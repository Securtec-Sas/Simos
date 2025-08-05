/**
 * crea una funcion para agregar los exchage desde el json de exchages_cofig.json
 * reorno la cantidad de exchanges agregados
 * cuanto fallaron al agregarse
 * y listo de id de los que fallaron
 */
const Exchange = require('../data/dataBase/modelosBD/exchange.model');
const mongoose = require('mongoose');
const exchangesConfig = require('../data/exchanges_config.json');
const ExchangeSymbol = require('../data/dataBase/modelosBD/exchangeSymbol.model');
const Analysis = require('../data/dataBase/modelosBD/analysis.model');
const analyzerController = require('./analizerController'); // Importar el controlador de análisis
const Symbol = require('../data/dataBase/modelosBD/symbol.model');
const ccxt = require('ccxt');

const addExchanges = async (req, res) => {
  let addedCount = 0;
  let failedCount = 0;
  const failedIds = [];

  for (const exchangeConfig of exchangesConfig) {
    try {
      // Mapear los campos del config al esquema del modelo
      const exchangeData = {
        id_ex: exchangeConfig.id, // Asignar exchangeConfig.id a id_ex
        name: exchangeConfig.name,
        isActive: exchangeConfig.isActive,
        isCoreExchange: exchangeConfig.isCoreExchange, // Asegúrate que este campo exista o tenga un default
        connectionType: exchangeConfig.connectionType, // Asegúrate que este campo exista o tenga un default
        conexion: exchangeConfig.conexion // Asegúrate que este campo exista o tenga un default
      };
      const newExchange = new Exchange(exchangeData);
      await newExchange.save();
      addedCount++;
    } catch (error) {
      failedCount++;
      failedIds.push(exchangeConfig.id);
      console.error(`Error adding exchange ${exchangeConfig.id}:`, error);
    }
  }
  res.status(200).json({
    message: `Added ${addedCount} exchanges, failed to add ${failedCount}.`,
    failedIds: failedIds
  });
};

/**
 * crea el metodo para agregar los symbolos desde spot_usdt.coins.json pero toma solo el symbol q es el id y name 
 */

const spotCoinsData = require('../data/spot_usdt_coins.json');

const addSymbols = async (req, res) => {
  let addedCount = 0;
  let failedCount = 0;
  const failedSymbols = [];

  // spotCoinsData is an object where keys are symbols (like "BTC/USDT")
  // and values are objects containing symbol details.
  // We iterate over the values to get the symbol objects.
  const symbolsToAdd = Object.values(spotCoinsData);

  for (const symbolData of symbolsToAdd) {
    try {
      // Mapear los campos del spotCoinsData al esquema del modelo Symbol
      const symbolToAdd = {
        id_sy: symbolData.symbol, // Usar el campo 'symbol' como id_sy
        name: symbolData.name,   // Usar el campo 'name'
      };
      const newSymbol = new Symbol(symbolToAdd);
      await newSymbol.save();
      addedCount++;
    } catch (error) {
      failedCount++;
      failedSymbols.push(symbolData.symbol);
      console.error(`Error adding symbol ${symbolData.symbol}:`, error);
    }
  }
  res.status(200).json({
    message: `Added ${addedCount} symbols, failed to add ${failedCount}.`,
    failedSymbols: failedSymbols
  });
};


/**
 * const addExchangesSymbols
 * cre el metodo para obtener lo symbolos por exchage desde ccxt el proceso es el siguiente:
 * 1. obtener los exchanges activos isactive = treu de la base de datos el id de cada exchage
 * 2. obtener los symbolos de cada exchange activo desde ccxt si no  puede obteer los datos guardar el error 
 * en un array y continuar con el siguiete exchange devolver el array de errores al final del proceso con los datos
 * 3. por cada symbolo de cada exchange activo, verificar si ya existe en symbolos de la base de datos
 * 4. si no existe, agregarlo a la base de datos en symbol y en exchangesymbols agregar el exchange y el symbolo a la tabla de exchangesymbols con el valor de compra y venta de el array obtenido de ccxt de cada simbolo
 * !!IMPORATE!!  si el symbolo ya existe en symbolos de la base de datos, verificar si ya existe en exchangesymbols, si ya existe el symbolo = symbolId y el exchange = exchangeId  exchangesymbols, si ya existe cotinuar con el siguiete de lo controrario agregargrlo
 * !!importante!! en exchagesybols pueden repetirse los id de lo simbolos o los de los exhanges pero nunca pueden reprtirse el mismo sybolo y exchnge jutos 
 * * @param {Object} req - Request object 
 * * @param {Object} res - Response object
 * res.status(200).json({
 *   message: `Added ${addedCount} exchange symbols, failed to add ${failedCount} exchanges., errors de conexion: ${failedIds, error arroajoda po ccxt}`,
 * captura los errores y devuelve un mensaje de error
 *  */


