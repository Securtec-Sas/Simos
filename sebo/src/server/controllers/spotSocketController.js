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
        console.log(`SpotSocketController: Evento 'balances-update' emitido al cliente ${socket.id} con el último balance.`);
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

      if (detailedOpportunities && detailedOpportunities.length > 0) {
        lastSpotArbData = detailedOpportunities; // Update lastSpotArbData with the formatted data

        // Emit each opportunity individually
        // 'opportunity' now has the detailed JSON structure with fees
        for (const opportunity of detailedOpportunities) {
          targetNamespace.emit("spot-arb", opportunity);
        }
        // console.log(`Emitted ${detailedOpportunities.length} detailed opportunities to ${SPOT_ARB_DATA_NAMESPACE}`);
      } else {
        // console.log('No detailed opportunities found in DB to emit.');
        lastSpotArbData = []; // Clear if no data found
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
