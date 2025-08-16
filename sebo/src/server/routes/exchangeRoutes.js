const express = require('express');
const router = express.Router();
const { getExchangesStatus, getConfiguredExchanges, getExchangeStatusById, updateExchangeActiveStatus, getWithdrawalFees } = require('../controllers/exchangeController');

/**
 * @swagger
 * tags:
 *   name: Exchanges
 *   description: Endpoints relacionados con la gestión y estado de exchanges.
 */

/**
 * @swagger
 * /api/exchanges/status:
 *   get:
 *     summary: Obtiene el estado de conexión y precio de XRP/USDT para una lista predefinida de exchanges.
 *     tags: [Exchanges]
 *     responses:
 *       '200':
 *         description: Lista de estados de exchanges.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ExchangeStatus'
 *       '500':
 *         description: Error al obtener el estado de los exchanges.
 */
router.get('/status', getExchangesStatus);

/**
 * @swagger
 * /api/exchanges/configured:
 *   get:
 *     summary: Obtiene la lista de exchanges configurados en la base de datos.
 *     tags: [Exchanges]
 *     responses:
 *       '200':
 *         description: Lista de exchanges configurados.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Exchange'
 *       '500':
 *         description: Error al obtener la lista de exchanges configurados.
 */
router.get('/configured', getConfiguredExchanges);

/**
 * @swagger
 * /api/exchanges/{exchangeId}/status:
 *   get:
 *     summary: Obtiene el estado de conexión y precio de XRP/USDT para un exchange especificado.
 *     tags: [Exchanges]
 *     parameters:
 *       - in: path
 *         name: exchangeId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID del exchange (CCXT ID).
 *     responses:
 *       '200':
 *         description: Estado del exchange especificado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExchangeStatus'
 *       '404':
 *         description: Exchange no encontrado.
 *       '500':
 *         description: Error al obtener el estado del exchange.
 */
router.get('/:exchangeId/status', getExchangeStatusById);

/**
 * @swagger
 * /api/exchanges/update-active-status:
 *   post:
 *     summary: Actualiza el estado de un exchange en la base de datos.
 *     tags: [Exchanges]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               exchangeId:
 *                 type: string
 *                 description: ID del exchange (CCXT ID).
 *               active:
 *                 type: boolean
 *                 description: Estado de conexión del exchange.
 *     responses:
 *       '200':
 *         description: Estado de conexión actualizado correctamente.
 *       '400':
 *         description: Exchange no encontrado o solicitud inválida.
 *       '500':
 *         description: Error al actualizar el estado del exchange.
 */
router.post('/update-active-status', updateExchangeActiveStatus);

/**
 * @swagger
 * /api/exchanges/{exchangeId}/withdrawal-fees/{currencyCode}:
 *   get:
 *     summary: Obtiene las fees de retiro en una moneda especificada para un exchange específico.
 *     tags: [Exchanges]
 *     parameters:
 *       - in: path
 *         name: exchangeId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID del exchange (CCXT ID).
 *       - in: path
 *         name: currencyCode
 *         schema:
 *           type: string
 *         required: true
 *         description: Código de la moneda para las fees de retiro.
 *     responses:
 *       '200':
 *         description: Fees de retiro en la moneda especificada.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WithdrawalFee'
 *       '404':
 *         description: Exchange no encontrado o moneda no compatible.
 *       '500':
 *         description: Error al obtener las fees de retiro.
 */
router.get('/:exchangeId/withdrawal-fees/:currencyCode', getWithdrawalFees);

module.exports = router;

