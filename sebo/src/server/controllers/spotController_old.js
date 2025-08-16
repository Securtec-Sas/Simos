// d:\ProyectosTrade\simo\sebo\src\server\controllers\spotController.js
const ccxt = require('ccxt');
const fs = require('fs').promises;
const path = require('path');


// Define data directory and file paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_FILE_PATH = path.join(DATA_DIR, 'exchanges_config.json');
const SPOT_COINS_FILE_PATH = path.join(DATA_DIR, 'spot_usdt_coins.json');

// Helper to read exchange config
const readExchangeConfig = async () => {
    try {
        await fs.access(CONFIG_FILE_PATH);
        const data = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`Exchange config file not found at ${CONFIG_FILE_PATH}.`);
            return [];
        }
        console.error('Error reading or parsing exchange config file:', error);
        return [];
    }
};

// Helper to read spot_usdt_coins.json
const readSpotCoinsFileHelper = async () => {
    try {
        await fs.access(SPOT_COINS_FILE_PATH);
        const data = await fs.readFile(SPOT_COINS_FILE_PATH, 'utf-8');
        // Mostrar en consola los 5 primeros datos de "data" juntos
        try {
            const parsedData = JSON.parse(data);
            const values = Object.values(parsedData);
            console.log("Primeros 5 datos:", values.slice(0, 5));
        } catch (e) {
            console.warn("No se pudo parsear o mostrar los primeros 5 datos:", e.message);
        }
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`Spot coins file not found at ${SPOT_COINS_FILE_PATH}.`);
            return null; // Indicate file not found or empty
        }
        console.error('Error reading or parsing spot coins file:', error);
        throw error; // Rethrow other errors
    }
};

// Helper to write spot coins data
const writeSpotCoinsFile = async (data) => {
    try {
        await fs.writeFile(SPOT_COINS_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`Spot coins data successfully written to ${SPOT_COINS_FILE_PATH}`);
    } catch (error) {
        console.error(`Error writing spot coins data to ${SPOT_COINS_FILE_PATH}:`, error);
    }
};

