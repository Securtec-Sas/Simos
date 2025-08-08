const mongoose = require('mongoose');

const exchangeSymbolSchema = new mongoose.Schema({
  symbolId: { type: mongoose.Schema.Types.ObjectId, ref: 'Symbol', required: true },
  sy_id: { type: String, required: true }, // ID del símbolo en CC
  symbolName: { type: String, required: true }, // Nombre del símbolo
  exch_data: {
    type: Map,
    of: {
      _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
      exchangeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exchange', required: true },
      exchangeName: { type: String, required: true },
      id_ex: { type: String, required: true }, // ID del exchange en CC
      Val_buy: { type: Number, default: 0 },
      Val_sell: { type: Number, default: 0 },
    },
    required: true
  },
  timestamp: { type: Date, default: Date.now }
});

const ExchangeSymbol = mongoose.model('ExchangeSymbol', exchangeSymbolSchema);

module.exports = ExchangeSymbol;