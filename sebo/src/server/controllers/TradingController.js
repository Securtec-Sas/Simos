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

  const exchangeTimeframeMaps = {
    kucoin: {
      '1m': '1min',
      '3m': '3min',
      '5m': '5min',
      '15m': '15min',
      '30m': '30min',
      '1h': '1hour',
      '2h': '2hour',
      '4h': '4hour',
      '6h': '6hour',
      '8h': '8hour',
      '12h': '12hour',
      '1d': '1day',
      '1w': '1week',
      default: '5min',
    },
    // Se pueden agregar otros exchanges aquí en el futuro
  };

  let buyIntervalo = intervalo;
  let sellIntervalo = intervalo;

  if (exchangeTimeframeMaps[buyExchangeId]) {
    const map = exchangeTimeframeMaps[buyExchangeId];
    buyIntervalo = map[intervalo] || map.default;
    if (!map[intervalo]) {
      console.warn(`Intervalo no mapeado para ${buyExchangeId}: '${intervalo}'. Usando '${map.default}' por defecto.`);
    }
  }

  if (exchangeTimeframeMaps[sellExchangeId]) {
    const map = exchangeTimeframeMaps[sellExchangeId];
    sellIntervalo = map[intervalo] || map.default;
    if (!map[intervalo]) {
      console.warn(`Intervalo no mapeado para ${sellExchangeId}: '${intervalo}'. Usando '${map.default}' por defecto.`);
    }
  }

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
 if (!ccxt.hasOwnProperty(buyExchangeId) || !ccxt.hasOwnProperty(sellExchangeId)) {
        console.error(`Uno de los exchanges no es soportado por CCXT: ${buyExchangeId}, ${sellExchangeId}`);
        return [];
    }
    // FIX: Correctly instantiate ccxt exchanges using bracket notation
    const buyExchange = new ccxt[buyExchangeId]();
    const sellExchange = new ccxt[sellExchangeId]();


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
  // console.log( await symbols);
  return await symbols;
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
      symbols = await getRandomSymbols(cantidadSimbolos);
    } else {
      return res.status(400).json({ error: 'Debe proporcionar cantidadSimbolos o listaSimbolos' });
    }

    // 2. Obtener el _id de los símbolos para la consulta
    const  symbolIds = symbols.map(s => s._id);

    // 3. Obtener análisis para los símbolos de forma asíncrona
    const analysisList = await Analysis.find({ id_exchsymbol: { $in: symbolIds } }).populate('id_exchsymbol');

    let balanceConfig = 20;
    const results = [];
    let operationsCount = 0;
    const totalOperationsRequested = parseInt(operaciones) || 1000;

    // 4. Iterar sobre la lista de análisis.
    // Usamos un bucle for tradicional para poder usar break si se alcanza el límite.
    for (const analysis of analysisList) {
      // Si ya hemos alcanzado el número de operaciones, salimos del bucle.
      if (operationsCount >= totalOperationsRequested) {
        break;
      }
      
      // La pausa de 2 segundos es una decisión de diseño. La mantendré, pero considera si es realmente necesaria.
      // Si la eliminas, el código será más rápido.
      // await new Promise(resolve => setTimeout(resolve, 2000));

      if (!analysis.id_exchsymbol) {
        // Si el símbolo de intercambio no está poblado, salta este registro para evitar un crash.
        console.warn(`Omitiendo registro de análisis ${analysis._id} por datos de símbolo de intercambio ausentes o inconsistentes.`);
        continue;
      }

      const data = {
        symbol: analysis.id_exchsymbol.sy_id,
        buyExchangeId: analysis.id_exdataMin,
        sellExchangeId: analysis.id_exdataMax,
        buyFees: analysis.taker_fee_exMin,
        sellFees: analysis.taker_fee_exMax,
        transferFee: 0.0005, // Valor por defecto
      };

      // 5. Obtener la red con la comisión más baja de forma asíncrona.
      // La función `getLowestFeeNetwork` devuelve un objeto o un array, el código original usaba await networks, lo que es incorrecto.
      // Es mejor obtener el resultado directamente.
      const lowestFeeResult = await getLowestFeeNetwork( data.sellExchangeId, data.buyExchangeId, data.symbol);
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

  } catch (error) {
    console.error('Error creating training CSV:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  createTrainingCSV,
};
