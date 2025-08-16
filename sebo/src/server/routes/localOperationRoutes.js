const express = require('express');
const router = express.Router();
const localOperationController = require('../controllers/localOperationController');

/**
 * @swagger
 * tags:
 *   name: Local Operations
 *   description: Operaciones de trading en modo local (simulación completa)
 */

/**
 * @swagger
 * /api/local-operations/connect:
 *   post:
 *     summary: Conectar a un exchange en modo local
 *     tags: [Local Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - exchangeId
 *             properties:
 *               exchangeId:
 *                 type: string
 *                 description: ID del exchange
 *     responses:
 *       200:
 *         description: Conexión validada exitosamente
 *       400:
 *         description: Error en los parámetros
 *       500:
 *         description: Error del servidor
 */
router.post('/connect', localOperationController.connect);

/**
 * @swagger
 * /api/local-operations/balance:
 *   get:
 *     summary: Obtener balance simulado de un exchange
 *     tags: [Local Operations]
 *     parameters:
 *       - in: query
 *         name: exchangeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del exchange
 *     responses:
 *       200:
 *         description: Balance obtenido exitosamente
 *       400:
 *         description: Error en los parámetros
 *       404:
 *         description: Balance no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get('/balance', localOperationController.getWalletBalance);

/**
 * @swagger
 * /api/local-operations/transfer:
 *   post:
 *     summary: Simular transferencia de moneda entre exchanges
 *     tags: [Local Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromExchangeId
 *               - toExchangeId
 *               - symbol
 *               - amount
 *               - transaction_id
 *             properties:
 *               fromExchangeId:
 *                 type: string
 *                 description: Exchange de origen
 *               toExchangeId:
 *                 type: string
 *                 description: Exchange de destino
 *               symbol:
 *                 type: string
 *                 description: Símbolo a transferir
 *               amount:
 *                 type: number
 *                 description: Cantidad a transferir
 *               transaction_id:
 *                 type: string
 *                 description: ID de la transacción
 *               transfer_delay:
 *                 type: number
 *                 description: Delay en segundos (opcional)
 *     responses:
 *       200:
 *         description: Transferencia simulada exitosamente
 *       400:
 *         description: Error en los parámetros
 *       500:
 *         description: Error del servidor
 */
router.post('/transfer', localOperationController.transferCurrency);

/**
 * @swagger
 * /api/local-operations/buy:
 *   post:
 *     summary: Simular compra de símbolo
 *     tags: [Local Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - exchangeId
 *               - symbol
 *               - usdtAmount
 *               - transaction_id
 *             properties:
 *               exchangeId:
 *                 type: string
 *                 description: ID del exchange
 *               symbol:
 *                 type: string
 *                 description: Símbolo a comprar
 *               usdtAmount:
 *                 type: number
 *                 description: Cantidad de USDT a invertir
 *               transaction_id:
 *                 type: string
 *                 description: ID de la transacción
 *               execution_delay:
 *                 type: number
 *                 description: Delay de ejecución en segundos (opcional)
 *     responses:
 *       200:
 *         description: Compra simulada exitosamente
 *       400:
 *         description: Error en los parámetros o balance insuficiente
 *       500:
 *         description: Error del servidor
 */
router.post('/buy', localOperationController.buySymbol);

/**
 * @swagger
 * /api/local-operations/sell:
 *   post:
 *     summary: Simular venta de símbolo
 *     tags: [Local Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - exchangeId
 *               - symbol
 *               - amount
 *               - transaction_id
 *             properties:
 *               exchangeId:
 *                 type: string
 *                 description: ID del exchange
 *               symbol:
 *                 type: string
 *                 description: Símbolo a vender
 *               amount:
 *                 type: number
 *                 description: Cantidad del asset a vender
 *               transaction_id:
 *                 type: string
 *                 description: ID de la transacción
 *               execution_delay:
 *                 type: number
 *                 description: Delay de ejecución en segundos (opcional)
 *     responses:
 *       200:
 *         description: Venta simulada exitosamente
 *       400:
 *         description: Error en los parámetros
 *       500:
 *         description: Error del servidor
 */
router.post('/sell', localOperationController.sellSymbol);

/**
 * @swagger
 * /api/local-operations/history:
 *   get:
 *     summary: Obtener historial de operaciones locales
 *     tags: [Local Operations]
 *     parameters:
 *       - in: query
 *         name: exchangeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del exchange
 *     responses:
 *       200:
 *         description: Historial obtenido exitosamente
 *       400:
 *         description: Error en los parámetros
 *       500:
 *         description: Error del servidor
 */
router.get('/history', localOperationController.getOperationHistory);

