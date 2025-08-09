const ccxt = require('ccxt');
const ExchangeSecurity = require('../data/dataBase/modelosBD/exchangeSecurity.model');

/**
 * Connects to an exchange using API keys from the database.
 * @param {string} exchangeId - The ID of the exchange (e.g., 'binance').
 * @param {boolean} sandbox - Whether to connect to the sandbox environment.
 * @returns {Promise<ccxt.Exchange>} - A ccxt exchange instance.
 * @throws {Error} - If the exchange is not supported by ccxt, or if API keys are not found.
 */
const connectToExchange = async (exchangeId, sandbox = false) => {
  if (!ccxt.exchanges.includes(exchangeId)) {
    throw new Error(`Exchange '${exchangeId}' is not supported by ccxt.`);
  }

  const security = await ExchangeSecurity.findOne({ id_ex: exchangeId });
  if (!security) {
    throw new Error(`API keys for exchange '${exchangeId}' not found in the database.`);
  }

  const exchangeOptions = {
    apiKey: security.api_key,
    secret: security.api_secret,
  };

  if (security.password) {
    exchangeOptions.password = security.password;
  }

  const exchange = new ccxt[exchangeId](exchangeOptions);

  if (sandbox) {
    exchange.setSandboxMode(true);
  }

  return exchange;
};

module.exports = {
  connectToExchange,
};
