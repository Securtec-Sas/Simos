// spotSocketController.js
const ccxt = require('ccxt');
const { readSpotCoinsFileHelper } = require('./spotController');

// Define the target namespace
const SPOT_ARB_DATA_NAMESPACE = '/api/spot/arb';

// --- State and Configuration ---
let lastSpotArbData = [];
let exchangeInstances = {}; // Cache for CCXT instances

/**
 * Initializes and caches CCXT exchange instances.
 * @param {string[]} exchangeIds - Array of exchange IDs like ['binance', 'kraken'].
 */
async function initializeExchanges(exchangeIds) {
    for (const exId of exchangeIds) {
        if (!exchangeInstances[exId]) {
            try {
                const instance = new ccxtexId;
                await instance.loadMarkets();
                exchangeInstances[exId] = instance;
                console.log(`Initialized and cached exchange: ${exId}`);
            } catch (e) {
                console.error(`Failed to initialize exchange ${exId}:`, e.message);
                exchangeInstances[exId] = null; // Mark as failed
            }
        }
    }
}

/**
 * Fetches prices for a given symbol from a list of exchanges.
 * @param {string} symbol - The trading symbol (e.g., 'BTC/USDT').
 * @param {string[]} exchangeIds - The exchanges to query.
 * @returns {Promise<Array<{exchange: string, price: number | null}>>}
 */
async function fetchPricesForSymbol(symbol, exchangeIds) {
    const pricePromises = exchangeIds.map(async (exId) => {
        const exchange = exchangeInstances[exId];
        if (!exchange) {
            return { exchange: exId, price: null };
        }
        try {
            const ticker = await exchange.fetchTicker(symbol);
            // Use 'ask' for buying price, ensure it's a number
            return { exchange: exId, price: ticker && typeof ticker.ask === 'number' ? ticker.ask : null };
        } catch (e) {
            // console.warn(`Could not fetch ticker for ${symbol} on ${exId}: ${e.message}`);
            return { exchange: exId, price: null };
        }
    });
    return Promise.all(pricePromises);
}

/**
 * Processes the fetched prices to find arbitrage opportunities.
 * @param {string} symbol - The trading symbol.
 * @param {Array<{exchange: string, price: number | null}>} prices - The fetched prices.
 * @returns {object | null} - Arbitrage data or null if not enough data.
 */
function processArbitrageData(symbol, prices) {
    const validPrices = prices.filter(p => p.price !== null && !isNaN(p.price));
    validPrices.sort((a, b) => a.price - b.price);

    if (validPrices.length < 2) {
        return null;
    }

    const min = validPrices[0];
    const max = validPrices[validPrices.length - 1];
    const percent = ((max.price - min.price) / min.price) * 100;

    console.log(`Moneda: ${symbol} | Min: ${min.exchange} ${min.price} | Max: ${max.exchange} ${max.price} | Diferencia: ${percent.toFixed(2)}%`);

    return {
        symbol,
        exchanges: validPrices.map(v => v.exchange),
        prices: validPrices, // Already sorted
        percent: percent.toFixed(2)
    };
}


/**
 * Main loop to fetch, process, and emit spot arbitrage data.
 * This function is designed to run continuously.
 * @param {import('socket.io').Server} io - The Socket.IO server instance.
 */
async function emitSpotPricesLoop(io) {
    // Get a handle to the specific namespace. This is done ONCE.
    const targetNamespace = io.of(SPOT_ARB_DATA_NAMESPACE);
    console.log(`SpotSocketController: Starting 'spot-arb' data emission to namespace: ${SPOT_ARB_DATA_NAMESPACE}`);

    while (true) {
        try {
            const spotCoinsData = await readSpotCoinsFileHelper();
            if (!spotCoinsData || Object.keys(spotCoinsData).length === 0) {
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }

            // 1. Get top 20 coins based on potential difference
            const top20 = Object.values(spotCoinsData)
                .sort((a, b) => {
                    const getNum = v => parseFloat((v?.valores?.difer || '0').replace('%', ''));
                    return getNum(b) - getNum(a);
                })
                .slice(0, 20);

            // 2. Pre-initialize all required exchanges for this batch
            const allExchanges = new Set(top20.flatMap(coin => coin.exchanges));
            await initializeExchanges(Array.from(allExchanges));

            // 3. Fetch and process data for each coin
            const results = [];
            for (const coin of top20) {
                const prices = await fetchPricesForSymbol(coin.symbol, coin.exchanges);
                const arbData = processArbitrageData(coin.symbol, prices);
                if (arbData) {
                    targetNamespace.emit('spot-arb', arbData);
                    results.push(arbData);
                }
            }
            lastSpotArbData = results;

        } catch (err) {
            console.error(`Error in spotSocketController loop (namespace: ${SPOT_ARB_DATA_NAMESPACE}):`, err);
        }
        // Wait before the next cycle
        await new Promise(r => setTimeout(r, 5000));
    }
}

/**
 * HTTP endpoint handler to get the last calculated arbitrage data.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getLastSpotArb = (req, res) => {
    res.status(200).json(lastSpotArbData);
};

module.exports = { emitSpotPricesLoop, getLastSpotArb };
