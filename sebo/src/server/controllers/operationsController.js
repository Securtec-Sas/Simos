const Operation = require('../data/dataBase/modelosBD/operation.model');
const OperationBalance = require('../data/dataBase/modelosBD/operationBalance.model');

/**
 * Crear una nueva operación
 */
const createOperation = async (req, res) => {
  try {
    const operation = new Operation(req.body);
    await operation.save();
    res.status(201).json({
      success: true,
      data: operation,
      message: 'Operación creada exitosamente'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      message: 'Error al crear la operación'
    });
  }
};

/**
 * Crear operación iniciada por el modelo AI
 * Este método se llama cuando el modelo AI decide ejecutar una operación
 * en cualquiera de los 3 tipos: local, sandbox, real
 */
const createAIInitiatedOperation = async (req, res) => {
  try {
    const {
      operation_type, // 'local', 'sandbox', 'real'
      symbol,
      buy_exchange_id,
      sell_exchange_id,
      expected_buy_price,
      expected_sell_price,
      balance_invested,
      buy_fee_rate,
      sell_fee_rate,
      transfer_fee,
      ai_confidence,
      ai_decision_factors,
      transaction_id
    } = req.body;

    // Validar parámetros requeridos
    if (!operation_type || !symbol || !buy_exchange_id || !sell_exchange_id ||
        !expected_buy_price || !expected_sell_price || !balance_invested) {
      return res.status(400).json({
        success: false,
        error: 'Faltan parámetros requeridos para crear la operación',
        message: 'operation_type, symbol, buy_exchange_id, sell_exchange_id, expected_buy_price, expected_sell_price y balance_invested son requeridos'
      });
    }

    // Validar tipo de operación
    const validTypes = ['local', 'sandbox', 'real'];
    if (!validTypes.includes(operation_type)) {
      return res.status(400).json({
        success: false,
        error: `Tipo de operación inválido. Debe ser uno de: ${validTypes.join(', ')}`,
        message: 'Tipo de operación no válido'
      });
    }

    // Verificar balance disponible
    const balance = await OperationBalance.findOne({
      operation_type: operation_type,
      exchange_id: buy_exchange_id,
      is_active: true
    });

    if (!balance || balance.usdt_balance < balance_invested) {
      return res.status(400).json({
        success: false,
        error: 'Balance insuficiente para la operación',
        message: `No hay suficiente balance USDT en ${buy_exchange_id} para tipo ${operation_type}`
      });
    }

    // Crear la operación
    const operation = new Operation({
      operation_type,
      symbol,
      buy_exchange_id,
      sell_exchange_id,
      expected_buy_price,
      expected_sell_price,
      balance_invested,
      buy_fee_rate: buy_fee_rate || 0.001,
      sell_fee_rate: sell_fee_rate || 0.001,
      transfer_fee: transfer_fee || 0,
      status: 'pending',
      ai_confidence: ai_confidence || 0.5,
      ai_decision_factors: ai_decision_factors || {},
      transaction_id: transaction_id || `ai_${Date.now()}`,
      created_by: 'AI_MODEL'
    });

    await operation.save();

    // Reservar balance para la operación
    await OperationBalance.updateOne(
      { _id: balance._id },
      {
        $inc: {
          reserved_balance: balance_invested,
          usdt_balance: -balance_invested
        },
        $set: { updated_at: new Date() }
      }
    );

    res.status(201).json({
      success: true,
      data: operation,
      message: `Operación ${operation_type} iniciada por AI creada exitosamente`,
      balance_reserved: balance_invested,
      remaining_balance: balance.usdt_balance - balance_invested
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      message: 'Error al crear la operación iniciada por AI'
    });
  }
};

/**
 * Iniciar transferencia USDT para comprar símbolo
 * Este método se ejecuta cuando se transfieren los USDT para comprar el símbolo
 * Marca el inicio real de la operación
 */