const exchangesymbolsNewAdd = async (req, res) => {
  console.time("exchangesymbolsNewAdd-TotalTime");
  let newSymbolsCreated = 0;
  const failedExchanges = [];
  const bulkOps = [];

  try {
    // 1. Obtener todos los exchanges activos de la BD
    const activeExchanges = await Exchange.find({ isActive: true, connectionType: 'ccxt' }).lean();
    if (activeExchanges.length === 0) {
      console.timeEnd("exchangesymbolsNewAdd-TotalTime");
      return res.status(200).json({ message: "No hay exchanges activos configurados para procesar." });
    }
    console.log(`Procesando ${activeExchanges.length} exchanges activos...`);

    // Caché para documentos de Symbol para reducir consultas a la BD
    const symbolCache = new Map();

    // 2. Iterar sobre cada exchange activo
    for (const exchangeDoc of activeExchanges) {
      try {
        // FIX: Validar que el ID del exchange existe en CCXT antes de intentar instanciarlo.
        // Esto previene el error "is not a constructor" si el id_ex es incorrecto o no soportado.
        if (!ccxt.hasOwnProperty(exchangeDoc.id_ex)) {
          const errorMessage = `El exchange con ID '${exchangeDoc.id_ex}' no es soportado por CCXT o el ID es incorrecto.`;
          console.warn(errorMessage);
          failedExchanges.push({ id: exchangeDoc.id_ex, error: errorMessage });
          continue;
        }
        // 3. Inicializar CCXT y obtener todos los tickers de una vez (Optimización)
        const exchange = new ccxt[exchangeDoc.id_ex]();
        await exchange.loadMarkets();
        const tickers = await exchange.fetchTickers();

        // 4. Iterar sobre los mercados (símbolos) del exchange
        for (const symbolStr in exchange.markets) {
          const market = exchange.markets[symbolStr];

          // Filtrar solo por mercados spot, activos y contra USDT
          if (!market.spot || !market.active || market.quote !== 'USDT') {
            continue;
          }

          // 5. Encontrar o crear el documento del Símbolo
          let symbolDoc = symbolCache.get(market.symbol);
          if (!symbolDoc) {
            // Buscar en la BD. Si no existe, crearlo.
            symbolDoc = await Symbol.findOneAndUpdate(
              { id_sy: market.symbol },
              { $setOnInsert: { name: market.base } },
              { new: true, upsert: true, lean: true }
            );
            if (!symbolCache.has(market.symbol)) newSymbolsCreated++;
            symbolCache.set(market.symbol, symbolDoc);
          }

          // 6. Preparar la operación de actualización para ExchangeSymbol
          const ticker = tickers[market.symbol];
          const exchangeData = {
            exchangeId: exchangeDoc._id,
            exchangeName: exchangeDoc.name,
            id_ex: exchangeDoc.id_ex,
            Val_buy: ticker ? ticker.bid : 0,
            Val_sell: ticker ? ticker.ask : 0,
          };

          // Esta operación buscará un ExchangeSymbol por symbolId.
          // Si no existe, lo creará (upsert: true).
          // Luego, establecerá o actualizará los datos para el exchange específico en el mapa `exch_data`.
          bulkOps.push({
            updateOne: {
              filter: { symbolId: symbolDoc._id },
              update: {
                $set: {
                  [`exch_data.${exchangeDoc.id_ex}`]: exchangeData,
                  symbolName: symbolDoc.name,
                  sy_id: symbolDoc.id_sy, // <-- CAMBIO: Añadir el ID del símbolo
                  timestamp: new Date()
                },
                $setOnInsert: { symbolId: symbolDoc._id }
              },
              upsert: true
            }
          });
        }
      } catch (error) {
        console.error(`Fallo al procesar el exchange ${exchangeDoc.id_ex}: ${error.message}`);
        failedExchanges.push({ id: exchangeDoc.id_ex, error: error.message });
        continue; // Continuar con el siguiente exchange si hay un error
      }
    }

    // 7. Ejecutar todas las operaciones en una sola consulta masiva (Optimización)
    let bulkResult = { modifiedCount: 0, upsertedCount: 0 };
    if (bulkOps.length > 0) {
      const result = await ExchangeSymbol.bulkWrite(bulkOps, { ordered: false });
      bulkResult.modifiedCount = result.modifiedCount || 0;
      bulkResult.upsertedCount = result.upsertedCount || 0;
    }

    console.timeEnd("exchangesymbolsNewAdd-TotalTime");

    // 8. Enviar la respuesta final (se eliminó la llamada incorrecta a analyzerController)
    res.status(200).json({
      message: `Proceso completado. Se procesaron ${bulkOps.length} pares símbolo-exchange.`,
      newSymbolsCreated,
      newExchangeSymbolDocsCreated: bulkResult.upsertedCount,
      existingExchangeSymbolDocsUpdated: bulkResult.modifiedCount,
      failedExchanges: failedExchanges
    });

  } catch (error) {
    console.timeEnd("exchangesymbolsNewAdd-TotalTime");
    console.error("Error crítico en exchangesymbolsNewAdd:", error);
    res.status(500).json({
      message: "Ocurrió un error crítico durante el proceso.",
      error: error.message,
      failedExchanges
    });
  }
};

