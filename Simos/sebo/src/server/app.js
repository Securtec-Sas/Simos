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
const { Server } = require("socket.io");
const { emitSpotPricesLoop } = require("./controllers/spotSocketController");
const { connectDB } = require("./data/dataBase/connectio");
const { addExchanges } = require("./controllers/dbCotroller");
const {  analisisExchangeSimbol, actualizePricetop20  } = require("./controllers/analizerController");

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

app.get("/analyser", analisisExchangeSimbol);
// app.get("/depure",depuredExchangeSymbolData)

// app.get("/depure", depuredExchangeSymbolData);

app.get("/api/exchange-unique/:exchangeId?", getExchangeStatusById);

app.get("/addexchanges",addExchanges);

app.get("/api/configured-exchanges", getConfiguredExchanges);

app.post("/api/update-exchange-active-status", updateExchangeActiveStatus);

app.post("/api/spot/spotanalyzer", (req, res) => {
    console.log("ok");
    res.status(200).json({ message: "ok" });
});

app.get("/api/spot/top-opportunities", getTopSpotOpportunities);

app.get("/api/exchange-status/:exchangeId", getExchangeStatusById);

async function loopActualizePricetop20() {
    try {
        await actualizePricetop20();
    } catch (err) {
        console.error("Error en actualizePricetop20:", err);
    } finally {
        setImmediate(loopActualizePricetop20);
    }
}

const spotRoutes = require("./routes/spotRoutes");
app.use("/api/spot", spotRoutes);

const balanceRoutes = require("./routes/balanceRoutes");
app.use("/api/balances", balanceRoutes);

const exchangeRoutes = require("./routes/exchangeRoutes");
app.use("/api/exchanges", exchangeRoutes);

serveri.listen(PORT, () => {
    console.log(`Servidor Express corriendo en http://localhost:${PORT}`);
    console.log(`Documentación Swagger disponible en http://localhost:${PORT}/api-docs`);
    console.log("Accede al frontend en http://localhost:3000");
    loopActualizePricetop20();
    emitSpotPricesLoop(io);
});


