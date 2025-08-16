const mongoose = require('mongoose');

const operationBalanceSchema = new mongoose.Schema({
  // Tipo de operación
  operation_type: {
    type: String,
    enum: ['local', 'sandbox', 'real'],
    required: true,
    index: true,
    comment: 'Tipo de operación: local (simulación), sandbox (prueba), real (producción)'
  },
  
  // Exchange donde está el balance
  exchange_id: { 
    type: String, 
    required: true,
    index: true,
    comment: 'ID del exchange donde está ubicado el balance'
  },
  
  // Información del balance
  usdt_balance: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0,
    comment: 'Balance en USDT disponible en este exchange'
  },
  
  total_balance: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0,
    comment: 'Balance total equivalente en USDT (incluyendo otros activos)'
  },
  
  // Estado del balance
  is_active: { 
    type: Boolean, 
    default: true,
    index: true,
    comment: 'Indica si este balance está activo para operaciones'
  },
  
  is_primary: { 
    type: Boolean, 
    default: false,
    comment: 'Indica si este es el balance principal para este tipo de operación'
  },
  
  // Información adicional de activos (opcional)
  other_assets: {
    type: Map,
    of: {
      symbol: { type: String, required: true },
      amount: { type: Number, required: true, min: 0 },
      usdt_value: { type: Number, required: true, min: 0 },
      last_price: { type: Number, required: true, min: 0 }
    },
    default: new Map(),
    comment: 'Otros activos en el balance con su valor en USDT'
  },
  
  // Configuración de trading para este balance
  min_operation_amount: { 
    type: Number, 
    default: 10,
    min: 0,
    comment: 'Monto mínimo para operaciones desde este balance'
  },
  
  max_operation_percentage: { 
    type: Number, 
    default: 50,
    min: 1,
    max: 100,
    comment: 'Porcentaje máximo del balance que se puede usar en una operación'
  },
  
  // Historial de movimientos
  last_operation_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Operation',
    default: null,
    comment: 'ID de la última operación realizada con este balance'
  },
  
  last_updated_balance: { 
    type: Date, 
    default: Date.now,
    comment: 'Última vez que se actualizó el balance'
  },
  
  // Estadísticas
  total_operations: { 
    type: Number, 
    default: 0,
    min: 0,
    comment: 'Total de operaciones realizadas con este balance'
  },
  
  total_profit_loss: { 
    type: Number, 
    default: 0,
    comment: 'Ganancia/pérdida acumulada con este balance'
  },
  
  initial_balance: { 
    type: Number, 
    required: true,
    min: 0,
    comment: 'Balance inicial cuando se creó este registro'
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
  
  // Información adicional
  notes: { 
    type: String, 
    default: '',
    comment: 'Notas adicionales sobre este balance'
  }
}, {
  timestamps: true,
  collection: 'operation_balances'
});

// Índices compuestos para consultas eficientes
operationBalanceSchema.index({ operation_type: 1, exchange_id: 1 }, { unique: true });
operationBalanceSchema.index({ operation_type: 1, is_active: 1 });
operationBalanceSchema.index({ operation_type: 1, is_primary: 1 });
operationBalanceSchema.index({ exchange_id: 1, is_active: 1 });

// Middleware para actualizar updated_at antes de guardar
operationBalanceSchema.pre('save', function(next) {
  this.updated_at = new Date();
  
  // Actualizar total_balance si no está establecido
  if (this.total_balance === 0) {
    this.total_balance = this.usdt_balance;
    
    // Sumar valor de otros activos
    if (this.other_assets && this.other_assets.size > 0) {
      for (let [key, asset] of this.other_assets) {
        this.total_balance += asset.usdt_value || 0;
      }
    }
  }
  
  next();
});

// Middleware para validar que solo haya un balance primario por tipo de operación
operationBalanceSchema.pre('save', async function(next) {
  if (this.is_primary && this.isModified('is_primary')) {
    // Si se está marcando como primario, desmarcar otros balances primarios del mismo tipo
    await this.constructor.updateMany(
      { 
        operation_type: this.operation_type, 
        _id: { $ne: this._id },
        is_primary: true 
      },
      { is_primary: false }
    );
  }
  next();
});

