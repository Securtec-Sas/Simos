const ccxt = require('ccxt');
const { EXCHANGES } = require('../utils/config'); // This might be unused if EXCHANGES is only for the old file based config
// const fs = require('fs').promises; // No longer needed for config
// const path = require('path'); // No longer needed for config paths

// Imports for DB access
const { readExchangeConfig } = require('./spotController');
const Exchange = require('../data/dataBase/modelosBD/exchange.model');

// DATA_DIR and CONFIG_FILE_PATH are removed as they are no longer used for exchange config.
// ensureDataDirExists, local readExchangeConfig, and writeExchangeConfig are removed.

// Función para inicializar un exchange con ccxt
const initializeExchange = (exchangeId) => {
    try {
        // Asegúrate de que el ID del exchange es válido para ccxt
        if (!ccxt.exchanges.includes(exchangeId)) {
            console.warn(`[${exchangeId}] no es un ID de exchange válido para ccxt.`);
            return null;
        }

        // Crear una instancia del exchange. Puedes añadir claves API aquí si las tienes.
        // Por ejemplo:
        // const api_key = process.env[\`\${exchangeId.toUpperCase()}_API_KEY\`];
        // const secret = process.env[\`\${exchangeId.toUpperCase()}_SECRET\`];
        //
        // const exchangeConfig = {
        //     'apiKey': api_key,
        //     'secret': secret,
        //     'timeout': 10000, // Tiempo de espera para la respuesta
        //     'enableRateLimit': true, // Habilitar la gestión de límites de tasa
        // };
        //
        // return new ccxt[exchangeId](exchangeConfig);

        // Para este ejemplo, solo inicializamos sin credenciales para probar conectividad pública
        return new ccxt[exchangeId]({
            'timeout': 10000,
            'enableRateLimit': true,
        });

    } catch (error) {
        console.error(`Error inicializando exchange ${exchangeId}: ${error.message}`);
        return null;
    }
};

// Helper function to get status and price for a single exchange
// ensureDataDirExists, local readExchangeConfig, and writeExchangeConfig have been removed.
const getSingleExchangeStatusAndPrice = async (exchangeId, exchangeNameProvided) => { //NOSONAR
    const result = {
        id: exchangeId,
        name: exchangeNameProvided || (exchangeId.charAt(0).toUpperCase() + exchangeId.slice(1)), // Use provided name or derive from ID
        connected: false,
        error: null
    };

    const exchange = initializeExchange(exchangeId);

    if (!exchange) {
        result.error = `Failed to initialize ccxt for ${result.name}. Check if ID is correct or if ccxt supports it.`;
        return result;
    }

    try {
        // Intentar cargar los mercados para verificar conectividad básica
        await exchange.loadMarkets();
        result.connected = true;

    } catch (e) {
        result.connected = false;
        result.error = e.message;
        // console.error(`Error fetching data for ${result.name}: ${e.message}`);
    }
    return result;
};

// Función para obtener el estado y el precio de un exchange (used by getExchangesStatus)
const getExchangeStatusAndPrice = async (exchangeId, exchangeName) => {
    // This function now can use the common helper
    return getSingleExchangeStatusAndPrice(exchangeId, exchangeName);
};

// Endpoint para obtener el estado de todos los exchanges
const getExchangesStatus = async (req, res) => {
    const statusPromises = EXCHANGES.map(ex => getSingleExchangeStatusAndPrice(ex.id, ex.name));
    const allExchangesStatus = await Promise.allSettled(statusPromises); //NOSONAR

    const formattedResults = allExchangesStatus.map(promiseResult => {
        if (promiseResult.status === 'fulfilled') {
            return promiseResult.value;
        } else {
            // Esto debería ser manejado por el catch dentro de getExchangeStatusAndPrice,
            // pero es un fallback en caso de error Promise.allSettled
            return {
                id: 'unknown',
                name: 'Unknown Exchange',
                connected: false,
                error: promiseResult.reason ? promiseResult.reason.message : 'Unknown error'
            };
        }
    });

    res.json(formattedResults);
};

// (Original getAvailableExchanges is replaced by getConfiguredExchanges)
// const getAvailableExchanges = (req, res) => { ... };

