const mongoose = require('mongoose');

const balanceSchema = new mongoose.Schema({
  balance_usdt: { type: Number, required: true, default: 0 },
  id_exchange: { type: String, required: true }, // CCXT id of the exchange

  investment_mode: {
    type: String,
    enum: ["FIXED", "PERCENTAGE"],
    default: "FIXED"
  },
  investment_percentage: {
    type: Number,
    default: 10,
    min: [1, 'Investment percentage must be at least 1%'],
    max: [100, 'Investment percentage cannot exceed 100%']
  },
  fixed_investment_usdt: {
    type: Number,
    default: 50,
    min: [50, 'Fixed investment USDT must be at least 50']
  },
  reinvest_profits: { type: Boolean, default: true },

  stop_loss_percentage_global: {
    type: Number,
    default: 50,
    min: [1, 'Global stop loss percentage must be at least 1%'],
    max: [100, 'Global stop loss percentage cannot exceed 100%']
  },
  initial_capital_for_global_sl: { type: Number, default: 0 }, // Capital base para el SL global

  take_profit_percentage_operation: {
    type: Number,
    default: null, // Nulo significa desactivado
    min: [0, 'Take profit percentage must be non-negative']
  },
  stop_loss_percentage_operation: {
    type: Number,
    default: 20, // Cambiado default a 20% como un valor más común para SL por operación
    min: [1, 'Operation stop loss percentage must be at least 1%'],
    max: [100, 'Operation stop loss percentage cannot exceed 100%']
  },

  timestamp: { type: Date, default: Date.now }
});

// Índice compuesto para asegurar que solo hay un doc de config/balance por exchange
// Si se quisiera múltiples snapshots de balance, este índice no iría o sería diferente.
// Para este caso, donde es LA configuración de balance para un exchange, es útil.
balanceSchema.index({ id_exchange: 1 }, { unique: true });

const Balance = mongoose.model('Balance', balanceSchema);

module.exports = Balance;
