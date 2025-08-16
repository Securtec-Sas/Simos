const express = require('express');
const router = express.Router();
const { createTestCSV } = require('../controllers/testController');

/**
 * @swagger
 * /api/test/create/{diasAtras}/{cantAnalysis}/{timeFrame}:
 *   get:
 *     summary: Crear archivo CSV de pruebas para el modelo AI
 *     description: Genera un archivo CSV con datos de prueba basados en análisis históricos para testing del modelo de IA
 *     tags: [Test]
 *     parameters:
 *       - in: path
 *         name: diasAtras
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           example: 59
 *         description: Número de días hacia atrás para obtener datos históricos
 *       - in: path
 *         name: cantAnalysis
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10000
 *           example: 100
 *         description: Cantidad de análisis/operaciones a generar
 *       - in: path
 *         name: timeFrame
 *         required: true
 *         schema:
 *           type: string
 *           enum: [5m, 10m, 15m, 30m, 1h, 2h, 3h, 4h, 6h, 12h, 1d]
 *           example: 5m
 *         description: Intervalo de tiempo para los datos históricos
 *     responses:
 *       201:
 *         description: CSV de pruebas creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "CSV de pruebas guardado exitosamente en el servidor."
 *                 filename:
 *                   type: string
 *                   example: "test_data_59days_100analysis_5m_2025-08-12T04-10-30.csv"
 *                 path:
 *                   type: string
 *                   example: "/path/to/csv/exports/test_data_59days_100analysis_5m_2025-08-12T04-10-30.csv"
 *                 records:
 *                   type: integer
 *                   example: 100
 *                 parameters:
 *                   type: object
 *                   properties:
 *                     diasAtras:
 *                       type: integer
 *                       example: 59
 *                     cantAnalysis:
 *                       type: integer
 *                       example: 100
 *                     timeFrame:
 *                       type: string
 *                       example: "5m"
 *                 summary:
 *                   type: object
 *                   properties:
 *                     processedSymbols:
 *                       type: integer
 *                       example: 25
 *                     skippedSymbols:
 *                       type: integer
 *                       example: 5
 *                     totalTrades:
 *                       type: integer
 *                       example: 100
 *       400:
 *         description: Parámetros inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Los días atrás deben estar entre 1 y 365"
 *       404:
 *         description: No se encontraron datos de análisis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "No se encontraron documentos de análisis."
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error interno del servidor"
 *     examples:
 *       example1:
 *         summary: Crear archivo de pruebas básico
 *         value:
 *           diasAtras: 59
 *           cantAnalysis: 100
 *           timeFrame: "5m"
 *       example2:
 *         summary: Crear archivo de pruebas extendido
 *         value:
 *           diasAtras: 90
 *           cantAnalysis: 500
 *           timeFrame: "15m"
 */
router.get('/create/:diasAtras/:cantAnalysis/:timeFrame', createTestCSV);

module.exports = router;