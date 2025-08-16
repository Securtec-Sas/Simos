const mongoose = require('mongoose');

const symbolSchema = new mongoose.Schema({
  id_sy: { type: String, unique: true, required: true },
  name: { type: String, required: true }
});

const Symbol = mongoose.model('Symbol', symbolSchema);

module.exports = Symbol;