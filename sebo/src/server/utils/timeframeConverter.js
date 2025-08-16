// Helper para convertir timeframes a segundos para una comparación consistente
const timeframeToSeconds = (timeframe) => {
  if (!timeframe || typeof timeframe !== 'string') {
    return 0;
  }
  const value = parseInt(timeframe.slice(0, -1));
  const unit = timeframe.slice(-1);

  switch (unit) {
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    case 'w': return value * 604800;
    case 'M': return value * 2592000; // Aproximado
    default: return 0; // Devuelve 0 si la unidad es desconocida
  }
};

/**
 * Encuentra el timeframe más cercano soportado por el exchange.
 * @param {ccxt.Exchange} exchange - La instancia del exchange de CCXT.
 * @param {string} desiredTimeframe - El timeframe deseado (ej. '5m', '1h').
 * @returns {string} - El timeframe soportado más cercano o un valor por defecto.
 */
const getExchangeTimeframe = (exchange, desiredTimeframe = '1h') => {
  const safeDefault = '1h';

  if (!exchange || !exchange.timeframes) {
    console.warn(`Exchange ${exchange.id} no tiene timeframes definidos. Usando '${safeDefault}'.`);
    return safeDefault;
  }

  const supportedTimeframes = Object.keys(exchange.timeframes);

  if (supportedTimeframes.length === 0) {
    console.warn(`Exchange ${exchange.id} no reporta timeframes soportados. Usando '${safeDefault}'.`);
    return safeDefault;
  }

  // 1. Búsqueda de coincidencia exacta
  if (supportedTimeframes.includes(desiredTimeframe)) {
    return desiredTimeframe;
  }

  // 2. Búsqueda del timeframe más cercano en segundos
  const desiredSeconds = timeframeToSeconds(desiredTimeframe);
  if (desiredSeconds === 0) {
    console.warn(`Timeframe deseado '${desiredTimeframe}' es inválido. Usando '${safeDefault}'.`);
    return safeDefault;
  }

  let closestTimeframe = null;
  let minDiff = Infinity;

  for (const tf of supportedTimeframes) {
    const supportedSeconds = timeframeToSeconds(tf);
    if (supportedSeconds > 0) {
      const diff = Math.abs(desiredSeconds - supportedSeconds);
      if (diff < minDiff) {
        minDiff = diff;
        closestTimeframe = tf;
      }
    }
  }

  if (closestTimeframe) {
    console.log(`Para ${exchange.id}, el timeframe más cercano a '${desiredTimeframe}' es '${closestTimeframe}'.`);
    return closestTimeframe;
  }

  // 3. Fallback final si no se encuentra ninguna coincidencia válida
  console.warn(`No se encontró un timeframe compatible para '${desiredTimeframe}' en ${exchange.id}. Usando '${safeDefault}'.`);
  return safeDefault;
};

module.exports = {
  getExchangeTimeframe,
};