// Métodos del esquema
operationBalanceSchema.methods.updateBalance = function(newUsdtBalance, otherAssets = null) {
  this.usdt_balance = newUsdtBalance;
  this.last_updated_balance = new Date();
  
  if (otherAssets) {
    this.other_assets = otherAssets;
  }
  
  // Recalcular total_balance
  this.total_balance = this.usdt_balance;
  if (this.other_assets && this.other_assets.size > 0) {
    for (let [key, asset] of this.other_assets) {
      this.total_balance += asset.usdt_value || 0;
    }
  }
  
  return this.save();
};

operationBalanceSchema.methods.canOperate = function(amount) {
  if (!this.is_active) return false;
  if (amount < this.min_operation_amount) return false;
  
  const maxAmount = (this.usdt_balance * this.max_operation_percentage) / 100;
  return amount <= maxAmount;
};

operationBalanceSchema.methods.reserveForOperation = function(amount, operationId) {
  if (!this.canOperate(amount)) {
    throw new Error(`No se puede reservar ${amount} USDT. Balance disponible: ${this.usdt_balance}`);
  }
  
  this.usdt_balance -= amount;
  this.last_operation_id = operationId;
  this.total_operations += 1;
  
  return this.save();
};

operationBalanceSchema.methods.completeOperation = function(finalAmount, profitLoss) {
  this.usdt_balance += finalAmount;
  this.total_profit_loss += profitLoss;
  this.last_updated_balance = new Date();
  
  return this.save();
};

// Métodos estáticos
operationBalanceSchema.statics.getBalanceByType = function(operationType) {
  return this.find({ 
    operation_type: operationType, 
    is_active: true 
  }).sort({ is_primary: -1, total_balance: -1 });
};

operationBalanceSchema.statics.getPrimaryBalance = function(operationType) {
  return this.findOne({ 
    operation_type: operationType, 
    is_primary: true, 
    is_active: true 
  });
};

operationBalanceSchema.statics.getTotalBalanceByType = function(operationType) {
  return this.aggregate([
    { 
      $match: { 
        operation_type: operationType, 
        is_active: true 
      } 
    },
    {
      $group: {
        _id: '$operation_type',
        total_usdt: { $sum: '$usdt_balance' },
        total_balance: { $sum: '$total_balance' },
        total_profit_loss: { $sum: '$total_profit_loss' },
        total_operations: { $sum: '$total_operations' },
        active_exchanges: { $sum: 1 }
      }
    }
  ]);
};

operationBalanceSchema.statics.moveBalance = async function(fromExchange, toExchange, amount, operationType) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Reducir balance del exchange origen
    const fromBalance = await this.findOne({ 
      operation_type: operationType, 
      exchange_id: fromExchange,
      is_active: true 
    }).session(session);
    
    if (!fromBalance || fromBalance.usdt_balance < amount) {
      throw new Error(`Balance insuficiente en ${fromExchange}`);
    }
    
    fromBalance.usdt_balance -= amount;
    
    // Si el balance queda en 0, marcarlo como inactivo
    if (fromBalance.usdt_balance === 0) {
      fromBalance.is_active = false;
    }
    
    await fromBalance.save({ session });
    
    // Aumentar balance del exchange destino o crear nuevo registro
    let toBalance = await this.findOne({ 
      operation_type: operationType, 
      exchange_id: toExchange 
    }).session(session);
    
    if (toBalance) {
      toBalance.usdt_balance += amount;
      toBalance.is_active = true;
      await toBalance.save({ session });
    } else {
      toBalance = new this({
        operation_type: operationType,
        exchange_id: toExchange,
        usdt_balance: amount,
        total_balance: amount,
        initial_balance: amount,
        is_active: true,
        is_primary: false
      });
      await toBalance.save({ session });
    }
    
    await session.commitTransaction();
    return { fromBalance, toBalance };
    
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

operationBalanceSchema.statics.initializeBalance = async function(operationType, exchangeId, initialAmount, isPrimary = false) {
  // Verificar si ya existe
  const existing = await this.findOne({ 
    operation_type: operationType, 
    exchange_id: exchangeId 
  });
  
  if (existing) {
    existing.usdt_balance = initialAmount;
    existing.total_balance = initialAmount;
    existing.is_active = true;
    existing.is_primary = isPrimary;
    return existing.save();
  }
  
  return this.create({
    operation_type: operationType,
    exchange_id: exchangeId,
    usdt_balance: initialAmount,
    total_balance: initialAmount,
    initial_balance: initialAmount,
    is_active: true,
    is_primary: isPrimary
  });
};

const OperationBalance = mongoose.model('OperationBalance', operationBalanceSchema);

module.exports = OperationBalance;