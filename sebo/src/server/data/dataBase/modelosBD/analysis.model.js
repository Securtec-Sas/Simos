const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  id_exdataMin: { type: String, required: true }, // Cambiado a String para guardar el id_ex de CCXT
  id_exdataMax: { type: String, required: true }, // Cambiado a String para guardar el id_ex de CCXT
  Val_max_buy: { type: Number, default: 0 }, // Renombrado para consistencia
  Val_min_sell: { type: Number, default: 0 }, // Renombrado para consistencia
  promedio: { type: Number, default: 0 },
  id_exchsymbol: { type: mongoose.Schema.Types.ObjectId, ref: 'ExchangeSymbol' },
  // Fee fields
  taker_fee_exMin: { type: Number, default: 0 },
  maker_fee_exMin: { type: Number, default: 0 },
  taker_fee_exMax: { type: Number, default: 0 },
  maker_fee_exMax: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
}, {
  collection: 'analysis' // Especifica explícitamente el nombre de la colección
});


const Analysis = mongoose.model('Analysis', analysisSchema);

module.exports = Analysis;