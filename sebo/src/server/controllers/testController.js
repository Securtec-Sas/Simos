const Analysis = require('../data/dataBase/modelosBD/analysis.model');
const ExchangeSymbol = require('../data/dataBase/modelosBD/exchangeSymbol.model');
const { Parser } = require('json2csv');
const { getExchangeTimeframe } = require('../utils/timeframeConverter');
const { getLowestFeeNetwork, initializeExchange } = require('./exchangeController');
const ccxt = require('ccxt');
const fs = require('fs').promises;
const path = require('path');

const fetchAllHistoricalDataForTest = async (data, since, intervalo) => {
  const { symbol, buyExchangeId, sellExchangeId } = data;
  const limit = 1000;
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

    // const buyIntervalo = getExchangeTimeframe(buyExchange, intervalo);
    // const sellIntervalo = getExchangeTimeframe(sellExchange, intervalo);

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
          buyExchange.fetchOHLCV(symbol, intervalo, lastTimestamp, limit),
          sellExchange.fetchOHLCV(symbol, intervalo, lastTimestamp, limit)
        ]);

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

        const validBuyData = [];
        const validSellData = [];
        
        // Procesar datos de compra con manejo individual de errores
        buyData.forEach((candle, index) => {
          try {
            if (candle && Array.isArray(candle) && candle.length >= 5 &&
                candle[0] && !isNaN(candle[0]) && isFinite(candle[0]) &&
                candle[4] && !isNaN(candle[4]) && isFinite(candle[4]) && candle[4] > 0) {
              validBuyData.push(candle);
            }
          } catch (candleError) {
            console.warn(`⚠️  Saltando candlestick de compra ${index} para ${symbol}: ${candleError.message}`);
          }
        });

        // Procesar datos de venta con manejo individual de errores
        sellData.forEach((candle, index) => {
          try {
            if (candle && Array.isArray(candle) && candle.length >= 5 &&
                candle[0] && !isNaN(candle[0]) && isFinite(candle[0]) &&
                candle[4] && !isNaN(candle[4]) && isFinite(candle[4]) && candle[4] > 0) {
              validSellData.push(candle);
            }
          } catch (candleError) {
            console.warn(`⚠️  Saltando candlestick de venta ${index} para ${symbol}: ${candleError.message}`);
          }
        });

        if (validBuyData.length === 0 && validSellData.length === 0) {
          console.warn(`⚠️  Saltando lote completo de datos para ${symbol}: Todos los datos son inválidos`);
          consecutiveEmptyResponses++;
          continue;
        }

        if (validBuyData.length === 0) {
          console.warn(`⚠️  No hay datos válidos de compra para ${symbol} en este lote`);
          consecutiveEmptyResponses++;
          continue;
        }

        if (validSellData.length === 0) {
          console.warn(`⚠️  No hay datos válidos de venta para ${symbol} en este lote`);
          consecutiveEmptyResponses++;
          continue;
        }

        consecutiveEmptyResponses = 0;
        allBuyData = allBuyData.concat(validBuyData);
        allSellData = allSellData.concat(validSellData);
        
        console.log(`📊 Datos válidos para ${symbol}: ${validBuyData.length} compra, ${validSellData.length} venta`);
        
        lastTimestamp = validBuyData[validBuyData.length - 1][0] + 1;

      } catch (fetchError) {
        console.warn(`⚠️  Error obteniendo datos para ${symbol}: ${fetchError.message}`);
        consecutiveEmptyResponses++;
        if (consecutiveEmptyResponses >= maxEmptyResponses) {
          moreData = false;
        }
      }
    }

    if (allBuyData.length === 0 || allSellData.length === 0) {
      console.warn(`⚠️  Saltando símbolo ${symbol}: No se obtuvieron datos históricos válidos`);
      return [];
    }

    // Sincronizar datos por timestamp con manejo de errores individual
    const synchronizedData = [];
    const sellDataMap = new Map();
    
    // Crear mapa de datos de venta con manejo de errores
    allSellData.forEach((candle, index) => {
      try {
        if (candle && candle[0] && candle[4]) {
          sellDataMap.set(candle[0], candle[4]);
        }
      } catch (mapError) {
        console.warn(`⚠️  Error procesando candlestick de venta ${index} para ${symbol}: ${mapError.message}`);
      }
    });

    // Sincronizar datos con manejo de errores individual
    allBuyData.forEach((buyCandle, index) => {
      try {
        const timestamp = buyCandle[0];
        const buyPrice = buyCandle[4];
        const sellPrice = sellDataMap.get(timestamp);

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
      } catch (syncError) {
        console.warn(`⚠️  Error sincronizando candlestick ${index} para ${symbol}: ${syncError.message}`);
      }
    });

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