const addExchangesSymbols = async (req, res) => {
  let addedCount = 0;
  let failedExchangeCount = 0;
  const failedExchangeIds = [];
  const symbolErrors = []; // To store errors during symbol/exchangeSymbol processing

  try {
    /** 1. Obtener los exchanges activos de la base de datos y que el id del exchage no este en exhangeSymbol si ya estan en la 
      significa que ya se analizo y no se necesita volver a analizarlo.
      Aquí "id del exchange" se refiere al _id del documento Exchange,
      ya que ExchangeSymbol.exchangeId referencia a Exchange._id.
    */
    // Primero, obtenemos todos los _id de Exchange que ya están en ExchangeSymbol
    const usedExchangeId  = await ExchangeSymbol.distinct('exchangeId');
    const  existingExchangeObjectIdsInSymbols = await usedExchangeId.map(es => es.exchangeId);

    // Populate para obtener el id_ex del Exchange
    console.log(`Found ${Object.values(existingExchangeObjectIdsInSymbols).slice(0, 2)}  ...  existing ExchangeSymbol entries.`);
    // Luego, buscamos Exchanges que cumplan las condiciones y cuyo _id NO esté en la lista obtenida
    const activeExchanges = await Exchange.find({
      isActive: true,
      connectionType: 'ccxt',
      _id : { $nin: existingExchangeObjectIdsInSymbols } // $nin significa "not in"
    });

    if (activeExchanges.length === 0) {
      return res.status(200).json({
        message: "No active CCXT exchanges found in the database.",
        addedCount: 0,
        failedExchangeCount: 0,
        failedExchangeIds: [],
        symbolErrors: []
      });
    }
    console.log(`Found ${activeExchanges.length} active CCXT exchanges.`);
    for (const exchange of activeExchanges) {
      const exchangeId = exchange.id_ex;
      console.log(`Processing exchange: ${exchangeId}`);
      try {
        // 2. Obtener los símbolos de cada exchange activo desde ccxt
        const ccxtExchange = new ccxt[exchangeId]({
          'timeout': 10000,
          'enableRateLimit': true,
        });
        await ccxtExchange.loadMarkets();
        

        // Obtener todos los tickers para el exchange de una vez para eficiencia
        let allTickers = {};
        try {
          allTickers = await ccxtExchange.fetchTickers();
        } catch (fetchTickersError) {
          console.error(`Error fetching all tickers for exchange ${exchangeId}: ${fetchTickersError.message}. Proceeding without live prices for this exchange.`);
          // Si fetchTickers falla, allTickers permanecerá vacío, y los symbols no tendrán precios actuales.
          continue; // Skip to the next exchange
        }
        /**cra un cosole log para ver el contenido de ccxtExchange.markets mustra 2 elemetos y mostrr el coetido de y has una pausa de 5 segundos
         * 
         */        
    
      
        // Pause for 5 seconds

        var markets =  ccxtExchange.markets;
        markets = await Object.fromEntries(
          Object.entries(markets).filter(
            ([_, market]) => market.spot === true && market.active === true && market.quote === 'USDT'
         )
        );
        console.log(`aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ${Object.values(markets).slice(0, 2)}`);
        if (!markets || Object.keys(markets).length === 0) {
          console.warn(`No markets found for exchange ${exchangeId}. Skipping...`);
          continue; // Skip to the next exchange
        }
        // 3. y 4. Procesar cada símbolo del exchange
        console.log(`Processing exchange: ${exchangeId} with ${Object.keys(markets).length} markets`);
        simbolos = 0;
        for (const symbol in markets) {
          console.log(`${simbolos} / ${Object.keys(markets).length}`);
          const market = markets[symbol];
          // Only process spot markets with USDT quote
          if (market.spot && market.active && market.quote === 'USDT') {
            try {
              // Find or create the Symbol in the database
              let symbolDoc = await Symbol.findOne({ id_sy: market.symbol });
              // console.log(`Processing symbol: ${market} on exchange: ${exchangeId}`);
              if (!symbolDoc) {
                symbolDoc = new Symbol({
                  id_sy: market.symbol,
                  name: market.base,
                });
                await symbolDoc.save();
                // console.log(`${market.symbol} - ok s`);
              }

              // Check if the ExchangeSymbol combination already exists
              let exchangeSymbolDoc = await ExchangeSymbol.findOne({
                symbolId: symbolDoc._id,
                exchangeId: exchange._id, // Usar el ObjectId del documento Exchange
              });

              if (!exchangeSymbolDoc) {
                // Fetch ticker to get buy/sell values (ask/bid)
                let ticker = null;
                try {
                  ticker = await ccxtExchange.fetchTicker(market.symbol);
                } catch (tickerError) {
                  console.warn(`Could not fetch ticker for ${market.symbol} on ${exchangeId}: ${tickerError.message}`);
                  // Continue without ticker data, Val_buy and Val_sell will be default 0
                  continue
                }
                // console.log(`Adding new ExchangeSymbol for ${ticker.bid} on ${exchangeId}`);
                exchangeSymbolDoc = new ExchangeSymbol({
                  symbolId: symbolDoc._id,
                  exchangeId: exchange._id, // Usar el ObjectId del documento Exchange
                  Val_buy: ticker ? ticker.bid : 0, // Use bid for buy value
                  Val_sell: ticker ? ticker.ask : 0, // Use ask for sell value
                  timestamp: new Date(),
                });
                await exchangeSymbolDoc.save();
                // console.log(`${ticker.bid} - ok es`);
                addedCount++;
                
              } 
            } catch (symbolProcessingError) {
              symbolErrors.push({
                exchangeId: exchangeId,
                symbol: market.symbol,
                error: symbolProcessingError.message,
              });
              console.error(`Error processing symbol ${market.symbol} on ${exchangeId}:`, symbolProcessingError);
              continue; // Continue to the next symbol if there's an error
            }
          }
          simbolos++;
        }
      } catch (exchangeError) {
        failedExchangeCount++;
        failedExchangeIds.push(exchangeId);
        console.error(`Error connecting to or fetching markets for exchange ${exchangeId}: ${exchangeError.message}`);
        symbolErrors.push({
          exchangeId: exchangeId,
          error: `Failed to connect or fetch markets: ${exchangeError.message}`,
        });
      }
    }
    console.log(`Finished processing exchanges. Added/Updated ${addedCount} ExchangeSymbol entries.`);
    res.status(200).json({
      message: `Processed active CCXT exchanges. Added/Updated ${addedCount} ExchangeSymbol entries.`,
      failedExchangeCount: failedExchangeCount,
      failedExchangeIds: failedExchangeIds,
      symbolErrors: symbolErrors,
    });

  } catch (error) {
    console.error("Critical error in addExchangesSymbols:", error);
    res.status(500).json({
      message: "An error occurred while processing exchanges and symbols.",
      error: error.message,
      failedExchangeCount: failedExchangeCount,
      failedExchangeIds: failedExchangeIds,
      symbolErrors: symbolErrors,
    });
  }
};

