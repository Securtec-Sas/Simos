const Operation = require('../data/dataBase/modelosBD/operation.model');
const OperationBalance = require('../data/dataBase/modelosBD/operationBalance.model');
const { initializeExchange } = require('./exchangeController');

/**
 * Connects to an exchange in local simulation mode and returns a confirmation.
 */
const connect = async (req, res) => {
    const { exchangeId } = req.body;
    if (!exchangeId) {
        return res.status(400).json({ success: false, message: "exchangeId is required." });
    }
    try {
        // En modo local, solo validamos que el exchange sea válido
        const exchange = initializeExchange(exchangeId);
        if (!exchange) {
            throw new Error(`Exchange ${exchangeId} not supported or failed to initialize`);
        }
        res.status(200).json({ success: true, message: `Successfully validated ${exchangeId} for local simulation.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Gets the simulated balance of a given exchange in local mode.
 */
const getWalletBalance = async (req, res) => {
    const { exchangeId } = req.query;
    if (!exchangeId) {
        return res.status(400).json({ success: false, message: "exchangeId is required." });
    }
    try {
        // Obtener balance simulado desde OperationBalance
        const balance = await OperationBalance.findOne({
            operation_type: 'local',
            exchange_id: exchangeId,
            is_active: true
        });

        if (!balance) {
            return res.status(404).json({
                success: false,
                message: `No local balance found for exchange ${exchangeId}`
            });
        }

        // Simular estructura de balance de CCXT
        const simulatedBalance = {
            USDT: {
                free: balance.usdt_balance,
                used: balance.reserved_balance || 0,
                total: balance.total_balance
            },
            free: { USDT: balance.usdt_balance },
            used: { USDT: balance.reserved_balance || 0 },
            total: { USDT: balance.total_balance }
        };

        res.status(200).json({ success: true, data: simulatedBalance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Simulates transferring a currency from one exchange to another in local mode.
 * Actualiza operación en la base de datos con estado de transferencia
 */
const transferCurrency = async (req, res) => {
    const { fromExchangeId, toExchangeId, symbol, amount, transaction_id, transfer_delay, operation_id } = req.body;
    if (!fromExchangeId || !toExchangeId || !symbol || !amount || !transaction_id) {
        return res.status(400).json({
            success: false,
            message: "fromExchangeId, toExchangeId, symbol, amount, and transaction_id are required."
        });
    }

    try {
        // Validar que los exchanges sean válidos
        const fromExchange = initializeExchange(fromExchangeId);
        const toExchange = initializeExchange(toExchangeId);

        if (!fromExchange || !toExchange) {
            return res.status(400).json({
                success: false,
                message: "One or both exchanges are not supported"
            });
        }

        // Validar que el símbolo existe en ambos exchanges
        await Promise.all([
            fromExchange.loadMarkets(),
            toExchange.loadMarkets()
        ]);

        const baseCurrency = symbol.split('/')[0];
        
        if (!fromExchange.markets[symbol] || !toExchange.markets[symbol]) {
            return res.status(400).json({
                success: false,
                message: `Symbol ${symbol} not available on one or both exchanges`
            });
        }

        // Obtener información de redes y fees
        if (fromExchange.has['fetchCurrencies']) {
            await fromExchange.fetchCurrencies();
        }
        if (toExchange.has['fetchCurrencies']) {
            await toExchange.fetchCurrencies();
        }

        const fromCurrency = fromExchange.currencies[baseCurrency];
        const toCurrency = toExchange.currencies[baseCurrency];

        if (!fromCurrency || !toCurrency) {
            return res.status(400).json({
                success: false,
                message: `Currency ${baseCurrency} information not available`
            });
        }

        // Validar redes compatibles
        let transferFee = 0.001; // Fee por defecto
        let networkUsed = 'Unknown';

        if (fromCurrency.networks && toCurrency.networks) {
            const commonNetworks = Object.keys(fromCurrency.networks).filter(network =>
                toCurrency.networks[network] &&
                fromCurrency.networks[network].withdraw &&
                toCurrency.networks[network].deposit
            );

            if (commonNetworks.length > 0) {
                networkUsed = commonNetworks[0];
                transferFee = fromCurrency.networks[networkUsed].fee || 0.001;
            }
        }

        const receivedAmount = amount - transferFee;
        const delay = transfer_delay || Math.random() * (300 - 60) + 60; // 1-5 minutos por defecto

        // Buscar y actualizar operación existente
        let operation;
        if (operation_id) {
            operation = await Operation.findById(operation_id);
            if (operation) {
                // Actualizar operación con datos de transferencia
                operation.status = 'asset_transfer_in_progress';
                operation.transfer_fee = transferFee;
                operation.transfer_transaction_id = transaction_id;
                operation.transfer_started_at = new Date();
                operation.transfer_network_used = networkUsed;
                operation.transfer_amount_sent = amount;
                operation.transfer_amount_received = receivedAmount;
                operation.updated_at = new Date();
                await operation.save();
            }
        }

        // Simular delay de transferencia
        await new Promise(resolve => setTimeout(resolve, Math.min(delay * 1000, 5000))); // Max 5 segundos para testing

        // Actualizar operación como transferencia completada
        if (operation) {
            operation.status = 'asset_transferred';
            operation.transfer_completed_at = new Date();
            operation.updated_at = new Date();
            await operation.save();
        }

        res.status(200).json({
            success: true,
            data: {
                operation_id: operation ? operation._id : null,
                transaction_id,
                from_exchange: fromExchangeId,
                to_exchange: toExchangeId,
                symbol,
                amount_sent: amount,
                transfer_fee: transferFee,
                received_amount: receivedAmount,
                network_used: networkUsed,
                estimated_delay_seconds: delay,
                status: 'completed',
                timestamp: new Date().toISOString(),
                simulation_mode: 'local',
                operation_status: operation ? operation.status : 'no_operation'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Simulates buying a symbol on a given exchange in local mode.
 * Crea/actualiza operación en la base de datos
 */
const buySymbol = async (req, res) => {
    const { exchangeId, symbol, usdtAmount, transaction_id, execution_delay, operation_id } = req.body;
    if (!exchangeId || !symbol || !usdtAmount || !transaction_id) {
        return res.status(400).json({
            success: false,
            message: "exchangeId, symbol, usdtAmount, and transaction_id are required."
        });
    }

    try {
        // Validar exchange y obtener datos de mercado
        const exchange = initializeExchange(exchangeId);
        if (!exchange) {
            return res.status(400).json({
                success: false,
                message: `Exchange ${exchangeId} not supported`
            });
        }

        await exchange.loadMarkets();
        
        if (!exchange.markets[symbol]) {
            return res.status(400).json({
                success: false,
                message: `Symbol ${symbol} not available on ${exchangeId}`
            });
        }

        // Obtener precio actual
        const ticker = await exchange.fetchTicker(symbol);
        const currentPrice = ticker.ask || ticker.last;

        // Obtener fees de trading
        const market = exchange.markets[symbol];
        const tradingFee = market.taker || 0.001; // 0.1% por defecto

        // Verificar balance local
        const balance = await OperationBalance.findOne({
            operation_type: 'local',
            exchange_id: exchangeId,
            is_active: true
        });

        if (!balance || balance.usdt_balance < usdtAmount) {
            return res.status(400).json({
                success: false,
                message: "Insufficient USDT balance in local simulation"
            });
        }

        // Buscar operación existente o crear nueva
        let operation;
        if (operation_id) {
            operation = await Operation.findById(operation_id);
        }

        if (!operation) {
            // Crear nueva operación en la base de datos
            operation = new Operation({
                operation_type: 'local',
                symbol: symbol,
                buy_exchange_id: exchangeId,
                sell_exchange_id: exchangeId, // Por defecto el mismo exchange
                expected_buy_price: currentPrice,
                expected_sell_price: currentPrice,
                balance_invested: usdtAmount,
                buy_fee_rate: tradingFee,
                sell_fee_rate: tradingFee,
                transfer_fee: 0,
                status: 'usdt_transfer_initiated',
                transaction_id: transaction_id,
                created_by: 'LOCAL_SIMULATION'
            });
            await operation.save();
        }

        // Calcular cantidad de asset a comprar
        const grossAssetAmount = usdtAmount / currentPrice;
        const feeAmount = usdtAmount * tradingFee;
        const netAssetAmount = grossAssetAmount * (1 - tradingFee);

        const delay = execution_delay || Math.random() * (10 - 2) + 2; // 2-10 segundos por defecto

        // Actualizar operación con datos de compra
        operation.real_buy_price = currentPrice;
        operation.asset_amount_received = netAssetAmount;
        operation.buy_transaction_id = transaction_id;
        operation.actual_buy_fees = feeAmount;
        operation.status = 'asset_purchased';
        operation.buy_completed_at = new Date();
        operation.updated_at = new Date();
        await operation.save();

        // Simular delay de ejecución
        await new Promise(resolve => setTimeout(resolve, Math.min(delay * 1000, 3000))); // Max 3 segundos para testing

        // Actualizar balance local (restar USDT)
        await OperationBalance.updateOne(
            { _id: balance._id },
            {
                $inc: {
                    usdt_balance: -usdtAmount,
                    total_operations: 1
                },
                $set: { updated_at: new Date() }
            }
        );

        res.status(200).json({
            success: true,
            data: {
                operation_id: operation._id,
                transaction_id,
                exchange_id: exchangeId,
                symbol,
                usdt_spent: usdtAmount,
                asset_amount: netAssetAmount,
                buy_price: currentPrice,
                trading_fee: feeAmount,
                trading_fee_percentage: tradingFee * 100,
                estimated_delay_seconds: delay,
                status: 'completed',
                timestamp: new Date().toISOString(),
                simulation_mode: 'local',
                operation_status: operation.status
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Simulates selling a symbol on a given exchange in local mode.
 * Actualiza operación en la base de datos
 */
const sellSymbol = async (req, res) => {
    const { exchangeId, symbol, amount, transaction_id, execution_delay, operation_id } = req.body;
    if (!exchangeId || !symbol || !amount || !transaction_id) {
        return res.status(400).json({
            success: false,
            message: "exchangeId, symbol, amount, and transaction_id are required."
        });
    }

    try {
        // Validar exchange y obtener datos de mercado
        const exchange = initializeExchange(exchangeId);
        if (!exchange) {
            return res.status(400).json({
                success: false,
                message: `Exchange ${exchangeId} not supported`
            });
        }

        await exchange.loadMarkets();
        
        if (!exchange.markets[symbol]) {
            return res.status(400).json({
                success: false,
                message: `Symbol ${symbol} not available on ${exchangeId}`
            });
        }

        // Obtener precio actual
        const ticker = await exchange.fetchTicker(symbol);
        const currentPrice = ticker.bid || ticker.last;

        // Obtener fees de trading
        const market = exchange.markets[symbol];
        const tradingFee = market.taker || 0.001; // 0.1% por defecto

        // Buscar operación existente
        let operation;
        if (operation_id) {
            operation = await Operation.findById(operation_id);
        }

        // Calcular USDT obtenido
        const grossUsdtAmount = amount * currentPrice;
        const feeAmount = grossUsdtAmount * tradingFee;
        const netUsdtAmount = grossUsdtAmount * (1 - tradingFee);

        const delay = execution_delay || Math.random() * (10 - 2) + 2; // 2-10 segundos por defecto

        // Si hay operación, actualizarla con datos de venta
        if (operation) {
            operation.real_sell_price = currentPrice;
            operation.final_usdt_received = netUsdtAmount;
            operation.sell_transaction_id = transaction_id;
            operation.actual_sell_fees = feeAmount;
            operation.sell_completed_at = new Date();

            // Calcular profit/loss real
            const totalInvested = operation.actual_invested_amount || operation.balance_invested;
            const totalFees = (operation.actual_buy_fees || 0) + feeAmount + (operation.transfer_fee || 0);
            operation.actual_profit_loss = netUsdtAmount - totalInvested - totalFees;

            // Marcar como completada
            operation.markAsCompleted();
            await operation.save();
        } else {
            // Crear nueva operación si no existe (venta directa)
            operation = new Operation({
                operation_type: 'local',
                symbol: symbol,
                buy_exchange_id: exchangeId,
                sell_exchange_id: exchangeId,
                expected_buy_price: currentPrice,
                expected_sell_price: currentPrice,
                real_sell_price: currentPrice,
                balance_invested: grossUsdtAmount, // Estimado
                sell_fee_rate: tradingFee,
                final_usdt_received: netUsdtAmount,
                actual_sell_fees: feeAmount,
                status: 'completed',
                transaction_id: transaction_id,
                created_by: 'LOCAL_SIMULATION',
                sell_completed_at: new Date()
            });
            await operation.save();
        }

        // Simular delay de ejecución
        await new Promise(resolve => setTimeout(resolve, Math.min(delay * 1000, 3000))); // Max 3 segundos para testing

        // Actualizar balance local (agregar USDT)
        const balance = await OperationBalance.findOne({
            operation_type: 'local',
            exchange_id: exchangeId,
            is_active: true
        });

        if (balance) {
            const profitLoss = operation.actual_profit_loss || 0;
            await OperationBalance.updateOne(
                { _id: balance._id },
                {
                    $inc: {
                        usdt_balance: netUsdtAmount,
                        total_operations: 1,
                        total_profit_loss: profitLoss
                    },
                    $set: { updated_at: new Date() }
                }
            );
        }

        res.status(200).json({
            success: true,
            data: {
                operation_id: operation._id,
                transaction_id,
                exchange_id: exchangeId,
                symbol,
                asset_amount_sold: amount,
                sell_price: currentPrice,
                gross_usdt: grossUsdtAmount,
                final_usdt: netUsdtAmount,
                trading_fee: feeAmount,
                trading_fee_percentage: tradingFee * 100,
                estimated_delay_seconds: delay,
                status: 'completed',
                timestamp: new Date().toISOString(),
                simulation_mode: 'local',
                operation_status: operation.status,
                profit_loss: operation.actual_profit_loss || 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Gets the simulated operation history for a given exchange in local mode.
 */
const getOperationHistory = async (req, res) => {
    const { exchangeId } = req.query;
    if (!exchangeId) {
        return res.status(400).json({ success: false, message: "exchangeId is required." });
    }
    try {
        // Obtener operaciones locales del exchange
        const operations = await Operation.find({
            operation_type: 'local',
            $or: [
                { buy_exchange_id: exchangeId },
                { sell_exchange_id: exchangeId }
            ]
        })
        .sort({ created_at: -1 })
        .limit(50)
        .lean();

        res.status(200).json({ success: true, data: operations });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Gets the networks for a given symbol on a given exchange in local mode.
 */
const getSymbolNetworks = async (req, res) => {
    const { exchangeId, symbol } = req.query;
    if (!exchangeId || !symbol) {
        return res.status(400).json({ success: false, message: "exchangeId and symbol are required." });
    }
    try {
        const exchange = initializeExchange(exchangeId);
        if (!exchange) {
            return res.status(400).json({
                success: false,
                message: `Exchange ${exchangeId} not supported`
            });
        }

        await exchange.loadMarkets();

        if (exchange.has['fetchCurrencies']) {
            await exchange.fetchCurrencies();
        }

        const baseCurrency = symbol.split('/')[0];
        const currency = exchange.currencies[baseCurrency];

        if (!currency || !currency.networks) {
            return res.status(404).json({
                success: false,
                message: `Networks for symbol '${symbol}' not found on exchange '${exchangeId}' in local mode.`
            });
        }

        res.status(200).json({ success: true, data: currency.networks });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Simulates withdrawing USDT from an exchange in local mode for arbitrage operations.
 * Actualiza operación en la base de datos con estado de retiro
 */
const withdrawUsdt = async (req, res) => {
    const { exchange_id, amount, transaction_id, withdrawal_delay, operation_id } = req.body;
    if (!exchange_id || !amount || !transaction_id) {
        return res.status(400).json({
            success: false,
            message: "exchange_id, amount, and transaction_id are required."
        });
    }

    try {
        // Validar exchange
        const exchange = initializeExchange(exchange_id);
        if (!exchange) {
            return res.status(400).json({
                success: false,
                message: `Exchange ${exchange_id} not supported`
            });
        }

        // Verificar balance local
        const balance = await OperationBalance.findOne({
            operation_type: 'local',
            exchange_id: exchange_id,
            is_active: true
        });

        if (!balance || balance.usdt_balance < amount) {
            return res.status(400).json({
                success: false,
                message: "Insufficient USDT balance for withdrawal in local simulation"
            });
        }

        // Obtener información de fees de retiro
        await exchange.loadMarkets();
        if (exchange.has['fetchCurrencies']) {
            await exchange.fetchCurrencies();
        }

        const usdtCurrency = exchange.currencies['USDT'];
        let withdrawalFee = 1.0; // Fee por defecto

        if (usdtCurrency && usdtCurrency.networks) {
            const networks = Object.values(usdtCurrency.networks);
            const activeNetwork = networks.find(n => n.withdraw && n.fee);
            if (activeNetwork) {
                withdrawalFee = activeNetwork.fee;
            }
        }

        const netAmount = amount - withdrawalFee;
        const delay = withdrawal_delay || Math.random() * (600 - 120) + 120; // 2-10 minutos por defecto

        // Buscar y actualizar operación existente
        let operation;
        if (operation_id) {
            operation = await Operation.findById(operation_id);
            if (operation) {
                // Actualizar operación con datos de retiro
                operation.status = 'usdt_withdrawal_in_progress';
                operation.withdrawal_transaction_id = transaction_id;
                operation.withdrawal_amount_requested = amount;
                operation.withdrawal_fee = withdrawalFee;
                operation.withdrawal_net_amount = netAmount;
                operation.withdrawal_started_at = new Date();
                operation.updated_at = new Date();
                await operation.save();
            }
        } else {
            // Crear nueva operación para retiro independiente
            operation = new Operation({
                operation_type: 'local',
                symbol: 'USDT/USDT', // Operación de retiro
                buy_exchange_id: exchange_id,
                sell_exchange_id: exchange_id,
                balance_invested: amount,
                transfer_fee: withdrawalFee,
                status: 'usdt_withdrawal_in_progress',
                transaction_id: transaction_id,
                withdrawal_transaction_id: transaction_id,
                withdrawal_amount_requested: amount,
                withdrawal_fee: withdrawalFee,
                withdrawal_net_amount: netAmount,
                withdrawal_started_at: new Date(),
                created_by: 'LOCAL_SIMULATION'
            });
            await operation.save();
        }

        // Simular delay de retiro
        await new Promise(resolve => setTimeout(resolve, Math.min(delay * 1000, 5000))); // Max 5 segundos para testing

        // Actualizar operación como retiro completado
        operation.status = 'usdt_withdrawal_completed';
        operation.withdrawal_completed_at = new Date();
        operation.updated_at = new Date();
        await operation.save();

        // Actualizar balance local
        await OperationBalance.updateOne(
            { _id: balance._id },
            {
                $inc: {
                    usdt_balance: -amount,
                    total_operations: 1
                },
                $set: { updated_at: new Date() }
            }
        );

        res.status(200).json({
            success: true,
            data: {
                operation_id: operation._id,
                transaction_id,
                exchange_id,
                amount_requested: amount,
                withdrawal_fee: withdrawalFee,
                net_amount: netAmount,
                estimated_delay_seconds: delay,
                status: 'completed',
                timestamp: new Date().toISOString(),
                simulation_mode: 'local',
                operation_status: operation.status
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Simulates buying an asset with USDT in local mode for arbitrage operations.
 * Crea operación en la base de datos cuando es iniciada por el modelo AI y actualiza estado progresivamente
 */
const buyAsset = async (req, res) => {
    const { exchange_id, symbol, amount_usdt, transaction_id, execution_delay, ai_decision_data } = req.body;
    if (!exchange_id || !symbol || !amount_usdt || !transaction_id) {
        return res.status(400).json({
            success: false,
            message: "exchange_id, symbol, amount_usdt, and transaction_id are required."
        });
    }

    try {
        // Validar exchange y obtener datos de mercado
        const exchange = initializeExchange(exchange_id);
        if (!exchange) {
            return res.status(400).json({
                success: false,
                message: `Exchange ${exchange_id} not supported`
            });
        }

        await exchange.loadMarkets();
        const ticker = await exchange.fetchTicker(symbol);
        const currentPrice = ticker.ask || ticker.last;
        const market = exchange.markets[symbol];
        const tradingFee = market.taker || 0.001;

        // Verificar balance local
        const balance = await OperationBalance.findOne({
            operation_type: 'local',
            exchange_id: exchange_id,
            is_active: true
        });

        if (!balance || balance.usdt_balance < amount_usdt) {
            return res.status(400).json({
                success: false,
                message: "Insufficient USDT balance for purchase in local simulation"
            });
        }

        // Crear operación en la base de datos cuando es iniciada por el modelo AI
        const operation = new Operation({
            operation_type: 'local',
            symbol: symbol,
            buy_exchange_id: exchange_id,
            sell_exchange_id: ai_decision_data?.sell_exchange_id || exchange_id,
            expected_buy_price: currentPrice,
            expected_sell_price: ai_decision_data?.expected_sell_price || currentPrice,
            balance_invested: amount_usdt,
            buy_fee_rate: tradingFee,
            sell_fee_rate: ai_decision_data?.sell_fee_rate || tradingFee,
            transfer_fee: ai_decision_data?.transfer_fee || 0,
            status: 'usdt_transfer_initiated',
            ai_confidence: ai_decision_data?.confidence || 0.5,
            ai_decision_factors: ai_decision_data?.decision_factors || {},
            transaction_id: transaction_id,
            created_by: 'AI_MODEL'
        });

        await operation.save();

        // Calcular cantidad de asset a comprar
        const grossAssetAmount = amount_usdt / currentPrice;
        const feeAmount = amount_usdt * tradingFee;
        const netAssetAmount = grossAssetAmount * (1 - tradingFee);

        const delay = execution_delay || Math.random() * (10 - 2) + 2;

        // Actualizar operación con datos de compra
        operation.real_buy_price = currentPrice;
        operation.asset_amount_received = netAssetAmount;
        operation.buy_transaction_id = transaction_id;
        operation.actual_buy_fees = feeAmount;
        operation.status = 'asset_purchased';
        operation.buy_completed_at = new Date();
        operation.updated_at = new Date();
        await operation.save();

        // Simular delay de ejecución
        await new Promise(resolve => setTimeout(resolve, Math.min(delay * 1000, 3000)));

        // Actualizar balance local
        await OperationBalance.updateOne(
            { _id: balance._id },
            {
                $inc: {
                    usdt_balance: -amount_usdt,
                    total_operations: 1
                },
                $set: { updated_at: new Date() }
            }
        );

        res.status(200).json({
            success: true,
            data: {
                operation_id: operation._id,
                transaction_id,
                exchange_id,
                symbol,
                usdt_spent: amount_usdt,
                asset_amount: netAssetAmount,
                buy_price: currentPrice,
                trading_fee: feeAmount,
                trading_fee_percentage: tradingFee * 100,
                estimated_delay_seconds: delay,
                status: 'completed',
                timestamp: new Date().toISOString(),
                simulation_mode: 'local',
                operation_status: operation.status
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Simulates transferring an asset between exchanges in local mode for arbitrage operations.
 * Actualiza operación en la base de datos con estado de transferencia
 */
const transferAsset = async (req, res) => {
    const { from_exchange, to_exchange, symbol, amount, transaction_id, transfer_delay, operation_id } = req.body;
    if (!from_exchange || !to_exchange || !symbol || !amount || !transaction_id) {
        return res.status(400).json({
            success: false,
            message: "from_exchange, to_exchange, symbol, amount, and transaction_id are required."
        });
    }

    try {
        // Validar exchanges
        const fromExchange = initializeExchange(from_exchange);
        const toExchange = initializeExchange(to_exchange);

        if (!fromExchange || !toExchange) {
            return res.status(400).json({
                success: false,
                message: "One or both exchanges are not supported"
            });
        }

        // Validar redes y obtener fees
        await Promise.all([
            fromExchange.loadMarkets(),
            toExchange.loadMarkets()
        ]);

        if (fromExchange.has['fetchCurrencies']) {
            await fromExchange.fetchCurrencies();
        }
        if (toExchange.has['fetchCurrencies']) {
            await toExchange.fetchCurrencies();
        }

        const baseCurrency = symbol.split('/')[0];
        const fromCurrency = fromExchange.currencies[baseCurrency];
        const toCurrency = toExchange.currencies[baseCurrency];

        let transferFee = amount * 0.001; // 0.1% por defecto
        let networkUsed = 'Unknown';

        if (fromCurrency && fromCurrency.networks && toCurrency && toCurrency.networks) {
            const commonNetworks = Object.keys(fromCurrency.networks).filter(network =>
                toCurrency.networks[network] &&
                fromCurrency.networks[network].withdraw &&
                toCurrency.networks[network].deposit
            );

            if (commonNetworks.length > 0) {
                networkUsed = commonNetworks[0];
                transferFee = fromCurrency.networks[networkUsed].fee || transferFee;
            }
        }

        const receivedAmount = amount - transferFee;
        const delay = transfer_delay || Math.random() * (600 - 180) + 180; // 3-10 minutos por defecto

        // Buscar y actualizar operación existente
        let operation;
        if (operation_id) {
            operation = await Operation.findById(operation_id);
            if (operation) {
                // Actualizar operación con datos de transferencia
                operation.status = 'asset_transfer_in_progress';
                operation.transfer_fee = transferFee;
                operation.transfer_transaction_id = transaction_id;
                operation.transfer_started_at = new Date();
                operation.transfer_network_used = networkUsed;
                operation.transfer_amount_sent = amount;
                operation.transfer_amount_received = receivedAmount;
                operation.updated_at = new Date();
                await operation.save();
            }
        }

        // Simular delay de transferencia
        await new Promise(resolve => setTimeout(resolve, Math.min(delay * 1000, 5000)));

        // Actualizar operación como transferencia completada
        if (operation) {
            operation.status = 'asset_transferred';
            operation.transfer_completed_at = new Date();
            operation.updated_at = new Date();
            await operation.save();
        }

        res.status(200).json({
            success: true,
            data: {
                operation_id: operation ? operation._id : null,
                transaction_id,
                from_exchange,
                to_exchange,
                symbol,
                amount_sent: amount,
                transfer_fee: transferFee,
                received_amount: receivedAmount,
                network_used: networkUsed,
                estimated_delay_seconds: delay,
                status: 'completed',
                timestamp: new Date().toISOString(),
                simulation_mode: 'local',
                operation_status: operation ? operation.status : 'no_operation'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Simulates selling an asset for USDT in local mode for arbitrage operations.
 * Actualiza operación en la base de datos con estado de venta y calcula profit/loss final
 */
const sellAsset = async (req, res) => {
    const { exchange_id, symbol, amount, transaction_id, execution_delay, operation_id } = req.body;
    if (!exchange_id || !symbol || !amount || !transaction_id) {
        return res.status(400).json({
            success: false,
            message: "exchange_id, symbol, amount, and transaction_id are required."
        });
    }

    try {
        // Validar exchange y obtener datos de mercado
        const exchange = initializeExchange(exchange_id);
        if (!exchange) {
            return res.status(400).json({
                success: false,
                message: `Exchange ${exchange_id} not supported`
            });
        }

        await exchange.loadMarkets();
        const ticker = await exchange.fetchTicker(symbol);
        const currentPrice = ticker.bid || ticker.last;
        const market = exchange.markets[symbol];
        const tradingFee = market.taker || 0.001;

        // Buscar operación existente
        let operation;
        if (operation_id) {
            operation = await Operation.findById(operation_id);
        }

        // Calcular USDT obtenido
        const grossUsdtAmount = amount * currentPrice;
        const feeAmount = grossUsdtAmount * tradingFee;
        const netUsdtAmount = grossUsdtAmount * (1 - tradingFee);

        const delay = execution_delay || Math.random() * (10 - 2) + 2;

        // Si hay operación, actualizarla con datos de venta
        if (operation) {
            operation.real_sell_price = currentPrice;
            operation.final_usdt_received = netUsdtAmount;
            operation.sell_transaction_id = transaction_id;
            operation.actual_sell_fees = feeAmount;
            operation.sell_completed_at = new Date();

            // Calcular profit/loss real
            const totalInvested = operation.actual_invested_amount || operation.balance_invested;
            const totalFees = (operation.actual_buy_fees || 0) + feeAmount + (operation.transfer_fee || 0);
            operation.actual_profit_loss = netUsdtAmount - totalInvested - totalFees;

            // Marcar como completada
            operation.markAsCompleted();
            await operation.save();
        } else {
            // Crear nueva operación si no existe (venta directa)
            operation = new Operation({
                operation_type: 'local',
                symbol: symbol,
                buy_exchange_id: exchange_id,
                sell_exchange_id: exchange_id,
                expected_buy_price: currentPrice,
                expected_sell_price: currentPrice,
                real_sell_price: currentPrice,
                balance_invested: grossUsdtAmount, // Estimado
                sell_fee_rate: tradingFee,
                final_usdt_received: netUsdtAmount,
                actual_sell_fees: feeAmount,
                status: 'completed',
                transaction_id: transaction_id,
                created_by: 'LOCAL_SIMULATION',
                sell_completed_at: new Date()
            });
            await operation.save();
        }

        // Simular delay de ejecución
        await new Promise(resolve => setTimeout(resolve, Math.min(delay * 1000, 3000)));

        // Actualizar balance local (agregar USDT)
        const balance = await OperationBalance.findOne({
            operation_type: 'local',
            exchange_id: exchange_id,
            is_active: true
        });

        if (balance) {
            const profitLoss = operation.actual_profit_loss || 0;
            await OperationBalance.updateOne(
                { _id: balance._id },
                {
                    $inc: {
                        usdt_balance: netUsdtAmount,
                        total_operations: 1,
                        total_profit_loss: profitLoss
                    },
                    $set: { updated_at: new Date() }
                }
            );
        }

        res.status(200).json({
            success: true,
            data: {
                operation_id: operation._id,
                transaction_id,
                exchange_id,
                symbol,
                asset_amount_sold: amount,
                sell_price: currentPrice,
                gross_usdt: grossUsdtAmount,
                final_usdt: netUsdtAmount,
                trading_fee: feeAmount,
                trading_fee_percentage: tradingFee * 100,
                estimated_delay_seconds: delay,
                status: 'completed',
                timestamp: new Date().toISOString(),
                simulation_mode: 'local',
                operation_status: operation.status,
                profit_loss: operation.actual_profit_loss || 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    connect,
    getWalletBalance,
    transferCurrency,
    buySymbol,
    sellSymbol,
    getOperationHistory,
    getSymbolNetworks,
    withdrawUsdt,
    buyAsset,
    transferAsset,
    sellAsset,
};