const initiateUSDTTransfer = async (req, res) => {
  try {
    const { operation_id, actual_transfer_amount, transfer_transaction_id } = req.body;

    if (!operation_id || !actual_transfer_amount) {
      return res.status(400).json({
        success: false,
        error: 'operation_id y actual_transfer_amount son requeridos',
        message: 'Faltan parámetros para iniciar la transferencia USDT'
      });
    }

    // Buscar la operación
    const operation = await Operation.findById(operation_id);
    if (!operation) {
      return res.status(404).json({
        success: false,
        error: 'Operación no encontrada',
        message: 'La operación solicitada no existe'
      });
    }

    // Verificar que la operación esté en estado pending
    if (operation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Estado de operación inválido',
        message: `La operación debe estar en estado 'pending', actual: ${operation.status}`
      });
    }

    // Actualizar la operación para marcar el inicio de la transferencia USDT
    operation.status = 'usdt_transfer_initiated';
    operation.actual_invested_amount = actual_transfer_amount;
    operation.usdt_transfer_transaction_id = transfer_transaction_id;
    operation.usdt_transfer_started_at = new Date();
    operation.updated_at = new Date();

    await operation.save();

    res.status(200).json({
      success: true,
      data: operation,
      message: 'Transferencia USDT iniciada exitosamente',
      next_step: 'buy_symbol'
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      message: 'Error al iniciar la transferencia USDT'
    });
  }
};

/**
 * Actualizar operación con resultado de compra
 */
const updateBuyResult = async (req, res) => {
  try {
    const { operation_id, real_buy_price, asset_amount_received, buy_transaction_id, buy_fees } = req.body;

    if (!operation_id || !real_buy_price || !asset_amount_received) {
      return res.status(400).json({
        success: false,
        error: 'operation_id, real_buy_price y asset_amount_received son requeridos',
        message: 'Faltan parámetros para actualizar el resultado de compra'
      });
    }

    const operation = await Operation.findById(operation_id);
    if (!operation) {
      return res.status(404).json({
        success: false,
        error: 'Operación no encontrada',
        message: 'La operación solicitada no existe'
      });
    }

    // Actualizar con datos reales de la compra
    operation.real_buy_price = real_buy_price;
    operation.asset_amount_received = asset_amount_received;
    operation.buy_transaction_id = buy_transaction_id;
    operation.actual_buy_fees = buy_fees || operation.buy_fee_rate * operation.actual_invested_amount;
    operation.status = 'asset_purchased';
    operation.buy_completed_at = new Date();
    operation.updated_at = new Date();

    await operation.save();

    res.status(200).json({
      success: true,
      data: operation,
      message: 'Resultado de compra actualizado exitosamente',
      next_step: 'transfer_asset_or_sell'
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      message: 'Error al actualizar el resultado de compra'
    });
  }
};

/**
 * Actualizar operación con resultado de venta
 */
const updateSellResult = async (req, res) => {
  try {
    const { operation_id, real_sell_price, final_usdt_received, sell_transaction_id, sell_fees } = req.body;

    if (!operation_id || !real_sell_price || !final_usdt_received) {
      return res.status(400).json({
        success: false,
        error: 'operation_id, real_sell_price y final_usdt_received son requeridos',
        message: 'Faltan parámetros para actualizar el resultado de venta'
      });
    }

    const operation = await Operation.findById(operation_id);
    if (!operation) {
      return res.status(404).json({
        success: false,
        error: 'Operación no encontrada',
        message: 'La operación solicitada no existe'
      });
    }

    // Actualizar con datos reales de la venta
    operation.real_sell_price = real_sell_price;
    operation.final_usdt_received = final_usdt_received;
    operation.sell_transaction_id = sell_transaction_id;
    operation.actual_sell_fees = sell_fees || operation.sell_fee_rate * final_usdt_received;
    operation.sell_completed_at = new Date();

    // Calcular profit/loss real
    const totalInvested = operation.actual_invested_amount || operation.balance_invested;
    const totalFees = (operation.actual_buy_fees || 0) + (operation.actual_sell_fees || 0) + (operation.transfer_fee || 0);
    operation.actual_profit_loss = final_usdt_received - totalInvested - totalFees;

    // Marcar como completada
    operation.markAsCompleted();
    await operation.save();

    // Actualizar balance final
    const balance = await OperationBalance.findOne({
      operation_type: operation.operation_type,
      exchange_id: operation.sell_exchange_id,
      is_active: true
    });

    if (balance) {
      await OperationBalance.updateOne(
        { _id: balance._id },
        {
          $inc: {
            usdt_balance: final_usdt_received,
            total_profit_loss: operation.actual_profit_loss,
            total_operations: 1
          },
          $set: { updated_at: new Date() }
        }
      );
    }

    res.status(200).json({
      success: true,
      data: operation,
      message: 'Operación completada exitosamente',
      profit_loss: operation.actual_profit_loss,
      final_balance_update: final_usdt_received
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      message: 'Error al actualizar el resultado de venta'
    });
  }
};

