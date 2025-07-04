const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const {getAllExchangeSecurity, getExchangeSecurity, createExchangeSecurity, updateExchangeSecurity, deleteExchangeSecurity, getConfiguredExchanges } = require('../controllers/exchangeSecurityController');


// Obtener configuración
/**
 * @swagger
 * /api/config/:
 *   get:
 *     summary: Obtiene la configuración actual.
 *     tags: [Config]
 *     responses:
 *       '200':
 *         description: Configuración actual.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exchanges:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ExchangeConfig'
 *       '500':
 *         description: Error al obtener la configuración.
 */
router.get('/', (req, res) => {
    configController.getConfig(req, res);
});

// Actualizar configuración
/**
 * @swagger
 * /api/config/:
 *   put:
 *     summary: Actualiza la configuración actual.
 *     tags: [Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               exchanges:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/ExchangeConfig'
 *     responses:
 *       '200':
 *         description: Configuración actualizada correctamente.
 *       '400':
 *         description: Error al actualizar la configuración.
 *       '500':
 *         description: Error interno al actualizar la configuración.
 */
router.put('/', (req, res) => {
    configController.updateConfig(req, res);
});

// Obtener exchanges configurados
/**
 * @swagger
 * /api/config/exchanges/configured:
 *   get:
 *     summary: Obtiene la lista de todos los exchanges configurados.
 *     tags: [Config]
 *     responses:
 *       '200':
 *         description: Lista de exchanges configurados.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ExchangeConfig'
 *       '500':
 *         description: Error al obtener la lista de exchanges configurados.
 */
router.get('/exchanges/configured', getConfiguredExchanges);

/**
 * @swagger
 * /api/config/exchangeSecurity:
 *   get:
 *     summary: Obtiene la lista de todos los exchanges con sus credenciales de seguridad.
 *     tags: [Config]
 *     responses:
 *       '200':
 *         description: Lista de exchanges con sus credenciales de seguridad.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ExchangeSecurity'
 *       '500':
 *         description: Error al obtener la lista de exchanges con sus credenciales de seguridad.
 */
router.get('/exchangeSecurity', getAllExchangeSecurity); // GET /api/config/exchangeSecurity
/**
 * @swagger
 * /api/config/exchangeSecurity/{id_exchange}:
 *   get:
 *     summary: Obtiene las credenciales de seguridad de un exchange en particular.
 *     tags: [Config]
 *     parameters:
 *       - in: path
 *         name: id_exchange
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del exchange.
 *     responses:
 *       '200':
 *         description: Credenciales de seguridad del exchange.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExchangeSecurity'
 *       '404':
 *         description: Exchange no encontrado.
 *       '500':
 *         description: Error al obtener las credenciales de seguridad del exchange.
 */
router.get('/exchangeSecurity/:id_exchange', getExchangeSecurity); // GET /api/config/exchangeSecurity/:id_exchange
/**
 * @swagger
 * /api/config/exchangeSecurity:
 *   post:
 *     summary: Crea una nueva credencial de seguridad para un exchange.
 *     tags: [Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExchangeSecurity'
 *     responses:
 *       '201':
 *         description: Credencial de seguridad creada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExchangeSecurity'
 *       '400':
 *         description: Error al crear la credencial de seguridad.
 *       '500':
 *         description: Error interno del servidor.
 */
router.post('/exchangeSecurity', createExchangeSecurity); // POST /api/config/exchangeSecurity
/**
 * @swagger
 * /api/config/exchangeSecurity/{id}:
 *   put:
 *     summary: Actualiza las credenciales de seguridad de un exchange.
 *     tags: [Config]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la credencial de seguridad.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExchangeSecurity'
 *     responses:
 *       '200':
 *         description: Credencial de seguridad actualizada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExchangeSecurity'
 *       '404':
 *         description: Credencial de seguridad no encontrada.
 *       '400':
 *         description: Error al actualizar la credencial de seguridad.
 *       '500':
 *         description: Error interno del servidor.
 */
/**
 * @swagger
 * /api/config/exchangeSecurity/{id}:
 *   put:
 *     summary: Actualiza las credenciales de seguridad de un exchange.
 *     tags: [Config]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la credencial de seguridad.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExchangeSecurity'
 *     responses:
 *       '200':
 *         description: Credencial de seguridad actualizada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExchangeSecurity'
 *       '404':
 *         description: Credencial de seguridad no encontrada.
 *       '400':
 *         description: Error al actualizar la credencial de seguridad.
 *       '500':
 *         description: Error interno del servidor.
 */
router.put('/exchangeSecurity/:id', updateExchangeSecurity); // PUT /api/config/exchangeSecurity/:id

/**
 * @swagger
 * /api/config/exchangeSecurity/{id}:
 *   delete:
 *     summary: Elimina las credenciales de seguridad de un exchange.
 *     tags: [Config]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la credencial de seguridad.
 *     responses:
 *       '200':
 *         description: Credencial de seguridad eliminada correctamente.
 *       '404':
 *         description: Credencial de seguridad no encontrada.
 *       '500':
 *         description: Error al eliminar la credencial de seguridad.
 */
router.delete('/exchangeSecurity/:id', deleteExchangeSecurity); // DELETE /api/config/exchangeSecurity/:id

