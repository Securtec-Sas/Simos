require('dotenv').config();

const EXCHANGES = [
    // Listado completo de los 42 exchanges de las imágenes
    // Importante: Los nombres de los exchanges deben coincidir con los IDs de ccxt.
    // Puedes encontrar los IDs de ccxt aquí: https://github.com/ccxt/ccxt/wiki/Exchange-IDs
    // Para simplificar, he tomado los nombres directamente de las imágenes.
    // Puede que necesites ajustar algunos nombres para que coincidan con ccxt.
    // Por ejemplo, "Bynodex" podría ser "bynodex", "Coinbase Exchange" podría ser "coinbasepro" o "coinbase"
    // He puesto los más comunes que identifiqué, necesitarías verificar para todos 42.

    // Página 1 (imágenes 1, 4):
    { id: 'ascendex', name: 'AscendEX' },
    { id: 'binance', name: 'Binance' },
    { id: 'binanceth', name: 'Binance TH' }, // Posiblemente no directo en ccxt
    { id: 'binancetr', name: 'Binance TR' }, // Posiblemente no directo en ccxt
    { id: 'binanceus', name: 'Binance.US' },
    { id: 'bingx', name: 'BingX' },
    { id: 'bitfinex', name: 'Bitfinex' },
    { id: 'bitget', name: 'Bitget' },
    { id: 'bitrue', name: 'Bitrue' },
    { id: 'bitunix', name: 'Bitunix' },

    // Página 2 (imágenes 2, 3):
    { id: 'btse', name: 'BTSE' },
    { id: 'bvox', name: 'BVOX' }, // Posiblemente no directo en ccxt
    { id: 'bybit', name: 'Bybit' },
    { id: 'bynoxdex', name: 'Bynodex' }, // Verificar ID exacto en ccxt
    { id: 'coinbasepro', name: 'Coinbase Exchange' }, // ccxt usa coinbasepro
    { id: 'coinex', name: 'CoinEx' },
    { id: 'coinw', name: 'CoinW' },
    { id: 'cryptocom', name: 'Crypto.com Exchange' }, // ccxt usa cryptocom
    { id: 'deepcoin', name: 'Deepcoin' },
    { id: 'digifinex', name: 'DigiFinex' },

    // Página 3 (imagen con PancakeSwap, Phemex, Pionex, etc.)
    { id: 'pancakeswap', name: 'PancakeSwap v3 (BSC)' }, // ccxt tiene soporte limitado para DEXs
    { id: 'phemex', name: 'Phemex' },
    { id: 'pionex', name: 'Pionex' },
    { id: 'poloniex', name: 'Poloniex' },
    { id: 'probit', name: 'ProBit Global' }, // ccxt usa probit
    { id: 'tapbit', name: 'Tapbit' }, // Verificar ID exacto en ccxt
    { id: 'tokocrypto', name: 'Tokocrypto' },
    { id: 'toobit', name: 'Toobit' }, // Verificar ID exacto en ccxt
    { id: 'weex', name: 'WEEX' }, // Verificar ID exacto en ccxt
    { id: 'whitebit', name: 'WhiteBIT' },

    // Página 4 (imagen con XT.COM, Zoomex)
    { id: 'xtcom', name: 'XT.COM' }, // ccxt usa xtcom
    { id: 'zoomex', name: 'Zoomex' }, // Verificar ID exacto en ccxt

    // Faltan exchanges para llegar a 42, ya que las imágenes no muestran todos.
    // Necesitarías completar esta lista con los nombres/IDs exactos de ccxt.
    // Ejemplo de cómo se podrían añadir más:
    // { id: 'kraken', name: 'Kraken' }, // Añadido manualmente si no estaba en tus imágenes
    // { id: 'okx', name: 'OKX' },
    // { id: 'kucoin', name: 'KuCoin' },
    // ... hasta 42
];

module.exports = {
    EXCHANGES,
    PORT: process.env.PORT || 3031, // Nuevo valor
    // Puedes agregar más configuraciones aquí, como rate limits globales
};
