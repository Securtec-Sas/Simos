const Analysis = require('../data/dataBase/modelosBD/analysis.model');
const ExchangeSymbol = require('../data/dataBase/modelosBD/exchangeSymbol.model');
const { Parser } = require('json2csv');
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
      buy_fees,
      sell_fees,
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

    res.header('Content-Type', 'text/csv');
    res.attachment('training_data.csv');
    return res.send(csv);

  } catch (error) {
    console.error('Error creating training CSV:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  createTrainingCSV,
};
