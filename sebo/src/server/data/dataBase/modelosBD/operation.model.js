const mongoose = require('mongoose');

const operationSchema = new mongoose.Schema({
  // Información del símbolo y exchanges
  symbol: { 
    type: String, 
    required: true,
    index: true
  },
  exchange_buy: { 
    type: String, 
    required: true,
    comment: 'Exchange donde se compró el símbolo'
  },
  exchange_sell: { 
    type: String, 
    required: true,
    comment: 'Exchange donde se vendió el símbolo'
  },
  
  // Valores esperados vs reales
  expected_buy_price: { 
    type: Number, 
    required: true,
    comment: 'Precio esperado de compra'
  },
  expected_sell_price: { 
    type: Number, 
    required: true,
    comment: 'Precio esperado de venta'
  },
  real_buy_price: { 
    type: Number, 
    default: 0,
    comment: 'Precio real de compra ejecutado'
  },
  real_sell_price: { 
    type: Number, 
    default: 0,
    comment: 'Precio real de venta ejecutado'
  },
  
  // Balance y resultados financieros
  balance_invested: { 
    type: Number, 
    required: true,
    comment: 'Balance invertido en USDT'
  },
  profit_loss: { 
    type: Number, 
    default: 0,
    comment: 'Ganancia o pérdida en USDT (positivo = ganancia, negativo = pérdida)'
  },
  usdt_obtained: { 
    type: Number, 
    default: 0,
    comment: 'USDT obtenidos al final de la operación'
  },
  
  // Fees y costos
  buy_fee: { 
    type: Number, 
    default: 0,
    comment: 'Fee de compra en USDT'
  },
  sell_fee: { 
    type: Number, 
    default: 0,
    comment: 'Fee de venta en USDT'
  },
  transfer_fee: { 
    type: Number, 
    default: 0,
    comment: 'Fee de transferencia en USDT'
  },
  total_fees: { 
    type: Number, 
    default: 0,
    comment: 'Total de fees pagados en USDT'
  },
  
  // Tipo de operación
  operation_type: {
    type: String,
    enum: ['local', 'sandbox', 'real'],
    required: true,
    index: true,
    comment: 'Tipo de operación: local (simulación), sandbox (prueba), real (producción)'
  },
  
  // Estado de la operación
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true,
    comment: 'Estado actual de la operación'
  },
  
  // Información adicional
  execution_time_seconds: { 
    type: Number, 
    default: 0,
    comment: 'Tiempo de ejecución en segundos'
  },
  error_message: { 
    type: String, 
    default: null,
    comment: 'Mensaje de error si la operación falló'
  },
  
  // Datos del modelo AI (si aplica)
  ai_confidence: { 
    type: Number, 
    default: null,
    min: 0,
    max: 1,
    comment: 'Confianza del modelo AI (0-1)'
  },
  ai_predicted_profit: { 
    type: Number, 
    default: null,
    comment: 'Ganancia predicha por el modelo AI'
  },
  
  // Metadatos
  created_at: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  updated_at: { 
    type: Date, 
    default: Date.now
  },
  completed_at: { 
    type: Date, 
    default: null,
    comment: 'Fecha y hora de finalización de la operación'
  }
}, {
  timestamps: true, // Agrega automáticamente createdAt y updatedAt
  collection: 'operations'
});

// Índices compuestos para consultas eficientes
operationSchema.index({ operation_type: 1, status: 1 });
operationSchema.index({ symbol: 1, operation_type: 1 });
operationSchema.index({ created_at: -1, operation_type: 1 });
operationSchema.index({ status: 1, created_at: -1 });

// Middleware para actualizar updated_at antes de guardar
operationSchema.pre('save', function(next) {
  this.updated_at = new Date();
  
  // Calcular total_fees si no está establecido
  if (this.total_fees === 0) {
    this.total_fees = (this.buy_fee || 0) + (this.sell_fee || 0) + (this.transfer_fee || 0);
  }
  
  // Establecer completed_at si el estado es completed
  if (this.status === 'completed' && !this.completed_at) {
    this.completed_at = new Date();
  }
  
  next();
});

// Métodos del esquema
operationSchema.methods.calculateProfitLoss = function() {
  if (this.real_buy_price > 0 && this.real_sell_price > 0) {
    const grossProfit = (this.balance_invested / this.real_buy_price) * this.real_sell_price - this.balance_invested;
    this.profit_loss = grossProfit - this.total_fees;
    this.usdt_obtained = this.balance_invested + this.profit_loss;
  }
  return this.profit_loss;
};

operationSchema.methods.markAsCompleted = function() {
  this.status = 'completed';
  this.completed_at = new Date();
  this.calculateProfitLoss();
};

operationSchema.methods.markAsFailed = function(errorMessage) {
  this.status = 'failed';
  this.error_message = errorMessage;
  this.completed_at = new Date();
};

// Métodos estáticos
operationSchema.statics.getOperationsByType = function(operationType, limit = 100) {
  return this.find({ operation_type: operationType })
    .sort({ created_at: -1 })
    .limit(limit);
};

operationSchema.statics.getOperationStats = function(operationType, startDate, endDate) {
  const matchStage = { operation_type: operationType };
  
  if (startDate || endDate) {
    matchStage.created_at = {};
    if (startDate) matchStage.created_at.$gte = startDate;
    if (endDate) matchStage.created_at.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalInvested: { $sum: '$balance_invested' },
        totalProfitLoss: { $sum: '$profit_loss' },
        totalFees: { $sum: '$total_fees' },
        avgExecutionTime: { $avg: '$execution_time_seconds' }
      }
    }
  ]);
};

const Operation = mongoose.model('Operation', operationSchema);

module.exports = Operation;