const Analysis = require('../data/dataBase/modelosBD/analysis.model');
const ExchangeSymbol = require('../data/dataBase/modelosBD/exchangeSymbol.model');
const { Parser } = require('json2csv');
const { getLowestFeeNetwork } = require('./exchangeController');
const ccxt = require('ccxt');
const fs = require('fs').promises;
const path = require('path');

const fetchHistoricalData = async (data, fecha_inicio, intervalo, cantidad_operaciones) => {
  const { symbol, buyExchangeId, sellExchangeId } = data;
  const since = fecha_inicio ? new Date(fecha_inicio).getTime() : undefined;
  // CCXT limit is per request, and often capped at 1000 by exchanges.
  const limit = cantidad_operaciones ? parseInt(cantidad_operaciones) : 100;

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
/*******  7c46ac28-1539-4b58-aac6-add2e7b948d2  *******/    if (!ccxt.hasOwnProperty(buyExchangeId) || !ccxt.hasOwnProperty(sellExchangeId)) {
        console.error(`Uno de los exchanges no es soportado por CCXT: ${buyExchangeId}, ${sellExchangeId}`);
        return [];
    }
    // FIX: Correctly instantiate ccxt exchanges using bracket notation
    const buyExchange = new ccxtbuyExchangeId;
    const sellExchange = new ccxtsellExchangeId;

    if (!buyExchange.has['fetchOHLCV'] || !sellExchange.has['fetchOHLCV']) {
        console.error(`Uno de los exchanges no soporta fetchOHLCV.`);
        return [];
    }

    // Fetch in parallel
    const [buyData, sellData] = await Promise.all([
        buyExchange.fetchOHLCV(symbol, intervalo, since, limit),
        sellExchange.fetchOHLCV(symbol, intervalo, since, limit)
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
      buy_fees: buyFees,
      sell_fees: sellFees,
      transferFee: transferFee,
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
  return symbols;
};

const createTrainingCSV = async (req, res) => {
  try {
    console.log(req.body);
    // FIX: Destructure according to the actual payload from the frontend (camelCase)
    const { fecha, operaciones, cantidadSimbolos, listaSimbolos, intervalo } = req.body;

    let symbols = [];
    if (listaSimbolos && listaSimbolos.length > 0) {
      // Use provided list of symbols
      symbols = await ExchangeSymbol.find({ symbolName: { $in: listaSimbolos } });
    } else if (cantidadSimbolos) {
      // Select random symbols
      symbols = await getRandomSymbols(cantidadSimbolos);
    } else {
      return res.status(400).json({ error: 'Debe proporcionar cantidadSimbolos o listaSimbolos' });
    }

    // Fetch analysis for symbols
    const symbolNames = symbols.map(s => s.symbolName);
    const analysisList = await Analysis.find({}).populate('id_exchsymbol');
    // Filter analysis by symbolNames
    const filteredAnalysis = analysisList.filter(a => a.id_exchsymbol && symbolNames.includes(a.id_exchsymbol.symbolName));

    let balanceConfig = 20;
    const results = [];
    let operationsCount = 0;
    const totalOperationsRequested = parseInt(operaciones) || 1000;

    for (const analysis of filteredAnalysis) {
      if (operationsCount >= totalOperationsRequested) {
        break;
      }
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
      const historicalData = await fetchHistoricalData(data,  fecha, intervalo, totalOperationsRequested - operationsCount);

      for (const dataPoint of historicalData) {
        if (operationsCount >= totalOperationsRequested) {
          break;
        }
        const tradeResult = simulateTrade(dataPoint, balanceConfig, data.buyFees, data.sellFees, data.transferFee, data.buyExchangeId, data.sellExchangeId, data.symbol);
        if (tradeResult) {
          results.push(tradeResult);

          // Update balanceConfig based on net profit
          balanceConfig += tradeResult.net_profit_usdt;
          if (balanceConfig < 0) balanceConfig = 0;
          operationsCount++;
        }
      }
    }

    // Generate CSV
    // FALTAN DATOS FEES Y 
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

    // Define file path and name as requested
    const filename = `realData_${fecha}_${intervalo}.csv`;
    const dataDir = path.join(__dirname, '..', '../../../../docs/data');

    // Ensure the data directory exists
    try {
      await fs.access(dataDir);
    } catch (e) {
      await fs.mkdir(dataDir, { recursive: true });
    }

    const filePath = path.join(dataDir, filename);

    // Save the CSV file to the server
    await fs.writeFile(filePath, csv, 'utf8');

    // Send a success JSON response instead of the file
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

module.exports = {
  createTrainingCSV,
};
