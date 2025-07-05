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
<<<<<<< HEAD
const Exchange = require('../data/dataBase/modelosBD/exchange.model');
const ccxt = require('ccxt'); // Added ccxt import
=======
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

>>>>>>> jules/multi-fixes-optimizations

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

// --- Helper Functions for Optimization ---

// Helper to get or create a cached CCXT instance
const getCcxtInstance = async (exchangeId, cache) => {
    if (cache[exchangeId]) {
        return cache[exchangeId];
    }
    if (!ccxt.hasOwnProperty(exchangeId)) {
        throw new Error(`CCXT does not support exchange: ${exchangeId}`);
    }
    // CORRECCIÓN: La instanciación dinámica de CCXT requiere notación de corchetes y paréntesis.
    const instance = new ccxt[exchangeId]();
    await instance.loadMarkets(true); // Force reload to get latest fees
    cache[exchangeId] = instance;
    return instance;
};

// Helper to get withdrawal fees
const getWithdrawalFeeInfo = (ccxtInstance, baseCurrency) => {
    let withdrawalFeeAssetFromExMin = 0;
    let withdrawalNetworkAssetFromExMin = '';

    if (ccxtInstance.currencies && ccxtInstance.currencies[baseCurrency]) {
        const currencyInfo = ccxtInstance.currencies[baseCurrency];
        if (currencyInfo.networks && Object.keys(currencyInfo.networks).length > 0) {
            let bestNetworkFee = Infinity;
            let bestNetworkName = '';
            for (const netId in currencyInfo.networks) {
                const network = currencyInfo.networks[netId];
                if (network.active !== false && network.withdraw !== false && network.fee != null && network.fee < bestNetworkFee) {
                    bestNetworkFee = network.fee;
                    bestNetworkName = netId.toUpperCase();
                }
            }
            if (bestNetworkFee !== Infinity) {
                withdrawalFeeAssetFromExMin = bestNetworkFee;
                withdrawalNetworkAssetFromExMin = bestNetworkName;
            }
        } else if (currencyInfo.fee != null) { // Fallback
            withdrawalFeeAssetFromExMin = currencyInfo.fee;
        }
    }
    return { withdrawalFeeAssetFromExMin, withdrawalNetworkAssetFromExMin };
};

/**
 * Depura la colección ExchangeSymbol, eliminando documentos que no son viables para arbitraje.
 * Específicamente, elimina aquellos documentos donde el símbolo está presente en menos de 2 exchanges.
 */
