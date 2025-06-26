/**
 * crea el crud para el modelo de analisis.model.js
 */

/**
 *  llama el metodo de symbolCotroller para obteer los todos los ids de los simbolos
 *  obten todos los datos de exchngeymbol para los simbolos uo por uno
 *  obten el valor mas bajo de db_sell y el valor mas alto de db_buy entre todos los exchanges de ese simbolo,
 * saca el porcentaje de diferencia entre esos dos valores, agrega los resultados a la tabla analysis: 
 * id_exsyMin: { type: mongoose.Schema.Types.ObjectId, ref: 'ExchangeSymbol' },
     id_exsyMax: { type: mongoose.Schema.Types.ObjectId, ref: 'ExchangeSymbol' },
     Val_buy: { type: Number, default: 0 },
     Val_sell: { type: Number, default: 0 },
     promedio: { type: Number, default: 0 },
     symbolId: { type: mongoose.Schema.Types.ObjectId, ref: 'Symbol', required: true },
     timestamp: { type: Date, default: Date.now }
 *  retorna la cantidad de documentos insertados
 */
const Analysis = require('../data/dataBase/modelosBD/analysis.model')
const ExchangeSymbol = require('../data/dataBase/modelosBD/exchangeSymbol.model');
const Symbol = require('../data/dataBase/modelosBD/symbol.model');
const ccxt = require('ccxt');

// Cachés para optimizar llamadas a CCXT
const ccxtInstances = {};
const exchangeDataCache = {}; // { exchangeId: { marketsLoaded: false, tradingFees: {}, currencies: {} } }

async function getExchangeInstance(exchangeId) {
    if (!ccxtInstances[exchangeId]) {
        try {
            const exchangeClass = ccxt[exchangeId];
            if (!exchangeClass) {
                throw new Error(`Exchange ${exchangeId} no es soportado por CCXT.`);
            }
            ccxtInstances[exchangeId] = new exchangeClass({ enableRateLimit: true });
        } catch (error) {
            console.error(`Error al instanciar CCXT para ${exchangeId}: ${error.message}`);
            throw error; // Re-lanzar para que el llamador maneje
        }
    }
    return ccxtInstances[exchangeId];
}

async function loadExchangeDataOnce(exchangeId) {
    if (exchangeDataCache[exchangeId] && exchangeDataCache[exchangeId].dataLoaded) {
        return exchangeDataCache[exchangeId];
    }

    const instance = await getExchangeInstance(exchangeId);
    let markets = null;
    let tradingFees = null;
    let currencies = null;
    let marketsLoadedSuccessfully = false;

    try {
        if (!exchangeDataCache[exchangeId] || !exchangeDataCache[exchangeId].marketsLoaded) {
            markets = await instance.loadMarkets();
            marketsLoadedSuccessfully = true;
        } else {
            markets = instance.markets; // Usar mercados ya cargados si existen en la instancia
        }
    } catch (e) { console.error(`Error loading markets for ${exchangeId}: ${e.message}`); }

    try {
        if (instance.has['fetchTradingFees']) {
            tradingFees = await instance.fetchTradingFees();
        }
    } catch (e) { console.error(`Error fetching trading fees for ${exchangeId}: ${e.message}`); }

    try {
        if (instance.has['fetchCurrencies']) {
            currencies = await instance.fetchCurrencies();
        }
    } catch (e) { console.error(`Error fetching currencies for ${exchangeId}: ${e.message}`); }

    exchangeDataCache[exchangeId] = {
        markets,
        tradingFees,
        currencies,
        marketsLoaded: marketsLoadedSuccessfully, // Indica si loadMarkets fue exitoso en esta carga
        dataLoaded: true // Indica que se intentó cargar todos los datos
    };
    return exchangeDataCache[exchangeId];
}


/**
 * crea el crud para el modelo de analisis.model.js
 */
