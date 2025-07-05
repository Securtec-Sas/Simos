/** crea todo el crud para symbol */
const Symbol = require('../data/dataBase/modelosBD/symbol.model');
const Exchange = require('../data/dataBase/modelosBD/exchange.model'); // Importar el modelo Exchange correctamente
const ccxt = require('ccxt');

// Obtener todos los símbolos
exports.getSymbols = async (req, res) => {
  try {
    const symbols = await Symbol.find();
    res.json(symbols);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Obtener un símbolo por ID
exports.getSymbolById = async (req, res) => { // El ID aquí es el id_sy
  try {
    // Búsqueda por id_sy en lugar de _id de MongoDB, que es más útil
    const symbol = await Symbol.findOne({ id_sy: req.params.id_sy });
    if (symbol == null) {
      return res.status(404).json({ message: 'No se encontró el símbolo' });
    }
    res.json(symbol);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

<<<<<<< HEAD
exports.addSymbolsForExchange = async (req, res) => {
  try {
    console.log(`Iniciando proceso para agregar símbolos de exchanges activos...`);
    let symbolsAddedCount = 0;
    const errors = [];

    // 1. Obtener de la BD la lista de exchanges que están activos y son de tipo ccxt
    const activeDbExchanges = await Exchange.find({ isActive: true, connectionType: 'ccxt' });
    console.log(`Exchanges activos encontrados: ${activeDbExchanges.length}`);  
    if (activeDbExchanges.length === 0) {
      console.log("No se encontraron exchanges activos en la BD para procesar.");
      return res.status(200).json({ message: "No hay exchanges activos configurados para procesar." });
    }

    // 2. Iterar sobre los exchanges activos de la BD
    // 2. Iterar sobre los exchanges activos de la BD
for (const dbExchange of activeDbExchanges) {
  const exchangeId = await dbExchange.id_ex; // 'id_ex' es el ID del exchange en CCXT
  console.log(`Procesando exchange: ${exchangeId}`);

  try {
    // 3. Crear instancia de CCXT y cargar mercados
    if (!ccxt.hasOwnProperty(exchangeId)) {
      throw new Error(`CCXT no soporta el exchange: ${exchangeId}`);
    }
    // CORRECCIÓN: Instanciación dinámica usando notación de corchetes
    const exchange = new ccxt[exchangeId]();
    await exchange.loadMarkets(true); // Forzar recarga para obtener los datos más recientes
    const markets = exchange.markets;

    // 4. Iterar sobre los mercados del exchange
    for (const symbolKey in markets) {
      const market = markets[symbolKey];

      // 5. Filtrar por mercados spot, activos y con quote USDT
      if (market.spot && market.active && market.quote === 'USDT') {
          console.log(`Procesando símbolo: ${market.symbol} (${market.base}/${market.quote})`);
        // 6. Verificar si el símbolo ya existe en nuestra BD por su 'id_sy'
        const existingSymbol = await Symbol.findOne({ id_sy: market.symbol });
        if (existingSymbol) {
          console.log(`El símbolo ${market.symbol} y ${market.spot} ya existe en la BD. Omitiendo...`);
          continue; // Si ya existe, pasar al siguiente
        }

        // 7. Crear y guardar el nuevo símbolo
        const newSymbol = new Symbol({
          id_sy: market.symbol, // ej: 'BTC/USDT'
          name: market.base,    // ej: 'BTC'
        });
        await newSymbol.save();
        symbolsAddedCount++;
      }
    }
  } catch (err) {
    const errorMessage = `Error procesando exchange ${exchangeId}: ${err.message}`;
    console.error(errorMessage);
    errors.push({ exchange: exchangeId, error: err.message });
  }
}
=======
/*
// exports.addSymbolsForExchange = async (req, res) => {
//   try {
//     console.log(`Agregando símbolos para el exchange...`);
//     const exchanges = ccxt.exchanges; // Obtiene la configuración de los exchanges activos
//     for (const ex of exchanges) {
//       // Itera sobre cada exchange
//       // ERROR: ex es un string, ex.id_ex no existe. Debería ser ex.
//       // ERROR: La variable 'exchange' no está definida para exchange.symbols
//       // ERROR: Symbol.findById(symbol.id_sy) espera ObjectId, no string.
//       // ERROR: Campos de symbolAdd incorrectos para el mercado CCXT (symbol.symbol, symbol.base)
//       // ERROR: No hay respuesta al cliente en caso de éxito dentro del try, ni en el catch.
//       if(exc = await Exchange.findOne({ id_ex: ex })) { // Corregido ex.id_ex a ex
//         if(exc.isActive) {
//           console.log(`Exchange ${ex} está activo. Intentando obtener símbolos...`);
//           // Aquí necesitarías instanciar el exchange con CCXT y cargar mercados
//           // const ccxtInstance = new ccxt[ex]();
//           // await ccxtInstance.loadMarkets();
//           // const markets = ccxtInstance.markets;
//           // for (const marketId in markets) {
//           //   const market = markets[marketId];
//           //   if (await Symbol.findOne({ id_sy: market.symbol }) ) continue;
//           //   if(!market.spot || !market.active || !market.symbol.endsWith('/USDT')) continue;
//           //   const symbolAdd = new Symbol({
//           //     id_sy: market.symbol,
//           //     name: market.base,
//           //   });
//           //   await symbolAdd.save();
//           // }
//         }
//       }
//   }
//     console.log(`Símbolos agregados para el exchange`);
//     // Este res.status(200) está fuera del try y no se alcanzará si hay error antes.
//     res.status(200).json({ message: `Símbolos agregados para los exchanges` });
//   } catch (err) {
//     console.error(`Error al agregar símbolos para el exchange:`, err);
//     // Debería haber un res.status(500).json(...) aquí
//   }
// };
*/
>>>>>>> jules/multi-fixes-optimizations

const successMessage = `Proceso completado. Símbolos nuevos agregados: ${symbolsAddedCount}.`;
console.log(successMessage);
res.status(200).json({
  message: successMessage,
  errors: errors
});

} catch (err) {
  const criticalError = `Error crítico en addSymbolsForExchange: ${err.message}`;
  console.error(criticalError);
  res.status(500).json({ message: criticalError });
}
};

// Crear un nuevo símbolo
exports.createSymbol = async (req, res) => {
<<<<<<< HEAD
  // Los campos deben coincidir con el modelo: id_sy y name
  const { id_sy, name } = req.body;
  if (!id_sy || !name) {
    return res.status(400).json({ message: "Los campos 'id_sy' y 'name' son requeridos." });
  }

  try {
    const symbol = new Symbol({ id_sy, name });
    const newSymbol = await symbol.save();
    res.status(201).json(newSymbol);
  } catch (err) {
    if (err.code === 11000) { // Error de clave duplicada
      return res.status(409).json({ message: `El símbolo con id_sy '${id_sy}' ya existe.` });
    }
    res.status(400).json({ message: err.message });
=======
  // Asumimos que el cuerpo de la solicitud contendrá id_sy y name
  const { id_sy, name } = req.body;

  if (!id_sy || !name) {
    return res.status(400).json({ message: 'Los campos id_sy y name son requeridos.' });
  }

  try {
    // Verificar si el símbolo ya existe por id_sy para evitar duplicados
    let existingSymbol = await Symbol.findOne({ id_sy: id_sy });
    if (existingSymbol) {
      return res.status(409).json({ message: `El símbolo con id_sy '${id_sy}' ya existe.`, symbol: existingSymbol });
    }

    const symbol = new Symbol({
      id_sy: id_sy,
      name: name,
    });
    const newSymbol = await symbol.save();
    res.status(201).json(newSymbol);
  } catch (err) {
    // Manejar errores de validación de Mongoose u otros
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'Error de validación.', errors: err.errors });
    }
    res.status(500).json({ message: err.message });
>>>>>>> jules/multi-fixes-optimizations
  }
};

// Actualizar un símbolo (identificado por su _id de MongoDB)
exports.updateSymbol = async (req, res) => {
  const { id_sy } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: "El campo 'name' es requerido para la actualización." });
  }

  try {
<<<<<<< HEAD
    // Usar findOneAndUpdate para buscar por id_sy y actualizar atómicamente
    const updatedSymbol = await Symbol.findOneAndUpdate(
      { id_sy: id_sy },
      { name: name },
      { new: true, runValidators: true } // Devuelve el doc actualizado y corre validaciones
    );

    if (!updatedSymbol) {
      return res.status(404).json({ message: 'No se encontró el símbolo' });
    }

=======
    // Los campos actualizables serían 'name' o quizás 'id_sy' (aunque cambiar id_sy podría ser problemático)
    // Por ahora, permitimos actualizar 'name'. Si se actualiza 'id_sy', se debe asegurar unicidad.
    const { name, id_sy } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (id_sy) {
        // Si se intenta cambiar id_sy, verificar que no exista ya uno con el nuevo id_sy
        // a menos que sea el mismo documento.
        const existingSymbolWithNewIdSy = await Symbol.findOne({ id_sy: id_sy, _id: { $ne: req.params.id } });
        if (existingSymbolWithNewIdSy) {
            return res.status(409).json({ message: `Otro símbolo ya existe con id_sy '${id_sy}'.`});
        }
        updateData.id_sy = id_sy;
    }


    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No se proporcionaron datos para actualizar." });
    }

    const updatedSymbol = await Symbol.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });

    if (!updatedSymbol) {
      return res.status(404).json({ message: 'No se encontró el símbolo para actualizar.' });
    }
