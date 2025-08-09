const mongoose = require('mongoose');

const exchangeSecuritySchema = new mongoose.Schema({
  id_ex: { type: String, ref: 'Exchange', required: true, unique: true },
  api_key: { type: String, required: true },
  api_secret: { type: String, required: true },
  password: { type: String }, // For exchanges that require a password for API access
  created_at: { type: Date, default: Date.now },
});

const ExchangeSecurity = mongoose.model('ExchangeSecurity', exchangeSecuritySchema);

module.exports = ExchangeSecurity;
