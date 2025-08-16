const Analysis = require('../data/dataBase/modelosBD/analysis.model');
const ExchangeSymbol = require('../data/dataBase/modelosBD/exchangeSymbol.model');
const { Parser } = require('json2csv');
const { getExchangeTimeframe } = require('../utils/timeframeConverter');
const { getLowestFeeNetwork, initializeExchange } = require('./exchangeController');
const ccxt = require('ccxt');
const fs = require('fs').promises;
const path = require('path');

const fetchAllHistoricalData = async (data, since, intervalo) => {
  const { symbol, buyExchangeId, sellExchangeId } = data;
  const limit = 1000; // Max limit for most exchanges
  let allBuyData = [];
  let allSellData = [];
  let lastTimestamp = since;

  try {
    const buyExchange = initializeExchange(buyExchangeId);
    const sellExchange = initializeExchange(sellExchangeId);

    if (!buyExchange || !sellExchange) {
      console.warn(`⚠️  Saltando símbolo ${symbol}: No se pudieron inicializar los exchanges ${buyExchangeId}/${sellExchangeId}`);
      return [];
    }

    const buyIntervalo = getExchangeTimeframe(buyExchange, intervalo);
    const sellIntervalo = getExchangeTimeframe(sellExchange, intervalo);

    if (!buyExchange.has['fetchOHLCV'] || !sellExchange.has['fetchOHLCV']) {
      console.warn(`⚠️  Saltando símbolo ${symbol}: Uno de los exchanges no soporta fetchOHLCV`);
      return [];
    }

    // Verificar si el símbolo existe en ambos exchanges
    try {
      await Promise.all([
        buyExchange.loadMarkets(),
        sellExchange.loadMarkets()
      ]);

      if (!buyExchange.markets[symbol] || !sellExchange.markets[symbol]) {
        console.warn(`⚠️  Saltando símbolo ${symbol}: No está disponible en uno o ambos exchanges (${buyExchangeId}/${sellExchangeId})`);
        return [];
      }
    } catch (marketError) {
      console.warn(`⚠️  Saltando símbolo ${symbol}: Error al cargar mercados - ${marketError.message}`);
      return [];
    }

    let moreData = true;
    let consecutiveEmptyResponses = 0;
    const maxEmptyResponses = 3;

    while (moreData && consecutiveEmptyResponses < maxEmptyResponses) {
      try {
        const [buyData, sellData] = await Promise.all([
          buyExchange.fetchOHLCV(symbol, buyIntervalo, lastTimestamp, limit),
          sellExchange.fetchOHLCV(symbol, sellIntervalo, lastTimestamp, limit)
        ]);

        // Validar que los datos no estén vacíos o sean inválidos
        if (!buyData || !Array.isArray(buyData) || buyData.length === 0) {
          consecutiveEmptyResponses++;
          if (consecutiveEmptyResponses >= maxEmptyResponses) {
            console.warn(`⚠️  Saltando símbolo ${symbol}: No hay más datos históricos disponibles en ${buyExchangeId}`);
            moreData = false;
          }
          continue;
        }

        if (!sellData || !Array.isArray(sellData) || sellData.length === 0) {
          console.warn(`⚠️  Saltando símbolo ${symbol}: No hay datos históricos disponibles en ${sellExchangeId}`);
          moreData = false;
          continue;
        }

        // Validar que los datos no contengan valores inválidos
        const validBuyData = buyData.filter(candle => {
          return candle && Array.isArray(candle) && candle.length >= 5 &&
                 candle[0] && !isNaN(candle[0]) && isFinite(candle[0]) && // timestamp
                 candle[4] && !isNaN(candle[4]) && isFinite(candle[4]) && candle[4] > 0; // close price
        });

        const validSellData = sellData.filter(candle => {
          return candle && Array.isArray(candle) && candle.length >= 5 &&
                 candle[0] && !isNaN(candle[0]) && isFinite(candle[0]) && // timestamp
                 candle[4] && !isNaN(candle[4]) && isFinite(candle[4]) && candle[4] > 0; // close price
        });

        if (validBuyData.length === 0 || validSellData.length === 0) {
          console.warn(`⚠️  Saltando lote de datos para ${symbol}: Datos inválidos o con valores infinity/undefined`);
          consecutiveEmptyResponses++;
          continue;
        }

        // Resetear contador de respuestas vacías si obtuvimos datos válidos
        consecutiveEmptyResponses = 0;

        allBuyData = allBuyData.concat(validBuyData);
        allSellData = allSellData.concat(validSellData);
        
        lastTimestamp = validBuyData[validBuyData.length - 1][0] + 1;

      } catch (fetchError) {
        console.warn(`⚠️  Error obteniendo datos para ${symbol}: ${fetchError.message}`);
        consecutiveEmptyResponses++;
        if (consecutiveEmptyResponses >= maxEmptyResponses) {
          moreData = false;
        }
      }
    }

    // Verificar que tengamos datos suficientes
    if (allBuyData.length === 0 || allSellData.length === 0) {
      console.warn(`⚠️  Saltando símbolo ${symbol}: No se obtuvieron datos históricos válidos`);
      return [];
    }

    // Synchronize data by timestamp
    const synchronizedData = [];
    const sellDataMap = new Map(allSellData.map(candle => [candle[0], candle[4]])); // Map<timestamp, close_price>

    for (const buyCandle of allBuyData) {
      const timestamp = buyCandle[0];
      const buyPrice = buyCandle[4];
      const sellPrice = sellDataMap.get(timestamp);

      // Validar que todos los valores sean válidos antes de agregar
      if (sellPrice &&
          timestamp && !isNaN(timestamp) && isFinite(timestamp) &&
          buyPrice && !isNaN(buyPrice) && isFinite(buyPrice) && buyPrice > 0 &&
          sellPrice && !isNaN(sellPrice) && isFinite(sellPrice) && sellPrice > 0) {
        
        synchronizedData.push({
          timestamp: timestamp,
          buyPrice: buyPrice,
          sellPrice: sellPrice
        });
      }
    }

    if (synchronizedData.length === 0) {
      console.warn(`⚠️  Saltando símbolo ${symbol}: No se pudieron sincronizar los datos entre exchanges`);
      return [];
    }

    console.log(`✅ Datos obtenidos para ${symbol}: ${synchronizedData.length} puntos sincronizados`);
    return synchronizedData;

  } catch (error) {
    console.warn(`⚠️  Saltando símbolo ${symbol}: Error general - ${error.message}`);
    return [];
  }
};

