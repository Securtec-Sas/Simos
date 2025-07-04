const express = require('express');
const router = express.Router();

const { getLastSpotArb } = require('../controllers/spotSocketController');
const { handleSpotAnalysisRequest } = require('../controllers/spotController');
const { addExchangesSymbols, exchangesymbolsNewAdd } = require('../controllers/dbCotroller');
const analizerController = require('../controllers/analizerController');
const symbolController = require('../controllers/symbolController');
// const {analyzeSymbols} = require('../controllers/analizerController'); // Comentada para usar el objeto completo


// ...otras rutas...

router.get('/symbol', symbolController.addSymbolsForExchange);

/**
 * @swagger
 * /api/spot/arb:
 *   get:
 *     summary: Obtiene el top 20 de oportunidades spot con precios actualizados y diferencia porcentual.
 *     tags:
 *       - Spot
 *     responses:
 *       200:
 *         description: Lista de oportunidades de arbitraje spot.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   symbol:
 *                     type: string
 *                     example: ETH3L/USDT
 *                   exchanges:
 *                     type: array
 *                     items:
 *                       type: string
 *                   prices:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         exchange:
 *                           type: string
 *                         price:
 *                           type: number
 *                   percent:
 *                     type: string
 *                     example: "200.00"
 */
router.get('/arb', getLastSpotArb);
// Rutas de Spot (movidas a routes/spotRoutes.js)


/**
 * @swagger
 * /api/spot/analysis:
 *   get:
 *     summary: Analiza oportunidades spot entre exchanges activos.
 *     tags:
 *       - Spot
 *     responses:
 *       200:
 *         description: Análisis de oportunidades spot realizado correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       500:
 *         description: Error durante el análisis de oportunidades spot.
 */
router.get('/analysis', handleSpotAnalysisRequest);

/**
 * @swagger
 * /api/spot/exchange-price:
 *   get:
 *     summary: Obtiene los precios de compra y venta de cada exchange para cada símbolo spot.
 *     tags:
 *       - Spot
 *     responses:
 *       200:
 *         description: Precios de compra y venta por exchange agregados correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 totalSymbols:
 *                   type: integer
 *       500:
 *         description: Error crítico durante el análisis de spot.
 */
    // router.get('/exchange-price', handleSpotExchangePrice);
// console.log("Debug: typeof handleSpotExchangePrice === 'function':", typeof handleSpotExchangePrice === 'function');
// router.get('/exchange-price', handleSpotExchangePrice); // Comentando ruta ya que handleSpotExchangePrice no existe en spotController.js

/**
 * @swagger
 * /api/spot/exchange-symbols:
 *   get:
 *     summary: Agrega los símbolos de los exchanges activos a la base de datos.
 *     tags:
 *       - Spot
 *     responses:
 *       200:
 *         description: Símbolos agregados correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Error al agregar símbolos de exchanges.
 */
router.get('/exchange-symbols', addExchangesSymbols);

/**
 * @swagger
 * /api/spot/exchangesymbol:
 *   get:
 *     summary: Agrega los símbolos de los exchanges activos a la base de datos.
 *     tags:
 *       - Spot
 *     responses:
 *       200:
 *         description: Símbolos de exchanges agregados correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Error al agregar símbolos de exchanges.
 */
router.get('/exchangesymbol', exchangesymbolsNewAdd);

/**
 * @swagger
 * /api/spot/depure:
 *   get:
 *     summary: Depura los datos de símbolos de exchanges.
 *     tags:
 *       - Spot
 *     responses:
 *       200:
 *         description: Datos de símbolos de exchanges depurados correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Error al depurar datos de símbolos de exchanges.
 */
router.get('/depure', analizerController.depuredExchangeSymbolData);


/**
 * @swagger
 * /api/spot/promedios:
 *   get:
 *     summary: Analiza los promedios de los símbolos spot entre exchanges.
 *     tags:
 *       - Spot
 *     responses:
 *       200:
 *         description: Análisis de promedios realizado correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Error durante el análisis de promedios.
 */
router.get('/promedios', analizerController.analyzeSymbols); // Usando acceso directo a la propiedad

/**
 * @swagger
 * /api/spot/spotanalyzer:
 *   post:
 *     summary: Inicia el análisis de spot y actualiza el archivo de monedas.
 *     tags: [Spot]
 *     responses:
 *       '200':
 *         description: Análisis de spot completado y archivo de monedas actualizado.
 *       '500':
 *         description: Error durante el análisis de spot.
 */





module.exports = router;
