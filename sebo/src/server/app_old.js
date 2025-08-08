const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path'); // Added for path.join
const { PORT } = require('./utils/config'); // Assuming PORT is defined in utils/config
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { getExchangesStatus, getConfiguredExchanges, getExchangeStatusById, updateExchangeActiveStatus } = require('./controllers/exchangeController'); //NOSONAR
const { handleSpotAnalysisRequest, getTopSpotOpportunities } = require('./controllers/spotController'); // Import new controller
const http = require('http');
const { Server } = require('socket.io');
const { emitSpotPricesLoop } = require('./controllers/spotSocketController');
dotenv.config();

const app = express();

// Middleware
app.use(cors()); // Habilita CORS para permitir peticiones desde el frontend
app.use(express.json()); // Permite a Express parsear JSON

// Create an HTTP server instance from the Express app
const serveri = http.createServer(app);

// Initialize Socket.IO with the HTTP server instance
const io = new Server(serveri, {
  cors: {
    origin: '*', // Allow all origins, or specify your client's origin
    methods: ['GET', 'POST'] // Allow specified HTTP methods
  }
});
// Ruta raíz para servir index.html (definida ANTES de static para asegurar que se use esta ruta para '/')
// app.get('/', (req, res) => {
//     console.log('Root route hit, attempting to send index.html'); // Log para depuración
//     res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
// });

// Servir archivos estáticos del frontend
// (CSS, JS del cliente, imágenes, etc., desde la carpeta src/public)
app.use(express.static('src/public'));

// Swagger Definitions
/**
 * @swagger
 * tags:
 *   - name: Exchanges
 *     description: Endpoints relacionados con la gestión y estado de exchanges.
 *   - name: Spot
 *     description: Endpoints relacionados con el análisis de mercados spot.
 *
 * components:
 *   schemas:
 *     ExchangeStatus:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: ID del exchange (CCXT ID).
 *         name:
 *           type: string
 *           description: Nombre del exchange.
 *         connected:
 *           type: boolean
 *           description: Estado de conexión.
 *         priceXRPUSDT:
 *           type: string
 *           description: Último precio de XRP/USDT o mensaje de estado si no está disponible/aplicable.
 *         error:
 *           type: string
 *           nullable: true
 *           description: Mensaje de error si la conexión falló.
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     SpotOpportunityValue:
 *       type: object
 *       properties:
 *         exValMin: { type: 'string', description: 'Exchange con el valor mínimo.' }
 *         exValMax: { type: 'string', description: 'Exchange con el valor máximo.' }
 *         valMin: { type: 'number', description: 'Valor mínimo.' }
 *         valMax: { type: 'number', description: 'Valor máximo.' }
 *         difer: { type: 'string', description: 'Porcentaje de diferencia.' }
 *     SpotOpportunity:
 *       type: object
 *       properties:
 *         symbol:
 *           type: string
 *           description: 'Símbolo del par de monedas (ej. BTC/USDT).'
 *         name:
 *           type: string
 *           description: 'Nombre de la moneda base (ej. BTC).'
 *         exchanges:
 *           type: array
 *           items:
 *             type: string
 *           description: 'Lista de exchanges donde se encuentra el par.'
 *         valores:
 *           $ref: '#/components/schemas/SpotOpportunityValue'
 *           description: 'Valores de la oportunidad de arbitraje.'
 */

// Configuración de Swagger JSDoc
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'SEBO API',
            version: '1.0.0',
            description: 'API para el Sistema de Especulación Basado en Oportunidades (SEBO)'
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
                description: 'Servidor de Desarrollo Local',
            },
        ],
    },
    // Rutas a los archivos que contienen las definiciones OpenAPI (tus controladores/rutas)
    apis: ['./src/server/app.js', './src/server/controllers/*.js'], // Ajusta según la ubicación de tus rutas
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Ruta para la UI de Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /api/exchanges-status:
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
app.get('/api/exchanges-status', getExchangesStatus);

