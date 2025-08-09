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


module.exports = {
    connect,
    getWalletBalance,
    transferCurrency,
    buySymbol,
    sellSymbol,
    getOperationHistory,
};