const depuredExchangeSymbolData = async (req, res) => {
    console.log("Iniciando proceso de depuración de ExchangeSymbols con menos de 2 exchanges...");
    try {
        // Usamos $expr para poder utilizar operadores de agregación en una consulta de búsqueda/eliminación.
        // $objectToArray convierte el mapa 'exch_data' en un array.
        // $size cuenta los elementos de ese array (el número de exchanges).
        // $lt (less than) compara si ese número es menor que 2.
        // $ifNull maneja casos donde 'exch_data' podría no existir en un documento.
        const result = await ExchangeSymbol.deleteMany({
            $expr: {
                $lt: [ { $size: { $ifNull: [ { $objectToArray: "$exch_data" }, [] ] } }, 2 ]
            }
        });

        const message = `Depuración completada. Se eliminaron ${result.deletedCount} documentos de ExchangeSymbol por tener menos de 2 exchanges.`;
        console.log(message);
        res.status(200).json({ message, deletedCount: result.deletedCount });

    } catch (error) {
        console.error("Error crítico durante la depuración de ExchangeSymbols:", error);
        res.status(500).json({ message: "Ocurrió un error durante el proceso de depuración.", error: error.message });
    }
};
const addAnalyzeSymbols = async (req, res) => {
    console.time("addAnalyzeSymbols-TotalTime");
    const ccxtInstanceCache = {};
    // La llamada a depuredExchangeSymbolData se ha eliminado.
    // Es una acción separada que debe ser llamada a través de su propia ruta de API, no dentro de esta función.
    try {
        // 1. Obtener todos los documentos de ExchangeSymbol
        const exchangeSymbols = await ExchangeSymbol.find({}).lean();
        console.log(`Found ${exchangeSymbols.length} ExchangeSymbol documents to analyze.`);

        // 2. Procesar cada documento en paralelo
        const analysisPromises = exchangeSymbols.map(async (exSym) => {
            try {
                const exchangesInData = Object.values(exSym.exch_data || {});
                console.log(`\n[${exSym.sy_id}] Iniciando análisis. ${exchangesInData.length} exchanges a evaluar.`);

                if (exchangesInData.length < 2) {
                    return null; // No se puede hacer arbitraje con menos de 2 exchanges
                }

                let minSellData = null;
                let maxBuyData = null;

                // 3. Encontrar el precio de venta más bajo y el de compra más alto
                for (const data of exchangesInData) {
                    console.log(`  [${exSym.sy_id}] Evaluando exchange: ${data.id_ex} | Compra: ${data.Val_buy}, Venta: ${data.Val_sell}`);
                    if (data.Val_sell > 0 && (!minSellData || data.Val_sell < minSellData.Val_sell)) {
                        minSellData = data;
                        console.log(`    -> Nuevo mínimo de venta encontrado: ${data.Val_sell} en ${data.id_ex}`);
                    }
                    if (data.Val_buy > 0 && (!maxBuyData || data.Val_buy > maxBuyData.Val_buy)) {
                        maxBuyData = data;
                        console.log(`    -> Nuevo máximo de compra encontrado: ${data.Val_buy} en ${data.id_ex}`);
                    }
                }

                // Continuar solo si hay una oportunidad válida
                if (!minSellData || !maxBuyData || minSellData.id_ex === maxBuyData.id_ex || minSellData.Val_sell >= maxBuyData.Val_buy) {
                    return null; // FIX: Abort if no valid opportunity
                }

<<<<<<< HEAD
                console.log(`[${exSym.sy_id}] Selección final -> Comprar en: ${minSellData.id_ex} a ${minSellData.Val_sell}, Vender en: ${maxBuyData.id_ex} a ${maxBuyData.Val_buy}`);

                // 4. Calcular el promedio
                const promedio = ((maxBuyData.Val_buy - minSellData.Val_sell) / minSellData.Val_sell) * 100;

                // 5. Obtener comisiones (fees)
                console.log(`[${exSym.sy_id}] Obteniendo comisiones de CCXT para ${minSellData.id_ex} y ${maxBuyData.id_ex}...`);
                console.log(`[${exSym.id_ex}]`)
                
                await new Promise(resolve => setTimeout(resolve, 2000)); // Sleep for 2 seconds
                const [ccxtExMin, ccxtExMax] = await Promise.all([
                    getCcxtInstance(minSellData.id_ex, ccxtInstanceCache),
                    getCcxtInstance(maxBuyData.id_ex, ccxtInstanceCache)
                ]);

                // CORRECCIÓN: Usar sy_id, que es el identificador de CCXT (ej: 'BTC/USDT'), no symbolName (ej: 'BTC').
                const symbolStr = await exSym.sy_id;
                console.log(`---------------[${exSym.sy_id}] Obteniendo información de CCXT para ${symbolStr}...`);
                const marketMin = await ccxtExMin.markets[symbolStr];
                console.log('ssssssssss ${marketMin}');
                if (!marketMin) {
                    console.warn(`Símbolo ${symbolStr} no encontrado en los mercados de ${minSellData.id_ex}. Saltando análisis para este par.`);
                    next;
                    return null; // FIX: Abort if market not found
                }
                const takerFeeExMin = marketMin.taker ?? 0;
                const makerFeeExMin = marketMin.maker ?? 0;

                const marketMax = ccxtExMax.markets[symbolStr];
                if (!marketMax) {
                    console.warn(`*****************Símbolo ${symbolStr} no encontrado en los mercados de ${maxBuyData.id_ex}. Saltando análisis para este par.`);
                    return null; // FIX: Abort if market not found
                }
                const takerFeeExMax = marketMax.taker ?? 0;
                const makerFeeExMax = marketMax.maker ?? 0;

                console.log(`///////////////////////[${exSym.sy_id}] Análisis completado. Promedio: ${promedio.toFixed(2)}%`);

                // Construir el documento de análisis
                const analysisResult = {
                    id_exdataMin: minSellData.id_ex, // Guardar el ID de CCXT estable
                    id_exdataMax: maxBuyData.id_ex, // Guardar el ID de CCXT estable
                    Val_max_buy: maxBuyData.Val_buy,
                    Val_min_sell: minSellData.Val_sell,
                    promedio: promedio,
                    id_exchsymbol: exSym._id,
                    taker_fee_exMin: takerFeeExMin,
                    maker_fee_exMin: makerFeeExMin,
                    taker_fee_exMax: takerFeeExMax,
                    maker_fee_exMax: makerFeeExMax,
                    timestamp: new Date()
                };
                return analysisResult;
            } catch (error) {
                // CORRECCIÓN: Usar sy_id para identificar el símbolo en el log de error.
                console.error(`Error analizando el símbolo ${exSym.sy_id}: ${error.message}`);
                return null; // FIX: Return null on error to not break Promise.all
            }
        });

        const analysisResults = (await Promise.all(analysisPromises)).filter(Boolean); // Filtra los nulos

        // 6. Limpiar análisis antiguos e insertar los nuevos masivamente
        console.log(`Clearing old analysis and inserting ${analysisResults.length} new documents...`);
        await Analysis.deleteMany({});
        if (analysisResults.length > 0) {
            await Analysis.insertMany(analysisResults);
        }

        console.timeEnd("addAnalyzeSymbols-TotalTime");
        const successMessage = `Analysis complete. Inserted ${analysisResults.length} new opportunities.`;
        console.log(successMessage);
        // Ensure headers are not already sent before responding
        if (!res.headersSent) {
            res.status(200).json({
                message: successMessage,
                insertedCount: analysisResults.length
            });
        }

    } catch (error) {
        console.timeEnd("addAnalyzeSymbols-TotalTime");
        console.error("Critical error in addAnalyzeSymbols:", error);
        // FIX: Re-enable error response with a safeguard
        if (!res.headersSent) {
            res.status(500).json({
                message: "A critical error occurred during the analysis process.",
                error: error.message
            });
        }
    }
};