const createAnalysis = async (req, res) => {
    try {
        const analysis = new Analysis(req.body);
        await analysis.save();
        res.status(201).json(analysis);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getAllAnalysis = async (req, res) => {
    try {
        const analysis = await Analysis.find().populate('id_exsyMin').populate('id_exsyMax').populate('symbolId');
        res.status(200).json(analysis);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getAnalysisById = async (req, res) => {
    try {
        const analysis = await Analysis.findById(req.params.id).populate('id_exsyMin').populate('id_exsyMax').populate('symbolId');
        if (!analysis) {
            return res.status(404).json({ message: 'Analysis not found' });
        }
        res.status(200).json(analysis);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateAnalysis = async (req, res) => {
    try {
        const analysis = await Analysis.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!analysis) {
            return res.status(404).json({ message: 'Analysis not found' });
        }
        res.status(200).json(analysis);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteAnalysis = async (req, res) => {
    try {
        const analysis = await Analysis.findByIdAndDelete(req.params.id);
        if (!analysis) {
            return res.status(404).json({ message: 'Analysis not found' });
        }
        res.status(200).json({ message: 'Analysis deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

 const analyzeSymbols = async (req, res) => {
    try {
        const symbols = await Symbol.find({});
        let insertedCount = 0;

        for (const symbol of symbols) {
            const exchangeSymbols = await ExchangeSymbol.find({ symbolId: symbol._id });
            console.log(`Processing symbol: ${symbol.name}, ExchangeSymbols count: ${exchangeSymbols.length}`);
            if (exchangeSymbols.length > 1) {
                let minSell = Infinity; // Initialize minSell to Infinity
                let maxBuy = -Infinity; // Initialize maxBuy to -Infinity
                let minSellExSyId = null;
                let maxBuyExSyId = null;

                for (const exSy of exchangeSymbols) {
                    if (exSy.Val_sell != null && exSy.Val_sell < minSell && exSy.Val_sell > 0) {
                        minSell = exSy.Val_sell;
                        minSellExSyId = exSy._id;
                    }
                    if (exSy.Val_buy != null && exSy.Val_buy > maxBuy && exSy.Val_buy > 0) {
                        maxBuy = exSy.Val_buy;
                        maxBuyExSyId = exSy._id;
                    }
                }

                let promedio;
                if (minSell === Infinity || maxBuy === -Infinity || minSellExSyId === null || maxBuyExSyId === null || minSell === 0) {
                    promedio = 0;
                } else {
                    promedio = ((maxBuy - minSell) / minSell) * 100;
                }

                let takerFeeExMin = 0, makerFeeExMin = 0, takerFeeExMax = 0, makerFeeExMax = 0;
                let withdrawalFeeAssetFromExMin = 0, withdrawalNetworkAssetFromExMin = '';

                let exSymMinDoc = null, exSymMaxDoc = null;

                if (minSellExSyId && maxBuyExSyId) {
                    try {
                        exSymMinDoc = await ExchangeSymbol.findById(minSellExSyId)
                            .populate({ path: 'exchangeId', select: 'id_ex name' }) // Added name for logging
                            .populate({ path: 'symbolId', select: 'id_sy name' });
                        exSymMaxDoc = await ExchangeSymbol.findById(maxBuyExSyId)
                            .populate({ path: 'exchangeId', select: 'id_ex name' }); // Added name for logging

                        if (exSymMinDoc && exSymMinDoc.exchangeId && exSymMinDoc.symbolId && exSymMaxDoc && exSymMaxDoc.exchangeId) {
                            const symbolStr = exSymMinDoc.symbolId.id_sy;
                            const baseCurrency = exSymMinDoc.symbolId.name; // Asset to withdraw, e.g., BTC from BTC/USDT

                            const exchangeMinId = exSymMinDoc.exchangeId.id_ex;
                            const exchangeMaxId = exSymMaxDoc.exchangeId.id_ex;

                            // Load data from cache or fetch if not available
                            const dataExMin = await loadExchangeDataOnce(exchangeMinId);
                            const dataExMax = await loadExchangeDataOnce(exchangeMaxId);

                            // Fees for Exchange Min (Buy Asset here, so we pay taker/maker on this exchange)
                            if (dataExMin.tradingFees && dataExMin.tradingFees[symbolStr]) {
                                takerFeeExMin = dataExMin.tradingFees[symbolStr].taker;
                                makerFeeExMin = dataExMin.tradingFees[symbolStr].maker;
                            } else if (dataExMin.markets && dataExMin.markets[symbolStr]) { // Fallback to markets
                                takerFeeExMin = dataExMin.markets[symbolStr].taker;
                                makerFeeExMin = dataExMin.markets[symbolStr].maker;
                            }
                            // Ensure fees are numbers
                            takerFeeExMin = Number(takerFeeExMin) || 0;
                            makerFeeExMin = Number(makerFeeExMin) || 0;

                            // Withdrawal fees for the ASSET from Exchange Min
                            if (dataExMin.currencies && dataExMin.currencies[baseCurrency]) {
                                const currencyInfo = dataExMin.currencies[baseCurrency];
                                if (currencyInfo.networks) {
                                    let bestNetworkFee = Infinity;
                                    let bestNetworkName = '';
                                    for (const netId in currencyInfo.networks) {
                                        const network = currencyInfo.networks[netId];
                                        if (network.active !== false && network.withdraw !== false && network.fee != null && parseFloat(network.fee) < bestNetworkFee) {
                                            bestNetworkFee = parseFloat(network.fee);
                                            bestNetworkName = netId.toUpperCase();
                                        }
                                    }
                                    if (bestNetworkFee !== Infinity) {
                                        withdrawalFeeAssetFromExMin = bestNetworkFee;
                                        withdrawalNetworkAssetFromExMin = bestNetworkName;
                                    }
                                } else if (currencyInfo.fee != null) { // Fallback to general currency fee
                                    withdrawalFeeAssetFromExMin = parseFloat(currencyInfo.fee);
                                }
                            }
                            withdrawalFeeAssetFromExMin = Number(withdrawalFeeAssetFromExMin) || 0;


                            // Fees for Exchange Max (Sell Asset here)
                            if (dataExMax.tradingFees && dataExMax.tradingFees[symbolStr]) {
                                takerFeeExMax = dataExMax.tradingFees[symbolStr].taker;
                                makerFeeExMax = dataExMax.tradingFees[symbolStr].maker;
                            } else if (dataExMax.markets && dataExMax.markets[symbolStr]) { // Fallback to markets
                                takerFeeExMax = dataExMax.markets[symbolStr].taker;
                                makerFeeExMax = dataExMax.markets[symbolStr].maker;
                            }
                            takerFeeExMax = Number(takerFeeExMax) || 0;
                            makerFeeExMax = Number(makerFeeExMax) || 0;

                        } else {
                            // console.warn(`AnalyzeSymbols: Documentos exSymMinDoc o exSymMaxDoc incompletos para symbol ${symbol.name} (ID: ${symbol._id}). Saltando cálculo de fees.`);
                        }
                    } catch (feeError) {
                        const currentSymbolStr = exSymMinDoc && exSymMinDoc.symbolId ? exSymMinDoc.symbolId.id_sy : (symbol ? symbol.id_sy : 'N/A');
                        console.error(`AnalyzeSymbols: Error obteniendo fees para ${currentSymbolStr} (SymbolId: ${symbol._id}, ExMin: ${exSymMinDoc?.exchangeId?.name}, ExMax: ${exSymMaxDoc?.exchangeId?.name}): ${feeError.message}`);
                        // Default fees are already 0, so they remain 0 on error.
                    }

                    // Proceder a guardar solo si tenemos IDs válidos
                    const analysisData = {
                        id_exsyMin: minSellExSyId,
                        id_exsyMax: maxBuyExSyId,
                        Val_buy: maxBuy,
                        Val_sell: minSell,
                        promedio: promedio,
                        symbolId: symbol._id,
                        taker_fee_exMin: takerFeeExMin,
                        maker_fee_exMin: makerFeeExMin,
                        taker_fee_exMax: takerFeeExMax,
                        maker_fee_exMax: makerFeeExMax,
                        withdrawal_fee_asset_from_exMin: withdrawalFeeAssetFromExMin,
                        withdrawal_network_asset_from_exMin: withdrawalNetworkAssetFromExMin,
                        timestamp: new Date()
                    };
                    const analysis = new Analysis(analysisData);
                    await analysis.save();
                    insertedCount++;
                } else {
                     // console.warn(`Skipping analysis for symbol ${symbol.name} (ID: ${symbol._id}) due to missing minSellExSyId or maxBuyExSyId.`);
                }
            }
        }
        console.log(`Total analysis documents inserted: ${insertedCount}`);
        res.status(200).json({ message: `${insertedCount} analysis documents inserted.` });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getFormattedTopAnalysis = async (limit = 20) => {
  try {
    const topAnalysisDocs = await Analysis.find({})
      .sort({ promedio: -1 })
      .limit(limit)
      .populate({
        path: 'symbolId',
        select: 'id_sy name'
      })
      .populate({
        path: 'id_exsyMin',
        select: 'exchangeId Val_sell',
        populate: {
          path: 'exchangeId',
          select: 'id_ex name'
        }
      })
      .populate({
        path: 'id_exsyMax',
        select: 'exchangeId Val_buy',
        populate: {
          path: 'exchangeId',
          select: 'id_ex name'
        }
      })
      .exec();

    if (!topAnalysisDocs || topAnalysisDocs.length === 0) {
      return [];
    }

    const formattedResults = topAnalysisDocs.map(doc => {
      if (!doc.symbolId || !doc.id_exsyMin || !doc.id_exsyMin.exchangeId || !doc.id_exsyMax || !doc.id_exsyMax.exchangeId) {
        console.warn(`Skipping analysis doc ${doc._id} due to missing populated fields.`);
        return null;
      }

      return {
        analysis_id: doc._id,
        symbol: doc.symbolId.id_sy,
        symbol_name: doc.symbolId.name,
        exchange_min_id: doc.id_exsyMin.exchangeId.id_ex,
        exchange_min_name: doc.id_exsyMin.exchangeId.name,
        exchange_max_id: doc.id_exsyMax.exchangeId.id_ex,
        exchange_max_name: doc.id_exsyMax.exchangeId.name,
        price_at_exMin_to_buy_asset: doc.Val_sell,
        price_at_exMax_to_sell_asset: doc.Val_buy,
        percentage_difference: doc.promedio != null ? doc.promedio.toFixed(2) + '%' : "N/A",
        fees_exMin: {
          taker_fee: doc.taker_fee_exMin,
          maker_fee: doc.maker_fee_exMin,
          withdrawal_fee_asset: doc.withdrawal_fee_asset_from_exMin,
          withdrawal_network: doc.withdrawal_network_asset_from_exMin
        },
        fees_exMax: {
          taker_fee: doc.taker_fee_exMax,
          maker_fee: doc.maker_fee_exMax
        },
        timestamp: doc.timestamp
      };
    }).filter(item => item !== null);

    return formattedResults;

  } catch (error) {
    console.error("Error fetching formatted top analysis:", error);
    throw error;
  }
};

module.exports = {
    createAnalysis,
    getAllAnalysis,
    getAnalysisById,
    updateAnalysis,
    deleteAnalysis,
    analyzeSymbols,
    getFormattedTopAnalysis
};
