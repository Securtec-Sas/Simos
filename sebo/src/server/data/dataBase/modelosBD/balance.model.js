const mongoose = require('mongoose');

const balanceSchema = new mongoose.Schema({
  balance_usdt: { type: Number, required: true, default: 0 },
  id_exchange: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exchange',
    required: true
  },
  exchange_name: { type: String, required: true },
  exchangeCcxtid: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});


const Balance = mongoose.model('Balance', balanceSchema);

module.exports = Balance;