/**
 * metodo que se ejecuta de forma asincrona no debeesperar a que
 * acabe su ejecusion cuando acabe enviar respuesta 
 * 1- carga los datos de los exchangeSymbol que el id ni este en analisis.id_exchsymbol
 * 2. empiesa a recorrer los exchangeSimbol 
 * obtiene los exch_data de exchangeSimbol
 * 3. compara los valores de venta de los exch_data y obtiene el menorvalor y el id_ex del exch_data de menor valor 
 * compara los valores de compra de los exch_data y obtiene el mayor valor y el id_ex del exch_data de menor valor 
 * 4. obtine el porcentaje de diferncia entre el menor valor de venta y el mayor velor de compra
 * 5. imprime el valoemax, valormin y promedio por
 *  
 */
const analisisExchangeSimbol= async (req, res) => {
    // Send an immediate response to the client to indicate the process has started
    res.status(202).json({ message: "El proceso de análisis asíncrono ha comenzado. Revise los logs del servidor para ver el progreso." });

    // Start the background processing without awaiting it
    (async () => {
        try {
            const ccxtInstanceCache = {}; // Cache for CCXT instances
            console.log('[Async Analysis] Proceso en segundo plano iniciado.');

            // 1. Cargar los IDs de los ExchangeSymbol que ya están en la colección de análisis
            const analyzedSymbolIds = await Analysis.distinct('id_exchsymbol');
            console.log(`[Async Analysis] Encontrados ${analyzedSymbolIds.length} análisis existentes.`);

            // Cargar los datos de los ExchangeSymbol que no han sido analizados
            const exchangeSymbolsToAnalyze = await ExchangeSymbol.find({
                _id: { $nin: analyzedSymbolIds }
            }).lean(); // Usar .lean() para mejor rendimiento ya que solo leeremos datos

            console.log(`[Async Analysis] Se analizarán ${exchangeSymbolsToAnalyze.length} nuevos documentos de ExchangeSymbol.`);

            // 2. Empezar a recorrer los ExchangeSymbol
            for (const exSym of exchangeSymbolsToAnalyze) {
                console.log(`\n[Async Analysis] -> Procesando ExchangeSymbol ID: ${exSym._id} (Símbolo: ${exSym.sy_id})`);
                
                const exchData = exSym.exch_data || {};
                const exchangesInData = Object.values(exchData);

                if (exchangesInData.length < 2) {
                    console.log(`   - Omitido: Se requieren al menos 2 exchanges, pero solo se encontraron ${exchangesInData.length}.`);
                    continue;
                }

                let minSellData = null;
                let maxBuyData = null;

                // 3. Comparar valores para encontrar el mínimo de venta y el máximo de compra
                for (const data of exchangesInData) {
                    if (data.Val_sell > 0 && (!minSellData || data.Val_sell < minSellData.Val_sell)) {
                        minSellData = data;
                    }
                    if (data.Val_buy > 0 && (!maxBuyData || data.Val_buy > maxBuyData.Val_buy)) {
                        maxBuyData = data;
                    }
                }

                // 4. Calcular el porcentaje de diferencia si se encontró una oportunidad válida
                if (minSellData && maxBuyData && minSellData.id_ex !== maxBuyData.id_ex && maxBuyData.Val_buy > minSellData.Val_sell) {
                    try {
                        const promedio = ((maxBuyData.Val_buy - minSellData.Val_sell) / minSellData.Val_sell) * 100;

                        // a. Obtener comisiones de CCXT
                        const [ccxtExMin, ccxtExMax] = await Promise.all([
                            getCcxtInstance(minSellData.id_ex, ccxtInstanceCache),
                            getCcxtInstance(maxBuyData.id_ex, ccxtInstanceCache)
                        ]);

                        const symbolStr = exSym.sy_id;
                        const marketMin = ccxtExMin.markets[symbolStr];
                        const takerFeeExMin = marketMin ? marketMin.taker : 0;
                        const makerFeeExMin = marketMin ? marketMin.maker : 0;

                        const marketMax = ccxtExMax.markets[symbolStr];
                        const takerFeeExMax = marketMax ? marketMax.taker : 0;
                        const makerFeeExMax = marketMax ? marketMax.maker : 0;

                        // b. Agregar los datos al modelo Analysis
                        const newAnalysis = new Analysis({
                            id_exdataMin: minSellData.id_ex, // Guardar el ID de CCXT estable
                            id_exdataMax: maxBuyData.id_ex, // Guardar el ID de CCXT estable
                            Val_max_buy: maxBuyData.Val_buy,
                            Val_min_sell: minSellData.Val_sell,
                            promedio: promedio,
                            id_exchsymbol: exSym._id,
                            taker_fee_exMin: takerFeeExMin,
                            maker_fee_exMin: makerFeeExMin,
                            taker_fee_exMax: takerFeeExMax,
                            maker_fee_exMax: makerFeeExMax,
                            timestamp: new Date()
                        });

                        await newAnalysis.save();
                            console.log('agregado')
                        // 5. Imprimir los resultados
                        console.log(`   - Oportunidad encontrada y guardada para ${exSym.sy_id}:`);
                        console.log(`     - Compra Máxima (Val_max_buy): ${maxBuyData.Val_buy} en ${maxBuyData.id_ex}`);
                        console.log(`     - Venta Mínima (Val_min_sell): ${minSellData.Val_sell} en ${minSellData.id_ex}`);
                        console.log(`     - Diferencia (Promedio): ${promedio.toFixed(2)}%`);
                    } catch (analysisError) {
                        console.error(`[Async Analysis] Error al procesar o guardar el análisis para ${exSym.sy_id}: ${analysisError.message}`);
                    }
=======
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
>>>>>>> jules/multi-fixes-optimizations
                } else {
                    console.log(`   - No se encontró una oportunidad de arbitraje rentable.`);
                }
            }

            console.log('\n[Async Analysis] Proceso en segundo plano finalizado.');

        } catch (error) {
            console.error('[Async Analysis] Error crítico durante el proceso en segundo plano:', error);
        }
    })();
};