const fetchHistoricalData = async (data, fecha_inicio, intervalo, cantidad_operaciones) => {
  const { symbol, buyExchangeId, sellExchangeId } = data;
  const since = fecha_inicio ? new Date(fecha_inicio).getTime() : undefined;
  // CCXT limit is per request, and often capped at 1000 by exchanges.
  const limit = cantidad_operaciones ? parseInt(cantidad_operaciones) : 100;

  try {
    const buyExchange = initializeExchange(buyExchangeId);
    const sellExchange = initializeExchange(sellExchangeId);

    if (!buyExchange || !sellExchange) {
      console.error(`Failed to initialize one or both exchanges for fetchHistoricalData: ${buyExchangeId}, ${sellExchangeId}`);
      return [];
    }

    // Convertir el intervalo al formato específico de cada exchange
    const buyIntervalo = getExchangeTimeframe(buyExchange, intervalo);
    const sellIntervalo = getExchangeTimeframe(sellExchange, intervalo);

    console.log(`Usando intervalos: buy=${buyIntervalo}, sell=${sellIntervalo} para intervalo original=${intervalo}`);

    if (!buyExchange.has['fetchOHLCV'] || !sellExchange.has['fetchOHLCV']) {
        console.error(`Uno de los exchanges no soporta fetchOHLCV.`);
        return [];
    }

    // Fetch in parallel usando los intervalos convertidos
    const [buyData, sellData] = await Promise.all([
        buyExchange.fetchOHLCV(symbol, buyIntervalo, since, limit),
        sellExchange.fetchOHLCV(symbol, sellIntervalo, since, limit)
    ]);

    // Synchronize data by timestamp
    const synchronizedData = [];
    const sellDataMap = new Map(sellData.map(candle => [candle[0], candle[4]])); // Map<timestamp, close_price>

    for (const buyCandle of buyData) {
        const timestamp = buyCandle[0];
        const sellPrice = sellDataMap.get(timestamp);

        if (sellPrice) {
            synchronizedData.push({
                timestamp: timestamp,
                buyPrice: buyCandle[4], // close price
                sellPrice: sellPrice
            });
        }
    }
    return synchronizedData;
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol} on ${buyExchangeId}/${sellExchangeId}:`, error);
    return [];
  }
};

const simulateTrade = async (dataPoint, balanceConfig, buyFeeRate, sellFeeRate, transferFee, buyExchangeId, sellExchangeId, symbol) => {
  // Validar que todos los parámetros sean válidos
  if (!dataPoint || typeof dataPoint !== 'object') {
    return null;
  }

  const current_price_buy = dataPoint.buyPrice;
  const current_price_sell = dataPoint.sellPrice;
  const timestamp = dataPoint.timestamp;

  // Validaciones exhaustivas para evitar valores infinity o undefined
  if (!current_price_buy || !current_price_sell || !timestamp ||
      !isFinite(current_price_buy) || !isFinite(current_price_sell) || !isFinite(timestamp) ||
      isNaN(current_price_buy) || isNaN(current_price_sell) || isNaN(timestamp) ||
      current_price_buy <= 0 || current_price_sell <= 0) {
    return null;
  }

  // Validar parámetros de configuración
  if (!isFinite(balanceConfig) || isNaN(balanceConfig) || balanceConfig <= 0 ||
      !isFinite(buyFeeRate) || isNaN(buyFeeRate) || buyFeeRate < 0 ||
      !isFinite(sellFeeRate) || isNaN(sellFeeRate) || sellFeeRate < 0 ||
      !isFinite(transferFee) || isNaN(transferFee) || transferFee < 0) {
    return null;
  }

  const investment_usdt = balanceConfig < 100 ? balanceConfig : 100;

  // Validar que investment_usdt sea válido
  if (!isFinite(investment_usdt) || isNaN(investment_usdt) || investment_usdt <= 0) {
    return null;
  }

  // Lógica de cálculo de profit basada en porcentajes con validaciones
  const gross_profit_percentage = (current_price_sell - current_price_buy) / current_price_buy;
  const transfer_fee_percentage = transferFee / investment_usdt;
  // CORRECCIÓN: El fee de venta se aplica sobre el monto final, que es mayor.
  // Se ajusta para un cálculo de profit neto más preciso.
  const sell_fee_adjusted_percentage = sellFeeRate * (1 + gross_profit_percentage);
  const total_fees_percentage = buyFeeRate + sell_fee_adjusted_percentage + transfer_fee_percentage;

  // Validar que los cálculos no produzcan valores inválidos
  if (!isFinite(gross_profit_percentage) || isNaN(gross_profit_percentage) ||
      !isFinite(transfer_fee_percentage) || isNaN(transfer_fee_percentage) ||
      !isFinite(total_fees_percentage) || isNaN(total_fees_percentage)) {
    return null;
  }

  const net_profit_percentage = gross_profit_percentage - total_fees_percentage;

  // Validar el resultado final
  if (!isFinite(net_profit_percentage) || isNaN(net_profit_percentage)) {
    return null;
  }

  // Decisión basada en el umbral de 0.6%
  const decision_outcome = net_profit_percentage > 0.06 ? 'EJECUTADA' : 'NO_EJECUTADA';
  const net_profit_usdt = decision_outcome === 'EJECUTADA' ? net_profit_percentage * investment_usdt : 0;

  // Calcular fees con validaciones
  const estimated_buy_fee = investment_usdt * buyFeeRate;
  const estimated_sell_fee = (investment_usdt * (1 + gross_profit_percentage)) * sellFeeRate;
  const total_fees_usdt = estimated_buy_fee + estimated_sell_fee + transferFee;
  const profit_percentage = net_profit_percentage * 100;
  const execution_time_seconds = Math.random() * (120 - 30) + 30;

  // Validar todos los valores calculados antes de crear el objeto
  if (!isFinite(estimated_buy_fee) || isNaN(estimated_buy_fee) ||
      !isFinite(estimated_sell_fee) || isNaN(estimated_sell_fee) ||
      !isFinite(total_fees_usdt) || isNaN(total_fees_usdt) ||
      !isFinite(profit_percentage) || isNaN(profit_percentage) ||
      !isFinite(execution_time_seconds) || isNaN(execution_time_seconds)) {
    return null;
  }

  // Estructurar el objeto de retorno para que coincida con lo que espera `ai_model.py`
  return {
    // --- Campos Originales Requeridos ---
    buy_exchange_id: buyExchangeId,
    sell_exchange_id: sellExchangeId,
    symbol: symbol,
    decision_outcome: decision_outcome,
    net_profit_usdt: net_profit_usdt,

    // --- Nuevos Campos para ai_model.py ---
    current_price_buy: current_price_buy,
    current_price_sell: current_price_sell,
    investment_usdt: investment_usdt,

    // Fees detallados
    estimated_buy_fee: estimated_buy_fee,
    estimated_sell_fee: estimated_sell_fee,
    estimated_transfer_fee: transferFee,
    total_fees_usdt: total_fees_usdt,

    profit_percentage: profit_percentage, // Enviar como porcentaje

    // Datos de mercado en la estructura esperada
    market_data: {
      buy_fees: { taker: buyFeeRate, maker: buyFeeRate }, // Asumimos taker/maker son iguales
      sell_fees: { taker: sellFeeRate, maker: sellFeeRate },
      transferFee: transferFee,
    },

    // Campos adicionales con valores por defecto o placeholders
    execution_time_seconds: execution_time_seconds,
    timestamp: new Date(timestamp).toISOString(),
    balance_config: { balance_usdt: balanceConfig },
    id_exch_balance: buyExchangeId, // Campo del esquema anterior
  };
};

const getRandomSymbols = async (count) => {
  // Fetch random symbols from ExchangeSymbol collection
  const total = await ExchangeSymbol.countDocuments();
  const random = Math.floor(Math.random() * (total - count));
  const symbols = await ExchangeSymbol.find().skip(random).limit(count);
  // console.log( await symbols);
  return await symbols;
};

const getRandomAnalysis = async (count) => {
  // Fetch random documents from Analysis collection
  const total = await Analysis.countDocuments();
  const random = Math.floor(Math.random() * (total - count));
  const analysis = await Analysis.find().skip(random).limit(count);
  return analysis;
};

const createTrainingCSV = async (req, res) => {
  try {
    // 1. Desestructurar el cuerpo de la solicitud sin 'await'
    const { fecha, operaciones, cantidadSimbolos, listaSimbolos, intervalo } = req.body;

    let symbols = [];
    if (listaSimbolos && listaSimbolos.length > 0) {
      // Usar la lista de símbolos proporcionada
      symbols = await ExchangeSymbol.find({ symbolName: { $in: listaSimbolos } });
    } else if (cantidadSimbolos) {
      // Seleccionar símbolos aleatorios
      // symbols = await getRandomSymbols(cantidadSimbolos);
      const analysisList = await getRandomAnalysis(cantidadSimbolos);
    } else {
      return res.status(400).json({ error: 'Debe proporcionar cantidadSimbolos o listaSimbolos' });
    }

    // 2. Obtener el _id de los símbolos para la consulta
    // const  symbolIds = symbols.map(s => s._id);

    // 3. Obtener análisis para los símbolos de forma asíncrona
    

    let balanceConfig = 20;
    const results = [];
    let operationsCount = 0;
    const totalOperationsRequested = parseInt(operaciones) || 1000;

    // 4. Iterar sobre la lista de análisis.
    for (const analysis of analysisList) {
      if (operationsCount >= totalOperationsRequested) {
        break;
      }

      if (!analysis.id_exchsymbol) {
        continue;
      }

      const symbolDoc = await ExchangeSymbol.findById(analysis.id_exchsymbol, 'sy_id');
      if (!symbolDoc) {
        console.warn(`Advertencia: No se encontró el símbolo con id_exchsymbol ${analysis.id_exchsymbol}`);
        continue;
      }

      // 5. Usar el fee de retiro almacenado en el documento de análisis.
      // Se establece un valor por defecto si 'fee' no está presente.
      const transferFee = analysis.fee || 0.0005;

      let data = {
        symbol: symbolDoc.sy_id,
        buyExchangeId: analysis.id_exdataMin,
        sellExchangeId: analysis.id_exdataMax,
        buyFees: analysis.taker_fee_exMin,
        sellFees: analysis.taker_fee_exMax,
        transferFee: transferFee
      };

      // 6. Obtener datos históricos de forma asíncrona.
      const historicalData = await fetchHistoricalData(data, fecha, intervalo, totalOperationsRequested - operationsCount);
      
      // 7. Iterar sobre los datos históricos. No se necesita 'await' aquí.
      for (const dataPoint of historicalData) {
        if (operationsCount >= totalOperationsRequested) {
          break;
        }
        
        const tradeResult = await simulateTrade(dataPoint, balanceConfig, data.buyFees, data.sellFees, data.transferFee, data.buyExchangeId, data.sellExchangeId, data.symbol);
        
        if (tradeResult) {
          results.push(tradeResult);
          
          balanceConfig += tradeResult.net_profit_usdt;
          if (balanceConfig < 0) balanceConfig = 0;
          operationsCount++;
        }
      }
    }
    
    // El resto del código para generar el CSV y responder al cliente está bien.
    // ... (el código de generación de CSV y respuesta no se modifica)
    const fields = [
      'buy_exchange_id',
      'sell_exchange_id',
      'symbol',
      'decision_outcome',
      'net_profit_usdt',
      'current_price_buy',
      'current_price_sell',
      'investment_usdt',
      'estimated_buy_fee',
      'estimated_sell_fee',
      'estimated_transfer_fee',
      'total_fees_usdt',
      'profit_percentage',
      'market_data',
      'execution_time_seconds',
      'timestamp',
      'balance_config',
      'id_exch_balance'
    ];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(results);

    const filename = `realData_${fecha}_${intervalo}.csv`;
    const dataDir = path.join(__dirname, '..', './../data/csv_exports/');
    
    // Asegurar que el directorio de datos existe
    await fs.mkdir(dataDir, { recursive: true });

    const filePath = path.join(dataDir, filename);

    await fs.writeFile(filePath, csv, 'utf8');

    return res.status(201).json({
      message: 'CSV de entrenamiento guardado exitosamente en el servidor.',
      filename: filename,
      path: filePath,
      records: results.length
    });

  } catch (error) {
    console.error('Error creating training CSV:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getTrainingCSVFiles = async (req, res) => {
  try {
    const dataDir = path.join(__dirname, '..', './../data/csv_exports/');
    const files = await fs.readdir(dataDir);
    const csvFiles = files.filter(file => file.endsWith('.csv'));
    
    // Crear array con nombre y ruta completa de cada archivo
    const filesWithPaths = csvFiles.map(filename => {
      const fullPath = path.join(dataDir, filename);
      return {
        name: filename,
        value: fullPath,
        filename: filename
      };
    });
    
    res.status(200).json(filesWithPaths);
  } catch (error) {
    console.error('Error listing training CSV files:', error);
    if (error.code === 'ENOENT') {
      // Si el directorio no existe, retornar una lista vacía
      return res.status(200).json([]);
    }
    res.status(500).json({ error: 'Error interno del servidor al listar los archivos CSV.' });
  }
};

const getCSVFilePath = async (req, res) => {
  try {
    const { filename } = req.body;
    
    if (!filename) {
      return res.status(400).json({ error: 'Se requiere el nombre del archivo en el body' });
    }

    // Construir la ruta completa del archivo
    const dataDir = path.join(__dirname, '..', './../../data/csv_exports/');
    const fullPath = path.join(dataDir, filename);
    
    // Verificar que el archivo existe
    try {
      await fs.access(fullPath);
    } catch (error) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    // Retornar la ruta completa del archivo
    res.status(200).json({
      filename: filename,
      fullPath: fullPath,
      relativePath: `docs/data/csv_exports/${filename}`,
      exists: true
    });

  } catch (error) {
    console.error('Error obteniendo ruta del archivo CSV:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const serveCSVFile = async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ error: 'Se requiere el nombre del archivo' });
    }

    // Construir la ruta completa del archivo
    const dataDir = path.join(__dirname, '..', './../../../docs/data/csv_exports/');
    const filePath = path.join(dataDir, filename);
    
    // Verificar que el archivo existe
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    // Leer y servir el archivo CSV
    const csvContent = await fs.readFile(filePath, 'utf8');
    
    // Configurar headers para CSV
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.status(200).send(csvContent);

  } catch (error) {
    console.error('Error sirviendo archivo CSV:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createTrainingCSVFromAnalysis = async (req, res) => {
  try {
    console.log('🚀 Iniciando generación de CSV de entrenamiento desde análisis...');
    
    const analysisList = await Analysis.find({})
      .sort({ promedio: -1 })
      .limit(1);

    // --- OPTIMIZACIÓN: PASO 1 - Preparar y ejecutar la obtención de datos en paralelo ---
    if (!analysisList || analysisList.length === 0) {
      return res.status(404).json({ message: "No se encontraron documentos de análisis." });
    }

    console.log(`📊 Procesando ${analysisList.length} análisis...`);

    const intervalo = '5m';
    const daysBack = 30;
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).getTime();

    let balanceConfig = 20;
    const results = [];
    let processedSymbols = 0;
    let skippedSymbols = 0;

    for (const analysis of analysisList) {
      if (!analysis.id_exchsymbol) {
        console.warn(`⚠️  Saltando análisis: No tiene id_exchsymbol`);
        skippedSymbols++;
        continue;
      }

      const symbolDoc = await ExchangeSymbol.findById(analysis.id_exchsymbol, 'sy_id');
      if (!symbolDoc) {
        console.warn(`⚠️  Saltando análisis: Símbolo con id_exchsymbol ${analysis.id_exchsymbol} no encontrado`);
        skippedSymbols++;
        continue;
      }

      // Validar que los datos del análisis sean válidos
      if (!analysis.id_exdataMin || !analysis.id_exdataMax ||
          !isFinite(analysis.taker_fee_exMin) || isNaN(analysis.taker_fee_exMin) ||
          !isFinite(analysis.taker_fee_exMax) || isNaN(analysis.taker_fee_exMax) ||
          analysis.taker_fee_exMin < 0 || analysis.taker_fee_exMax < 0) {
        console.warn(`⚠️  Saltando símbolo ${symbolDoc.sy_id}: Datos de análisis inválidos`);
        skippedSymbols++;
        continue;
      }

      const transferFee = analysis.fee && isFinite(analysis.fee) && !isNaN(analysis.fee) && analysis.fee >= 0
        ? analysis.fee
        : 0.0005;

      let data = {
        symbol: symbolDoc.sy_id,
        buyExchangeId: analysis.id_exdataMin,
        sellExchangeId: analysis.id_exdataMax,
        buyFees: analysis.taker_fee_exMin,
        sellFees: analysis.taker_fee_exMax,
        transferFee: transferFee
      };

      console.log(`🔄 Procesando símbolo ${symbolDoc.sy_id} (${processedSymbols + 1}/${analysisList.length})...`);

      const historicalData = await fetchAllHistoricalData(data, since, intervalo);

      if (historicalData.length === 0) {
        console.warn(`⚠️  No se obtuvieron datos históricos para ${symbolDoc.sy_id}`);
        skippedSymbols++;
        continue;
      }

      let validTrades = 0;
      for (const dataPoint of historicalData) {
        const tradeResult = await simulateTrade(dataPoint, balanceConfig, data.buyFees, data.sellFees, data.transferFee, data.buyExchangeId, data.sellExchangeId, data.symbol);

        if (tradeResult) {
          // Validar que el resultado del trade no contenga valores inválidos
          if (isFinite(tradeResult.net_profit_usdt) && !isNaN(tradeResult.net_profit_usdt) &&
              isFinite(tradeResult.profit_percentage) && !isNaN(tradeResult.profit_percentage)) {
            results.push(tradeResult);
            balanceConfig += tradeResult.net_profit_usdt;
            if (balanceConfig < 0) balanceConfig = 0;
            validTrades++;
          }
        }
      }

      if (validTrades > 0) {
        console.log(`✅ Símbolo ${symbolDoc.sy_id}: ${validTrades} trades válidos procesados`);
        processedSymbols++;
      } else {
        console.warn(`⚠️  Símbolo ${symbolDoc.sy_id}: No se generaron trades válidos`);
        skippedSymbols++;
      }
    }


    console.log(`📈 Resumen del procesamiento:`);
    console.log(`   - Símbolos procesados exitosamente: ${processedSymbols}`);
    console.log(`   - Símbolos saltados: ${skippedSymbols}`);
    console.log(`   - Total de trades generados: ${results.length}`);

    if (results.length === 0) {
      return res.status(400).json({
        error: 'No se pudieron generar datos de entrenamiento válidos',
        details: {
          processedSymbols,
          skippedSymbols,
          totalTrades: 0
        }
      });
    }

    const fields = [
      'buy_exchange_id',
      'sell_exchange_id',
      'symbol',
      'decision_outcome',
      'net_profit_usdt',
      'current_price_buy',
      'current_price_sell',
      'investment_usdt',
      'estimated_buy_fee',
      'estimated_sell_fee',
      'estimated_transfer_fee',
      'total_fees_usdt',
      'profit_percentage',
      'market_data',
      'execution_time_seconds',
      'timestamp',
      'balance_config',
      'id_exch_balance'
    ];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(results);

    const filename = `analysis_training_5m.csv`;
    const dataDir = path.join(__dirname, '..', './../data/csv_exports/');

    await fs.mkdir(dataDir, { recursive: true });

    const filePath = path.join(dataDir, filename);

    await fs.writeFile(filePath, csv, 'utf8');

    console.log(`💾 CSV guardado exitosamente: ${filename}`);

    return res.status(201).json({
      message: 'CSV de entrenamiento guardado exitosamente en el servidor.',
      filename: filename,
      path: filePath,
      records: results.length,
      summary: {
        processedSymbols,
        skippedSymbols,
        totalTrades: results.length
      }
    });

  } catch (error) {
    console.error('❌ Error en createTrainingCSVFromAnalysis:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  createTrainingCSV,
  getTrainingCSVFiles,
  getCSVFilePath,
  serveCSVFile,
  createTrainingCSVFromAnalysis,
};
