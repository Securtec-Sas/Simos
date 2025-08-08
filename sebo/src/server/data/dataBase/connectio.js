/***
 * archivo que maneja la conexion a bases de datos
 * MongoDB
 * crear conexion y shemas o modelos de datos para mongo º
 * Data Base: simo  url: mongodb://localhost:27017/bd_simo
 * Tables:
 * 1- exchange:
 *  `"id_ex": string (UQ),
    "name": string,
    "isActive": boolean,
    "isCoreExchange": boolean,
    "connectionType": string,
    "conexion": boolean`

 * * 2- symbols:
 *  `"id_sy": string (UQ),
    "name": string,

    3- exchangesymbols:
 *  `"id_exsy": auto,
    "symbolId": symbols.id_sy (no unico),
    "exchangeId": exchanges.id_ex (no unico),
    "Val_buy": number,
    "Val_sell": number,

    4- analysis:
 *  `"id_an": auto,
    "id_exsyMin": exchangesymbols._id (el valro minimo de venta para un symbol en todos los exchanges),
    "id_exsyMax": exchangesymbols._id (el valro maximo de compra para un symbol en todos los exchanges),
    "Val_buy": number,
    "Val_sell": number,
    "promedio": number,

    
 * */

    
const mongoose = require('mongoose');


// Conexión a la base de datos MongoDB
const dbURI = 'mongodb://localhost:27017/bd_simo';

const connectDB = async () => {
  try {
    await mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Conexión a MongoDB exitosa');
  } catch (err) {
    console.error('Error al conectar a MongoDB:', err);
    process.exit(1); // Salir del proceso si la conexión falla
  }
};

// Importar modelos
const Exchange = require('./modelosBD/exchange.model');
const Symbol = require('./modelosBD/symbol.model');
const ExchangeSymbol = require('./modelosBD/exchangeSymbol.model');
const Analysis = require('./modelosBD/analysis.model');
const Balance = require('./modelosBD/balance.model'); // Import Balance model

// Exportar la conexión y los modelos
module.exports = {
  // Opcionalmente, puedes exportar la instancia de mongoose si la necesitas en otros módulos
  // mongoose,
  connectDB, // Exportar la función de conexión
  dbConnection: mongoose.connection, // O exportar directamente la conexión
  Exchange,
  Symbol,
  ExchangeSymbol,
  Analysis,
  Balance // Export Balance model
};