// --- Block 1: Main Controller and Orchestration ---
const analyzeSymbols = async (req, res) => {
    /**
     * 1 debe tomar los simbolos de la base de datos
     * 2 debe buscar los exchanges activos 
     */
    console.time("Total Analysis Time");
    const ccxtInstanceCache = {}; // Cache for CCXT instances to avoid re-initialization

    try {
        // Step 1: Find all potential arbitrage opportunities using an efficient aggregation query.
        const candidates = await findArbitrageCandidates();

        if (candidates.length === 0) {
            console.log("No new arbitrage candidates found to process.");
            await Analysis.deleteMany({}); // Clear old analysis if no new opportunities
            return res.status(200).json({ message: "Analysis complete. No arbitrage opportunities found.", insertedCount: 0 });
        }

        // Step 2: Process all candidates in parallel to fetch fees and prepare analysis data.
        console.log(`Step 2: Processing ${candidates.length} candidates in parallel to fetch fees...`);
        const analysisPromises = candidates.map(candidate =>
            processCandidateAndFetchFees(candidate, ccxtInstanceCache)
        );
        const analysisResults = await Promise.allSettled(analysisPromises);

        // Filter out failed promises and extract successful analysis documents
        const successfulAnalyses = analysisResults
            .filter(result => {
                if (result.status === 'rejected') {
                    console.error("Error processing a candidate:", result.reason);
                    return false;
                }
                return result.value !== null;
            })
            .map(result => result.value);

        // Step 3: Perform a bulk update (clear old, insert new).
        console.log(`Step 3: Clearing old analysis data and inserting ${successfulAnalyses.length} new documents...`);
        await Analysis.deleteMany({}); // Clean slate for fresh data

        if (successfulAnalyses.length > 0) {
            await Analysis.insertMany(successfulAnalyses);
        }

        console.timeEnd("Total Analysis Time");
        const successMessage = `Analysis complete. Inserted ${successfulAnalyses.length} new analysis documents.`;
        console.log(successMessage);
        res.status(200).json({ message: successMessage, insertedCount: successfulAnalyses.length });

    } catch (error) {
        console.timeEnd("Total Analysis Time");
        console.error("Critical error during symbol analysis:", error);
        res.status(500).json({ message: "A critical error occurred during the analysis process.", error: error.message });
    }
};