const createTestDataPoint = async (dataPoint, balanceConfig, buyFeeRate, sellFeeRate, transferFee, buyExchangeId, sellExchangeId, symbol) => {
  if (!dataPoint || typeof dataPoint !== 'object') {
    return null;
  }

  const current_price_buy = dataPoint.buyPrice;
  const current_price_sell = dataPoint.sellPrice;
  const timestamp = dataPoint.timestamp;

  if (!current_price_buy || !current_price_sell || !timestamp ||
      !isFinite(current_price_buy) || !isFinite(current_price_sell) || !isFinite(timestamp) ||
      isNaN(current_price_buy) || isNaN(current_price_sell) || isNaN(timestamp) ||
      current_price_buy <= 0 || current_price_sell <= 0) {
    return null;
  }

  if (!isFinite(balanceConfig) || isNaN(balanceConfig) || balanceConfig <= 0 ||
      !isFinite(buyFeeRate) || isNaN(buyFeeRate) || buyFeeRate < 0 ||
      !isFinite(sellFeeRate) || isNaN(sellFeeRate) || sellFeeRate < 0 ||
      !isFinite(transferFee) || isNaN(transferFee) || transferFee < 0) {
    return null;
  }

  const investment_usdt = balanceConfig < 100 ? balanceConfig : 100;

  if (!isFinite(investment_usdt) || isNaN(investment_usdt) || investment_usdt <= 0) {
    return null;
  }

  // Calcular fees estimados sin simular la operación
  const estimated_buy_fee = investment_usdt * buyFeeRate;
  const estimated_sell_fee = (investment_usdt / current_price_buy * current_price_sell) * sellFeeRate;
  const total_fees_usdt = estimated_buy_fee + estimated_sell_fee + transferFee;

  // Calcular diferencia de precio y ganancia potencial (sin decidir si ejecutar)
  const price_difference_percentage = ((current_price_sell - current_price_buy) / current_price_buy) * 100;
  const gross_profit_usdt = (investment_usdt / current_price_buy) * current_price_sell - investment_usdt;
  const net_profit_usdt = gross_profit_usdt - total_fees_usdt;
  const profit_percentage = (net_profit_usdt / investment_usdt) * 100;

  if (!isFinite(estimated_buy_fee) || isNaN(estimated_buy_fee) ||
      !isFinite(estimated_sell_fee) || isNaN(estimated_sell_fee) ||
      !isFinite(total_fees_usdt) || isNaN(total_fees_usdt) ||
      !isFinite(profit_percentage) || isNaN(profit_percentage) ||
      !isFinite(net_profit_usdt) || isNaN(net_profit_usdt)) {
    return null;
  }

  // NO simular la operación - solo proporcionar datos para que el modelo AI decida
  return {
    buy_exchange_id: buyExchangeId,
    sell_exchange_id: sellExchangeId,
    symbol: symbol,
    current_price_buy: current_price_buy,
    current_price_sell: current_price_sell,
    investment_usdt: investment_usdt,
    estimated_buy_fee: estimated_buy_fee,
    estimated_sell_fee: estimated_sell_fee,
    estimated_transfer_fee: transferFee,
    total_fees_usdt: total_fees_usdt,
    price_difference_percentage: price_difference_percentage,
    gross_profit_usdt: gross_profit_usdt,
    net_profit_usdt: net_profit_usdt, // Ganancia potencial, no real
    profit_percentage: profit_percentage, // Porcentaje potencial, no real
    market_data: {
      buy_fees: { taker: buyFeeRate, maker: buyFeeRate },
      sell_fees: { taker: sellFeeRate, maker: sellFeeRate },
      transferFee: transferFee,
    },
    timestamp: new Date(timestamp).toISOString(),
    balance_config: { balance_usdt: balanceConfig },
    id_exch_balance: buyExchangeId,
    // Campos adicionales para el modelo AI
    opportunity_type: 'ARBITRAGE_OPPORTUNITY',
    data_source: 'TEST_GENERATION',
    requires_ai_decision: true
  };
};