>>>>>>> jules/multi-fixes-optimizations
    res.json(updatedSymbol);
  } catch (err) {
    if (err.name === 'ValidationError') {
        return res.status(400).json({ message: 'Error de validación al actualizar.', errors: err.errors });
    }
    res.status(500).json({ message: err.message });
  }
};

<<<<<<< HEAD
// Eliminar un símbolo por su id_sy
=======
// Eliminar un símbolo por su _id de MongoDB
>>>>>>> jules/multi-fixes-optimizations
exports.deleteSymbol = async (req, res) => {
  const { id_sy } = req.params;
  try {
<<<<<<< HEAD
    // Usar deleteOne y buscar por id_sy
    const result = await Symbol.deleteOne({ id_sy: id_sy });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'No se encontró el símbolo' });
    }

    res.json({ message: 'Símbolo eliminado' });
=======
    const deletedSymbol = await Symbol.findByIdAndDelete(req.params.id);
    if (!deletedSymbol) {
      return res.status(404).json({ message: 'No se encontró el símbolo para eliminar.' });
    }
    // Considerar si se deben eliminar también las entradas relacionadas en ExchangeSymbol
    // await ExchangeSymbol.deleteMany({ symbolId: req.params.id });
    res.json({ message: 'Símbolo eliminado exitosamente.', deletedSymbol });
>>>>>>> jules/multi-fixes-optimizations
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
