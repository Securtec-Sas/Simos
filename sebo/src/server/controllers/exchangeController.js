const ccxt = require('ccxt');
const { EXCHANGES } = require('../utils/config'); // This might be unused if EXCHANGES is only for the old file based config

// Imports for DB access
const { readExchangeConfig } = require('./spotController'); // Assuming this is the correct source for readExchangeConfig
const Exchange = require('../data/dataBase/modelosBD/exchange.model');

// CCXT Instance and Data Cache
const ccxtSharedInstances = {};
const ccxtSharedDataCache = {}; // { exchangeId: { markets: {}, currencies: {}, lastFetch: 0 } }
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes, ejemplo

async function getSharedCcxtInstance(exchangeId) {
    if (!ccxt.exchanges.includes(exchangeId)) {
        console.warn(`[${exchangeId}] no es un ID de exchange válido para ccxt.`);
        return null;
    }
    if (!ccxtSharedInstances[exchangeId]) {
        try {
            ccxtSharedInstances[exchangeId] = new ccxt[exchangeId]({
                timeout: 10000,
                enableRateLimit: true,
            });
        } catch (error) {
            console.error(`Error inicializando instancia compartida de CCXT para ${exchangeId}: ${error.message}`);
            return null;
        }
    }
    return ccxtSharedInstances[exchangeId];
}

async function loadSharedExchangeData(exchangeId, forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && ccxtSharedDataCache[exchangeId] && (now - ccxtSharedDataCache[exchangeId].lastFetch < CACHE_DURATION)) {
        return ccxtSharedDataCache[exchangeId];
    }

    const instance = await getSharedCcxtInstance(exchangeId);
    if (!instance) return null;

    let markets = null;
    let currencies = null;

    try {
        markets = await instance.loadMarkets();
    } catch (e) { console.error(`Error cargando markets para ${exchangeId} (compartido): ${e.message}`); }

    try {
        if (instance.has['fetchCurrencies']) {
            currencies = await instance.fetchCurrencies();
        } else if (instance.currencies) { // Fallback si fetchCurrencies no existe pero currencies sí
            currencies = instance.currencies;
        }
    } catch (e) { console.error(`Error cargando currencies para ${exchangeId} (compartido): ${e.message}`); }

    ccxtSharedDataCache[exchangeId] = { markets, currencies, lastFetch: now };
    return ccxtSharedDataCache[exchangeId];
}


// Helper function to get status for a single exchange
const getSingleExchangeStatusAndPrice = async (exchangeId, exchangeNameProvided) => { //NOSONAR
    const result = {
        id: exchangeId,
        name: exchangeNameProvided || (exchangeId.charAt(0).toUpperCase() + exchangeId.slice(1)),
        connected: false,
        error: null
    };

    const instance = await getSharedCcxtInstance(exchangeId);

    if (!instance) {
        result.error = `Failed to initialize shared ccxt for ${result.name}.`;
        return result;
    }

    try {
        // Intentar cargar los mercados (usará el caché si es reciente y loadMarkets fue exitoso previamente)
        const exchangeCacheData = await loadSharedExchangeData(exchangeId); // No forzar refresh aquí

        // La conexión se considera exitosa si `loadMarkets` dentro de `loadSharedExchangeData` tuvo éxito
        // y devolvió un objeto de mercados (incluso si está vacío).
        // Si `loadMarkets` falló, `exchangeCacheData.markets` será null o no definido.
        if (exchangeCacheData && typeof exchangeCacheData.markets === 'object' && exchangeCacheData.markets !== null) {
            result.connected = true;
        } else {
            result.connected = false;
            result.error = `Failed to load markets for ${result.name} via shared data loader.`;
            // Si se quiere más detalle del error original de loadMarkets,
            // loadSharedExchangeData tendría que propagarlo o almacenarlo.
        }
    } catch (e) {
        // Este catch es un fallback, la mayoría de los errores de CCXT deberían ser manejados dentro de loadSharedExchangeData
        result.connected = false;
        result.error = `Unexpected error checking status for ${result.name}: ${e.message}`;
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
    try {
        const configuredExchanges = await readExchangeConfig(); // Leer de la BD
        if (!configuredExchanges || configuredExchanges.length === 0) {
            return res.json([]); // No hay exchanges configurados para verificar
        }

        // Filtrar solo los que son 'ccxt'
        const ccxtExchangesToTest = configuredExchanges.filter(ex => ex.connectionType === 'ccxt');

        if (ccxtExchangesToTest.length === 0) {
            return res.json([]); // No hay exchanges CCXT para probar
        }
        // Usar ex.id_ex que es el ID de CCXT, y ex.name para el nombre.
        const statusPromises = ccxtExchangesToTest.map(ex => getSingleExchangeStatusAndPrice(ex.id_ex, ex.name));
        const allExchangesStatus = await Promise.allSettled(statusPromises);

        const formattedResults = allExchangesStatus.map(promiseResult => {
            if (promiseResult.status === 'fulfilled') {
                return promiseResult.value;
            } else {
                // Podríamos intentar obtener el ID del exchange del input original si es necesario
                // const originalInput = statusPromises.find(...)
                return {
                    id: 'unknown', // Considerar cómo obtener el ID original aquí si es posible y útil
                    name: 'Unknown Exchange',
                    connected: false,
                    error: promiseResult.reason ? promiseResult.reason.message : 'Unknown error'
                };
            }
        });
        res.json(formattedResults);
    } catch (error) {
        console.error("Error en getExchangesStatus al leer de la BD:", error);
        res.status(500).json({ error: "Error interno obteniendo estados de exchange." });
    }
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

module.exports = {
    getExchangesStatus,
    // getAvailableExchanges, // Replaced
    getConfiguredExchanges,
    getExchangeStatusById,
    updateExchangeActiveStatus,
    getWithdrawalFees: exports.getWithdrawalFees, // Placeholder, will be defined below
};

exports.getWithdrawalFees = async (req, res) => {
  const { exchangeId, currencyCode } = req.params;

  if (!ccxt.exchanges.includes(exchangeId)) {
    return res.status(400).json({ message: `Exchange ID '${exchangeId}' is not supported by CCXT or is invalid.` });
  }

  try {
    const instance = await getSharedCcxtInstance(exchangeId);
    if (!instance) {
      return res.status(500).json({ message: `Failed to get shared CCXT instance for ${exchangeId}.` });
    }

    // Usar datos cacheados. Forzar refresh si es necesario (ej. si los datos son muy viejos o se sospecha que cambiaron)
    // Por ahora, no forzamos refresh, confiamos en CACHE_DURATION.
    const exchangeCacheData = await loadSharedExchangeData(exchangeId);

    if (!exchangeCacheData || !exchangeCacheData.currencies) {
      return res.status(500).json({ message: `Currency data not available for ${exchangeId} via shared loader.` });
    }

    const upperCurrencyCode = currencyCode.toUpperCase();
    const currencyInfo = exchangeCacheData.currencies[upperCurrencyCode];

    if (!currencyInfo) {
      return res.status(404).json({ message: `Currency code '${upperCurrencyCode}' not found or not supported by exchange '${exchangeId}' (cached data).` });
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
// Re-exporting to ensure the function defined above is correctly assigned
module.exports.getWithdrawalFees = exports.getWithdrawalFees;