// New function to get configured and all ccxt exchanges
const getConfiguredExchanges = async (req, res) => {
  try {
    const ccxtExchangeIds = ccxt.exchanges;
    // Llamar a la función refactorizada que lee de la BD
    let configuredExchangesFromDB = await readExchangeConfig();

    const configuredMap = new Map(configuredExchangesFromDB.map(ex => [ex.id_ex, ex]));

    const finalExchangeList = [];

    configuredExchangesFromDB.forEach(confEx => {
      finalExchangeList.push({
        id: confEx.id_ex, // Mapear id_ex a id
        name: confEx.name,
        isActive: confEx.isActive,
        isCoreExchange: confEx.isCoreExchange,
        connectionType: confEx.connectionType,
        conexion: confEx.conexion, // Este campo viene de la BD? El modelo Exchange lo tiene.
        ccxtSupported: ccxtExchangeIds.includes(confEx.id_ex)
      });
    });

    ccxtExchangeIds.forEach(id_ccxt => {
      if (!configuredMap.has(id_ccxt)) {
        finalExchangeList.push({
          id: id_ccxt,
          name: id_ccxt.charAt(0).toUpperCase() + id_ccxt.slice(1),
          isActive: false,
          isCoreExchange: false,
          connectionType: 'ccxt',
          conexion: false,
          ccxtSupported: true
        });
      }
    });

    finalExchangeList.sort((a, b) => a.name.localeCompare(b.name));
    res.json(finalExchangeList);

  } catch (error) {
    console.error('Error fetching configured exchanges (DB source):', error);
    res.status(500).json({ error: 'Failed to retrieve list of exchanges.' });
  }
};






// Endpoint to get status for a single exchange by ID
const getExchangeStatusById = async (req, res) => {
  const { exchangeId } = req.params; // Este es el id_ex de CCXT
  if (!exchangeId) {
    return res.status(400).json({ error: 'Exchange ID is required.' });
  }

  try {
    const allExchangeConfigsFromDB = await readExchangeConfig(); // Usa la función que lee de la BD
    const exchangeConfig = allExchangeConfigsFromDB.find(ex => ex.id_ex === exchangeId);

    const exchangeName = exchangeConfig ? exchangeConfig.name : (exchangeId.charAt(0).toUpperCase() + exchangeId.slice(1));

    if (!exchangeConfig || exchangeConfig.connectionType !== 'ccxt') {
      // La función updateExchangeConexionStatus será refactorizada después para usar BD.
      // El 'await' es previendo que sea async en el futuro.
      await updateExchangeConexionStatus(exchangeId, false);

      let errorMessage = `Exchange '${exchangeName}' no está configurado para conexión CCXT en la base de datos.`;
      if (!exchangeConfig) {
        errorMessage = `Exchange '${exchangeName}' (ID: ${exchangeId}) no encontrado en la base de datos de configuración.`;
      }

      console.warn(errorMessage);
      return res.json({
        id: exchangeId,
        name: exchangeName,
        connected: false,
        error: errorMessage
      });
    }

    const status = await getSingleExchangeStatusAndPrice(exchangeId, exchangeName);

    await updateExchangeConexionStatus(exchangeId, status.connected);

    res.json(status);

  } catch (error) {
    console.error(`Error en getExchangeStatusById para ${exchangeId}:`, error);
    res.status(500).json({
      id: exchangeId,
      name: exchangeId.charAt(0).toUpperCase() + exchangeId.slice(1), // Fallback name
      connected: false,
      error: 'Ocurrió un error inesperado en el servidor al obtener el estado.'
    });
  }
};