// --- Block 2: Data Aggregation and Candidate Finding ---
const findArbitrageCandidates = async () => {
    console.log("Step 1: Aggregating ExchangeSymbol data to find potential arbitrage candidates...");
    // This aggregation pipeline groups all ExchangeSymbol documents by their symbolId.
    // It only keeps symbols that are present on 2 or more exchanges.
    const symbolGroups = await ExchangeSymbol.aggregate([
        {
            $group: {
                _id: "$symbolId", // Group by the symbol's ObjectId
                docs: { $push: "$$ROOT" }, // Push the entire document into an array
                count: { $sum: 1 } // Count how many exchanges per symbol
            }
        },
        {
            $match: {
                count: { $gte: 2 } // Filter for symbols on 2 or more exchanges
            }
        }
    ]);
    console.log(`Found ${symbolGroups.length} symbols present on 2 or more exchanges.`);

    const candidates = [];
    // In-memory processing is fast for finding min/max within small, pre-filtered groups.
    for (const group of symbolGroups) {
        let minSellDoc = null;
        let maxBuyDoc = null;

        for (const doc of group.docs) {
            // Find the document with the lowest selling price (best to buy)
            if (doc.Val_sell > 0 && (!minSellDoc || doc.Val_sell < minSellDoc.Val_sell)) {
                minSellDoc = doc;
            }
            // Find the document with the highest buying price (best to sell)
            if (doc.Val_buy > 0 && (!maxBuyDoc || doc.Val_buy > maxBuyDoc.Val_buy)) {
                maxBuyDoc = doc;
            }
        }

        // Ensure we found both a min sell and a max buy, and they are on different exchanges
        if (minSellDoc && maxBuyDoc && minSellDoc.exchangeId.toString() !== maxBuyDoc.exchangeId.toString()) {
            candidates.push({
                symbolId: group._id,
                minSellDoc,
                maxBuyDoc
            });
        }
    }
    console.log(`Identified ${candidates.length} valid arbitrage candidates for fee processing.`);
    return candidates;
};

