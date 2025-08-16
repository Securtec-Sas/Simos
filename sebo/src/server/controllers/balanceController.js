const Balance = require('../data/dataBase/modelosBD/balance.model');
const OperationBalance = require('../data/dataBase/modelosBD/operationBalance.model');

// ============================================
// CONTROLADORES PARA BALANCE ORIGINAL (Legacy)
// ============================================

// Crear un nuevo registro de balance
exports.createBalance = async (req, res) => {
  try {
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
    const balances = await Balance.find().sort({ timestamp: -1 }).lean();
    return balances;
  } catch (error) {
    console.error("Error fetching balance data internally:", error);
    return [];
  }
};
exports.getBalancesData = getBalancesData;

// Nueva función para obtener solo el último documento de balance
const getLatestBalanceDocument = async () => {
  try {
    const latestBalance = await Balance.findOne().sort({ timestamp: -1 }).lean();
    return latestBalance;
  } catch (error) {
    console.error("Error fetching latest balance document internally:", error);
    return null;
  }
};
exports.getLatestBalanceDocument = getLatestBalanceDocument;

// Obtener todos los registros de balance (handler de Express)
exports.getAllBalances = async (req, res) => {
  try {
    const balances = await getBalancesData();
    res.status(200).json(balances);
  } catch (error) {
    res.status(500).json({ message: "Error fetching balance records", error: error.message });
  }
};

// Obtener un balance por id_exchange (más útil que por _id de MongoDB)
exports.getBalanceByExchange = async (req, res) => {
  try {
    const { exchangeId } = req.params;
    const balance = await Balance.findOne({ id_exchange: exchangeId }).sort({ timestamp: -1 });

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
    const balanceData = { ...req.body, timestamp: new Date() };
    const updatedBalance = await Balance.findByIdAndUpdate(balanceId, balanceData, { new: true, runValidators: true });
    if (!updatedBalance) {
      return res.status(404).json({ message: "Balance record not found." });
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

    if (updateData.id_exchange) {
      delete updateData.id_exchange;
    }
    if (updateData._id) {
        delete updateData._id;
    }

    const updatedBalance = await Balance.findOneAndUpdate(
      { id_exchange: exchangeId },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(200).json(updatedBalance);
  } catch (error) {
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

// ============================================
// CONTROLADORES PARA OPERATION BALANCE (Nuevo)
// ============================================

/**
 * Crear un nuevo balance de operación
 */
exports.createOperationBalance = async (req, res) => {
  try {
    const operationBalance = new OperationBalance(req.body);
    await operationBalance.save();
    res.status(201).json({
      success: true,
      data: operationBalance,
      message: 'Balance de operación creado exitosamente'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      message: 'Error al crear el balance de operación'
    });
  }
};

/**
 * Obtener balances separados por tipo para la página principal
 * Devuelve un resumen de balances por cada tipo de operación
 */
exports.getBalancesSeparatedByType = async (req, res) => {
  try {
    // Obtener totales por tipo de operación
    const [localTotals, sandboxTotals, realTotals] = await Promise.all([
      OperationBalance.getTotalBalanceByType('local'),
      OperationBalance.getTotalBalanceByType('sandbox'),
      OperationBalance.getTotalBalanceByType('real')
    ]);

    // Obtener balances primarios por tipo
    const [primaryLocal, primarySandbox, primaryReal] = await Promise.all([
      OperationBalance.getPrimaryBalance('local'),
      OperationBalance.getPrimaryBalance('sandbox'),
      OperationBalance.getPrimaryBalance('real')
    ]);

    // Formatear respuesta
    const balancesSummary = {
      local: {
        totals: localTotals[0] || {
          total_usdt: 0,
          total_balance: 0,
          total_profit_loss: 0,
          total_operations: 0,
          active_exchanges: 0
        },
        primary_balance: primaryLocal ? {
          exchange_id: primaryLocal.exchange_id,
          usdt_balance: primaryLocal.usdt_balance,
          total_balance: primaryLocal.total_balance,
          profit_loss: primaryLocal.total_profit_loss,
          operations_count: primaryLocal.total_operations
        } : null
      },
      sandbox: {
        totals: sandboxTotals[0] || {
          total_usdt: 0,
          total_balance: 0,
          total_profit_loss: 0,
          total_operations: 0,
          active_exchanges: 0
        },
        primary_balance: primarySandbox ? {
          exchange_id: primarySandbox.exchange_id,
          usdt_balance: primarySandbox.usdt_balance,
          total_balance: primarySandbox.total_balance,
          profit_loss: primarySandbox.total_profit_loss,
          operations_count: primarySandbox.total_operations
        } : null
      },
      real: {
        totals: realTotals[0] || {
          total_usdt: 0,
          total_balance: 0,
          total_profit_loss: 0,
          total_operations: 0,
          active_exchanges: 0
        },
        primary_balance: primaryReal ? {
          exchange_id: primaryReal.exchange_id,
          usdt_balance: primaryReal.usdt_balance,
          total_balance: primaryReal.total_balance,
          profit_loss: primaryReal.total_profit_loss,
          operations_count: primaryReal.total_operations
        } : null
      }
    };

    res.status(200).json({
      success: true,
      data: balancesSummary,
      message: 'Balances separados por tipo obtenidos exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error al obtener los balances separados por tipo'
    });
  }
};

/**
 * Obtener todos los balances de un tipo específico
 * @param {string} tipo - Tipo de operación (local, sandbox, real)
 */
exports.getAllBalancesByType = async (req, res) => {
  try {
    const { tipo } = req.params;
    const { includeInactive = false } = req.query;

    // Validar tipo de operación
    const validTypes = ['local', 'sandbox', 'real'];
    if (!validTypes.includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: `Tipo de operación inválido. Debe ser uno de: ${validTypes.join(', ')}`,
        message: 'Tipo de operación no válido'
      });
    }

    // Construir filtros
    const filters = { operation_type: tipo };
    if (!includeInactive) {
      filters.is_active = true;
    }

    // Obtener balances
    const balances = await OperationBalance.find(filters)
      .sort({ is_primary: -1, total_balance: -1 })
      .lean();

    // Obtener totales
    const totals = await OperationBalance.getTotalBalanceByType(tipo);

    res.status(200).json({
      success: true,
      data: {
        operation_type: tipo,
        balances: balances,
        totals: totals[0] || {
          total_usdt: 0,
          total_balance: 0,
          total_profit_loss: 0,
          total_operations: 0,
          active_exchanges: 0
        },
        count: balances.length
      },
      message: `Balances de tipo '${tipo}' obtenidos exitosamente`
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error al obtener los balances por tipo'
    });
  }
};

/**
 * Obtener balance específico por tipo y exchange
 */
exports.getBalanceByTypeAndExchange = async (req, res) => {
  try {
    const { tipo, exchangeId } = req.params;

    const balance = await OperationBalance.findOne({
      operation_type: tipo,
      exchange_id: exchangeId
    });

    if (!balance) {
      return res.status(404).json({
        success: false,
        error: 'Balance no encontrado',
        message: `No se encontró balance para ${tipo} en ${exchangeId}`
      });
    }

    res.status(200).json({
      success: true,
      data: balance,
      message: 'Balance obtenido exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error al obtener el balance'
    });
  }
};

/**
 * Actualizar balance de operación
 */
exports.updateOperationBalance = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const balance = await OperationBalance.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!balance) {
      return res.status(404).json({
        success: false,
        error: 'Balance no encontrado',
        message: 'El balance solicitado no existe'
      });
    }

    res.status(200).json({
      success: true,
      data: balance,
      message: 'Balance actualizado exitosamente'
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      message: 'Error al actualizar el balance'
    });
  }
};

