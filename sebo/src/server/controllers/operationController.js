const { connectToExchange } = require('../utils/exchangeConnector');

/**
 * Connects to an exchange and returns a confirmation.
 * This is mostly for testing the connection.
 */
const connect = async (req, res) => {
    const { exchangeId } = req.body;
    if (!exchangeId) {
        return res.status(400).json({ success: false, message: "exchangeId is required." });
    }
    try {
        await connectToExchange(exchangeId, false);
        res.status(200).json({ success: true, message: `Successfully connected to ${exchangeId}.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Gets the balance of a given exchange.
 */
const getWalletBalance = async (req, res) => {
    const { exchangeId } = req.query;
    if (!exchangeId) {
        return res.status(400).json({ success: false, message: "exchangeId is required." });
    }
    try {
        const exchange = await connectToExchange(exchangeId, false);
        const balance = await exchange.fetchBalance();
        res.status(200).json({ success: true, data: balance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Transfers a currency from one exchange to another.
 * This is a withdrawal from the source exchange to the deposit address of the destination exchange.
 */
const transferCurrency = async (req, res) => {
    const { fromExchangeId, toExchangeId, symbol, amount } = req.body;
    if (!fromExchangeId || !toExchangeId || !symbol || !amount) {
        return res.status(400).json({ success: false, message: "fromExchangeId, toExchangeId, symbol, and amount are required." });
    }

    try {
        const fromExchange = await connectToExchange(fromExchangeId, false);
        const toExchange = await connectToExchange(toExchangeId, false);

        // 1. Get deposit address from the destination exchange
        const depositAddress = await toExchange.fetchDepositAddress(symbol);

        // 2. Withdraw from the source exchange to the deposit address
        const withdrawal = await fromExchange.withdraw(symbol, amount, depositAddress.address, depositAddress.tag);

        res.status(200).json({ success: true, data: withdrawal });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Buys a symbol on a given exchange.
 */
const buySymbol = async (req, res) => {
    const { exchangeId, symbol, usdtAmount, amount } = req.body;
    if (!exchangeId || !symbol || !usdtAmount || !amount) {
        return res.status(400).json({ success: false, message: "exchangeId, symbol, usdtAmount and amount are required." });
    }

    try {
        const exchange = await connectToExchange(exchangeId, false);
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
 * Sells a symbol on a given exchange.
 */
const sellSymbol = async (req, res) => {
    const { exchangeId, symbol, amount, minUsdtExpected } = req.body;
    if (!exchangeId || !symbol || !amount || !minUsdtExpected) {
        return res.status(400).json({ success: false, message: "exchangeId, symbol, amount, and minUsdtExpected are required." });
    }

    try {
        const exchange = await connectToExchange(exchangeId, false);

        // Check current price before selling
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
 * Gets the operation history for a given exchange.
 */
const getOperationHistory = async (req, res) => {
    const { exchangeId } = req.query;
    if (!exchangeId) {
        return res.status(400).json({ success: false, message: "exchangeId is required." });
    }
    try {
        const exchange = await connectToExchange(exchangeId, false);
        const trades = await exchange.fetchMyTrades();
        res.status(200).json({ success: true, data: trades });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


/**
 * Gets the networks for a given symbol on a given exchange.
 */
const getSymbolNetworks = async (req, res) => {
    const { exchangeId, symbol } = req.query;
    if (!exchangeId || !symbol) {
        return res.status(400).json({ success: false, message: "exchangeId and symbol are required." });
    }
    try {
        const exchange = await connectToExchange(exchangeId, false);

        // We need to load markets first to get currency details
        await exchange.loadMarkets();

        // CCXT stores currency info, including networks, in `exchange.currencies`
        const currency = exchange.currencies[symbol];

        if (!currency || !currency.networks) {
            return res.status(404).json({ success: false, message: `Networks for symbol '${symbol}' not found on exchange '${exchangeId}'.` });
        }

        res.status(200).json({ success: true, data: currency.networks });
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
};
