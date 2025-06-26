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
    // Considerar si la exclusión de exchanges ya procesados es necesaria o si
    // la lógica de findOne para ExchangeSymbol individual es suficiente.
    // Por ahora, se simplificará eliminando esta exclusión previa.
    // const existingExchangeObjectIdsInSymbols = await ExchangeSymbol.distinct('exchangeId');
    // console.log(`Found ${existingExchangeObjectIdsInSymbols.length} distinct exchangeIds in ExchangeSymbol.`);

    const activeExchanges = await Exchange.find({
      isActive: true,
      connectionType: 'ccxt'
      // Descomentar si se quiere reintroducir la exclusión:
      // _id : { $nin: existingExchangeObjectIdsInSymbols }
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
        for (const marketSymbolKey in markets) { // Iterate over keys to get symbol string directly
          // console.log(`${simbolos} / ${Object.keys(markets).length}`); // Reduced verbosity
          const market = markets[marketSymbolKey];

          // Only process spot markets with USDT quote
          // market.symbol should be used for consistency with ccxt structure
          if (market.spot && market.active && market.quote === 'USDT' && market.symbol) {
            try {
              // Find or create the Symbol in the database
              let symbolDoc = await Symbol.findOne({ id_sy: market.symbol });
              if (!symbolDoc) {
                symbolDoc = new Symbol({
                  id_sy: market.symbol,
                  name: market.base, // 'base' is the base currency, e.g., BTC in BTC/USDT
                });
                await symbolDoc.save();
              }

              // Check if the ExchangeSymbol combination already exists
              let exchangeSymbolDoc = await ExchangeSymbol.findOne({
                symbolId: symbolDoc._id,
                exchangeId: exchange._id, // Usar el ObjectId del documento Exchange
              });

              if (!exchangeSymbolDoc) {
                const tickerForSymbol = allTickers[market.symbol]; // Use data from fetchTickers()

                if (tickerForSymbol) {
                  exchangeSymbolDoc = new ExchangeSymbol({
                    symbolId: symbolDoc._id,
                    exchangeId: exchange._id,
                    // Corregido:
                    // Val_buy (precio al que NOSOTROS compramos el activo base) = precio ASK del mercado
                    // Val_sell (precio al que NOSOTROS vendemos el activo base) = precio BID del mercado
                    Val_buy: tickerForSymbol.ask,
                    Val_sell: tickerForSymbol.bid,
                    timestamp: new Date(),
                  });
                  await exchangeSymbolDoc.save();
                  addedCount++;
                } else {
                  console.warn(`No ticker data found in allTickers for ${market.symbol} on ${exchangeId}. Skipping ExchangeSymbol creation.`);
                  // Optionally create ExchangeSymbol with 0 prices if required
                  // exchangeSymbolDoc = new ExchangeSymbol({
                  //   symbolId: symbolDoc._id,
                  //   exchangeId: exchange._id,
                  //   Val_buy: 0,
                  //   Val_sell: 0,
                  //   timestamp: new Date(),
                  // });
                  // await exchangeSymbolDoc.save();
                  // addedCount++;
                }
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
 */const deleteLowCountExchangeSymbols = async (req, res) => {
  let deletedCount = 0;
  const symbolsProcessed = [];
  const errors = [];

  try {
    // 1. Obtener todos los símbolos
    const symbols = await Symbol.find({}, '_id id_sy');

    console.log(`Found ${symbols.length} symbols to check.`);

    for (const symbol of symbols) {
      symbolsProcessed.push(symbol.id_sy);
      try {
        // 2. Contar cuántos ExchangeSymbols existen para este símbolo
        const count = await ExchangeSymbol.countDocuments({ symbolId: symbol._id });

        // 3. Si el count es menor que 2, eliminar todos los ExchangeSymbols para este símbolo
        if (count < 2) {
          const deleteResult = await ExchangeSymbol.deleteMany({ symbolId: symbol._id });
          deletedCount += deleteResult.deletedCount;
          console.log(`Deleted ${deleteResult.deletedCount} ExchangeSymbol entries for symbol ${symbol.id_sy} (count: ${count}).`);
        } else {
          // console.log(`Symbol ${symbol.id_sy} has ${count} ExchangeSymbol entries. Keeping.`);
        }
      } catch (symbolError) {
        errors.push({
          symbolId: symbol._id,
          symbol: symbol.id_sy,
          error: symbolError.message,
        });
        console.error(`Error processing symbol ${symbol.id_sy} for deletion check:`, symbolError);
      }
    }
    /**celimina el simbolo  */
    console.log(`Finished deleting low count ExchangeSymbols. Total deleted: ${deletedCount}`);

    res.status(200).json({
      message: `Checked ${symbols.length} symbols. Deleted ${deletedCount} ExchangeSymbol entries where count was less than 2.`,
      symbolsProcessed: symbolsProcessed,
      errors: errors,
    });

  } catch (error) {
    console.error("Critical error in deleteLowCountExchangeSymbols:", error);
    res.status(500).json({
      message: "An error occurred while deleting low count exchange symbols.",
      error: error.message,
      symbolsProcessed: symbolsProcessed,
      errors: errors,
    });  }
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

module.exports = {
  addExchanges,
  addSymbols,
  addExchangesSymbols,
  getAllExchangeSymbols
};
