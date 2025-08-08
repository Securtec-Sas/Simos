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
  }
};

// Actualizar un símbolo
exports.updateSymbol = async (req, res) => {
  const { id_sy } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: "El campo 'name' es requerido para la actualización." });
  }

  try {
    // Usar findOneAndUpdate para buscar por id_sy y actualizar atómicamente
    const updatedSymbol = await Symbol.findOneAndUpdate(
      { id_sy: id_sy },
      { name: name },
      { new: true, runValidators: true } // Devuelve el doc actualizado y corre validaciones
    );

    if (!updatedSymbol) {
      return res.status(404).json({ message: 'No se encontró el símbolo' });
    }

    res.json(updatedSymbol);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Eliminar un símbolo por su id_sy
exports.deleteSymbol = async (req, res) => {
  const { id_sy } = req.params;
  try {
    // Usar deleteOne y buscar por id_sy
    const result = await Symbol.deleteOne({ id_sy: id_sy });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'No se encontró el símbolo' });
    }

    res.json({ message: 'Símbolo eliminado' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