/**
 * Obtener operaciones por tipo
 * @param {string} tipo - Tipo de operación (local, sandbox, real)
 * @param {number} limit - Cantidad de operaciones a devolver (por defecto 10)
 */
const getOperationsByType = async (req, res) => {
  try {
    const { tipo } = req.params;
    const { limit = 10, status, symbol, startDate, endDate } = req.query;
    
    // Validar tipo de operación
    const validTypes = ['local', 'sandbox', 'real'];
    if (!validTypes.includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: `Tipo de operación inválido. Debe ser uno de: ${validTypes.join(', ')}`,
        message: 'Tipo de operación no válido'
      });
    }

    // Construir filtros
    const filters = { operation_type: tipo };
    
    if (status) {
      filters.status = status;
    }
    
    if (symbol) {
      filters.symbol = { $regex: symbol, $options: 'i' };
    }
    
    if (startDate || endDate) {
      filters.created_at = {};
      if (startDate) filters.created_at.$gte = new Date(startDate);
      if (endDate) filters.created_at.$lte = new Date(endDate);
    }

    // Ejecutar consulta
    const operations = await Operation.find(filters)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .lean();

    // Obtener estadísticas adicionales
    const totalCount = await Operation.countDocuments(filters);
    
    res.status(200).json({
      success: true,
      data: operations,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        returned: operations.length
      },
      filters: {
        operation_type: tipo,
        status,
        symbol,
        startDate,
        endDate
      },
      message: `Operaciones de tipo '${tipo}' obtenidas exitosamente`
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error al obtener las operaciones'
    });
  }
};

/**
 * Obtener todas las operaciones con paginación
 */
const getAllOperations = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      operation_type, 
      status, 
      symbol,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    // Construir filtros
    const filters = {};
    if (operation_type) filters.operation_type = operation_type;
    if (status) filters.status = status;
    if (symbol) filters.symbol = { $regex: symbol, $options: 'i' };

    // Construir ordenamiento
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calcular skip para paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Ejecutar consulta
    const [operations, totalCount] = await Promise.all([
      Operation.find(filters)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Operation.countDocuments(filters)
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.status(200).json({
      success: true,
      data: operations,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      },
      message: 'Operaciones obtenidas exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error al obtener las operaciones'
    });
  }
};

/**
 * Obtener una operación por ID
 */
const getOperationById = async (req, res) => {
  try {
    const { id } = req.params;
    const operation = await Operation.findById(id);

    if (!operation) {
      return res.status(404).json({
        success: false,
        error: 'Operación no encontrada',
        message: 'La operación solicitada no existe'
      });
    }

    res.status(200).json({
      success: true,
      data: operation,
      message: 'Operación obtenida exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error al obtener la operación'
    });
  }
};

/**
 * Actualizar una operación
 */
const updateOperation = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updated_at: new Date() };

    const operation = await Operation.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!operation) {
      return res.status(404).json({
        success: false,
        error: 'Operación no encontrada',
        message: 'La operación solicitada no existe'
      });
    }

    res.status(200).json({
      success: true,
      data: operation,
      message: 'Operación actualizada exitosamente'
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      message: 'Error al actualizar la operación'
    });
  }
};

/**
 * Marcar operación como completada
 */