// --- Block 3: Fee Fetching and Final Data Processing ---
const processCandidateAndFetchFees = async (candidate, ccxtInstanceCache) => {
    const { minSellDoc, maxBuyDoc } = candidate;

    // Populate the necessary fields to get string IDs (id_ex, id_sy)
    // This is a necessary step as the aggregation only gives us ObjectIds.
    const [populatedMinDoc, populatedMaxDoc] = await Promise.all([
        ExchangeSymbol.findById(minSellDoc._id).populate('exchangeId', 'id_ex').populate('symbolId', 'id_sy name'),
        ExchangeSymbol.findById(maxBuyDoc._id).populate('exchangeId', 'id_ex')
    ]);

    if (!populatedMinDoc || !populatedMinDoc.exchangeId || !populatedMinDoc.symbolId || !populatedMaxDoc || !populatedMaxDoc.exchangeId) {
        console.warn(`Skipping candidate due to missing populated data for symbolId: ${candidate.symbolId}`);
        return null; // Skip this candidate if data is incomplete
    }

    const minSell = populatedMinDoc.Val_sell;
    const maxBuy = maxBuyDoc.Val_buy;

    // Calculate percentage difference
    const promedio = ((maxBuy - minSell) / minSell) * 100;

    // Optional: If the opportunity is not profitable even before fees, we can skip it.
    if (promedio <= 0) {
        return null;
    }

    const exchangeMinId = populatedMinDoc.exchangeId.id_ex;
    const exchangeMaxId = populatedMaxDoc.exchangeId.id_ex;
    const symbolStr = populatedMinDoc.symbolId.id_sy;
    const baseCurrency = populatedMinDoc.symbolId.name;

    // Fetch CCXT instances and fees in parallel
    const [ccxtExMin, ccxtExMax] = await Promise.all([
        getCcxtInstance(exchangeMinId, ccxtInstanceCache),
        getCcxtInstance(exchangeMaxId, ccxtInstanceCache)
    ]);

    // Get fees for the "buy" exchange (min)
    const marketMin = ccxtExMin.markets[symbolStr];
    const takerFeeExMin = marketMin ? marketMin.taker : 0;
    const makerFeeExMin = marketMin ? marketMin.maker : 0;
    const { withdrawalFeeAssetFromExMin, withdrawalNetworkAssetFromExMin } = getWithdrawalFeeInfo(ccxtExMin, baseCurrency);

    // Get fees for the "sell" exchange (max)
    const marketMax = ccxtExMax.markets[symbolStr];
    const takerFeeExMax = marketMax ? marketMax.taker : 0;
    const makerFeeExMax = marketMax ? marketMax.maker : 0;

    // Construct the final document for insertion
    const analysisData = {
        id_exsyMin: minSellDoc._id,
        id_exsyMax: maxBuyDoc._id,
        Val_buy: maxBuy,
        Val_sell: minSell,
        promedio: promedio,
        symbolId: candidate.symbolId,
        taker_fee_exMin: takerFeeExMin,
        maker_fee_exMin: makerFeeExMin,
        taker_fee_exMax: takerFeeExMax,
        maker_fee_exMax: makerFeeExMax,
        withdrawal_fee_asset_from_exMin: withdrawalFeeAssetFromExMin,
        withdrawal_network_asset_from_exMin: withdrawalNetworkAssetFromExMin,
        timestamp: new Date()
    };

    return analysisData;
};


