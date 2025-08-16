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
const Exchange = require('../data/dataBase/modelosBD/exchange.model');
const { initializeExchange } = require('./exchangeController');
const ccxt = require('ccxt');

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

/**
 * Obtiene datos históricos de análisis para entrenamiento de IA
 */
const getHistoricalAnalysis = async (req, res) => {
    try {
        const { start_date, limit = 1000, include_fees = true } = req.query;
        
        // Construir filtro de fecha
        let dateFilter = {};
        if (start_date) {
            dateFilter.timestamp = { $gte: new Date(start_date) };
        }
        
        // Construir query
        let query = Analysis.find(dateFilter)
            .populate('id_exchsymbol', 'sy_id')
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));
        
        const historicalData = await query.exec();
        
        // Formatear datos para el entrenamiento
        const formattedData = historicalData.map(record => ({
            id_exchsymbol: record.id_exchsymbol,
            id_exdataMin: record.id_exdataMin,
            id_exdataMax: record.id_exdataMax,
            Val_min_sell: record.Val_min_sell,
            Val_max_buy: record.Val_max_buy,
            promedio: record.promedio,
            taker_fee_exMin: include_fees ? record.taker_fee_exMin : 0.001,
            maker_fee_exMin: include_fees ? record.maker_fee_exMin : 0.001,
            taker_fee_exMax: include_fees ? record.taker_fee_exMax : 0.001,
            maker_fee_exMax: include_fees ? record.maker_fee_exMax : 0.001,
            timestamp: record.timestamp
        }));
        
        res.status(200).json(formattedData);
        
    } catch (error) {
        console.error('Error obteniendo datos históricos:', error);
        res.status(500).json({ 
            message: 'Error obteniendo datos históricos',
            error: error.message 
        });
    }
};

// Helper to get or create a cached CCXT instance
const getCcxtInstance = async (exchangeId, cache) => {
    if (cache[exchangeId]) {
        return cache[exchangeId];
    }
    const instance = initializeExchange(exchangeId);
    if (!instance) {
        throw new Error(`Failed to initialize exchange: ${exchangeId}`);
    }
    await instance.loadMarkets(true); // Force reload to get latest fees
    cache[exchangeId] = instance;
    return instance;
};

// Helper to get withdrawal fees
const getWithdrawalFees = async (ccxtInstance, symbol) => {
    try {
        const fees = await ccxtInstance.fetchTradingFees();
        return fees[symbol] || { taker: 0.001, maker: 0.001 };
    } catch (error) {
        console.warn(`Could not fetch fees for ${symbol}: ${error.message}`);
        return { taker: 0.001, maker: 0.001 }; // Default fees
    }
};

/**
 * Funcion para obtener datos históricos OHLCV de un exchange y símbolo.
 * Redondea el timeframe al intervalo CCXT más cercano.
 */
const getHistoricalOHLCV = async (req, res) => {
    try {
        const { exchangeId, symbol, timeframe, since, limit } = req.query;

        if (!exchangeId || !symbol || !timeframe) {
            return res.status(400).json({ message: 'Missing required parameters: exchangeId, symbol, timeframe' });
        }

        const exchange = initializeExchange(exchangeId);
        if (!exchange) {
            return res.status(400).json({ message: `Exchange ${exchangeId} not supported by CCXT or failed to initialize.` });
        }
        if (!exchange.has['fetchOHLCV']) {
            return res.status(400).json({ message: `Exchange ${exchangeId} does not support fetching OHLCV data` });
        }

        await exchange.loadMarkets();

        // Redondear el timeframe al intervalo CCXT más cercano
        const availableTimeframes = exchange.timeframes ? Object.keys(exchange.timeframes) : [];
        let roundedTimeframe = timeframe;

        if (availableTimeframes.length > 0) {
            const timeframeInSeconds = parseTimeframeToSeconds(timeframe);
            let minDiff = Infinity;
            let bestTimeframe = timeframe;

            for (const tf of availableTimeframes) {
                const diff = Math.abs(parseTimeframeToSeconds(tf) - timeframeInSeconds);
                if (diff < minDiff) {
                    minDiff = diff;
                    bestTimeframe = tf;
                }
            }
            roundedTimeframe = bestTimeframe;
        }

        const sinceTimestamp = since ? parseInt(since) : undefined;
        const limitCount = limit ? parseInt(limit) : undefined;

        const ohlcv = await exchange.fetchOHLCV(symbol, roundedTimeframe, sinceTimestamp, limitCount);

        res.status(200).json({
            exchangeId,
            symbol,
            timeframe: roundedTimeframe,
            ohlcv,
            message: `Fetched OHLCV data for ${symbol} on ${exchangeId} with timeframe ${roundedTimeframe}`
        });

    } catch (error) {
        console.error('Error fetching historical OHLCV data:', error);
        res.status(500).json({ 
            message: 'Error fetching historical OHLCV data',
            error: error.message 
        });
    }
};

