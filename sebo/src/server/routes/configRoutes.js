const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');

// ===== RUTAS DE CONFIGURACIÓN PRINCIPAL =====

// Obtener configuración principal
/**
 * @swagger
 * /api/config/:
 *   get:
 *     summary: Obtiene la configuración principal activa del sistema.
 *     tags: [Config]
 *     responses:
 *       '200':
 *         description: Configuración principal obtenida exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Config'
 *                 message:
 *                   type: string
 *       '500':
 *         description: Error al obtener la configuración.
 */
router.get('/', configController.getConfig);

// Actualizar configuración principal
/**
 * @swagger
 * /api/config/:
 *   put:
 *     summary: Actualiza la configuración principal del sistema.
 *     tags: [Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Config'
 *     responses:
 *       '200':
 *         description: Configuración actualizada correctamente.
 *       '400':
 *         description: Error al actualizar la configuración.
 *       '500':
 *         description: Error interno al actualizar la configuración.
 */
router.put('/', configController.updateConfig);

// Obtener resumen de configuración para dashboard
/**
 * @swagger
 * /api/config/summary:
 *   get:
 *     summary: Obtiene un resumen de la configuración principal para el dashboard.
 *     tags: [Config]
 *     responses:
 *       '200':
 *         description: Resumen de configuración obtenido exitosamente.
 *       '404':
 *         description: No hay configuración activa.
 *       '500':
 *         description: Error al obtener el resumen.
 */
router.get('/summary', configController.getConfigSummary);

// Restablecer configuración a valores por defecto
/**
 * @swagger
 * /api/config/reset:
 *   post:
 *     summary: Restablece la configuración a valores por defecto.
 *     tags: [Config]
 *     responses:
 *       '200':
 *         description: Configuración restablecida exitosamente.
 *       '500':
 *         description: Error al restablecer la configuración.
 */
router.post('/reset', configController.resetConfig);

// ===== RUTAS DE GESTIÓN DE CONFIGURACIONES =====

// Obtener todas las configuraciones
/**
 * @swagger
 * /api/config/all:
 *   get:
 *     summary: Obtiene todas las configuraciones del sistema.
 *     tags: [Config]
 *     responses:
 *       '200':
 *         description: Configuraciones obtenidas exitosamente.
 *       '500':
 *         description: Error al obtener las configuraciones.
 */
router.get('/all', configController.getConfigs);

// Crear nueva configuración
/**
 * @swagger
 * /api/config/create:
 *   post:
 *     summary: Crea una nueva configuración.
 *     tags: [Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Config'
 *     responses:
 *       '201':
 *         description: Configuración creada exitosamente.
 *       '400':
 *         description: Error al crear la configuración.
 */
router.post('/create', configController.createConfig);

// Obtener configuración por ID
/**
 * @swagger
 * /api/config/{id}:
 *   get:
 *     summary: Obtiene una configuración específica por ID.
 *     tags: [Config]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la configuración.
 *     responses:
 *       '200':
 *         description: Configuración obtenida exitosamente.
 *       '404':
 *         description: Configuración no encontrada.
 *       '500':
 *         description: Error al obtener la configuración.
 */
router.get('/:id', configController.getConfigById);

// Actualizar configuración por ID
/**
 * @swagger
 * /api/config/{id}:
 *   put:
 *     summary: Actualiza una configuración específica por ID.
 *     tags: [Config]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la configuración.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Config'
 *     responses:
 *       '200':
 *         description: Configuración actualizada exitosamente.
 *       '404':
 *         description: Configuración no encontrada.
 *       '400':
 *         description: Error al actualizar la configuración.
 */
router.put('/:id', configController.updateConfigById);

// Eliminar configuración por ID
/**
 * @swagger
 * /api/config/{id}:
 *   delete:
 *     summary: Elimina una configuración específica por ID.
 *     tags: [Config]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la configuración.
 *     responses:
 *       '200':
 *         description: Configuración eliminada exitosamente.
 *       '404':
 *         description: Configuración no encontrada.
 *       '400':
 *         description: No se puede eliminar la única configuración activa.
 *       '500':
 *         description: Error al eliminar la configuración.
 */
router.delete('/:id', configController.deleteConfig);

module.exports = router;

