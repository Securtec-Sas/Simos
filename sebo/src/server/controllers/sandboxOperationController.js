const { connectToExchange } = require('../utils/exchangeConnector');

/**
 * Connects to an exchange in sandbox mode and returns a confirmation.
 */
const connect = async (req, res) => {
    const { exchangeId } = req.body;
    if (!exchangeId) {
        return res.status(400).json({ success: false, message: "exchangeId is required." });
    }
    try {
        await connectToExchange(exchangeId, true);
        res.status(200).json({ success: true, message: `Successfully connected to ${exchangeId} in sandbox mode.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Gets the balance of a given exchange in sandbox mode.
 */
const getWalletBalance = async (req, res) => {
    const { exchangeId } = req.query;
    if (!exchangeId) {
        return res.status(400).json({ success: false, message: "exchangeId is required." });
    }
    try {
        const exchange = await connectToExchange(exchangeId, true);
        const balance = await exchange.fetchBalance();
        res.status(200).json({ success: true, data: balance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Transfers a currency from one exchange to another in sandbox mode.
 */
const transferCurrency = async (req, res) => {
    const { fromExchangeId, toExchangeId, symbol, amount } = req.body;
    if (!fromExchangeId || !toExchangeId || !symbol || !amount) {
        return res.status(400).json({ success: false, message: "fromExchangeId, toExchangeId, symbol, and amount are required." });
    }

    try {
        const fromExchange = await connectToExchange(fromExchangeId, true);
        const toExchange = await connectToExchange(toExchangeId, true);

        const depositAddress = await toExchange.fetchDepositAddress(symbol);
        const withdrawal = await fromExchange.withdraw(symbol, amount, depositAddress.address, depositAddress.tag);

        res.status(200).json({ success: true, data: withdrawal });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Buys a symbol on a given exchange in sandbox mode.
 */
const buySymbol = async (req, res) => {
    const { exchangeId, symbol, usdtAmount, amount } = req.body;
    if (!exchangeId || !symbol || !usdtAmount || !amount) {
        return res.status(400).json({ success: false, message: "exchangeId, symbol, usdtAmount and amount are required." });
    }

    try {
        const exchange = await connectToExchange(exchangeId, true);
        const balance = await exchange.fetchBalance();

        if (balance.USDT.free < usdtAmount) {
            return res.status(400).json({ success: false, message: "Insufficient USDT balance." });
        }

        const order = await exchange.createMarketBuyOrder(symbol, amount);
        res.status(200).json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Sells a symbol on a given exchange in sandbox mode.
 */
const sellSymbol = async (req, res) => {
    const { exchangeId, symbol, amount, minUsdtExpected } = req.body;
    if (!exchangeId || !symbol || !amount || !minUsdtExpected) {
        return res.status(400).json({ success: false, message: "exchangeId, symbol, amount, and minUsdtExpected are required." });
    }

    try {
        const exchange = await connectToExchange(exchangeId, true);

        const ticker = await exchange.fetchTicker(symbol);
        const currentPrice = ticker.last;
        const expectedUsdt = amount * currentPrice;

        if (expectedUsdt < minUsdtExpected) {
            return res.status(400).json({ success: false, message: `Possible loss: expected USDT (${expectedUsdt}) is less than minimum expected USDT (${minUsdtExpected}).` });
        }

        const order = await exchange.createMarketSellOrder(symbol, amount);
        res.status(200).json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Gets the operation history for a given exchange in sandbox mode.
 */
const getOperationHistory = async (req, res) => {
    const { exchangeId } = req.query;
    if (!exchangeId) {
        return res.status(400).json({ success: false, message: "exchangeId is required." });
    }
    try {
        const exchange = await connectToExchange(exchangeId, true);
        const trades = await exchange.fetchMyTrades();
        res.status(200).json({ success: true, data: trades });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


/**
 * Gets the networks for a given symbol on a given exchange in sandbox mode.
 */
const getSymbolNetworks = async (req, res) => {
    const { exchangeId, symbol } = req.query;
    if (!exchangeId || !symbol) {
        return res.status(400).json({ success: false, message: "exchangeId and symbol are required." });
    }
    try {
        const exchange = await connectToExchange(exchangeId, true);

        // We need to load markets first to get currency details
        await exchange.loadMarkets();

        // CCXT stores currency info, including networks, in `exchange.currencies`
        const currency = exchange.currencies[symbol];

        if (!currency || !currency.networks) {
            return res.status(404).json({ success: false, message: `Networks for symbol '${symbol}' not found on exchange '${exchangeId}' in sandbox mode.` });
        }

        res.status(200).json({ success: true, data: currency.networks });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Withdraws USDT from an exchange in sandbox mode for arbitrage operations.
 */
const withdrawUsdt = async (req, res) => {
    const { exchange_id, amount, transaction_id } = req.body;
    if (!exchange_id || !amount || !transaction_id) {
        return res.status(400).json({
            success: false,
            message: "exchange_id, amount, and transaction_id are required."
        });
    }

    try {
        const exchange = await connectToExchange(exchange_id, true);
        const balance = await exchange.fetchBalance();

        // Verificar balance suficiente
        if (balance.USDT.free < amount) {
            return res.status(400).json({
                success: false,
                message: "Insufficient USDT balance for withdrawal."
            });
        }

        // Simular retiro (en sandbox no se hace retiro real)
        const withdrawalFee = 1.0; // Fee fijo de 1 USDT
        const netAmount = amount - withdrawalFee;

        // Simular delay de procesamiento
        await new Promise(resolve => setTimeout(resolve, 1000));

        res.status(200).json({
            success: true,
            data: {
                transaction_id,
                exchange_id,
                amount_requested: amount,
                withdrawal_fee: withdrawalFee,
                net_amount: netAmount,
                status: 'completed',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Buys an asset with USDT in sandbox mode for arbitrage operations.
 */
const buyAsset = async (req, res) => {
    const { exchange_id, symbol, amount_usdt, transaction_id } = req.body;
    if (!exchange_id || !symbol || !amount_usdt || !transaction_id) {
        return res.status(400).json({
            success: false,
            message: "exchange_id, symbol, amount_usdt, and transaction_id are required."
        });
    }

    try {
        const exchange = await connectToExchange(exchange_id, true);
        const balance = await exchange.fetchBalance();
        const ticker = await exchange.fetchTicker(symbol);

        // Verificar balance suficiente
        if (balance.USDT.free < amount_usdt) {
            return res.status(400).json({
                success: false,
                message: "Insufficient USDT balance for purchase."
            });
        }

        // Calcular cantidad de asset a comprar
        const currentPrice = ticker.ask || ticker.last;
        const tradingFee = 0.001; // 0.1% fee
        const grossAssetAmount = amount_usdt / currentPrice;
        const assetAmount = grossAssetAmount * (1 - tradingFee);

        // Simular delay de procesamiento
        await new Promise(resolve => setTimeout(resolve, 1500));

        res.status(200).json({
            success: true,
            data: {
                transaction_id,
                exchange_id,
                symbol,
                usdt_spent: amount_usdt,
                asset_amount: assetAmount,
                buy_price: currentPrice,
                trading_fee_percentage: tradingFee * 100,
                status: 'completed',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Transfers an asset between exchanges in sandbox mode for arbitrage operations.
 */
const transferAsset = async (req, res) => {
    const { from_exchange, to_exchange, symbol, amount, transaction_id } = req.body;
    if (!from_exchange || !to_exchange || !symbol || !amount || !transaction_id) {
        return res.status(400).json({
            success: false,
            message: "from_exchange, to_exchange, symbol, amount, and transaction_id are required."
        });
    }

    try {
        const fromExchange = await connectToExchange(from_exchange, true);
        const toExchange = await connectToExchange(to_exchange, true);

        // Simular verificación de balance
        const balance = await fromExchange.fetchBalance();
        const baseCurrency = symbol.split('/')[0];
        
        if (balance[baseCurrency] && balance[baseCurrency].free < amount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient ${baseCurrency} balance for transfer.`
            });
        }

        // Simular fee de transferencia
        const transferFee = amount * 0.001; // 0.1% fee
        const receivedAmount = amount - transferFee;

        // Simular delay de transferencia (más largo)
        await new Promise(resolve => setTimeout(resolve, 3000));

        res.status(200).json({
            success: true,
            data: {
                transaction_id,
                from_exchange,
                to_exchange,
                symbol,
                amount_sent: amount,
                transfer_fee: transferFee,
                received_amount: receivedAmount,
                status: 'completed',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Sells an asset for USDT in sandbox mode for arbitrage operations.
 */
const sellAsset = async (req, res) => {
    const { exchange_id, symbol, amount, transaction_id } = req.body;
    if (!exchange_id || !symbol || !amount || !transaction_id) {
        return res.status(400).json({
            success: false,
            message: "exchange_id, symbol, amount, and transaction_id are required."
        });
    }

    try {
        const exchange = await connectToExchange(exchange_id, true);
        const balance = await exchange.fetchBalance();
        const ticker = await exchange.fetchTicker(symbol);

        // Verificar balance del asset
        const baseCurrency = symbol.split('/')[0];
        if (balance[baseCurrency] && balance[baseCurrency].free < amount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient ${baseCurrency} balance for sale.`
            });
        }

        // Calcular USDT obtenido
        const currentPrice = ticker.bid || ticker.last;
        const tradingFee = 0.001; // 0.1% fee
        const grossUsdtAmount = amount * currentPrice;
        const finalUsdt = grossUsdtAmount * (1 - tradingFee);

        // Simular delay de procesamiento
        await new Promise(resolve => setTimeout(resolve, 1500));

        res.status(200).json({
            success: true,
            data: {
                transaction_id,
                exchange_id,
                symbol,
                asset_amount_sold: amount,
                sell_price: currentPrice,
                gross_usdt: grossUsdtAmount,
                final_usdt: finalUsdt,
                trading_fee_percentage: tradingFee * 100,
                status: 'completed',
                timestamp: new Date().toISOString()
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