/**
 * metodo para eliminar los exchangeSymbol que cumplan las siguientes condiciones
 * delete document  from  exchanSymbol where symbolid = symbol,_id count(exchangeId) < 2clos exchangeSymbol que no tengan de 2 exchanges en adelante
 * recorrer la coleccion de symbols y buscar y eliminar de la coleccion de exchangeSymbol los que cumplan las condiciones
 *
 */
// const deleteLowCountExchangeSymbols = async (req, res) => {
//   let deletedCount = 0;
//   const symbolsProcessed = [];
//   const errors = [];

//   try {
//     // 1. Obtener todos los símbolos
//     const symbols = await Symbol.find({}, '_id id_sy');

//     console.log(`Found ${symbols.length} symbols to check.`);

//     for (const symbol of symbols) {
//       symbolsProcessed.push(symbol.id_sy);
//       try {
//         // 2. Contar cuántos ExchangeSymbols existen para este símbolo
//         const count = await ExchangeSymbol.countDocuments({ symbolId: symbol._id });

//         // 3. Si el count es menor que 2, eliminar todos los ExchangeSymbols para este símbolo
//         if (count < 2) {
//           const deleteResult = await ExchangeSymbol.deleteMany({ symbolId: symbol._id });
//           deletedCount += deleteResult.deletedCount;
//           console.log(`Deleted ${deleteResult.deletedCount} ExchangeSymbol entries for symbol ${symbol.id_sy} (count: ${count}).`);
//         } else {
//           // console.log(`Symbol ${symbol.id_sy} has ${count} ExchangeSymbol entries. Keeping.`);
//         }
//       } catch (symbolError) {
//         errors.push({
//           symbolId: symbol._id,
//           symbol: symbol.id_sy,
//           error: symbolError.message,
//         });
//         console.error(`Error processing symbol ${symbol.id_sy} for deletion check:`, symbolError);
//       }
//     }
//     /**celimina el simbolo  */
//     console.log(`Finished deleting low count ExchangeSymbols. Total deleted: ${deletedCount}`);

