const express = require('express');
const router = express.Router();
const balanceController = require('../controllers/balanceController');

/**
 * @swagger
 * /api/balances:
 *   post:
 *     summary: Crea un nuevo balance para un exchange.
 *     tags: [Balances]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Balance'
 *     responses:
 *       201:
 *         description: Balance creado correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Balance'
 *       400:
 *         description: Error al crear el balance.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', balanceController.createBalance);

/**
 * @swagger
 * /api/balances:
 *   get:
 *     summary: Obtiene todos los balances.
 *     tags: [Balances]
 *     responses:
 *       200:
 *         description: Lista de balances.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Balance'
 */
router.get('/', balanceController.getAllBalances);

/**
 * @swagger
 * /api/balances/exchange/{exchangeId}:
 *   get:
 *     summary: Obtiene el balance para un exchange especifico.
 *     tags: [Balances]
 *     parameters:
 *       - in: path
 *         name: exchangeId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID del exchange.
 *     responses:
 *       200:
 *         description: Balance para el exchange especifico.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Balance'
 *       404:
 *         description: No se encontró el balance para el exchange especifico.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/exchange/:exchangeId', balanceController.getBalanceByExchange);

/**
 * @swagger
 * /api/balances/exchange/{exchangeId}:
 *   put:
 *     summary: Actualiza el balance para un exchange especifico.
 *     tags: [Balances]
 *     parameters:
 *       - in: path
 *         name: exchangeId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID del exchange.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Balance'
 *     responses:
 *       200:
 *         description: Balance actualizado correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Balance'
 *       400:
 *         description: Error al actualizar el balance.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/exchange/:exchangeId', balanceController.updateBalanceByExchange);

/**
 * @swagger
 * /api/balances/{balanceId}:
 *   put:
 *     summary: Actualiza el balance por _id de MongoDB.
 *     tags: [Balances]
 *     parameters:
 *       - in: path
 *         name: balanceId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID del balance en MongoDB.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Balance'
 *     responses:
 *       200:
 *         description: Balance actualizado correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Balance'
 *       400:
 *         description: Error al actualizar el balance.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:balanceId', balanceController.updateBalanceById);

/**
 * @swagger
 * /api/balances/{balanceId}:
 *   delete:
 *     summary: Elimina el balance por _id de MongoDB.
 *     tags: [Balances]
 *     parameters:
 *       - in: path
 *         name: balanceId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID del balance en MongoDB.
 *     responses:
 *       200:
 *         description: Balance eliminado correctamente.
 *       404:
 *         description: No se encontró el balance.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:balanceId', balanceController.deleteBalanceById);

module.exports = router;