const sleep = ms => new Promise(r => setTimeout(r, ms));

// Helper para reintentos con backoff exponencial
async function fetchWithRetry(fn, maxRetries = 3, delay = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            // Si es rate limit, espera más tiempo
            if (err.message && err.message.includes('too many requests')) {
                await sleep(delay * (i + 1));
            } else {
                throw err;
            }
        }
    }
    throw lastError;
}

const actualizePricetop20 = async (req, res) => {
    console.log("Starting top 20 analysis price update...");
    console.time("actualizePricetop20-Time");

    const ccxtInstanceCache = {};
    try {
        const top20 = await Analysis.find({})
            .sort({ promedio: -1 })
            .limit(20)
            .populate('id_exchsymbol', 'sy_id')
            .lean();

        if (!top20 || top20.length === 0) {
            console.log("No analysis documents found to update.");
            if (res) res.status(200).json({ message: "No analysis documents found to update.", updatedCount: 0 });
            return;
        }

        // Agrupa por exchange para evitar rate limit
        const exchangeSymbols = {};
        for (const analysis of top20) {
            if (!analysis.id_exchsymbol || !analysis.id_exchsymbol.sy_id) continue;
            if (!exchangeSymbols[analysis.id_exdataMin]) exchangeSymbols[analysis.id_exdataMin] = new Set();
            if (!exchangeSymbols[analysis.id_exdataMax]) exchangeSymbols[analysis.id_exdataMax] = new Set();
            exchangeSymbols[analysis.id_exdataMin].add(analysis.id_exchsymbol.sy_id);
            exchangeSymbols[analysis.id_exdataMax].add(analysis.id_exchsymbol.sy_id);
        }

        // Pre-carga tickers por exchange (si soporta fetchTickers)
        const tickersCache = {};
        await Promise.all(Object.keys(exchangeSymbols).map(async exId => {
            const ccxtEx = await getCcxtInstance(exId, ccxtInstanceCache);
            const symbols = Array.from(exchangeSymbols[exId]);
            try {
                if (typeof ccxtEx.fetchTickers === 'function') {
                    // Batch fetch
                    tickersCache[exId] = await fetchWithRetry(() => ccxtEx.fetchTickers(symbols));
                } else {
                    // Individual fetch
                    tickersCache[exId] = {};
                    for (const symbol of symbols) {
                        tickersCache[exId][symbol] = await fetchWithRetry(() => ccxtEx.fetchTicker(symbol));
                        await sleep(ccxtEx.rateLimit || 1000); // Respeta el rate limit
                    }
                }
            } catch (err) {
                console.error(`Error fetching tickers for ${exId}:`, err.message);
            }
        }));

        // Actualiza los análisis usando los tickers cacheados
        const updateOps = [];
        for (const analysis of top20) {
            if (!analysis.id_exchsymbol || !analysis.id_exchsymbol.sy_id) continue;
            const symbol = analysis.id_exchsymbol.sy_id;
            const exMinId = analysis.id_exdataMin;
            const exMaxId = analysis.id_exdataMax;

            const tickerMin = tickersCache[exMinId]?.[symbol];
            const tickerMax = tickersCache[exMaxId]?.[symbol];

            const newSellPrice = tickerMin?.ask;
            const newBuyPrice = tickerMax?.bid;

            if (!newSellPrice || !newBuyPrice) {
                console.warn(`Could not fetch valid ask/bid for ${symbol} on ${exMinId}/${exMaxId}.`);
                continue;
            }

            const newAverage = ((newBuyPrice - newSellPrice) / newSellPrice) * 100;

            updateOps.push({
                updateOne: {
                    filter: { _id: analysis._id },
                    update: {
                        $set: {
                            Val_min_sell: newSellPrice,
                            Val_max_buy: newBuyPrice,
                            promedio: newAverage,
                            timestamp: new Date()
                        }
                    }
                }
            });
        }

        if (updateOps.length > 0) {
            await Analysis.bulkWrite(updateOps);
            console.log(`${updateOps.length} analysis documents were successfully updated.`);
        } else {
            console.log("No analysis documents could be updated after fetching prices.");
        }

        console.timeEnd("actualizePricetop20-Time");
        const successMessage = `Price update process finished. Updated ${updateOps.length} documents.`;
        if (res && !res.headersSent) res.status(200).json({ message: successMessage, updatedCount: updateOps.length });

    } catch (error) {
        console.timeEnd("actualizePricetop20-Time");
        console.error("Critical error in actualizePricetop20:", error);
        if (res && !res.headersSent) res.status(500).json({ message: "A critical error occurred during the price update process.", error: error.message });
    }
};
// ...resto del código...

