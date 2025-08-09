const express = require('express');
const router = express.Router();
const operationController = require('../controllers/operationController');

/**
 * @swagger
 * tags:
 *   name: Operations
 *   description: API for exchange trading operations
 */

/**
 * @swagger
 * /api/operations/connect:
 *   post:
 *     summary: Test connection to an exchange
 *     tags: [Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               exchangeId:
 *                 type: string
 *                 description: The ID of the exchange (e.g., 'binance').
 *     responses:
 *       200:
 *         description: Successfully connected to the exchange.
 *       500:
 *         description: Error connecting to the exchange.
 */
router.post('/connect', operationController.connect);

/**
 * @swagger
 * /api/operations/balance:
 *   get:
 *     summary: Get wallet balance for an exchange
 *     tags: [Operations]
 *     parameters:
 *       - in: query
 *         name: exchangeId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the exchange.
 *     responses:
 *       200:
 *         description: The wallet balance.
 *       500:
 *         description: Error fetching the balance.
 */
router.get('/balance', operationController.getWalletBalance);

/**
 * @swagger
 * /api/operations/transfer:
 *   post:
 *     summary: Transfer currency from one exchange to another
 *     tags: [Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fromExchangeId:
 *                 type: string
 *               toExchangeId:
 *                 type: string
 *               symbol:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: The result of the withdrawal operation.
 *       500:
 *         description: Error during the transfer.
 */
router.post('/transfer', operationController.transferCurrency);

/**
 * @swagger
 * /api/operations/buy:
 *   post:
 *     summary: Buy a symbol on an exchange
 *     tags: [Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               exchangeId:
 *                 type: string
 *               symbol:
 *                 type: string
 *               usdtAmount:
 *                 type: number
 *                 description: Amount of USDT to check for balance, not the cost of the order.
 *               amount:
 *                 type: number
 *                 description: The quantity of the symbol to buy.
 *     responses:
 *       200:
 *         description: The created order details.
 *       400:
 *         description: Insufficient balance or bad request.
 *       500:
 *         description: Error creating the buy order.
 */
router.post('/buy', operationController.buySymbol);

/**
 * @swagger
 * /api/operations/sell:
 *   post:
 *     summary: Sell a symbol on an exchange
 *     tags: [Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               exchangeId:
 *                 type: string
 *               symbol:
 *                 type: string
 *               amount:
 *                 type: number
 *               minUsdtExpected:
 *                 type: number
 *                 description: The minimum amount of USDT expected from the sale.
 *     responses:
 *       200:
 *         description: The created order details.
 *       400:
 *         description: Possible loss detected or bad request.
 *       500:
 *         description: Error creating the sell order.
 */
router.post('/sell', operationController.sellSymbol);

/**
 * @swagger
 * /api/operations/history:
 *   get:
 *     summary: Get operation history for an exchange
 *     tags: [Operations]
 *     parameters:
 *       - in: query
 *         name: exchangeId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the exchange.
 *     responses:
 *       200:
 *         description: A list of past trades.
 *       500:
 *         description: Error fetching the history.
 */
router.get('/history', operationController.getOperationHistory);

module.exports = router;