const handleSpotAnalysisRequest = async (req, res) => {
    console.log('Iniciando análisis de mercados spot...');
    try {
        const configuredExchanges = await readExchangeConfig();
        const activeCcxtExchanges = configuredExchanges.filter(ex =>
            ex.isActive && ex.connectionType === 'ccxt' && ccxt.exchanges.includes(ex.id)
        );

        if (activeCcxtExchanges.length === 0) {
            console.log("No se encontraron exchanges CCXT activos para analizar.");
            return res.status(200).json({ message: "No hay exchanges CCXT activos para analizar." });
        }

        // --- FASE 1: RECOLECCIÓN DE MONEDAS ---
        console.log(`Fase 1: Agregando monedas de ${activeCcxtExchanges.length} exchanges...`);
        const initialCoinMap = {};
        const exchangeInstances = {}; // Cache instances for price fetching

        for (const exchangeConfig of activeCcxtExchanges) {
            const exchangeId = exchangeConfig.id;
            try {
                const exchange = new ccxt[exchangeId]();
                exchangeInstances[exchangeId] = exchange; // Cache instance
                await exchange.loadMarkets();

                for (const symbol in exchange.markets) {
                    const market = exchange.markets[symbol];
                    if (market.spot && market.active && market.quote === 'USDT') {
                        if (!initialCoinMap[symbol]) {
                            
                            initialCoinMap[symbol] = { symbol: market.symbol, name: market.base, exchanges: [] };
                        }
                        if (!initialCoinMap[symbol].exchanges.includes(exchangeId)) {
                            initialCoinMap[symbol].exchanges.push(exchangeId);
                        }
                    }
                }
                console.log(`✔ Monedas de ${exchangeId} ageregadas.`);
            } catch (e) {
                console.error(`❌ Error recolectando de ${exchangeId}: ${e.message}. Continuando...`);
            }
        }
        console.log(`Fase 1 completada. Monedas únicas encontradas: ${Object.keys(initialCoinMap).length}`);

        // --- FASE 2: FILTRADO POR REGLAS DE NEGOCIO ---
        console.log('Fase 2: Aplicando filtros de arbitraje...');
        const filteredCoinMap = {};

        for (const symbol in initialCoinMap) {
            const coinData = initialCoinMap[symbol];
            const numExchanges = coinData.exchanges.length;

            // Regla 1: Descartar si solo está en 1 exchange
            if (numExchanges <= 1) {
                continue;
            }


            // Regla 3: Verificar precios si está en 2-4 exchanges
            if (numExchanges >= 2) {
                const pricePromises = coinData.exchanges.map(exId =>
                    exchangeInstances[exId].fetchTicker(symbol)
                        .then(ticker => ({ ticker, exchangeId: exId })) // Incluir exchangeId
                        .catch(e => {
                            console.warn(`⚠️ No se pudo obtener precio de ${symbol} en ${exId}: ${e.message}`);
                            return null;
                        })
                );

                const results = await Promise.allSettled(pricePromises);
                const pricedExchanges = results
                    .filter(r => r.status === 'fulfilled' && r.value && r.value.ticker && r.value.ticker.ask)
                    .map(r => ({ price: r.value.ticker.ask, exchangeId: r.value.exchangeId }));

                if (pricedExchanges.length < 2) {
                    continue; // No hay suficientes precios para comparar
                }

                let minPriceData = pricedExchanges[0];
                let maxPriceData = pricedExchanges[0]
                    console.log("cantidad de exchanges: ", pricedExchanges.length)
                    console.log("precio min: ", minPriceData.price);
                    console.log("precio max: ", maxPriceData.price);
                for (let i = 1; i < pricedExchanges.length; i++) {
                    if (pricedExchanges[i].price < minPriceData.price) {
                        minPriceData = pricedExchanges[i];
                        console.log("nuevo min: ", minPriceData.price);
                    }
                    if (pricedExchanges[i].price > maxPriceData.price) {
                        maxPriceData = pricedExchanges[i];
                        console.log("nuevo max: ", maxPriceData.price);
                    }
                }
                // los campos se deben estar en 0 para hacer operaciones 
                const minPrice = minPriceData.price; 
                const maxPrice = maxPriceData.price;
                const exchangeMin = minPriceData.exchangeId;
                const exchangeMax = maxPriceData.exchangeId;
                console.log("precio min: ", minPrice);
                console.log("precio max: ", maxPrice);
                console.log("exchange min: ", exchangeMin);
                console.log("exchange max: ", exchangeMax);

                // Fórmula proporcionada: (valor1 - valor2) / ((valor1 * valor2) / 2)
                let numerator = maxPrice - minPrice;
                let difference;
                let diferPercentageStr;

                if (minPrice === 0 && maxPrice === 0) {
                    difference = 0;
                } else if (minPrice === 0 && maxPrice > 0) { // Denominador (maxPrice * minPrice / 2) sería 0
                    continue
                } else if (maxPrice > 0 && minPrice > 0) { // Ambos precios son positivos
                    const denominatorProduct = maxPrice + minPrice;
                    const denominatorFormulaPart = denominatorProduct / 2;
                    if (denominatorFormulaPart === 0) { // Salvaguarda adicional
                        console.warn(`Denominador cero inesperado para ${symbol} con minPrice ${minPrice}, maxPrice ${maxPrice}`);
                        if (numerator === 0) difference = 0;
                        else difference = Infinity; // O considerar saltar con 'continue'
                        console.warn(`Saltando ${symbol} debido a precios = 0: min ${minPrice}, max ${maxPrice}`);
                        continue
                    } else {
                        difference = numerator / denominatorFormulaPart;
                    }
                } else {
                    console.warn(`Saltando ${symbol} debido a precios inusuales para cálculo de diferencia: min ${minPrice}, max ${maxPrice}`);
                    continue;
                }

                if (difference === Infinity) diferPercentageStr = "Infinity%";
                else if (isNaN(difference)) diferPercentageStr = "NaN%";
                else diferPercentageStr = (difference * 100).toFixed(2) + '%';

                if (difference >= 0.006) {
                    console.log(`✔ CONSERVADA: ${symbol} (Dif: ${diferPercentageStr})`);
                    coinData.valores = {
                        exValMin: exchangeMin,
                        exValMax: exchangeMax,
                        valMin: minPrice,
                        valMax: maxPrice,
                        difer: diferPercentageStr
                    };
                    filteredCoinMap[symbol] = coinData;
                } else {
                    // console.log(`DESCARTADA: ${symbol} (Dif: ${diferPercentageStr})`);
                }
            }
        }
        console.log(`Fase 2 completada. Monedas después del filtro: ${Object.keys(filteredCoinMap).length}`);

        // --- FASE 3: ESCRITURA DEL ARCHIVO FINAL ---
        await writeSpotCoinsFile(filteredCoinMap);

        res.status(200).json({
            message: "Análisis de spot y filtrado completado.",
            exchangesProcessed: activeCcxtExchanges.length,
            initialCoinsFound: Object.keys(initialCoinMap).length,
            finalCoinsKept: Object.keys(filteredCoinMap).length
        });

    } catch (error) {
        console.error("Error crítico durante el análisis de spot:", error);
        res.status(500).json({ message: "Error crítico durante el análisis de spot.", error: error.message });
    }
};