/**
 * @swagger
 * /api/local-operations/networks:
 *   get:
 *     summary: Obtener redes disponibles para un símbolo
 *     tags: [Local Operations]
 *     parameters:
 *       - in: query
 *         name: exchangeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del exchange
 *       - in: query
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Símbolo a consultar
 *     responses:
 *       200:
 *         description: Redes obtenidas exitosamente
 *       400:
 *         description: Error en los parámetros
 *       404:
 *         description: Redes no encontradas
 *       500:
 *         description: Error del servidor
 */
router.get('/networks', localOperationController.getSymbolNetworks);

/**
 * @swagger
 * /api/local-operations/withdraw-usdt:
 *   post:
 *     summary: Simular retiro de USDT
 *     tags: [Local Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - exchange_id
 *               - amount
 *               - transaction_id
 *             properties:
 *               exchange_id:
 *                 type: string
 *                 description: ID del exchange
 *               amount:
 *                 type: number
 *                 description: Cantidad de USDT a retirar
 *               transaction_id:
 *                 type: string
 *                 description: ID de la transacción
 *               withdrawal_delay:
 *                 type: number
 *                 description: Delay de retiro en segundos (opcional)
 *     responses:
 *       200:
 *         description: Retiro simulado exitosamente
 *       400:
 *         description: Error en los parámetros o balance insuficiente
 *       500:
 *         description: Error del servidor
 */
router.post('/withdraw-usdt', localOperationController.withdrawUsdt);

/**
 * @swagger
 * /api/local-operations/buy-asset:
 *   post:
 *     summary: Simular compra de asset para arbitraje (iniciada por AI)
 *     tags: [Local Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - exchange_id
 *               - symbol
 *               - amount_usdt
 *               - transaction_id
 *             properties:
 *               exchange_id:
 *                 type: string
 *                 description: ID del exchange
 *               symbol:
 *                 type: string
 *                 description: Símbolo a comprar
 *               amount_usdt:
 *                 type: number
 *                 description: Cantidad de USDT a invertir
 *               transaction_id:
 *                 type: string
 *                 description: ID de la transacción
 *               execution_delay:
 *                 type: number
 *                 description: Delay de ejecución en segundos (opcional)
 *               ai_decision_data:
 *                 type: object
 *                 description: Datos de la decisión del modelo AI
 *                 properties:
 *                   sell_exchange_id:
 *                     type: string
 *                   expected_sell_price:
 *                     type: number
 *                   sell_fee_rate:
 *                     type: number
 *                   transfer_fee:
 *                     type: number
 *                   confidence:
 *                     type: number
 *                   decision_factors:
 *                     type: object
 *     responses:
 *       200:
 *         description: Compra simulada y operación creada exitosamente
 *       400:
 *         description: Error en los parámetros o balance insuficiente
 *       500:
 *         description: Error del servidor
 */
router.post('/buy-asset', localOperationController.buyAsset);

/**
 * @swagger
 * /api/local-operations/transfer-asset:
 *   post:
 *     summary: Simular transferencia de asset entre exchanges
 *     tags: [Local Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - from_exchange
 *               - to_exchange
 *               - symbol
 *               - amount
 *               - transaction_id
 *             properties:
 *               from_exchange:
 *                 type: string
 *                 description: Exchange de origen
 *               to_exchange:
 *                 type: string
 *                 description: Exchange de destino
 *               symbol:
 *                 type: string
 *                 description: Símbolo a transferir
 *               amount:
 *                 type: number
 *                 description: Cantidad a transferir
 *               transaction_id:
 *                 type: string
 *                 description: ID de la transacción
 *               transfer_delay:
 *                 type: number
 *                 description: Delay de transferencia en segundos (opcional)
 *     responses:
 *       200:
 *         description: Transferencia simulada exitosamente
 *       400:
 *         description: Error en los parámetros
 *       500:
 *         description: Error del servidor
 */
router.post('/transfer-asset', localOperationController.transferAsset);

/**
 * @swagger
 * /api/local-operations/sell-asset:
 *   post:
 *     summary: Simular venta de asset para arbitraje
 *     tags: [Local Operations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - exchange_id
 *               - symbol
 *               - amount
 *               - transaction_id
 *             properties:
 *               exchange_id:
 *                 type: string
 *                 description: ID del exchange
 *               symbol:
 *                 type: string
 *                 description: Símbolo a vender
 *               amount:
 *                 type: number
 *                 description: Cantidad del asset a vender
 *               transaction_id:
 *                 type: string
 *                 description: ID de la transacción
 *               execution_delay:
 *                 type: number
 *                 description: Delay de ejecución en segundos (opcional)
 *               operation_id:
 *                 type: string
 *                 description: ID de la operación a completar (opcional)
 *     responses:
 *       200:
 *         description: Venta simulada exitosamente
 *       400:
 *         description: Error en los parámetros
 *       500:
 *         description: Error del servidor
 */
router.post('/sell-asset', localOperationController.sellAsset);

module.exports = router;