//     res.status(200).json({
//       message: `Checked ${symbols.length} symbols. Deleted ${deletedCount} ExchangeSymbol entries where count was less than 2.`,
//       symbolsProcessed: symbolsProcessed,
//       errors: errors,
//     });

//   } catch (error) {
//     console.error("Critical error in deleteLowCountExchangeSymbols:", error);
//     res.status(500).json({
//       message: "An error occurred while deleting low count exchange symbols.",
//       error: error.message,
//       symbolsProcessed: symbolsProcessed,
//       errors: errors,
//     });  }
// };

const deleteLowCountExchangeSymbols = async (req, res) => {
  let deletedCount = 0;

  try {
    // 1. Encontrar y eliminar los documentos que cumplen con la condición
    //    Usamos $expr con $lt (less than) y $size para contar los elementos del mapa exch_data.
    const deleteResult = await ExchangeSymbol.deleteMany({
      $expr: { $lt: [{ $size: "$exch_data" }, 2] }
    });

    deletedCount = deleteResult.deletedCount;
    
    // 2. Opcional: Si necesitas limpiar símbolos de la colección 'Symbol' que ya no tienen ExchangeSymbols.
    // Esta parte asume que tu aplicación podría necesitar esta limpieza.
    // const symbolsWithoutExchangeSymbols = await Symbol.find({
    //   _id: {
    //     $nin: await ExchangeSymbol.distinct('symbolId')
    //   }
    // });
    // const symbolsDeleted = await Symbol.deleteMany({
    //   _id: {
    //     $in: symbolsWithoutExchangeSymbols.map(s => s._id)
    //   }
    // });
    // console.log(`Deleted ${symbolsDeleted.deletedCount} symbols without associated ExchangeSymbols.`);

    console.log(`Se eliminaron ${deletedCount} documentos de ExchangeSymbol donde exch_data tenía menos de 2 elementos.`);

    // 3. Devolver la respuesta con el conteo de documentos eliminados
    res.status(200).json({
      message: `Proceso completado. Se eliminaron ${deletedCount} documentos de ExchangeSymbol.`,
      deletedCount: deletedCount
    });

  } catch (error) {
    console.error("Error crítico en deleteLowCountExchangeSymbols:", error);
    res.status(500).json({
      message: "Ocurrió un error al intentar eliminar los símbolos con pocos exchanges.",
      error: error.message
    });
  }
};

