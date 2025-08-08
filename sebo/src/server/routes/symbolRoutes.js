// Simos/sebo/src/server/routes/symbolRoutes.js

const express = require('express');
const router = express.Router();
const {addSymbolsForExchange, getSymbols, getSymbolById, createSymbol, updateSymbol, deleteSymbol} = require('../controllers/symbolController');

/**
 * @swagger
 * components:
 *   schemas:
 *     Symbol:
 *       type: object
 *       required:
 *         - id_sy
 *         - name
 *       properties:
 *         id_sy:
 *           type: string
 *           description: ID único del símbolo (ej. BTC/USDT)
 *         name:
 *           type: string
 *           description: Nombre base del símbolo (ej. BTC)
 *       example:
 *         id_sy: "BTC/USDT"
 *         name: "BTC"
 */

/**
 * @swagger
 * /api/symbols:
 *   get:
 *     summary: Obtiene todos los símbolos
 *     tags: [Symbols]
 *     responses:
 *       200:
 *         description: Lista de símbolos obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Symbol'
 *       500:
 *         description: Error interno del servidor
 */
router.get('/', getSymbols);

/**
 * @swagger
 * /api/symbols/{id_sy}:
 *   get:
 *     summary: Obtiene un símbolo por su ID
 *     tags: [Symbols]
 *     parameters:
 *       - in: path
 *         name: id_sy
 *         schema:
 *           type: string
 *         required: true
 *         description: ID del símbolo
 *     responses:
 *       200:
 *         description: Símbolo encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Symbol'
 *       404:
 *         description: Símbolo no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.get('/:id_sy', getSymbolById);

/**
 * @swagger
 * /api/symbols:
 *   post:
 *     summary: Crea un nuevo símbolo
 *     tags: [Symbols]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Symbol'
 *     responses:
 *       201:
 *         description: Símbolo creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Symbol'
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: El símbolo ya existe
 *       500:
 *         description: Error interno del servidor
 */
router.post('/',createSymbol);

/**
 * @swagger
 * /api/symbols/{id_sy}:
 *   put:
 *     summary: Actualiza un símbolo existente
 *     tags: [Symbols]
 *     parameters:
 *       - in: path
 *         name: id_sy
 *         schema:
 *           type: string
 *         required: true
 *         description: ID del símbolo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nuevo nombre del símbolo
 *     responses:
 *       200:
 *         description: Símbolo actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Symbol'
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Símbolo no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.put('/:id_sy', updateSymbol);

/**
 * @swagger
 * /api/symbols/{id_sy}:
 *   delete:
 *     summary: Elimina un símbolo
 *     tags: [Symbols]
 *     parameters:
 *       - in: path
 *         name: id_sy
 *         schema:
 *           type: string
 *         required: true
 *         description: ID del símbolo
 *     responses:
 *       200:
 *         description: Símbolo eliminado exitosamente
 *       404:
 *         description: Símbolo no encontrado
 *       500:
 *         description: Error interno del servidor
 */
router.delete('/:id_sy', deleteSymbol);

/**
 * @swagger
 * /api/symbols/add-for-exchanges:
 *   post:
 *     summary: Agrega símbolos para todos los exchanges activos
 *     tags: [Symbols]
 *     responses:
 *       200:
 *         description: Proceso completado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Mensaje del resultado
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       exchange:
 *                         type: string
 *                       error:
 *                         type: string
 *       500:
 *         description: Error crítico durante el proceso
 */
router.get('/add-for-exchanges', addSymbolsForExchange);

module.exports = router;

