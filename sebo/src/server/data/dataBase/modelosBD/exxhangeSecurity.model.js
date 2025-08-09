const { Document, StringField, DateTimeField } = require('mongoose');

class ExchangeSecurity extends Document {
  /**
   * Genera el schema de MongoDB para guardar las API keys de los exchanges.
   * Se debe instanciar con el modelo de exchange.
   */
  static schema = {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Exchange', required: true, alias: 'exchange_name' },
    api_key: { type: String, required: true },
    api_secret: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
  };
}

module.exports = ExchangeSecurity;