/**
 * crea el metodo para obtener todos los exchangeSymbol de un symbolo
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {string} req.params.symbolId - The ID of the symbol to fetch exchange symbols for.
 * res.status(200).json(exchangeSymbols);
 * res.status(500).json({ message: "Error fetching exchange symbols", error: error.message });
 */






const getAllExchangeSymbols = async (req, res) => {
  try {
    const { symbolId } = req.params;
    const exchangeSymbols = await ExchangeSymbol.find({ symbolId });
    res.status(200).json(exchangeSymbols);
  } catch (error) {
    console.error("Error fetching exchange symbols:", error);
    res.status(500).json({ message: "Error fetching exchange symbols", error: error.message });
  }
};

/**
 * Verifica si un par de exchanges tiene una red de retiro en común para un símbolo.
 * @param {string} symbolId El ID del símbolo (ej. 'BTC/USDT').
 * @param {string} id_sell El ID del exchange de venta (ej. 'binance').
 * @param {string} id_buy El ID del exchange de compra (ej. 'coinbase').
 * @returns {Promise<boolean>} Retorna true si hay una red común, de lo contrario, false.
 */
const hasCommonWithdrawalNetwork = async (symbolId, id_sell, id_buy) => {
  try {
    const sellExchange = new ccxt[id_sell]();
    const buyExchange = new ccxt[id_buy]();

    await Promise.all([
      sellExchange.loadMarkets(),
      buyExchange.loadMarkets()
    ]);

    const sellMarket = sellExchange.market(symbolId);
    const buyMarket = buyExchange.market(symbolId);

    const baseCurrencysell = sellMarket.base;
    const baseCurrencybuy = buyMarket.base;

    const [sellCurrencyInfo, buyCurrencyInfo] = await Promise.all([
      sellExchange.currency(baseCurrencysell),
      buyExchange.currency(baseCurrencybuy)
    ]);

    const sellNetworks = await sellCurrencyInfo?.networks;
    // console.log(sellNetworks);
    const buyNetworks = await buyCurrencyInfo?.networks;
    // console.log('buyNetworks[networkName]');
    // console.log(buyNetworks);
    const networkDetails = await Object.entries(sellNetworks).map(([networkName, networkInfo]) => ({
      name: networkName,
      withdraw: networkInfo.withdraw,
      fee: networkInfo.fee
    }));
    console.log(networkDetails);
    
    const buyNetworkDetails = await Object.entries(buyNetworks).map(([networkName, networkInfo]) => ({
      name: networkName,
      deposit: networkInfo.deposit,
      fee: networkInfo.fee
    }));

    console.log(buyNetworkDetails);

    const commonNetwork = await networkDetails.find(sellNetwork => buyNetworkDetails.find(buyNetwork => sellNetwork.name === buyNetwork.name && sellNetwork.withdraw && buyNetwork.deposit));
    console.log(commonNetwork)
    return commonNetwork;

    

    // if (Object.keys(sellNetworks).length > 0) {
    //   Object.entries(sellNetworks).forEach(([networkName, networkInfo]) => {
    //     console.log(`---------------------------------------------------`);
    //     console.log(`sellNetworks[${networkName}]:`);
    //     console.log(networkInfo);
    // if (Object.keys(buyNetworks).length > 0) {
    //   Object.entries(buyNetworks).forEach(([networkName, networkInfo]) => {
    //     console.log(`---------------------------------------------------`);
    //     console.log(`buyNetworks[${networkName}]:`);
    //     console.log(networkInfo);
    //     if (buyNetworks[networkName]) {
          
    //     }
    //   });
    // }
    //   });
    // }
    // const commonNetworks = Object.keys(sellNetworks).filter(networkName => {
    //   // Verifica si la red existe en ambos exchanges
    //   console.log(networkName);
    //   console.log('sellNetworks[networkName]');
    //   // console.log(sellNetworks[networkName].info);
    //   console.log('buyNetworks[networkName]');
    //   console.log(buyNetworks[networkName].info);
    //   if (buyNetworks[networkName]) {
    //     // Opcional: Verifica si la red está activa para retiros
    //     // console.log(buyNetworks[networkName])
    //     const sellNetworkActive = sellNetworks[networkName].withdrawal?.active;
    //     const buyNetworkActive = buyNetworks[networkName].deposit?.active;
    //     return sellNetworkActive && buyNetworkActive;
    //   }
    //   return false;
    // });
    // await new Promise(resolve => setTimeout(resolve, 2000));
    // return commonNetworks.length > 0;

  } catch (error) {
    console.error(`Error al verificar redes para ${symbolId} en ${id_sell}->${id_buy}:`, error.message);
    return false;
  }
};