const createTestCSV = async (req, res) => {
  try {
    console.log('🚀 Iniciando generación de CSV de pruebas...');
    
    // Obtener parámetros de la URL
    const { diasAtras, cantAnalysis, timeFrame } = req.params;
    
    // Validar parámetros
    const daysBack = parseInt(diasAtras) || 59;
    const numAnalysis = parseInt(cantAnalysis) || 100;
    const intervalo = timeFrame || '5m';
    
    console.log(`📊 Parámetros: ${daysBack} días atrás, ${numAnalysis} análisis, intervalo ${intervalo}`);
    
    // Validaciones
    if (daysBack < 1 || daysBack > 365) {
      return res.status(400).json({ error: 'Los días atrás deben estar entre 1 y 365' });
    }
    
    if (numAnalysis < 1 || numAnalysis > 10000) {
      return res.status(400).json({ error: 'La cantidad de análisis debe estar entre 1 y 10000' });
    }
    
    const validTimeFrames = ['5m', '10m', '15m', '30m', '1h', '2h', '3h', '4h', '6h', '12h', '1d'];
    if (!validTimeFrames.includes(intervalo)) {
      return res.status(400).json({ error: `El timeFrame debe ser uno de: ${validTimeFrames.join(', ')}` });
    }

    // Obtener análisis aleatorios limitados por numAnalysis
    const analysisList = await Analysis.find({})
      .sort({ promedio: -1 })
      .limit(Math.min(numAnalysis, 50)); // Limitar a máximo 50 símbolos para evitar sobrecarga

    if (!analysisList || analysisList.length === 0) {
      return res.status(404).json({ message: "No se encontraron documentos de análisis." });
    }

    console.log(`📊 Procesando ${analysisList.length} análisis...`);

    // Calcular fecha de inicio
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).getTime();

    let balanceConfig = 20;
    const results = [];
    let processedSymbols = 0;
    let skippedSymbols = 0;
    let totalOperationsGenerated = 0;

    for (const analysis of analysisList) {
      if (totalOperationsGenerated >= numAnalysis) {
        break;
      }

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

      // Validar datos del análisis
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

      const historicalData = await fetchAllHistoricalDataForTest(data, since, intervalo);

      if (historicalData.length === 0) {
        console.warn(`⚠️  No se obtuvieron datos históricos para ${symbolDoc.sy_id}`);
        skippedSymbols++;
        continue;
      }

      let validTrades = 0;
      const maxTradesPerSymbol = Math.ceil(numAnalysis / analysisList.length);
      
      for (const dataPoint of historicalData) {
        if (totalOperationsGenerated >= numAnalysis || validTrades >= maxTradesPerSymbol) {
          break;
        }
        
        const testDataPoint = await createTestDataPoint(dataPoint, balanceConfig, data.buyFees, data.sellFees, data.transferFee, data.buyExchangeId, data.sellExchangeId, data.symbol);

        if (testDataPoint) {
          if (isFinite(testDataPoint.net_profit_usdt) && !isNaN(testDataPoint.net_profit_usdt) &&
              isFinite(testDataPoint.profit_percentage) && !isNaN(testDataPoint.profit_percentage)) {
            results.push(testDataPoint);
            // NO actualizar balance aquí - el modelo AI decidirá si ejecutar
            validTrades++;
            totalOperationsGenerated++;
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
        error: 'No se pudieron generar datos de prueba válidos',
        details: {
          processedSymbols,
          skippedSymbols,
          totalTrades: 0
        }
      });
    }

    // Generar CSV con campos para pruebas del modelo AI
    // Ajustar la estructura para que coincida con los datos del socket
    const fields = [
      'buy_exchange_id',
      'sell_exchange_id',
      'symbol',
      'current_price_buy',
      'current_price_sell',
      'investment_usdt',
      'estimated_buy_fee',
      'estimated_sell_fee',
      'estimated_transfer_fee',
      'total_fees_usdt',
      'price_difference_percentage',
      'gross_profit_usdt',
      'net_profit_usdt',
      'profit_percentage',
      'timestamp'
    ];
    
    // Convertir los resultados para que coincidan con la estructura del socket
    const csvData = results.map(result => {
      return {
        buy_exchange_id: result.buy_exchange_id,
        sell_exchange_id: result.sell_exchange_id,
        symbol: result.symbol,
        current_price_buy: result.current_price_buy,
        current_price_sell: result.current_price_sell,
        investment_usdt: result.investment_usdt,
        estimated_buy_fee: result.estimated_buy_fee,
        estimated_sell_fee: result.estimated_sell_fee,
        estimated_transfer_fee: result.estimated_transfer_fee,
        total_fees_usdt: result.total_fees_usdt,
        price_difference_percentage: result.price_difference_percentage,
        gross_profit_usdt: result.gross_profit_usdt,
        net_profit_usdt: result.net_profit_usdt,
        profit_percentage: result.profit_percentage,
        timestamp: result.timestamp
      };
    });
    
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(csvData);

    // Generar nombre de archivo con timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `ai_test_opportunities_${daysBack}days_${numAnalysis}analysis_${intervalo}_${timestamp}.csv`;
    
    // Usar la misma ruta que el entrenamiento
    const dataDir = path.join(__dirname, '..', './../data/csv_exports/');
    
    await fs.mkdir(dataDir, { recursive: true });

    const filePath = path.join(dataDir, filename);

    await fs.writeFile(filePath, csv, 'utf8');

    console.log(`💾 CSV de oportunidades para pruebas AI guardado exitosamente: ${filename}`);

    return res.status(201).json({
      message: 'CSV de oportunidades para pruebas del modelo AI guardado exitosamente en el servidor.',
      filename: filename,
      path: filePath,
      records: results.length,
      parameters: {
        diasAtras: daysBack,
        cantAnalysis: numAnalysis,
        timeFrame: intervalo
      },
      summary: {
        processedSymbols,
        skippedSymbols,
        totalOpportunities: results.length
      },
      note: 'Este archivo contiene oportunidades de arbitraje para que el modelo AI decida si ejecutar o no. Las operaciones simuladas serán manejadas por el AdvancedSimulationEngine.'
    });

  } catch (error) {
    console.error('❌ Error en createTestCSV:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  createTestCSV,
};