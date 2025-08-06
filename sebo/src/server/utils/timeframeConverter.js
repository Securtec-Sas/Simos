const exchangeTimeframeMaps = {
  kucoin: {
    '1m': '1min',
    '3m': '3min',
    '5m': '5min',
    '15m': '15min',
    '30m': '30min',
    '1h': '1hour',
    '2h': '2hour',
    '4h': '4hour',
    '6h': '6hour',
    '8h': '8hour',
    '12h': '12hour',
    '1d': '1day',
    '1w': '1week',
    default: '5min',
  },
  gate: {
    '1m': '60',
    '5m': '300',
    '10m': '600',
    '15m': '900',
    '30m': '1800',
    '1h': '3600',
    '2h': '7200',
    '4h': '14400',
    '1d': '86400',
    default: '300',
  },
  // Se pueden agregar otros exchanges aquí en el futuro
};

const getExchangeTimeframe = (exchangeId, intervalo) => {
  if (exchangeTimeframeMaps[exchangeId]) {
    const map = exchangeTimeframeMaps[exchangeId];
    const timeframe = map[intervalo] || map.default;
    if (!map[intervalo]) {
      console.warn(`Intervalo no mapeado para ${exchangeId}: '${intervalo}'. Usando '${map.default}' por defecto.`);
    }
    return timeframe;
  }
  return intervalo;
};

module.exports = {
  getExchangeTimeframe,
};