// Helper function to parse 'difer' string to a number for sorting
const parseDiferToNumber = (diferStr) => {
    if (typeof diferStr !== 'string') {
        return Number.NEGATIVE_INFINITY; // Treat malformed/missing 'difer' as lowest priority
    }
    if (diferStr.toUpperCase() === "INFINITY%") {
        return Number.POSITIVE_INFINITY;
    }
    if (diferStr.toUpperCase() === "NAN%") {
        return Number.NEGATIVE_INFINITY; // Treat NaN as lowest priority
    }
    const value = parseFloat(diferStr.replace('%', ''));
    return isNaN(value) ? Number.NEGATIVE_INFINITY : value;
};

const getTopSpotOpportunities = async (req, res) => {
    try {
        const spotCoinsData = await readSpotCoinsFileHelper();

        // If file not found, is empty, or contains no data (e.g. {}), return an empty array.
        if (!spotCoinsData || Object.keys(spotCoinsData).length === 0) {
            return res.status(200).json([]);
        }

        const allOpportunities = Object.values(spotCoinsData);

        const sortedOpportunities = allOpportunities
            .map(op => ({
                ...op,
                // Ensure 'valores' and 'difer' exist before parsing, assign a numeric value for sorting
                parsedDifer: (op.valores && typeof op.valores.difer === 'string')
                    ? parseDiferToNumber(op.valores.difer)
                    : Number.NEGATIVE_INFINITY
            }))
            .sort((a, b) => b.parsedDifer - a.parsedDifer); // Sort descending: highest 'parsedDifer' first

        // Take the top 20 opportunities and remove the temporary 'parsedDifer' field
        const top20Opportunities = sortedOpportunities.slice(0, 20).map(op => {
            const { parsedDifer, ...opportunityData } = op;
            return opportunityData;
        });

        res.status(200).json(top20Opportunities);

    } catch (error) {
        console.error("Error in getTopSpotOpportunities:", error);
        res.status(500).json({
            message: "Failed to retrieve top spot opportunities due to a server error.",
            error: error.message // Provide error message for easier debugging
        });
    }
};

module.exports = {
    handleSpotAnalysisRequest,
    getTopSpotOpportunities,
    readSpotCoinsFileHelper, // <-- asegúrate de exportarla aquí
};