const express = require('express');
const router = express.Router();
const sandboxOperationController = require('../controllers/sandboxOperationController');

/**
 * @swagger
 * tags:
 *   name: Sandbox Operations
 *   description: API for exchange trading operations in Sandbox Mode
 */

/**
 * @swagger
 * /api/sandbox-operations/connect:
 *   post:
 *     summary: Test connection to an exchange in sandbox mode
 *     tags: [Sandbox Operations]
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
 *         description: Successfully connected to the exchange in sandbox mode.
 *       500:
 *         description: Error connecting to the exchange.
 */
router.post('/connect', sandboxOperationController.connect);

/**
 * @swagger
 * /api/sandbox-operations/balance:
 *   get:
 *     summary: Get wallet balance for an exchange in sandbox mode
 *     tags: [Sandbox Operations]
 *     parameters:
 *       - in: query
 *         name: exchangeId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the exchange.
 *     responses:
 *       200:
 *         description: The wallet balance from the sandbox environment.
 *       500:
 *         description: Error fetching the balance.
 */
router.get('/balance', sandboxOperationController.getWalletBalance);

/**
 * @swagger
 * /api/sandbox-operations/transfer:
 *   post:
 *     summary: Transfer currency from one exchange to another in sandbox mode
 *     tags: [Sandbox Operations]
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
 *         description: The result of the withdrawal operation from the sandbox.
 *       500:
 *         description: Error during the transfer.
 */
router.post('/transfer', sandboxOperationController.transferCurrency);

/**
 * @swagger
 * /api/sandbox-operations/buy:
 *   post:
 *     summary: Buy a symbol on an exchange in sandbox mode
 *     tags: [Sandbox Operations]
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
 *         description: The created order details from the sandbox.
 *       400:
 *         description: Insufficient balance or bad request.
 *       500:
 *         description: Error creating the buy order.
 */
router.post('/buy', sandboxOperationController.buySymbol);

/**
 * @swagger
 * /api/sandbox-operations/sell:
 *   post:
 *     summary: Sell a symbol on an exchange in sandbox mode
 *     tags: [Sandbox Operations]
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
 *         description: The created order details from the sandbox.
 *       400:
 *         description: Possible loss detected or bad request.
 *       500:
 *         description: Error creating the sell order.
 */
router.post('/sell', sandboxOperationController.sellSymbol);

/**
 * @swagger
 * /api/sandbox-operations/history:
 *   get:
 *     summary: Get operation history for an exchange in sandbox mode
 *     tags: [Sandbox Operations]
 *     parameters:
 *       - in: query
 *         name: exchangeId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the exchange.
 *     responses:
 *       200:
 *         description: A list of past trades from the sandbox.
 *       500:
 *         description: Error fetching the history.
 */
router.get('/history', sandboxOperationController.getOperationHistory);

/**
 * @swagger
 * /api/sandbox-operations/networks:
 *   get:
 *     summary: Get available networks for a currency on an exchange in sandbox mode
 *     tags: [Sandbox Operations]
 *     parameters:
 *       - in: query
 *         name: exchangeId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the exchange.
 *       - in: query
 *         name: symbol
 *         schema:
 *           type: string
 *         required: true
 *         description: The currency symbol (e.g., 'BTC', 'ETH').
 *     responses:
 *       200:
 *         description: An object containing the available networks from the sandbox.
 *       404:
 *         description: Symbol or networks not found.
 *       500:
 *         description: Error fetching the networks.
 */
router.get('/networks', sandboxOperationController.getSymbolNetworks);

/**
 * @swagger
 * /api/sandbox-operations/withdraw_usdt:
 *   post:
 *     summary: Withdraw USDT from an exchange in sandbox mode for arbitrage
 *     tags: [Sandbox Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               exchange_id:
 *                 type: string
 *               amount:
 *                 type: number
 *               transaction_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: USDT withdrawal successful
 *       500:
 *         description: Error during withdrawal
 */
router.post('/withdraw_usdt', sandboxOperationController.withdrawUsdt);

/**
 * @swagger
 * /api/sandbox-operations/buy_asset:
 *   post:
 *     summary: Buy asset with USDT in sandbox mode for arbitrage
 *     tags: [Sandbox Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               exchange_id:
 *                 type: string
 *               symbol:
 *                 type: string
 *               amount_usdt:
 *                 type: number
 *               transaction_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Asset purchase successful
 *       500:
 *         description: Error during purchase
 */
router.post('/buy_asset', sandboxOperationController.buyAsset);

/**
 * @swagger
 * /api/sandbox-operations/transfer_asset:
 *   post:
 *     summary: Transfer asset between exchanges in sandbox mode for arbitrage
 *     tags: [Sandbox Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               from_exchange:
 *                 type: string
 *               to_exchange:
 *                 type: string
 *               symbol:
 *                 type: string
 *               amount:
 *                 type: number
 *               transaction_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Asset transfer successful
 *       500:
 *         description: Error during transfer
 */
router.post('/transfer_asset', sandboxOperationController.transferAsset);

/**
 * @swagger
 * /api/sandbox-operations/sell_asset:
 *   post:
 *     summary: Sell asset for USDT in sandbox mode for arbitrage
 *     tags: [Sandbox Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               exchange_id:
 *                 type: string
 *               symbol:
 *                 type: string
 *               amount:
 *                 type: number
 *               transaction_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Asset sale successful
 *       500:
 *         description: Error during sale
 */
router.post('/sell_asset', sandboxOperationController.sellAsset);

module.exports = router;