const completeOperation = async (req, res) => {
  try {
    const { id } = req.params;
    const { real_buy_price, real_sell_price } = req.body;

    const operation = await Operation.findById(id);
    if (!operation) {
      return res.status(404).json({
        success: false,
        error: 'Operación no encontrada',
        message: 'La operación solicitada no existe'
      });
    }

    // Actualizar precios reales si se proporcionan
    if (real_buy_price) operation.real_buy_price = real_buy_price;
    if (real_sell_price) operation.real_sell_price = real_sell_price;

    // Marcar como completada (esto calculará automáticamente profit/loss)
    operation.markAsCompleted();
    await operation.save();

    res.status(200).json({
      success: true,
      data: operation,
      message: 'Operación marcada como completada exitosamente'
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      message: 'Error al completar la operación'
    });
  }
};

/**
 * Marcar operación como fallida
 */
const failOperation = async (req, res) => {
  try {
    const { id } = req.params;
    const { error_message } = req.body;

    const operation = await Operation.findById(id);
    if (!operation) {
      return res.status(404).json({
        success: false,
        error: 'Operación no encontrada',
        message: 'La operación solicitada no existe'
      });
    }

    operation.markAsFailed(error_message || 'Operación fallida');
    await operation.save();

    res.status(200).json({
      success: true,
      data: operation,
      message: 'Operación marcada como fallida exitosamente'
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      message: 'Error al marcar la operación como fallida'
    });
  }
};

/**
 * Obtener estadísticas de operaciones por tipo
 */
const getOperationStats = async (req, res) => {
  try {
    const { tipo } = req.params;
    const { startDate, endDate } = req.query;

    // Validar tipo de operación
    const validTypes = ['local', 'sandbox', 'real'];
    if (!validTypes.includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: `Tipo de operación inválido. Debe ser uno de: ${validTypes.join(', ')}`,
        message: 'Tipo de operación no válido'
      });
    }

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const stats = await Operation.getOperationStats(tipo, start, end);

    // Calcular totales generales
    const totals = stats.reduce((acc, stat) => {
      acc.totalOperations += stat.count;
      acc.totalInvested += stat.totalInvested;
      acc.totalProfitLoss += stat.totalProfitLoss;
      acc.totalFees += stat.totalFees;
      return acc;
    }, {
      totalOperations: 0,
      totalInvested: 0,
      totalProfitLoss: 0,
      totalFees: 0
    });

    res.status(200).json({
      success: true,
      data: {
        operation_type: tipo,
        period: { startDate, endDate },
        statsByStatus: stats,
        totals,
        profitabilityRate: totals.totalInvested > 0 
          ? ((totals.totalProfitLoss / totals.totalInvested) * 100).toFixed(2) + '%'
          : '0%'
      },
      message: `Estadísticas de operaciones '${tipo}' obtenidas exitosamente`
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error al obtener las estadísticas'
    });
  }
};

/**
 * Eliminar una operación
 */
const deleteOperation = async (req, res) => {
  try {
    const { id } = req.params;
    const operation = await Operation.findByIdAndDelete(id);

    if (!operation) {
      return res.status(404).json({
        success: false,
        error: 'Operación no encontrada',
        message: 'La operación solicitada no existe'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Operación eliminada exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error al eliminar la operación'
    });
  }
};

/**
 * Obtener resumen de operaciones para dashboard
 */
const getOperationsSummary = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    // Obtener estadísticas por tipo de operación
    const [localStats, sandboxStats, realStats] = await Promise.all([
      Operation.getOperationStats('local', startDate),
      Operation.getOperationStats('sandbox', startDate),
      Operation.getOperationStats('real', startDate)
    ]);

    // Obtener operaciones recientes
    const recentOperations = await Operation.find({ created_at: { $gte: startDate } })
      .sort({ created_at: -1 })
      .limit(10)
      .select('symbol operation_type status profit_loss created_at')
      .lean();

    res.status(200).json({
      success: true,
      data: {
        period: `Últimos ${days} días`,
        summary: {
          local: localStats,
          sandbox: sandboxStats,
          real: realStats
        },
        recentOperations
      },
      message: 'Resumen de operaciones obtenido exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error al obtener el resumen de operaciones'
    });
  }
};

module.exports = {
  createOperation,
  createAIInitiatedOperation,
  initiateUSDTTransfer,
  updateBuyResult,
  updateSellResult,
  getOperationsByType,
  getAllOperations,
  getOperationById,
  updateOperation,
  completeOperation,
  failOperation,
  getOperationStats,
  deleteOperation,
  getOperationsSummary
};