/**
 * Mover balance entre exchanges
 */
exports.moveBalance = async (req, res) => {
  try {
    const { fromExchange, toExchange, amount, operationType } = req.body;

    if (!fromExchange || !toExchange || !amount || !operationType) {
      return res.status(400).json({
        success: false,
        error: 'Faltan parámetros requeridos',
        message: 'Se requieren fromExchange, toExchange, amount y operationType'
      });
    }

    const result = await OperationBalance.moveBalance(
      fromExchange,
      toExchange,
      amount,
      operationType
    );

    res.status(200).json({
      success: true,
      data: result,
      message: `Balance movido exitosamente de ${fromExchange} a ${toExchange}`
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      message: 'Error al mover el balance'
    });
  }
};

/**
 * Inicializar balance para un tipo de operación
 */
exports.initializeBalance = async (req, res) => {
  try {
    const { operationType, exchangeId, initialAmount, isPrimary = false } = req.body;

    if (!operationType || !exchangeId || initialAmount === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Faltan parámetros requeridos',
        message: 'Se requieren operationType, exchangeId e initialAmount'
      });
    }

    const balance = await OperationBalance.initializeBalance(
      operationType,
      exchangeId,
      initialAmount,
      isPrimary
    );

    res.status(201).json({
      success: true,
      data: balance,
      message: 'Balance inicializado exitosamente'
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      message: 'Error al inicializar el balance'
    });
  }
};

/**
 * Obtener resumen general de todos los balances
 */
exports.getBalancesSummary = async (req, res) => {
  try {
    // Obtener totales por tipo
    const [localTotals, sandboxTotals, realTotals] = await Promise.all([
      OperationBalance.getTotalBalanceByType('local'),
      OperationBalance.getTotalBalanceByType('sandbox'),
      OperationBalance.getTotalBalanceByType('real')
    ]);

    // Calcular totales generales
    const grandTotals = {
      total_usdt: 0,
      total_balance: 0,
      total_profit_loss: 0,
      total_operations: 0,
      active_exchanges: 0
    };

    [localTotals[0], sandboxTotals[0], realTotals[0]].forEach(totals => {
      if (totals) {
        grandTotals.total_usdt += totals.total_usdt || 0;
        grandTotals.total_balance += totals.total_balance || 0;
        grandTotals.total_profit_loss += totals.total_profit_loss || 0;
        grandTotals.total_operations += totals.total_operations || 0;
        grandTotals.active_exchanges += totals.active_exchanges || 0;
      }
    });

    // Obtener balances más activos
    const mostActiveBalances = await OperationBalance.find({ is_active: true })
      .sort({ total_operations: -1 })
      .limit(5)
      .select('operation_type exchange_id total_operations total_profit_loss usdt_balance')
      .lean();

    res.status(200).json({
      success: true,
      data: {
        by_type: {
          local: localTotals[0] || { total_usdt: 0, total_balance: 0, total_profit_loss: 0, total_operations: 0, active_exchanges: 0 },
          sandbox: sandboxTotals[0] || { total_usdt: 0, total_balance: 0, total_profit_loss: 0, total_operations: 0, active_exchanges: 0 },
          real: realTotals[0] || { total_usdt: 0, total_balance: 0, total_profit_loss: 0, total_operations: 0, active_exchanges: 0 }
        },
        grand_totals: grandTotals,
        most_active_balances: mostActiveBalances,
        profitability_rate: grandTotals.total_balance > 0
          ? ((grandTotals.total_profit_loss / grandTotals.total_balance) * 100).toFixed(2) + '%'
          : '0%'
      },
      message: 'Resumen de balances obtenido exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error al obtener el resumen de balances'
    });
  }
};
