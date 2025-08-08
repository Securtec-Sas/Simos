// d:\ProyectosTrade\simo\sebo\src\server\controllers\spotController.js
const ccxt = require('ccxt'); // Keep ccxt
// const fs = require('fs').promises; // fs is no longer used
// const path = require('path'); // path is no longer used
const { Analysis, Symbol, ExchangeSymbol, Exchange } = require('../data/dataBase/connectio'); // Keep

// NUEVAS IMPORTACIONES:
// Assuming these controllers export their core logic functions, not just Express handlers
// If they are Express handlers, spotController cannot call them directly.
// For this subtask, we'll assume direct function calls are intended,
// implying dbController and analizerController might need refactoring later
// or these imports refer to specific logic functions exported from them.
// const { addExchangesSymbols } = require('./dbController');
// const { analyzeSymbols } = require('./analizerController');
// For now, as per prompt, these will be conceptual calls within handleSpotAnalysisRequest

// Define data directory and file paths - DATA_DIR and SPOT_COINS_FILE_PATH to be removed
// const DATA_DIR = path.join(__dirname, '..', 'data');
// const SPOT_COINS_FILE_PATH = path.join(DATA_DIR, 'spot_usdt_coins.json');

// Helper to read exchange config (NOW FROM DB)
const readExchangeConfig = async () => {
  try {
    const exchangesFromDB = await Exchange.find({}).lean();
    // console.log("Sebo: Configuración de exchanges leída desde la BD.");
    return exchangesFromDB;
  } catch (error) {
    console.error('Sebo: Error leyendo la configuración de exchanges desde la BD:', error);
    return []; // Devolver array vacío en caso de error para mantener consistencia
  }
};

// readSpotCoinsFileHelper and writeSpotCoinsFile are removed.

const handleSpotAnalysisRequest = async (req, res) => {
  console.log('Sebo: Iniciando proceso de análisis completo de mercados spot y persistencia en BD...');
  try {
    // Paso 1 y 2 conceptuales: La lógica real de addExchangesSymbols y analyzeSymbols
    // necesitaría ser invocable aquí, o sus endpoints llamados secuencialmente.
    // Por ahora, este endpoint actúa como un disparador/notificador.
    // La refactorización para llamadas directas de lógica de negocio es un paso más profundo.

    let message = "Proceso de análisis iniciado. ";
    let errors = [];

    // Simulación o placeholder para la lógica real:
    // Idealmente, se importan funciones de lógica de negocio de dbController y analizerController
    // y se llaman aquí. Ejemplo:
    // const symbolUpdateResult = await require('./dbController').updateSymbolsAndPricesLogic();
    // const analysisResult = await require('./analizerController').performAnalysisLogic();
    // message += `Actualización de símbolos: ${symbolUpdateResult.message}. Análisis: ${analysisResult.message}.`;

    // Como esto no es trivial sin refactorizar los otros controladores para exportar su lógica de negocio,
    // mantenemos el mensaje placeholder como se indica en el prompt de la subtarea.
    message += " (Simulación: addExchangesSymbols y analyzeSymbols deberían ser invocados para actualizar la BD).";
    console.log("Sebo: handleSpotAnalysisRequest completado (simulado). La lógica real de llamadas a dbController y analizerController debe ser implementada si se requiere orquestación directa.");

    // Si hubiera errores en las llamadas (no simuladas) a la lógica de negocio:
    // if (symbolUpdateResult.error) errors.push(symbolUpdateResult.error);
    // if (analysisResult.error) errors.push(analysisResult.error);

    if (errors.length > 0) {
        throw new Error(errors.join("; "));
    }

    res.status(200).json({
      message: "Sebo: Proceso de análisis de spot (actualización de BD) orquestado. " + message,
    });

  } catch (error) {
    console.error("Sebo: Error crítico durante el handleSpotAnalysisRequest:", error);
    res.status(500).json({ message: "Sebo: Error crítico durante el análisis de spot.", error: error.message });
  }
};

const getTopOpportunitiesFromDB = async (limit = 20) => {
  try {
    const opportunities = await Analysis.find({})
      .sort({ promedio: -1 }) // Sort by 'promedio' descending
      .limit(limit)
      .populate({
        path: 'symbolId',
        select: 'id_sy name' // Select specific fields from Symbol
      })
      .populate({
        path: 'id_exsyMin',
        select: 'Val_sell exchangeId',
        populate: {
          path: 'exchangeId',
          select: 'id_ex name'
        }
      })
      .populate({
        path: 'id_exsyMax',
        select: 'Val_buy exchangeId',
        populate: {
          path: 'exchangeId',
          select: 'id_ex name'
        }
      })
      .exec();

    if (!opportunities) {
      return [];
    }

    const formattedOpportunities = opportunities.map(op => {
      if (!op.symbolId || !op.id_exsyMin || !op.id_exsyMax || !op.id_exsyMin.exchangeId || !op.id_exsyMax.exchangeId) {
        return null;
      }

      return {
        symbol: op.symbolId.id_sy,
        name: op.symbolId.name,
        exchanges: [op.id_exsyMin.exchangeId.id_ex, op.id_exsyMax.exchangeId.id_ex].sort(),
        valores: {
          exValMin: op.id_exsyMin.exchangeId.id_ex,
          exValMax: op.id_exsyMax.exchangeId.id_ex,
          valMin: op.Val_sell,
          valMax: op.Val_buy,
          difer: op.promedio != null ? op.promedio.toFixed(2) + '%' : "N/A"
        }
      };
    }).filter(op => op !== null);

    return formattedOpportunities;

  } catch (error) {
    console.error("Error fetching top opportunities from DB:", error);
    throw error;
  }
};

const getTopSpotOpportunities = async (req, res) => {
  try {
    const topOpportunities = await getTopOpportunitiesFromDB();
    if (!topOpportunities || topOpportunities.length === 0) {
      return res.status(200).json([]);
    }
    res.status(200).json(topOpportunities);
  } catch (error) {
    console.error("Error in getTopSpotOpportunities (DB):", error);
    res.status(500).json({
      message: "Failed to retrieve top spot opportunities from the database.",
    });
  }
};

// handleSpotExchangePrice is removed.

module.exports = {
    handleSpotAnalysisRequest,
    getTopSpotOpportunities,
    // readSpotCoinsFileHelper, // Removed
    // handleSpotExchangePrice, // Removed
    getTopOpportunitiesFromDB,
    readExchangeConfig,
};