const getFormattedTopAnalysis = async (limit = 20) => {
  try {
    const topAnalysisDocs = await Analysis.find({})
      .sort({ promedio: -1 })
      .limit(limit)
      .populate('id_exchsymbol') // Poblar la referencia principal a ExchangeSymbol
      .exec();

    if (!topAnalysisDocs || topAnalysisDocs.length === 0) {
      return [];
    }

    const formattedResults = topAnalysisDocs.map(doc => {
      // La referencia principal ahora es id_exchsymbol
      const exchangeSymbolDoc = doc.id_exchsymbol;

      // Validación básica: asegurar que el documento referenciado y sus datos existen
      if (!exchangeSymbolDoc || !exchangeSymbolDoc.exch_data) {
        console.warn(`Omitiendo doc de análisis ${doc._id} por falta de 'id_exchsymbol' o 'exch_data' poblados.`);
        return null;
      }
      

      // Obtener los datos de los exchanges min/max usando el ID de CCXT (la clave del mapa)
      // que se guarda en el documento de análisis. Esto es más robusto que usar el _id del subdocumento.
      const minData = exchangeSymbolDoc.exch_data.get(doc.id_exdataMin);
      const maxData = exchangeSymbolDoc.exch_data.get(doc.id_exdataMax);

      // Validación adicional: asegurar que encontramos los subdocumentos específicos
      if (!minData || !maxData) {
        console.warn(`Omitiendo doc de análisis ${doc._id} porque no se encontraron los subdocumentos para min_ex '${doc.id_exdataMin}' o max_ex '${doc.id_exdataMax}' dentro de ExchangeSymbol ${exchangeSymbolDoc._id}.`);
        return null;
      }

      return {
        analysis_id: doc._id,
        symbol: exchangeSymbolDoc.sy_id, // Desde ExchangeSymbol
        symbol_name: exchangeSymbolDoc.symbolName, // Desde ExchangeSymbol
        exchange_min_id: minData.id_ex,
        exchange_min_name: minData.exchangeName,
        exchange_max_id: maxData.id_ex,
        exchange_max_name: maxData.exchangeName,
        price_at_exMin_to_buy_asset: doc.Val_min_sell, // Corregido para usar el campo correcto
        price_at_exMax_to_sell_asset: doc.Val_max_buy, // Corregido para usar el campo correcto
        percentage_difference: doc.promedio != null ? doc.promedio.toFixed(2) + '%' : "N/A",
        fees_exMin: {
          taker_fee: doc.taker_fee_exMin,
          maker_fee: doc.maker_fee_exMin,
          // Los campos de retiro ya no están en el modelo de análisis, se eliminan del resultado.
          // Si se necesitaran, habría que obtenerlos de otra fuente o agregarlos al modelo.
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
    getFormattedTopAnalysis,
    addAnalyzeSymbols,
    depuredExchangeSymbolData,
    analisisExchangeSimbol,
    actualizePricetop20
}