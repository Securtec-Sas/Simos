const Analysis = require('../data/dataBase/modelosBD/analysis.model');
const ExchangeSymbol = require('../data/dataBase/modelosBD/exchangeSymbol.model');
const { Parser } = require('json2csv');
<<<<<<< HEAD
const { getLowestFeeNetwork } = require('./exchangeController');

const fetchHistoricalData = async (data, fecha_inicio, intervalo, cantidad_operaciones) => {
  // Placeholder function to fetch historical data from ccxt or other source
  // Return array of OHLCV or price data objects [{timestamp, open, high, low, close, volume}, ...]
  // For now, return empty array or mock data
  
  return [];
};

const simulateTrade = (dataPoint, balanceConfig, buyFees, sellFees, transferFee, buyExchangeId, sellExchangeId, symbol) => {
  // Simulate trade logic as per description
  // Calculate investment_usdt based on balanceConfig
  let investment_usdt = balanceConfig < 40 ? balanceConfig : balanceConfig * 0.2;

  // Prices
  const current_price_buy = dataPoint.buyPrice;
  const current_price_sell = dataPoint.sellPrice;

  // Fees
  const buy_fees = buyFees;
  const sell_fees = sellFees;

  // Simulate profit calculation
  // Simplified: profit = (sellPrice * (1 - sell_fees)) - (buyPrice * (1 + buy_fees)) - transferFee
  const gross_buy = current_price_buy * (1 + buy_fees);
  const gross_sell = current_price_sell * (1 - sell_fees);
  const net_profit = (gross_sell - gross_buy) * investment_usdt - transferFee;
=======
const { getExchangeTimeframe } = require('../utils/timeframeConverter');
const { getLowestFeeNetwork, initializeExchange } = require('./exchangeController');
const ccxt = require('ccxt');
const fs = require('fs').promises;
const path = require('path');

const fetchHistoricalData = async (data, fecha_inicio, intervalo, cantidad_operaciones) => {
  const { symbol, buyExchangeId, sellExchangeId } = data;
  const since = fecha_inicio ? new Date(fecha_inicio).getTime() : undefined;
  // CCXT limit is per request, and often capped at 1000 by exchanges.
  const limit = cantidad_operaciones ? parseInt(cantidad_operaciones) : 100;

  const buyIntervalo = getExchangeTimeframe(buyExchangeId, intervalo);
  const sellIntervalo = getExchangeTimeframe(sellExchangeId, intervalo);

  try {
/*************  ✨ Windsurf Command ⭐  *************/
  /**
   * Simulate trade logic as per description
   * @param {Object} dataPoint - Data point with buyPrice and sellPrice
   * @param {Number} balanceConfig - Balance configuration value
   * @param {Number} buyFees - Buy fees percentage
   * @param {Number} sellFees - Sell fees percentage
   * @param {Number} transferFee - Transfer fee value
   * @param {String} buyExchangeId - Buy exchange ID
   * @param {String} sellExchangeId - Sell exchange ID
   * @param {String} symbol - Symbol name
   * @returns {Object} - Simulated trade result object
   */
/*******  7c46ac28-1539-4b58-aac6-add2e7b948d2  *******/   
    const buyExchange = initializeExchange(buyExchangeId);
    const sellExchange = initializeExchange(sellExchangeId);

    if (!buyExchange || !sellExchange) {
      console.error(`Failed to initialize one or both exchanges for fetchHistoricalData: ${buyExchangeId}, ${sellExchangeId}`);
      return [];
    }


    if (!buyExchange.has['fetchOHLCV'] || !sellExchange.has['fetchOHLCV']) {
        console.error(`Uno de los exchanges no soporta fetchOHLCV.`);
        return [];
    }

    // Fetch in parallel
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

const simulateTrade = (dataPoint, balanceConfig, buyFees, sellFees, transferFee, buyExchangeId, sellExchangeId, symbol) => {
  // Calculate investment_usdt based on balanceConfig
  let investment_usdt = balanceConfig < 40 ? balanceConfig : balanceConfig * 0.2;

  // Prices from historical data point
  const current_price_buy = dataPoint.buyPrice;
  const current_price_sell = dataPoint.sellPrice;

  // If prices are invalid, can't simulate
  if (!current_price_buy || !current_price_sell || current_price_buy <= 0) {
    return null; // Or return a 'FAILED' trade
  }

  // Correct profit calculation
  // 1. Amount of asset we can buy with our investment
  const amount_of_asset = investment_usdt / (current_price_buy * (1 + buyFees));
  // 2. Revenue in USDT from selling that asset
  const revenue_from_sell = amount_of_asset * (current_price_sell * (1 - sellFees));
  // 3. Net profit is revenue minus initial investment and transfer fee
  const net_profit = revenue_from_sell - investment_usdt - transferFee;
>>>>>>> parent of 5b78e8f (prueba)

  const decision_outcome = net_profit > (investment_usdt * 0.005) ? 'EJECUTADA' : 'NO_EJECUTADA';
  const net_profit_usdt = decision_outcome === 'EJECUTADA' ? net_profit : 0;

  // id_exch_balance is the buyExchangeId as per simulation description
  const id_exch_balance = buyExchangeId;

  return {
    buy_exchange_id: buyExchangeId,
    sell_exchange_id: sellExchangeId,
    current_price_buy,
    current_price_sell,
    investment_usdt,
    market_data: {
<<<<<<< HEAD
      buy_fees,
      sell_fees,
=======
      buy_fees: buyFees,
      sell_fees: sellFees,
      transferFee: transferFee,
>>>>>>> parent of 5b78e8f (prueba)
    },
    symbol,
    balance_config: balanceConfig,
    decision_outcome,
    net_profit_usdt,
    id_exch_balance,
  };
};

const getRandomSymbols = async (count) => {
  // Fetch random symbols from ExchangeSymbol collection
  const total = await ExchangeSymbol.countDocuments();
  const random = Math.floor(Math.random() * (total - count));
  const symbols = await ExchangeSymbol.find().skip(random).limit(count);
<<<<<<< HEAD
  return symbols;
=======
  // console.log( await symbols);
  return await symbols;
};

const getRandomAnalysis = async (count) => {
  // Fetch random documents from Analysis collection
  const total = await Analysis.countDocuments();
  const random = Math.floor(Math.random() * (total - count));
  const analysis = await Analysis.find().skip(random).limit(count);
  return analysis;
>>>>>>> parent of 5b78e8f (prueba)
};

const createTrainingCSV = async (req, res) => {
  try {
<<<<<<< HEAD
    const { fecha_inicio, intervalo, cantidad_operaciones, cantidad_simbolos, lista_simbolos } = req.body;

    let symbols = [];
    if (lista_simbolos && lista_simbolos.length > 0) {
      // Use provided list of symbols
      symbols = await ExchangeSymbol.find({ symbolName: { $in: lista_simbolos } });
    } else if (cantidad_simbolos) {
      // Select random symbols
      symbols = await getRandomSymbols(cantidad_simbolos);
    } else {
      return res.status(400).json({ error: 'Debe proporcionar cantidad_simbolos o lista_simbolos' });
    }

    // Fetch analysis for symbols
    const symbolNames = symbols.map(s => s.symbolName);
    const analysisList = await Analysis.find({}).populate('id_exchsymbol');
    // Filter analysis by symbolNames
    const filteredAnalysis = analysisList.filter(a => symbolNames.includes(a.id_exchsymbol?.symbolName));

    let balanceConfig = 20;
    const results = [];

    for (const analysis of filteredAnalysis) {
      // For each analysis, fetch historical data for the symbol and exchanges
      const data = {
       symbol : analysis.id_exchsymbol.symbolName,
       buyExchangeId : analysis.id_exdataMin,
       sellExchangeId : analysis.id_exdataMax,
       buyFees : analysis.taker_fee_exMin, 
       sellFees : analysis.taker_fee_exMax,
       transferFee : 0.0005 // Example transfer fee
      }

      // Get lowest fee network and commission for the symbol and exchanges
      const { commission, network, error } = await getLowestFeeNetwork(analysis.id_exdataMin, analysis.id_exdataMax, analysis.id_exchsymbol.symbolName);
      if (error) {
        console.warn(`Warning: Could not get lowest fee network for symbol ${analysis.id_exchsymbol.symbolName}: ${error}`);
      } else {
        data.transferFee = commission;
        data.network = network;
      }

      // Fetch historical data - placeholder
      const historicalData = await fetchHistoricalData(data,  fecha_inicio, intervalo, cantidad_operaciones);

      for (const dataPoint of historicalData) {
        const tradeResult = simulateTrade(dataPoint, balanceConfig, data.buyFees, data.sellFees, data.transferFee, data.buyExchangeId, data.sellExchangeId, data.symbol);
        results.push(tradeResult);

        // Update balanceConfig based on net profit
        balanceConfig += tradeResult.net_profit_usdt;
        if (balanceConfig < 0) balanceConfig = 0;
      }
    }

    // Generate CSV
    // FALTAN DATOS FEES Y 
=======
    // 1. Desestructurar el cuerpo de la solicitud sin 'await'
    const { fecha, operaciones, cantidadSimbolos, listaSimbolos, intervalo } = req.body;

    let symbols = [];
    if (listaSimbolos && listaSimbolos.length > 0) {
      // Usar la lista de símbolos proporcionada
      symbols = await ExchangeSymbol.find({ symbolName: { $in: listaSimbolos } });
    } else if (cantidadSimbolos) {
      // Seleccionar símbolos aleatorios
      // symbols = await getRandomSymbols(cantidadSimbolos);
    } else {
      return res.status(400).json({ error: 'Debe proporcionar cantidadSimbolos o listaSimbolos' });
    }

    // 2. Obtener el _id de los símbolos para la consulta
    // const  symbolIds = symbols.map(s => s._id);

    // 3. Obtener análisis para los símbolos de forma asíncrona
    const analysisList = await getRandomAnalysis(cantidadSimbolos)

    let balanceConfig = 20;
    const results = [];
    let operationsCount = 0;
    const totalOperationsRequested = parseInt(operaciones) || 1000;

    // 4. Iterar sobre la lista de análisis.
    // Usamos un bucle for tradicional para poder usar break si se alcanza el límite.
    for (const analysis of analysisList) {
      // Si ya hemos alcanzado el número de operaciones, salimos del bucle.
      console.log(cantidadSimbolos+'----'+analysisList.length);
      if (operationsCount >= totalOperationsRequested) {
        break;
      }
      
      // La pausa de 2 segundos es una decisión de diseño. La mantendré, pero considera si es realmente necesaria.
      // Si la eliminas, el código será más rápido.
      // await new Promise(resolve => setTimeout(resolve, 2000));

      if (!analysis.id_exchsymbol) {
        // Si el símbolo de intercambio no está poblado, salta este registro para evitar un crash.
        continue;
      }

      let symbolDoc = await ExchangeSymbol.findById(analysis.id_exchsymbol, 'sy_id');
      if (!symbolDoc) {
        console.warn(`Advertencia: No se encontró el símbolo con id_exchsymbol ${analysis.id_exchsymbol}`);
        continue;
      }
      console.log(symbolDoc);
      let data = {
        symbol: await symbolDoc.sy_id,
        buyExchangeId: await analysis.id_exdataMin,
        sellExchangeId: await analysis.id_exdataMax,
        buyFees: await analysis.taker_fee_exMin,
        sellFees: await analysis.taker_fee_exMax,
        transferFee: 0.0005, // Valor por defecto
      };

      // 5. Obtener la red con la comisión más baja de forma asíncrona.
      // La función `getLowestFeeNetwork` devuelve un objeto o un array, el código original usaba await networks, lo que es incorrecto.
      // Es mejor obtener el resultado directamente.
      const lowestFeeResult = await getLowestFeeNetwork( data.sellExchangeId, data.buyExchangeId, data.symbol);
      console.log('RESULTADO REDES -----------------');
      console.log(lowestFeeResult);
      if (!lowestFeeResult || lowestFeeResult.error) {
        const errorMessage = lowestFeeResult ? lowestFeeResult.error : "La función getLowestFeeNetwork no devolvió resultado.";
        console.warn(`Advertencia: No se pudo obtener la red de menor comisión para el símbolo ${data.symbol}: ${errorMessage}`);
        continue;
      } else {
        // Asumiendo que getLowestFeeNetwork devuelve un array. Tomamos el primer elemento.
        data.transferFee = lowestFeeResult.commission;
        data.network = lowestFeeResult.network;
      } 
      // else {
      //   console.warn(`Advertencia: No se encontró una red común para el símbolo ${data.symbol}`);
      // }

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
>>>>>>> parent of 5b78e8f (prueba)
    const fields = [
      'buy_exchange_id',
      'sell_exchange_id',
      'current_price_buy',
      'current_price_sell',
      'investment_usdt',
      'market_data',
      'symbol',
      'balance_config',
      'decision_outcome',
      'net_profit_usdt',
      'id_exch_balance'
    ];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(results);

<<<<<<< HEAD
    res.header('Content-Type', 'text/csv');
    res.attachment('training_data.csv');
    return res.send(csv);
=======
    const filename = `realData_${fecha}_${intervalo}.csv`;
    const dataDir = path.join(__dirname, '..', './../data/');
    
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
>>>>>>> parent of 5b78e8f (prueba)

  } catch (error) {
    console.error('Error creating training CSV:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  createTrainingCSV,
};