const deleteAnalysisWithoutActiveNetworks = async (req, res) => {
  let deletedCount = 0;
  let processedCount = 0;

  try {
    // 1. Obtener todos los documentos de análisis, poblando el ExchangeSymbol
    const analyses = await Analysis.find().populate('id_exchsymbol');

    console.log(`Se encontraron ${analyses.length} análisis para verificar.`);

    // 2. Usar Promise.all para procesar todas las verificaciones en paralelo
    const analysesToDelete = [];
    
    // Usamos un bucle for-of normal para poder usar await de forma segura
    for (const analysis of analyses) {
      processedCount++;
      const id_exchsymbol = analysis.id_exchsymbol;
      
      // Si el populate falló o el documento vinculado fue eliminado, se salta
      if (!id_exchsymbol) {
        analysesToDelete.push(analysis._id);
        continue;
      }
      
      const symbolId = id_exchsymbol.sy_id;
      const id_sell = analysis.id_exdataMax;
      const id_buy = analysis.id_exdataMin;
      
      const hasNetworks = await hasCommonWithdrawalNetwork(symbolId, id_sell, id_buy);

      if (!hasNetworks) {
        analysesToDelete.push(analysis._id);
        console.log(`Análisis para ${symbolId} en ${id_buy}->${id_sell} no tiene redes comunes. Marcado para eliminación.`);
      }
    }
    
    // 3. Eliminar todos los documentos marcados en una sola operación en la base de datos
    if (analysesToDelete.length > 0) {
      const result = await Analysis.deleteMany({ _id: { $in: analysesToDelete } });
      deletedCount = result.deletedCount;
    }

    console.log(`Proceso completado. ${deletedCount} documentos de análisis eliminados.`);
    
    // 4. Devolver la respuesta al cliente
    res.status(200).json({
      message: `Proceso completado. Se revisaron ${processedCount} análisis y se eliminaron ${deletedCount} que no tenían redes de retiro activas en común.`,
      deletedCount: deletedCount
    });

  } catch (error) {
    console.error("Error crítico en deleteAnalysisWithoutActiveNetworks:", error);
    res.status(500).json({
      message: "Ocurrió un error al eliminar los análisis sin redes activas.",
      error: error.message
    });
  }
};

module.exports = {
  addExchanges,
  addSymbols,
  addExchangesSymbols,
  getAllExchangeSymbols,
  exchangesymbolsNewAdd, // Exportar la nueva función
  deleteLowCountExchangeSymbols,
  deleteAnalysisWithoutActiveNetworks
};
