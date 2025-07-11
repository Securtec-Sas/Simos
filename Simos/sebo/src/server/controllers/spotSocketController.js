// const ccxt = require("ccxt"); // No longer needed here
// const { readSpotCoinsFileHelper } = require("./spotController"); // No longer needed here
// const { getTopOpportunitiesFromDB } = require('./spotController'); // Removed
const { getFormattedTopAnalysis } = require('./analizerController'); // Added
const { getLatestBalanceDocument } = require('./balanceController'); // Importar la función para el último balance
// let ioInstance = null; // No parece ser utilizado, se puede eliminar

let lastSpotArbData = []; // Stays as an array, will store data from DB
// Define the target namespace based on the Python client's URL path
// WEBSOCKET_URL from Python config: "ws://localhost:3001/api/spot/arb"
// The path component /api/spot/arb is treated as a Socket.IO namespace.
// Swagger docs for the WebSocket
/**
 * @swagger
 * /api/spot/arb:
 *   get:
 *     summary: WebSocket endpoint for spot arbitrage data.
 *     tags: [Spot]
 *     responses:
 *       '200':
 *         description: Connected to the WebSocket.
 *     webSocket:
 *       $ref: '#/components/webSockets/spot-arb'
 */
const SPOT_ARB_DATA_NAMESPACE =
  process.env.SPOT_ARB_DATA_NAMESPACE || "/api/spot/arb"; // CORREGIDO

// Función para obtener y emitir los datos cada 5 segundos
async function emitSpotPricesLoop(io) {
  // ioInstance = io; // ioInstance no se utiliza en otras partes de este archivo

  // Get a handle to the specific namespace
  const targetNamespace = io.of(SPOT_ARB_DATA_NAMESPACE);
  console.log(
    `SpotSocketController: Namespace ${SPOT_ARB_DATA_NAMESPACE} inicializado. Esperando conexiones...`
  );

  targetNamespace.on('connection', async (socket) => {
    console.log(`SpotSocketController: Cliente conectado al namespace ${SPOT_ARB_DATA_NAMESPACE} con ID: ${socket.id}`);

    // Enviar el último balance al cliente recién conectado
    try {
      const latestBalance = await getLatestBalanceDocument();
      if (latestBalance) { // latestBalance puede ser null si no hay documentos
        socket.emit('balances-update', latestBalance); // Enviar el objeto único
        // console.log(`SpotSocketController: Evento 'balances-update' emitido al cliente ${socket.id} con el último balance.`);
      } else {
        socket.emit('balances-update', {}); // Enviar objeto vacío o null si no hay balance
      }
    } catch (error) {
      console.error(`SpotSocketController: Error al obtener o emitir el último balance para ${socket.id}:`, error);
      socket.emit('balances-update', { error: 'Error al obtener el último balance del servidor.' }); // Informar al cliente del error
    }

    socket.on('disconnect', () => {
      console.log(`SpotSocketController: Cliente desconectado del namespace ${SPOT_ARB_DATA_NAMESPACE} con ID: ${socket.id}`);
    });

    // Listen for balance updates pushed from V2 client
    socket.on('v2_last_balance_update', async (balanceData) => {
    });
  });

  console.log(
    `SpotSocketController: Iniciando bucle de emisión 'spot-arb' para el namespace: ${SPOT_ARB_DATA_NAMESPACE}`
  );
  while (true) {
    try {
      const detailedOpportunities = await getFormattedTopAnalysis();

      const latestBalance = await getLatestBalanceDocument();

      if (detailedOpportunities && detailedOpportunities.length > 0) {
        lastSpotArbData = detailedOpportunities; // Update lastSpotArbData with the formatted data

        for (const opportunity of detailedOpportunities) {
          targetNamespace.emit("spot-arb", opportunity);
        }
        targetNamespace.emit("top_20_data", detailedOpportunities);
      } else {
        targetNamespace.emit("top_20_data", []); // Emit empty list if no opportunities
        lastSpotArbData = []; // Clear if no data found
      }

      if (latestBalance) {
        targetNamespace.emit("balances-update", latestBalance);
      } else {
        targetNamespace.emit("balances-update", {}); // Emit empty object if no balance found
      }

    } catch (err) {
      console.error(
        `Error in spotSocketController loop (sourcing from analizerController for namespace: ${SPOT_ARB_DATA_NAMESPACE}):`,
        err
      );
      lastSpotArbData = []; // Clear on error
    }
    await new Promise((r) => setTimeout(r, 5000)); // Interval remains 5 seconds
  }
}

const getLastSpotArb = (req, res) => {
  res.status(200).json(lastSpotArbData);
};

module.exports = { emitSpotPricesLoop, getLastSpotArb };


