const Balance = require('../data/dataBase/modelosBD/balance.model');

// Crear un nuevo registro de balance
exports.createBalance = async (req, res) => {
  try {
    // Opcional: Verificar si ya existe un balance para este exchange y actualizarlo en lugar de crear uno nuevo,
    // o permitir múltiples registros si se quiere un historial. Por ahora, creamos uno nuevo.
    // Si se quiere 'upsert' o 'update if exists, else create':
    // const { id_exchange, balance_usdt } = req.body;
    // const updatedBalance = await Balance.findOneAndUpdate(
    //   { id_exchange },
    //   { balance_usdt, timestamp: new Date() },
    //   { new: true, upsert: true, runValidators: true }
    // );
    // return res.status(201).json(updatedBalance);

    const newBalance = new Balance(req.body);
    await newBalance.save();
    res.status(201).json(newBalance);
  } catch (error) {
    res.status(400).json({ message: "Error creating balance record", error: error.message });
  }
};

// Función interna para obtener datos de balances
const getBalancesData = async () => {
  try {
    const balances = await Balance.find().sort({ timestamp: -1 }).lean(); // Usar .lean() para objetos JS planos si no se necesitan métodos de Mongoose
    return balances;
  } catch (error) {
    console.error("Error fetching balance data internally:", error);
    return []; // Devolver array vacío en caso de error
  }
};
exports.getBalancesData = getBalancesData; // Exportar para uso interno

// Nueva función para obtener solo el último documento de balance
const getLatestBalanceDocument = async () => {
  try {
    const latestBalance = await Balance.findOne().sort({ timestamp: -1 }).lean();
    return latestBalance; // Puede ser null si la colección está vacía
  } catch (error) {
    console.error("Error fetching latest balance document internally:", error);
    return null; // Devolver null en caso de error
  }
};
exports.getLatestBalanceDocument = getLatestBalanceDocument; // Exportar para uso interno

// Obtener todos los registros de balance (handler de Express)
exports.getAllBalances = async (req, res) => {
  try {
    const balances = await getBalancesData(); // Usar la función interna
    res.status(200).json(balances);
  } catch (error) {
    // getBalancesData ya maneja su propio error de log, aquí solo respondemos
    res.status(500).json({ message: "Error fetching balance records", error: error.message });
  }
};

// Obtener un balance por id_exchange (más útil que por _id de MongoDB)
exports.getBalanceByExchange = async (req, res) => {
  try {
    const { exchangeId } = req.params;
    // Si se quiere el más reciente para un exchange:
    const balance = await Balance.findOne({ id_exchange: exchangeId }).sort({ timestamp: -1 });
    // Si se quieren todos los registros para un exchange:
    // const balance = await Balance.find({ id_exchange: exchangeId }).sort({ timestamp: -1 });

    if (!balance) {
      return res.status(404).json({ message: "Balance record not found for this exchange." });
    }
    res.status(200).json(balance);
  } catch (error) {
    res.status(500).json({ message: "Error fetching balance record", error: error.message });
  }
};

// Actualizar un registro de balance (identificado por su _id de MongoDB)
exports.updateBalanceById = async (req, res) => {
  try {
    const { balanceId } = req.params;
    // Asegurarse de actualizar el timestamp
    const balanceData = { ...req.body, timestamp: new Date() };
    const updatedBalance = await Balance.findByIdAndUpdate(balanceId, balanceData, { new: true, runValidators: true });
    if (!updatedBalance) {
      return res.status(404).json({ message: "Balance record not found." });
    }

    if (updatedBalance) {
      const io = req.io;
      if (io) {
        const allBalances = await getBalancesData();
        const balancesMap = {};
        allBalances.forEach(balance => {
          if (balance.id_exchange) {
            balancesMap[String(balance.id_exchange)] = balance.toObject ? balance.toObject() : balance;
          }
        });
        const V3SeboNamespace = io.of('/api/spot/arb');
        V3SeboNamespace.emit('balances-update', balancesMap);
        console.log(`Socket event 'balances-update' emitted to /api/spot/arb after updateBalanceById`);
      }
    }
    res.status(200).json(updatedBalance);
  } catch (error) {
    res.status(400).json({ message: "Error updating balance record", error: error.message });
  }
};

// Actualizar balance por id_exchange (upsert: actualiza si existe, o crea si no existe)
exports.updateBalanceByExchange = async (req, res) => {
  try {
    const { exchangeId } = req.params;
    const updateData = { ...req.body, timestamp: new Date() };

    // Eliminar id_exchange del cuerpo si viene, ya que está en params y es la clave de búsqueda
    if (updateData.id_exchange) {
      delete updateData.id_exchange;
    }
    // No permitir que se actualice _id directamente
    if (updateData._id) {
        delete updateData._id;
    }

    const updatedBalance = await Balance.findOneAndUpdate(
      { id_exchange: exchangeId },
      { $set: updateData }, // Usar $set para actualizar solo los campos proporcionados en req.body
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    if (updatedBalance) {
      const io = req.io;
      if (io) {
        const allBalances = await getBalancesData(); // Reutiliza la función existente
        const balancesMap = {};
        allBalances.forEach(balance => {
          if (balance.id_exchange) {
            balancesMap[String(balance.id_exchange)] = balance.toObject ? balance.toObject() : balance;
          }
        });
        const V3SeboNamespace = io.of('/api/spot/arb');
        V3SeboNamespace.emit('balances-update', balancesMap);
        console.log(`Socket event 'balances-update' emitted to /api/spot/arb after updateByExchange`);
      }
    }
    res.status(200).json(updatedBalance);
  } catch (error) {
    // Capturar errores de validación de Mongoose
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: "Validation Error", errors: error.errors });
    }
    console.error(`Error upserting balance for ${req.params.exchangeId}:`, error);
    res.status(400).json({ message: "Error upserting balance record for exchange", error: error.message });
  }
};

// Eliminar un registro de balance (por _id de MongoDB)
exports.deleteBalanceById = async (req, res) => {
  try {
    const { balanceId } = req.params;
    const deletedBalance = await Balance.findByIdAndDelete(balanceId);
    if (!deletedBalance) {
      return res.status(404).json({ message: "Balance record not found." });
    }
    res.status(200).json({ message: "Balance record deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error deleting balance record", error: error.message });
  }
};
