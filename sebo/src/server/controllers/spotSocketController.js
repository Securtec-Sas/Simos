// const ccxt = require("ccxt"); // No longer needed here
// const { readSpotCoinsFileHelper } = require("./spotController"); // No longer needed here
// const { getTopOpportunitiesFromDB } = require('./spotController'); // Removed
const { getFormattedTopAnalysis } = require('./analizerController'); // Added
const { getLatestBalanceDocument } = require('./balanceController'); // Importar la función para el último balance
let ioInstance = null; // Para guardar la instancia de socket.io

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
  process.env.SPOT_ARB_DATA_NAMESPACE || "/api/spot/arb";

// Función para obtener y emitir los datos cada 5 segundos
async function emitSpotPricesLoop(io) {
  ioInstance = io; // Store the main io instance if needed by other parts

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
        console.log(`SpotSocketController: No se encontró ningún documento de balance para emitir al cliente ${socket.id}.`);
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
      // console.log(`Sebo (${SPOT_ARB_DATA_NAMESPACE}): Received 'v2_last_balance_update' from client ${socket.id}:`, JSON.stringify(balanceData, null, 2));
      // TODO: What should Sebo do with this?
      // - Update its own database? (V2 already does this via HTTP PUT)
      // - Use it for internal analytics/models?
      // - Re-broadcast to other connected clients on this namespace? (It already sends on connect)
      // For now, just log receipt. If Sebo needs to update its DB from this,
      // it would call a controller function here, e.g., something like:
      // await require('./balanceController').updateBalanceFromV2Socket(balanceData);
      // This also means the HTTP PUT from V2 might become redundant or serve as a fallback.
    });
  });

  // El bucle while (true) para emitir 'spot-arb' continúa como antes,
  // pero ahora opera independientemente de las conexiones individuales para el envío de balances.
  console.log(
    `SpotSocketController: Iniciando bucle de emisión 'spot-arb' para el namespace: ${SPOT_ARB_DATA_NAMESPACE}`
  );
  while (true) {
    try {
      // Call the new function from analizerController.js
      const detailedOpportunities = await getFormattedTopAnalysis();

      // Also get the latest balance document from balanceController
      const latestBalance = await getLatestBalanceDocument();

      if (detailedOpportunities && detailedOpportunities.length > 0) {
        lastSpotArbData = detailedOpportunities; // Update lastSpotArbData with the formatted data

        // Emit each opportunity individually for V2's per-opportunity processing
        for (const opportunity of detailedOpportunities) {
          targetNamespace.emit("spot-arb", opportunity);
        }
        // Also emit the full list for V2 to have the complete Top 20
        targetNamespace.emit("top_20_data", detailedOpportunities);
      } else {
        targetNamespace.emit("top_20_data", []); // Emit empty list if no opportunities
        lastSpotArbData = []; // Clear if no data found
      }

      // Emit the latest balance continuously with the top_20_data
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

// Endpoint para obtener el último top 20
const getLastSpotArb = (req, res) => {
  res.status(200).json(lastSpotArbData);
};

module.exports = { emitSpotPricesLoop, getLastSpotArb };

