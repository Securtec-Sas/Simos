const mongoose = require('mongoose');

const exchangeSchema = new mongoose.Schema({
  id_ex: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  isCoreExchange: { type: Boolean, default: false },
  connectionType: { type: String, required: true },
  conexion: { type: Boolean, default: false }
});

const Exchange = mongoose.model('Exchange', exchangeSchema);

module.exports = Exchange;