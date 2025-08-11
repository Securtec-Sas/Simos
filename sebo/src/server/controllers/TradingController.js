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
      console.error(`Failed to initialize one or both exchanges for fetchAllHistoricalData: ${buyExchangeId}, ${sellExchangeId}`);
      return [];
    }

    const buyIntervalo = getExchangeTimeframe(buyExchange, intervalo);
    const sellIntervalo = getExchangeTimeframe(sellExchange, intervalo);

    if (!buyExchange.has['fetchOHLCV'] || !sellExchange.has['fetchOHLCV']) {
      console.error(`One of the exchanges does not support fetchOHLCV.`);
      return [];
    }

    let moreData = true;
    while (moreData) {
      const [buyData, sellData] = await Promise.all([
        buyExchange.fetchOHLCV(symbol, buyIntervalo, lastTimestamp, limit),
        sellExchange.fetchOHLCV(symbol, sellIntervalo, lastTimestamp, limit)
      ]);

      if (buyData.length > 0) {
        allBuyData = allBuyData.concat(buyData);
        lastTimestamp = buyData[buyData.length - 1][0] + 1;
      } else {
        moreData = false;
      }

      if (sellData.length > 0) {
        allSellData = allSellData.concat(sellData);
      }
    }

    // Synchronize data by timestamp
    const synchronizedData = [];
    const sellDataMap = new Map(allSellData.map(candle => [candle[0], candle[4]])); // Map<timestamp, close_price>

    for (const buyCandle of allBuyData) {
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
  const investment_usdt = balanceConfig < 40 ? balanceConfig : balanceConfig * 0.2;
  const current_price_buy = dataPoint.buyPrice;
  const current_price_sell = dataPoint.sellPrice;

  if (!current_price_buy || !current_price_sell || current_price_buy <= 0) {
    return null;
  }

  // Lógica de cálculo de profit basada en porcentajes
  const gross_profit_percentage = (current_price_sell - current_price_buy) / current_price_buy;
  const transfer_fee_percentage = transferFee / investment_usdt;
  const total_fees_percentage = buyFeeRate + sellFeeRate + transfer_fee_percentage;

  const net_profit_percentage = gross_profit_percentage - total_fees_percentage;

  // Decisión basada en el umbral de 0.6%
  const decision_outcome = net_profit_percentage > 0.006 ? 'EJECUTADA' : 'NO_EJECUTADA';

  const net_profit_usdt = decision_outcome === 'EJECUTADA' ? net_profit_percentage * investment_usdt : 0;

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
    estimated_buy_fee: investment_usdt * buyFeeRate,
    estimated_sell_fee: (investment_usdt * (1 + gross_profit_percentage)) * sellFeeRate,
    estimated_transfer_fee: transferFee,
    total_fees_usdt: (investment_usdt * buyFeeRate) + ((investment_usdt * (1 + gross_profit_percentage)) * sellFeeRate) + transferFee,

    profit_percentage: net_profit_percentage * 100, // Enviar como porcentaje

    // Datos de mercado en la estructura esperada
    market_data: {
      buy_fees: { taker: buyFeeRate, maker: buyFeeRate }, // Asumimos taker/maker son iguales
      sell_fees: { taker: sellFeeRate, maker: sellFeeRate },
      transferFee: transferFee,
    },

    // Campos adicionales con valores por defecto o placeholders
    execution_time_seconds: Math.random() * (120 - 30) + 30, // Simular tiempo entre 30-120s
    timestamp: new Date(dataPoint.timestamp).toISOString(),
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
    const analysisList = await Analysis.find({})
      .sort({ promedio: -1 })
      .limit(30);

    if (!analysisList || analysisList.length === 0) {
      return res.status(404).json({ message: "No analysis documents found." });
    }

    const intervalo = '5m';
    const daysBack = 30;
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).getTime();

    let balanceConfig = 20;
    const results = [];

    for (const analysis of analysisList) {
      if (!analysis.id_exchsymbol) {
        continue;
      }

      const symbolDoc = await ExchangeSymbol.findById(analysis.id_exchsymbol, 'sy_id');
      if (!symbolDoc) {
        console.warn(`Warning: Symbol with id_exchsymbol ${analysis.id_exchsymbol} not found`);
        continue;
      }

      const transferFee = analysis.fee || 0.0005;

      let data = {
        symbol: symbolDoc.sy_id,
        buyExchangeId: analysis.id_exdataMin,
        sellExchangeId: analysis.id_exdataMax,
        buyFees: analysis.taker_fee_exMin,
        sellFees: analysis.taker_fee_exMax,
        transferFee: transferFee
      };

      const historicalData = await fetchAllHistoricalData(data, since, intervalo);

      for (const dataPoint of historicalData) {
        const tradeResult = await simulateTrade(dataPoint, balanceConfig, data.buyFees, data.sellFees, data.transferFee, data.buyExchangeId, data.sellExchangeId, data.symbol);

        if (tradeResult) {
          results.push(tradeResult);
          balanceConfig += tradeResult.net_profit_usdt;
          if (balanceConfig < 0) balanceConfig = 0;
        }
      }
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

    return res.status(201).json({
      message: 'CSV de entrenamiento guardado exitosamente en el servidor.',
      filename: filename,
      path: filePath,
      records: results.length
    });

  } catch (error) {
    console.error('Error in createTrainingCSVFromAnalysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createTrainingCSV,
  getTrainingCSVFiles,
  getCSVFilePath,
  serveCSVFile,
  createTrainingCSVFromAnalysis,
};