// Endpoint to update the active status of an exchange
const updateExchangeActiveStatus = async (req, res) => {
  const { exchangeId, isActive, exchangeName } = req.body; // exchangeName es opcional, usado si se crea nuevo

  if (typeof exchangeId === 'undefined' || typeof isActive === 'undefined') {
    return res.status(400).json({ error: 'exchangeId (id_ex de CCXT) e isActive son requeridos.' });
  }

  try {
    const updatedExchange = await Exchange.findOneAndUpdate(
      { id_ex: exchangeId }, // Condición de búsqueda
      { $set: { isActive: isActive } }, // Campos a actualizar
      { new: true, runValidators: true } // Opciones: devolver el nuevo doc, correr validadores del esquema
    );

    if (!updatedExchange) {
      return res.status(404).json({
        error: `Exchange con id '${exchangeId}' no encontrado en la base de datos. No se pudo actualizar estado.`
      });
    }

    res.json({
      success: true,
      message: `Exchange ${exchangeId} active status updated to ${isActive}.`,
      data: updatedExchange
    });

  } catch (error) {
    console.error('Error actualizando el estado activo del exchange en la BD:', error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: "Error de validación", errors: error.errors });
    }
    res.status(500).json({ error: 'Falló la actualización del estado activo del exchange.' });
  }
};

// Nueva función para actualizar el campo "conexion" en la BD
const updateExchangeConexionStatus = async (exchangeId, status) => {
  // exchangeId es el id_ex de CCXT, status es un booleano
  if (typeof exchangeId === 'undefined' || typeof status === 'undefined') {
    console.error('V2_updateExchangeConexionStatus: exchangeId y status son requeridos.');
    return; // No se puede proceder
  }

  try {
    const updatedExchange = await Exchange.findOneAndUpdate(
      { id_ex: exchangeId },
      { $set: { conexion: status } },
      { new: true, runValidators: true } // new:true es opcional aquí si no usamos el resultado
    );

    if (!updatedExchange) {
      console.warn(`V2_updateExchangeConexionStatus: No se encontró el exchange con id_ex '${exchangeId}' en la BD para actualizar estado de conexión.`);
    } else {
      // console.log(`V2_updateExchangeConexionStatus: Estado de conexión para ${exchangeId} actualizado a ${status} en la BD.`);
    }
  } catch (error) {
    console.error(`V2_updateExchangeConexionStatus: Error actualizando estado de conexión para ${exchangeId} en la BD:`, error);
  }
};

const getWithdrawalFees = async (req, res) => {
  const { exchangeId, currencyCode } = req.params;

  if (!ccxt.exchanges.includes(exchangeId)) {
    return res.status(400).json({ message: `Exchange ID '${exchangeId}' is not supported by CCXT or is invalid.` });
  }

  try {
    const exchange = new ccxt[exchangeId]();
    // No es estrictamente necesario tener API keys para fetchCurrencies en la mayoría de los exchanges,
    // pero si se requieren para alguno en particular, esta llamada fallará o devolverá datos limitados.

    await exchange.loadMarkets(); // Es buena práctica para asegurar que todo esté cargado, incluyendo currencies.

    if (!exchange.currencies || Object.keys(exchange.currencies).length === 0) {
         // Algunos exchanges podrían necesitar fetchCurrencies() explícitamente si loadMarkets no las llena siempre.
        if (exchange.has['fetchCurrencies']) {
            await exchange.fetchCurrencies();
        } else {
            return res.status(500).json({ message: `Exchange '${exchangeId}' does not provide currency data through common methods.`});
        }
    }

    const upperCurrencyCode = currencyCode.toUpperCase();
    const currencyInfo = exchange.currencies[upperCurrencyCode];

    if (!currencyInfo) {
      return res.status(404).json({ message: `Currency code '${upperCurrencyCode}' not found or not supported by exchange '${exchangeId}'.` });
    }

    const networks = currencyInfo.networks;
    const resultNetworks = [];

    if (networks && Object.keys(networks).length > 0) {
      for (const [networkCode, networkData] of Object.entries(networks)) {
        resultNetworks.push({
          network: networkCode.toUpperCase(), // Nombre de la red (e.g., ERC20, TRC20, BEP20)
          currency: upperCurrencyCode,
          fee: networkData.fee,
          precision: networkData.precision, // Precisión para el fee y monto de retiro
          active: networkData.active !== false, // Considerar activa si no está explícitamente inactiva
          deposit: networkData.deposit === true,
          withdraw: networkData.withdraw === true,
          // Incluir límites si están disponibles y son útiles
          // limits: networkData.limits
        });
      }
    } else if (currencyInfo.fee !== undefined) {
        // Fallback si no hay estructura 'networks' pero sí un 'fee' directo en la moneda (menos común para retiros)
        // Este fee podría ser ambiguo (¿trading, depósito, retiro?). Usualmente 'networks' es más específico para retiros.
        // Para ser más precisos, podríamos optar por devolver un array vacío o un mensaje si 'networks' no está.
        // O, si se asume que este 'fee' es de retiro:
        resultNetworks.push({
            network: 'DEFAULT', // O dejarlo como null/undefined
            currency: upperCurrencyCode,
            fee: currencyInfo.fee,
            precision: currencyInfo.precision,
            active: true, // Asumir activo si no hay más info
            deposit: true, // Asumir si no hay más info
            withdraw: true, // Asumir si no hay más info
        });
    }
    // Si resultNetworks está vacío, significa que no se encontró información de fees de retiro estructurada.
    if (resultNetworks.length === 0) {
        return res.status(404).json({ message: `No specific withdrawal network fee information found for ${upperCurrencyCode} on ${exchangeId}. The currency might be listed but withdrawal details are unavailable or it uses a general fee not detailed per network.` });
    }

    res.status(200).json({
      exchange: exchangeId,
      currency: upperCurrencyCode,
      networks: resultNetworks
    });

  } catch (error) {
    console.error(`Error fetching withdrawal fees for ${currencyCode} on ${exchangeId}:`, error);
    // CCXT puede lanzar errores específicos que podríamos querer manejar de forma diferente
    if (error instanceof ccxt.NetworkError) {
      res.status(503).json({ message: `Network error connecting to ${exchangeId}.`, error: error.message });
    } else if (error instanceof ccxt.ExchangeError) {
      res.status(502).json({ message: `Error from exchange ${exchangeId}.`, error: error.message });
    } else {
      res.status(500).json({ message: "An internal server error occurred while fetching withdrawal fees.", error: error.message });
    }
  }
};