/**
 * @swagger
 * /api/configured-exchanges:
 *   get:
 *     summary: Obtiene la lista de todos los exchanges soportados por CCXT, incluyendo su estado activo desde la configuración.
 *     tags: [Exchanges]
 *     responses:
 *       '200':
 *         description: Lista de exchanges configurados y soportados por CCXT.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: 'string', description: 'ID del exchange (CCXT ID)' }
 *                   name: { type: 'string', description: 'Nombre del exchange' }
 *                   isActive: { type: 'boolean', description: 'Indica si el exchange está marcado como activo en la configuración' }
 *                   ccxtSupported: { type: 'boolean', description: 'Indica si el exchange es soportado por la librería CCXT' }
 *                   connectionType:
 *                      type: string
 *                      nullable: true
 *                      description: Tipo de conexión (ej. 'ccxt', 'api_propia'), si está definido en exchanges_config.json.
 *       '500':
 *         description: Error al obtener la lista de exchanges.
 */
app.get('/api/configured-exchanges', getConfiguredExchanges);

// Endpoint to update an exchange's active status
/**
 * @swagger
 * /api/update-exchange-active-status:
 *   post:
 *     summary: Actualiza el estado activo de un exchange.
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
 *                 description: ID del exchange a actualizar.
 *                 example: "binance"
 *               isActive:
 *                 type: boolean
 *                 description: Nuevo estado activo del exchange.
 *                 example: true
 *               exchangeName:
 *                 type: string
 *                 description: Nombre del exchange (opcional, para logging o UI).
 *                 example: "Binance"
 *     responses:
 *       '200':
 *         description: Estado del exchange actualizado correctamente.
 *       '500':
 *         description: Error al actualizar el estado del exchange.
 */
app.post('/api/update-exchange-active-status', updateExchangeActiveStatus);

// New Endpoint for Spot Analyzer
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
// app.post('/api/spot/spotanalyzer', handleSpotAnalysisRequest); // Original call
app.post('/api/spot/spotanalyzer', (req, res) => {
    console.log('ok'); // Muestra "ok" en la consola del servidor
    res.status(200).json({ message: 'ok' }); // Responde con estado 200 y mensaje "ok"
});

/**
 * @swagger
 * /api/spot/top-opportunities:
 *   get:
 *     summary: Obtiene las 20 principales oportunidades de spot con par USDT, ordenadas por mayor diferencia de precio.
 *     tags: [Spot]
 *     responses:
 *       '200':
 *         description: Una lista de las 20 principales oportunidades de spot.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SpotOpportunity'
 *       '500':
 *         description: Error al obtener las oportunidades de spot.
 */
app.get('/api/spot/top-opportunities', getTopSpotOpportunities);

/**
 * @swagger
 * /api/exchange-status/{exchangeId}:
 *   get:
 *     summary: Obtiene el estado de conexión y precio de XRP/USDT para un exchange específico.
 *     tags: [Exchanges]
 *     parameters:
 *       - in: path
 *         name: exchangeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del exchange (CCXT ID).
 *     responses:
 *       '200':
 *         description: Estado del exchange.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExchangeStatus'
 *       '400':
 *         description: ID del exchange no proporcionado.
 *       '500':
 *         description: Error al obtener el estado del exchange.
 */
app.get('/api/exchange-status/:exchangeId', getExchangeStatusById);

// Rutas de Spot (movidas a routes/spotRoutes.js)
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
/**
 * @swagger
 * /api/spot/top-opportunities:
 *   get:
 *     summary: Obtiene las 20 principales oportunidades de spot con par USDT, ordenadas por mayor diferencia de precio.
 *     tags: [Spot]
 *     responses:
 *       '200':
 *         description: Una lista de las 20 principales oportunidades de spot.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SpotOpportunity'
 *       '500':
 *         description: Error al obtener las oportunidades de spot.
 */

// Importar y usar las rutas de Spot
const spotRoutes = require('./routes/spotRoutes');
app.use('/api/spot', spotRoutes);


// Iniciar el servidor
const server = http.createServer(app);
server.listen(PORT, () => {
    console.log(`Servidor Express corriendo en http://localhost:${PORT}`);
    console.log(`Documentación Swagger disponible en http://localhost:${PORT}/api-docs`);
    console.log('Accede al frontend en http://localhost:3000');
    emitSpotPricesLoop(io);
});