// Helper para convertir timeframe a segundos
const parseTimeframeToSeconds = (timeframe) => {
    const unit = timeframe.slice(-1);
    const value = parseInt(timeframe.slice(0, -1));
    switch (unit) {
        case 'm': return value * 60;
        case 'h': return value * 60 * 60;
        case 'd': return value * 24 * 60 * 60;
        case 'w': return value * 7 * 24 * 60 * 60;
        case 'M': return value * 30 * 24 * 60 * 60; // Aproximado para meses
        default: return parseInt(timeframe); // Asume segundos si no hay unidad
    }
};

const addAnalyzeSymbols = async (req, res) => {
    console.time("addAnalyzeSymbols-TotalTime");
    try {
        // 1. Obtener todos los ExchangeSymbol únicos por sy_id
        console.log("Fetching unique ExchangeSymbol records...");
        const uniqueExchangeSymbols = await ExchangeSymbol.aggregate([
            {
                $group: {
                    _id: "$sy_id",
                    exchangeSymbols: { $push: "$$ROOT" }
                }
            }
        ]);

        console.log(`Found ${uniqueExchangeSymbols.length} unique symbols to analyze.`);

        // 2. Cache para instancias de CCXT
        const ccxtInstanceCache = {};

        // 3. Procesar cada símbolo único
        const analysisPromises = uniqueExchangeSymbols.map(async (group) => {
            const exSym = group.exchangeSymbols[0]; // Tomar el primer elemento como referencia
            try {
                console.log(`[${exSym.sy_id}] Analizando símbolo...`);

                // 4. Obtener todos los exch_data para este símbolo
                const exchDataList = group.exchangeSymbols.flatMap(es => es.exch_data || []);
                console.log(exchDataList.length)
                if (exchDataList.length < 2) {
                    console.warn(`[${exSym.sy_id}] Insuficientes datos de exchange (${exchDataList.length}). Saltando.`);
                    return null;
                }

                // Filtrar datos válidos
                const validExchData = exchDataList.filter(data => 
                    data.Val_sell > 0 && data.Val_buy > 0
                );

                if (validExchData.length < 2) {
                    console.warn(`[${exSym.sy_id}] Insuficientes datos válidos. Saltando.`);
                    return null;
                }

                // Encontrar menor valor de venta y mayor valor de compra
                const minSellData = validExchData.reduce((min, current) => 
                    current.Val_sell < min.Val_sell ? current : min
                );
                const maxBuyData = validExchData.reduce((max, current) => 
                    current.Val_buy > max.Val_buy ? current : max
                );

                // Verificar que los exchanges sean diferentes
                if (minSellData.id_ex === maxBuyData.id_ex) {
                    console.warn(`[${exSym.sy_id}] Mismo exchange para compra y venta. Saltando.`);
                    return null;
                }

                // Calcular porcentaje de diferencia
                // CORRECCIÓN: Aplicar la fórmula de porcentaje de ganancia correcta.
                const ganancia = (maxBuyData.Val_buy / minSellData.Val_sell) - 1;
                const promedio = ganancia * 100;
                if (promedio <= 0) {
                    console.warn(`[${exSym.sy_id}] Diferencia no rentable (${promedio.toFixed(2)}%). Saltando.`);
                    return null;
                }

                // 5. Obtener comisiones (fees)
                console.log(`[${exSym.sy_id}] Obteniendo comisiones de CCXT para ${minSellData.id_ex} y ${maxBuyData.id_ex}...`);
                console.log(`[${exSym.id_ex}]`)
                
                await new Promise(resolve => setTimeout(resolve, 2000)); // Sleep for 2 seconds
                const [ccxtExMin, ccxtExMax] = await Promise.all([
                    getCcxtInstance(minSellData.id_ex, ccxtInstanceCache),
                    getCcxtInstance(maxBuyData.id_ex, ccxtInstanceCache)
                ]);

                // CORRECCIÓN: Usar sy_id, que es el identificador de CCXT (ej: 'BTC/USDT'), no symbolName (ej: 'BTC').
                const symbolStr = exSym.sy_id;
                console.log(`---------------[${exSym.sy_id}] Obteniendo información de CCXT para ${symbolStr}...`);
                const marketMin = await ccxtExMin.markets[symbolStr];
                console.log(`ssssssssss ${marketMin}`);
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
                    symbol: exSym.sy_id,
                    promedio: promedio,
                    symbol: exSym.sy_id,
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
const addAnalyzeSymbolsAsync = async (req, res) => {
    // Responder inmediatamente
    res.status(200).json({
        message: "Analysis started in background. Check logs for progress.",
        status: "processing"
    });

    console.time("addAnalyzeSymbolsAsync-TotalTime");
    try {
        // 1. Obtener todos los documentos de ExchangeSymbol.
        // Es más eficiente que aggregate si cada sy_id es único, como parece ser el caso con el nuevo esquema.
        console.log("Fetching all ExchangeSymbol records...");
        const allExchangeSymbols = await ExchangeSymbol.find({}).lean(); // .lean() para mejor rendimiento

        console.log(`Found ${allExchangeSymbols.length} symbols to analyze.`);

        // 2. Cache para instancias de CCXT
        const ccxtInstanceCache = {};

        // 3. Procesar cada símbolo
        const analysisPromises = allExchangeSymbols.map(async (symbolDoc) => {
            try {
                console.log(`[${symbolDoc.sy_id}] Analizando símbolo...`);

                // 4. Obtener todos los exch_data para este símbolo
                // Con .lean(), symbolDoc.exch_data es un objeto. Obtenemos sus valores.
                if (!symbolDoc.exch_data || Object.keys(symbolDoc.exch_data).length < 1) {
                    const count = symbolDoc.exch_data ? Object.keys(symbolDoc.exch_data).length : 0;
                    console.warn(`[${symbolDoc.sy_id}] Insuficientes datos de exchange (${count}). Saltando.`);
                    return null;
                }
                const exchDataList = Object.values(symbolDoc.exch_data);

                // Filtrar datos válidos
                let validExchData = exchDataList.filter(data => 
                    data.Val_sell > 0 && data.Val_buy > 0
                );

                if (validExchData.length < 1) {
                    console.warn(`[${symbolDoc.sy_id}] Insuficientes datos válidos (${validExchData.length}). Saltando. --------------------------`);
                    return null;
                }

                // Encontrar menor valor de venta y mayor valor de compra
                let minSellData = validExchData.reduce((min, current) => 
                    current.Val_sell < min.Val_sell ? current : min
                );
                let maxBuyData = validExchData.reduce((max, current) => 
                    current.Val_buy > max.Val_buy ? current : max
                );

                // Verificar que los exchanges sean diferentes
                if (minSellData.id_ex === maxBuyData.id_ex) {
                    console.warn(`[${symbolDoc.sy_id}] Mismo exchange para compra y venta. Saltando.`);
                    return null;
                }

                // Calcular porcentaje de diferencia
                let ganancia = (maxBuyData.Val_buy/minSellData.Val_sell) - 1;
                let promedio = ganancia * 100;

                if (promedio <= 0) {
                    console.warn(`[${symbolDoc.sy_id}] Diferencia no rentable (${promedio.toFixed(2)}%). Saltando.`);
                    return null;
                }

                console.log(`[${symbolDoc.sy_id}] Análisis completado. Promedio: ${promedio.toFixed(2)}%`);

                // Construir el documento de análisis (sin fees para async)
                let analysisResult = {
                    id_exdataMin: minSellData.id_ex,
                    id_exdataMax: maxBuyData.id_ex,
                    Val_max_buy: maxBuyData.Val_buy,
                    Val_min_sell: minSellData.Val_sell,
                    symbol: symbolDoc.sy_id,
                    promedio: promedio,
                    id_exchsymbol: symbolDoc._id,
                    taker_fee_exMin: 0.001, // Default fee
                    maker_fee_exMin: 0.001, // Default fee
                    taker_fee_exMax: 0.001, // Default fee
                    maker_fee_exMax: 0.001, // Default fee
                    timestamp: new Date()
                };
                return analysisResult;
            } catch (error) {
                console.error(`Error analizando el símbolo ${symbolDoc.sy_id}: ${error.message}`);
                return null;
            }
        });

        const analysisResults = (await Promise.all(analysisPromises)).filter(Boolean);

        // 6. Limpiar análisis antiguos e insertar los nuevos masivamente
        console.log(`Clearing old analysis and inserting ${analysisResults.length} new documents...`);
        await Analysis.deleteMany({});
        if (analysisResults.length > 0) {
            await Analysis.insertMany(analysisResults);
        }

        console.timeEnd("addAnalyzeSymbolsAsync-TotalTime");
        console.log(`Async analysis complete. Inserted ${analysisResults.length} new opportunities.`);

    } catch (error) {
        console.timeEnd("addAnalyzeSymbolsAsync-TotalTime");
        console.error("Critical error in addAnalyzeSymbolsAsync:", error);
    }
};



/**
 * Actualiza los campos de withdrawal, fee y deposit para cada análisis en la base de datos
 */
const updateAnalysisFee = async (req, res) => {
  try {
    const analysisList = await Analysis.find({}, { id_exdataMin: 1, id_exdataMax: 1, symbol: 1 }).lean();
    console.log(`Iniciando actualización de withdrawal/fee/deposit para ${analysisList.length} análisis.`);

    for (const analysis of analysisList) {

      let exMin = await initializeExchange(analysis.id_exdataMin);
      let exMax = await initializeExchange(analysis.id_exdataMax);

      if (!exMin || !exMax) {
        console.warn(`Skipping analysis for symbol ${analysis.symbol} due to invalid exchange ID: ${!exMin ? analysis.id_exdataMin : ''} ${!exMax ? analysis.id_exdataMax : ''}`);
        return; // Skip this iteration
      }
      console.log(analysis.id_exdataMin);
      console.log(analysis.id_exdataMax);
    //   console.log(exMin)

      // Cargar mercados para obtener la moneda base
      const [marketsMin, marketsMax] = await Promise.all([exMin.loadMarkets(true), exMax.loadMarkets(true)]);

      if (!marketsMin || !marketsMax) {
        console.warn(`Error cargando mercados para ${exMin.id} o ${exMax.id}. Saltando análisis para ${analysis.symbol}`);
        continue; // Skip this iteration
      }

      // Validar que el símbolo existe en ambos exchanges
      if (!exMin.markets[analysis.symbol] || !exMax.markets[analysis.symbol]) {
        console.warn(`Símbolo '${analysis.symbol}' no encontrado en alguno de los exchanges: ${exMin.id} o ${exMax.id}`);

      }

      // Es crucial para obtener información detallada de las redes.
      if (exMin.has['fetchCurrencies'] && exMax.has['fetchCurrencies']) {
        await Promise.all([exMin.fetchCurrencies(), exMax.fetchCurrencies()]);

      }

      const marketMin = await exMin.markets[analysis.symbol];
      const marketMax = await exMax.markets[analysis.symbol];
      const baseCurrencyCodeMin = marketMin.base;
      const baseCurrencyCodeMax = marketMax.base;
      const currencyInfoMin = exMin.currencies[baseCurrencyCodeMin];
      const currencyInfoMax = exMax.currencies[baseCurrencyCodeMax];
      console.log(`Actualizando análisis para ${analysis.symbol} en ${exMin.id} y ${exMax.id}`);
      console.log(currencyInfoMin);
// Update the analysis with withdrawal and fee from currencyInfoMin and deposit from currencyInfoMax
await Analysis.updateOne(
  { _id: analysis._id },
  {
    $set: {
      withdraw: currencyInfoMin.withdraw || false,
      fee: currencyInfoMin.fee || 0,
      deposit: currencyInfoMax.deposit || false
    }
  }
);


    // Obtener información de redes para cada exchange

    }

    console.log(`Actualización de withdrawal/fee/deposit completada para ${analysisList.length} análisis.`);
    res.status(200).json({ message: `Actualización de withdrawal/fee/deposit completada para ${analysisList.length} análisis.` });
}catch (error) {
    console.error(`Error fetching networks for analysis:`, error);
    // En caso de un error inesperado (ej. de red), saltamos a la siguiente iteración
    // para no afectar la ejecución global.
    res.status(500).json({ message: `Error fetching networks for analysis: ${error.message}` });
  }
};
const updateAnalysisWithdrawDepositFee = async (req, res) => { //NOSONAR
    // Responder inmediatamente para no bloquear la solicitud
    if (res && !res.headersSent) {
        res.status(202).json({ message: "El proceso para actualizar la información de retiro/depósito ha comenzado en segundo plano." });
    }

    // Ejecutar la lógica pesada en segundo plano
    (async () => {
        try {
            // Se necesita el _id para actualizar el documento correcto de forma segura
            const analysisList = await Analysis.find({}, { id_exdataMin: 1, id_exdataMax: 1, symbol: 1, _id: 1 }).lean();
            console.log(`Iniciando actualización de withdrawal/fee/deposit para ${analysisList.length} análisis.`);

            const promises = analysisList.map(async (analysis) => {
                try {
                    // CORRECCIÓN: `ccxt.exchanges` es un array de strings. Se debe instanciar el exchange.
                    const exMin = initializeExchange(analysis.id_exdataMin);
                    const exMax = initializeExchange(analysis.id_exdataMax);

                    if (!exMin || !exMax) {
                        console.warn(`[Update Fees] Skipping analysis for symbol ${analysis.symbol} due to invalid exchange ID: ${!exMin ? analysis.id_exdataMin : ''} ${!exMax ? analysis.id_exdataMax : ''}`);
                        return; // Skip this iteration
                    }

                    // Cargar mercados para obtener la moneda base
                    await Promise.all([exMin.loadMarkets(), exMax.loadMarkets()]);                    

                    // Es crucial para obtener información detallada de las monedas y redes.
                    if (exMin.has['fetchCurrencies']) {
                        await exMin.fetchCurrencies();
                    }
                    if (exMax.has['fetchCurrencies']) {
                        await exMax.fetchCurrencies();
                    }
                    const market = exMin.markets[analysis.symbol];
                    if (!market || !market.base) {
                        console.warn(`[Update Fees] Skipping analysis for symbol ${analysis.symbol} on ${analysis.id_exdataMin}: Market or base currency not found.`);
                        return;
                    }
                    const currencyCode = market.base;

                    // Obtener la información de la moneda para cada exchange
                    const currencyInfoMin = exMin.currencies ? exMin.currencies[currencyCode] : null;
                    const currencyInfoMax = exMax.currencies ? exMax.currencies[currencyCode] : null;

                    // Construir el payload con los datos específicos solicitados
                    const updatePayload = {};
                    if (currencyInfoMin) {
                        updatePayload.withdraw = currencyInfoMin.withdraw === true;
                        updatePayload.fee = (typeof currencyInfoMin.fee === 'number') ? currencyInfoMin.fee : null;
                    }
                    if (currencyInfoMax) {
                        updatePayload.deposit = currencyInfoMax.deposit === true;
                    }

                    // Actualizar el documento solo si hay algo que actualizar
                    if (Object.keys(updatePayload).length > 0) {
                        await Analysis.updateOne({ _id: analysis._id }, { $set: updatePayload });
                    }
                } catch (error) {
                    console.error(`[Update Fees] Error updating analysis for symbol ${analysis.symbol} (${analysis._id}):`, error.message);
                }
            });
            await Promise.all(promises);
            console.log(`[Update Fees] Finished updating withdrawal/fee/deposit for all applicable analyses.`);
        } catch (error) {
            console.error("Critical error in updateAnalysisWithdrawDepositFee:", error);
        }
    })();
}





/**
 * Función para obtener datos formateados del top 20 de análisis
 */
const getFormattedTopAnalysis = async () => {
    try {
        const topAnalysis = await Analysis.find()
            .populate('id_exchsymbol', 'sy_id')
            .sort({ promedio: -1 })
            .limit(20);

        const formattedData = topAnalysis.map(record => ({
            symbol: record.id_exchsymbol ? record.id_exchsymbol.sy_id : 'Unknown',
            exchange_buy: record.id_exdataMax,
            exchange_sell: record.id_exdataMin,
            buy_price: record.Val_max_buy,
            sell_price: record.Val_min_sell,
            profit_percentage: record.promedio,
            taker_fee_buy: record.taker_fee_exMax || 0.001,
            maker_fee_buy: record.maker_fee_exMax || 0.001,
            taker_fee_sell: record.taker_fee_exMin || 0.001,
            maker_fee_sell: record.maker_fee_exMin || 0.001,
            timestamp: record.timestamp
        }));

        return formattedData;
    } catch (error) {
        console.error('Error obteniendo top analysis formateado:', error);
        return [];
    }
};

/**
 * Función para obtener datos de entrenamiento para el modelo de IA
 * Basada en los parámetros recibidos desde V3
 */
const dataTrainModel = async (req) => {
    try {
        const { payload } = req;
        const { 
            start_date, 
            end_date, 
            limit = 1000, 
            epochs = 100,
            include_fees = true
        } = payload || {};

        console.log('Obteniendo datos de entrenamiento con parámetros:', {
            start_date, end_date, limit, epochs, include_fees
        });

        // Construir filtro de fecha
        let dateFilter = {};
        if (start_date) {
            dateFilter.timestamp = { $gte: new Date(start_date) };
        }
        if (end_date) {
            if (dateFilter.timestamp) {
                dateFilter.timestamp.$lte = new Date(end_date);
            } else {
                dateFilter.timestamp = { $lte: new Date(end_date) };
            }
        }

        // Obtener datos de análisis históricos
        const historicalData = await Analysis.find(dateFilter)
            .populate('id_exchsymbol', 'sy_id')
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));

        // Formatear datos para entrenamiento
        const trainingData = historicalData.map(record => {
            // Calcular rentabilidad neta considerando fees
            let netProfit = record.promedio;
            if (include_fees) {
                const totalFees = (record.taker_fee_exMax || 0.001) +
                                 (record.taker_fee_exMin || 0.001);
                netProfit = record.promedio - (totalFees * 100);
            }

            // Clasificar el nivel de riesgo basado en la rentabilidad
            let riskLevel = 'low';
            if (netProfit > 5) riskLevel = 'high';
            else if (netProfit > 2) riskLevel = 'medium';

            return {
                symbol: record.id_exchsymbol ? record.id_exchsymbol.sy_id : 'Unknown',
                exchange_buy: record.id_exdataMax,
                exchange_sell: record.id_exdataMin,
                buy_price: record.Val_max_buy,
                sell_price: record.Val_min_sell,
                gross_profit_percentage: record.promedio,
                net_profit_percentage: netProfit,
                taker_fee_buy: record.taker_fee_exMax || 0.001,
                maker_fee_buy: record.maker_fee_exMax || 0.001,
                taker_fee_sell: record.taker_fee_exMin || 0.001,
                maker_fee_sell: record.maker_fee_exMin || 0.001,
                risk_level: riskLevel,
                is_profitable: netProfit > 0.1, // Rentable si es mayor a 0.1%
                timestamp: record.timestamp,
                // Características adicionales para el modelo
                price_spread: record.Val_min_sell - record.Val_max_buy,
                price_ratio: record.Val_min_sell / record.Val_max_buy,
                volume_indicator: Math.random() * 100, // Placeholder - se puede mejorar con datos reales
                market_volatility: Math.abs(record.promedio) / 10 // Indicador simple de volatilidad
            };
        });

        console.log(`Datos de entrenamiento generados: ${trainingData.length} registros`);
        return trainingData;

    } catch (error) {
        console.error('Error generando datos de entrenamiento:', error);
        throw error;
    }
};

/**
 * Función para actualizar precios del top 20 (si no existe)
 */
const actualizePricetop20 = async () => {
    try {
        // Esta función debería actualizar los precios del top 20
        // Por ahora, simplemente ejecutamos el análisis
        console.log('Actualizando precios del top 20...');
        // Aquí se podría llamar a addAnalyzeSymbolsAsync() si es necesario
    } catch (error) {
        console.error('Error actualizando precios del top 20:', error);
    }
};


/**
 * Actualiza los precios y el promedio de todos los documentos de análisis.
 * Este método está diseñado para ser eficiente en memoria y ejecutarse periódicamente.
 */
const updateAllAnalysisPrices = async () => {
    console.log('Iniciando la actualización de precios de análisis...');
    const ccxtCache = {}; // Cache para las instancias de CCXT y evitar reinicialización
    const analysisCursor = Analysis.find().cursor();

    try {
        for (let doc = await analysisCursor.next(); doc != null; doc = await analysisCursor.next()) {
            try {
                const { _id, id_exdataMin, id_exdataMax, symbol } = doc;

                // Inicializar instancias de exchange (usando caché)
                if (!ccxtCache[id_exdataMin]) {
                    ccxtCache[id_exdataMin] = initializeExchange(id_exdataMin);
                }
                if (!ccxtCache[id_exdataMax]) {
                    ccxtCache[id_exdataMax] = initializeExchange(id_exdataMax);
                }

                const exchangeMin = ccxtCache[id_exdataMin];
                const exchangeMax = ccxtCache[id_exdataMax];

                if (!exchangeMin || !exchangeMax) {
                    console.warn(`[Price Update] No se pudo inicializar uno de los exchanges para el símbolo ${symbol}. Min: ${id_exdataMin}, Max: ${id_exdataMax}. Saltando.`);
                    continue;
                }

                // Obtener los tickers (precios actuales) de ambos exchanges
                const [tickerMin, tickerMax] = await Promise.all([
                    exchangeMin.fetchTicker(symbol),
                    exchangeMax.fetchTicker(symbol)
                ]);

                // El precio de venta (ask) se obtiene del exchange con el precio mínimo (id_exdataMin)
                // El precio de compra (bid) se obtiene del exchange con el precio máximo (id_exdataMax)
                const newSellPrice = tickerMin ? tickerMin.ask : null;
                const newBuyPrice = tickerMax ? tickerMax.bid : null;

                if (newSellPrice && newBuyPrice && newBuyPrice > 0) {
                    // Calcular el nuevo promedio (porcentaje de diferencia)
                    const newPromedio = ((newSellPrice - newBuyPrice) / newBuyPrice) * 100;

                    // Actualizar el documento en la base de datos
                    await Analysis.updateOne(
                        { _id: _id },
                        {
                            $set: {
                                Val_min_sell: newSellPrice,
                                Val_max_buy: newBuyPrice,
                                promedio: newPromedio,
                                timestamp: new Date()
                            }
                        }
                    );
                    console.log(`[Price Update] Símbolo ${symbol} actualizado. Nuevo promedio: ${newPromedio.toFixed(2)}%`);
                } else {
                    console.warn(`[Price Update] No se pudieron obtener los precios para el símbolo ${symbol} en ${id_exdataMin}/${id_exdataMax}. Saltando.`);
                }

            } catch (error) {
                console.error(`[Price Update] Error procesando el documento para el símbolo ${doc.symbol}: ${error.message}`);
                // Continuar con el siguiente documento
            }
        }
    } catch (error) {
        console.error('[Price Update] Error crítico durante el proceso de actualización de precios:', error);
    } finally {
        console.log('Finalizada la actualización de precios de análisis.');
    }
};

/**
 * Método síncrono que actualiza los valores de los 20 primeros documentos
 * de la colección Analysis ordenados por promedio del más alto al más bajo
 */
const updateTop20AnalysisPrices = async () => {
    console.log('[Top20 Update] Iniciando actualización de precios del Top 20...');
    const ccxtCache = {}; // Cache para las instancias de CCXT
    
    try {
        // Obtener los 20 documentos con mayor promedio
        const top20Analysis = await Analysis.find()
            .sort({ promedio: -1 })
            .limit(20)
            .lean();

        if (top20Analysis.length === 0) {
            console.log('[Top20 Update] No hay documentos de análisis para actualizar.');
            return;
        }

        console.log(`[Top20 Update] Actualizando ${await top20Analysis.length} documentos del Top 20...`);

        // Procesar cada documento del Top 20
        const updatePromises = await top20Analysis.map(async (doc) => {
            try {
                const { _id, id_exdataMin, id_exdataMax, symbol } = doc;

                // Inicializar instancias de exchange (usando caché)
                if (!ccxtCache[id_exdataMin]) {
                    ccxtCache[id_exdataMin] = initializeExchange(id_exdataMin);
                    if (ccxtCache[id_exdataMin]) {
                        await ccxtCache[id_exdataMin].loadMarkets();
                    }
                }
                if (!ccxtCache[id_exdataMax]) {
                    ccxtCache[id_exdataMax] = initializeExchange(id_exdataMax);
                    if (ccxtCache[id_exdataMax]) {
                        await ccxtCache[id_exdataMax].loadMarkets();
                    }
                }

                const exchangeMin = await ccxtCache[id_exdataMin];
                const exchangeMax = await ccxtCache[id_exdataMax];

                if (!exchangeMin || !exchangeMax) {
                    console.warn(`[Top20 Update] No se pudo inicializar exchanges para ${symbol}. Min: ${id_exdataMin}, Max: ${id_exdataMax}`);
                    return null;
                }

                // Verificar que el símbolo existe en ambos exchanges
                if (!exchangeMin.markets[symbol] || !exchangeMax.markets[symbol]) {
                    console.warn(`[Top20 Update] Símbolo ${symbol} no encontrado en uno de los exchanges`);
                    return null;
                }

                // Obtener los tickers (precios actuales) de ambos exchanges
                const [tickerMin, tickerMax] = await Promise.all([
                    exchangeMin.fetchTicker(symbol).catch(err => {
                        console.warn(`[Top20 Update] Error obteniendo ticker de ${id_exdataMin} para ${symbol}: ${err.message}`);
                        return null;
                    }),
                    exchangeMax.fetchTicker(symbol).catch(err => {
                        console.warn(`[Top20 Update] Error obteniendo ticker de ${id_exdataMax} para ${symbol}: ${err.message}`);
                        return null;
                    })
                ]);

                if (!tickerMin || !tickerMax) {
                    console.warn(`[Top20 Update] No se pudieron obtener tickers para ${symbol}`);
                    return null;
                }

                // El precio de venta (ask) se obtiene del exchange con el precio mínimo (id_exdataMin)
                // El precio de compra (bid) se obtiene del exchange con el precio máximo (id_exdataMax)
                const newSellPrice = tickerMin.ask;
                const newBuyPrice = tickerMax.bid;

                if (newSellPrice && newBuyPrice && newBuyPrice > 0) {
                    // Calcular el nuevo promedio (porcentaje de diferencia)
                    const newPromedio = ((newSellPrice - newBuyPrice) / newBuyPrice) * 100;

                    // Actualizar el documento en la base de datos
                    await Analysis.updateOne(
                        { _id: _id },
                        {
                            $set: {
                                Val_min_sell: newSellPrice,
                                Val_max_buy: newBuyPrice,
                                promedio: newPromedio,
                                timestamp: new Date()
                            }
                        }
                    );

                    console.log(`[Top20 Update] ${symbol}: ${doc.promedio.toFixed(4)}% → ${newPromedio.toFixed(4)}%`);
                    return { symbol, oldPromedio: doc.promedio, newPromedio };
                } else {
                    console.warn(`[Top20 Update] Precios inválidos para ${symbol}. Sell: ${newSellPrice}, Buy: ${newBuyPrice}`);
                    return null;
                }

            } catch (error) {
                console.error(`[Top20 Update] Error procesando ${doc.symbol}: ${error.message}`);
                return null;
            }
        });

        // Esperar a que todas las actualizaciones se completen
        const results = await Promise.all(updatePromises);
        const successfulUpdates = results.filter(result => result !== null);

        console.log(`[Top20 Update] Completado. ${successfulUpdates.length}/${top20Analysis.length} documentos actualizados exitosamente.`);

    } catch (error) {
        console.error('[Top20 Update] Error crítico durante la actualización del Top 20:', error);
    }
};

/**
 * Inicia el proceso de actualización automática del Top 20 cada 10 segundos
 */
let top20UpdateInterval = null;

   

/**
 * Detiene el proceso de actualización automática del Top 20
 */



module.exports = {
    createAnalysis,
    getAllAnalysis,
    getAnalysisById,
    updateAnalysis,
    deleteAnalysis,
    addAnalyzeSymbols,
    addAnalyzeSymbolsAsync,
    getHistoricalAnalysis,
    getHistoricalOHLCV,
    getFormattedTopAnalysis,
    dataTrainModel,
    actualizePricetop20,
    updateAnalysisWithdrawDepositFee,
    updateAnalysisFee,
    updateAllAnalysisPrices,
    updateTop20AnalysisPrices,

};
