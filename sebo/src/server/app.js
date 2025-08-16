const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const { PORT } = require("./utils/config");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const { getExchangesStatus, getExchangeStatusById, getConfiguredExchanges, updateExchangeActiveStatus } = require("./controllers/exchangeController");
const { handleSpotAnalysisRequest, getTopSpotOpportunities } = require("./controllers/spotController");
const http = require("http");
const { Server } = require("socket.io"); // NOSONAR
const { setupSpotSocketController } = require("./controllers/spotSocketController");
const {addSymbolsForExchange} = require("./controllers/symbolController");
const { connectDB } = require("./data/dataBase/connectio");
const { addExchanges,deleteLowCountExchangeSymbols } = require("./controllers/dbCotroller");
const analyzerController = require("./controllers/analizerController");
const cron = require('node-cron');

dotenv.config();

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

const serveri = http.createServer(app);

const io = new Server(serveri, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static("src/public"));

const swaggerOptions = {
    swaggerDefinition: {
        openapi: "3.0.0",
        info: {
            title: "SEBO API",
            version: "1.0.0",
            description: "API para el Sistema de Especulación Basado en Oportunidades (SEBO)"
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
                description: "Servidor de Desarrollo Local",
            },
        ],
    },
    apis: [
        "./src/server/app.js",
        "./src/server/controllers/*.js",
        "./src/server/routes/*.js",
        "./src/server/controllers/dbCotroller.js",
        "./src/server/controllers/spotController.js",
        "./src/server/controllers/spotSocketController.js",
        "./src/server/controllers/exchangeController.js",
        "./src/server/controllers/analizerController.js",
        "./src/server/controllers/symbolController.js",
    ]
};
    const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/api/exchanges-status", getExchangesStatus);

app.get("/analyser", analyzerController.addAnalyzeSymbols);
// app.get("/depure",balanceRoutes.depº)

app.get('/addsymbols',addSymbolsForExchange);

app.get("/api/exchange-unique/:exchangeId?", getExchangeStatusById);

app.get("/addexchanges",addExchanges);

app.get('/depureex,',deleteLowCountExchangeSymbols)

app.get("/api/configured-exchanges", getConfiguredExchanges);

app.post("/api/update-exchange-active-status", updateExchangeActiveStatus);

app.post("/api/spot/spotanalyzer", (req, res) => {
    console.log("ok");
    res.status(200).json({ message: "ok" });
});

app.get("/api/spot/top-opportunities", getTopSpotOpportunities);

app.get("/api/exchange-status/:exchangeId", getExchangeStatusById);

// Función para iniciar el cron job de actualización del Top 20 cada 10 segundos
    console.log("🚀 Iniciando cron job para actualización del Top 20 cada 10 segundos...");
    
    // Cron job que se ejecuta cada 10 segundos
    // cron.schedule('*/10 * * * * *', () => {
    //     try {
    //         console.log('[Cron] Ejecutando actualización del Top 20...');
    //         analyzerController.updateTop20AnalysisPrices();
    //     } catch (err) {
    //         console.error("[Cron] Error en updateTop20AnalysisPrices:", err);
    //     }
    // });
    



const spotRoutes = require("./routes/spotRoutes");
app.use("/api/spot", spotRoutes);

const balanceRoutes = require("./routes/balanceRoutes");
app.use("/api/balances", balanceRoutes);

const exchangeRoutes = require("./routes/exchangeRoutes");
app.use("/api/exchanges", exchangeRoutes);

const tradingRoutes = require("./routes/tradingRoutes");
app.use("/api/trading", tradingRoutes);

const symbolRoutes = require("./routes/symbolRoutes");
app.use("/api/symbols", symbolRoutes);

const operationRoutes = require("./routes/operationRoutes");
app.use("/api/operations", operationRoutes);

const sandboxOperationRoutes = require("./routes/sandboxOperationRoutes");
app.use("/api/sandbox-operations", sandboxOperationRoutes);

const configRoutes = require("./routes/configRoutes");
app.use("/api/config", configRoutes);

const testRoutes = require("./routes/testRoutes");
app.use("/api/test", testRoutes);

const localOperationRoutes = require("./routes/localOperationRoutes");
app.use("/api/local-operations", localOperationRoutes);

// Nueva ruta para datos históricos de OHLCV
app.get("/api/historical-ohlcv", analyzerController.getHistoricalOHLCV);

// Schedule the price update job to run every 5 minutes
// cron.schedule('*/5 * * * *', () => {
//   console.log('Ejecutando el cron job para actualizar precios de análisis...');
//   analyzerController.updateAllAnalysisPrices();
// });

serveri.listen(PORT, () => {
    console.log(`Servidor Express corriendo en http://localhost:${PORT}`);
    console.log(`Documentación Swagger disponible en http://localhost:${PORT}/api-docs`);
    console.log("Accede al frontend en http://localhost:3000");
    
    // Iniciar el cron job para actualización del Top 20 cada 10 segundos
    
    setupSpotSocketController(io);
});