const getLowestFeeNetwork = async (id_sell, id_buy, symbol) => {
  try {
    const ccxt = require('ccxt');

    // Initialize exchanges
    const sellExchange = new ccxt[id_sell]();
    const buyExchange = new ccxt[id_buy]();

    // Load markets for both exchanges
    await sellExchange.loadMarkets();
    await buyExchange.loadMarkets();

    // Get currency info for symbol on both exchanges
    const sellMarket = sellExchange.markets[symbol];
    const buyMarket = buyExchange.markets[symbol];

    if (!sellMarket || !buyMarket) {
      throw new Error('Symbol not found on one or both exchanges');
    }

    // Get networks for the base currency (symbol split by '/')
    const baseCurrency = symbol.split('/')[0];

    const sellCurrencies = sellExchange.currencies[baseCurrency];
    const buyCurrencies = buyExchange.currencies[baseCurrency];

    if (!sellCurrencies || !buyCurrencies) {
      throw new Error('Base currency info not found on one or both exchanges');
    }

    // Networks info
    const sellNetworks = sellCurrencies.networks || {};
    const buyNetworks = buyCurrencies.networks || {};

    // Find common networks
    const commonNetworks = Object.keys(sellNetworks).filter(network => network in buyNetworks);

    if (commonNetworks.length === 0) {
      throw new Error('No common networks found between exchanges for this symbol');
    }

    // Find network with lowest combined fee
    let lowestFee = Number.MAX_VALUE;
    let bestNetwork = null;

    for (const network of commonNetworks) {
      const sellFee = sellNetworks[network].fee || Number.MAX_VALUE;
      const buyFee = buyNetworks[network].fee || Number.MAX_VALUE;
      const totalFee = sellFee + buyFee;

      if (totalFee < lowestFee) {
        lowestFee = totalFee;
        bestNetwork = network;
      }
    }

    return { commission: lowestFee, network: bestNetwork };

  } catch (error) {
    console.error('Error in getLowestFeeNetwork:', error.message);
    return { commission: null, network: null, error: error.message };
  }
};

module.exports = {
    getExchangesStatus,
    // getAvailableExchanges, // Replaced
    getConfiguredExchanges,
    getExchangeStatusById,
    updateExchangeActiveStatus,
    getWithdrawalFees, // Placeholder, will be defined below
    getLowestFeeNetwork,
};


