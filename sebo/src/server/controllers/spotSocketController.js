// const ccxt = require("ccxt"); // No longer needed here
// const { readSpotCoinsFileHelper } = require("./spotController"); // No longer needed here
// const { getTopOpportunitiesFromDB } = require(/'./spotController/'); // Removed
const { getFormattedTopAnalysis, dataTrainModel } = require('./analizerController')
const { getLatestBalanceDocument } = require('./balanceController')
// let ioInstance = null; // No parece ser utilizado, se puede eliminar

let lastSpotArbData = []; // Stays as an array, will store data from DB
// Define the target namespace based on the Python client/'s URL path
// WEBSOCKET_URL from Python config: "ws://localhost:3001/api/spot/arb"
// The path component /api/spot/arb is treated as a Socket.IO namespace.
/**
 * @swagger
 * /api/spot/arb:
 *   get:
 *     summary: WebSocket endpoint for spot arbitrage data.
 *     tags:
 *       - Spot
 *     responses:
 *       '200':
 *         description: Connected to the WebSocket.
 *     webSocket:
 *       $ref: '#/components/webSockets/spot-arb'
 */
const SPOT_ARB_DATA_NAMESPACE =
  process.env.SPOT_ARB_DATA_NAMESPACE || "/api/spot/arb"; // CORREGIDO

<<<<<<< HEAD
// Función para obtener y emitir los datos cada 5 segundos
async function emitSpotPricesLoop(io) {
=======
// Función para configurar los manejadores de eventos del socket
async function setupSpotSocketController(io) {
>>>>>>> parent of 5b78e8f (prueba)
  // ioInstance = io; // ioInstance no se utiliza en otras partes de este archivo

  // Get a handle to the specific namespace
  const targetNamespace = io.of(SPOT_ARB_DATA_NAMESPACE);
  console.log(
    `SpotSocketController: Namespace ${SPOT_ARB_DATA_NAMESPACE} inicializado. Esperando conexiones...`
  );

  targetNamespace.on('connection', async (socket) => {
    console.log(`SpotSocketController: Cliente conectado al namespace ${SPOT_ARB_DATA_NAMESPACE} con ID: ${socket.id}`);

<<<<<<< HEAD
    // Enviar el último balance al cliente recién conectado
=======
    // Enviar el último balance una vez al cliente recién conectado
>>>>>>> parent of 5b78e8f (prueba)
    try {
      const latestBalance = await getLatestBalanceDocument();
      if (latestBalance) { // latestBalance puede ser null si no hay documentos
      socket.emit("balances-update", latestBalance); // Enviar el objeto único
        // console.log(`SpotSocketController: Evento 'balances-update' emitido al cliente ${socket.id} con el último balance.`);
      } else {
        socket.emit('balances-update', {}); // Enviar objeto vacío o null si no hay balance
      }
    } catch (error) {
      console.error(`SpotSocketController: Error al obtener o emitir el último balance para ${socket.id}:`, error);
      socket.emit('balances-update', { error: 'Error al obtener el último balance del servidor.' }); // Informar al cliente del error
    }

<<<<<<< HEAD
=======
    // Escuchar solicitud de datos Top 20 y enviar una sola vez
    socket.on('request_top_20_data', async () => {
      console.log(`SpotSocketController: Recibida solicitud 'request_top_20_data' de ${socket.id}`);
      try {
        const detailedOpportunities = await getFormattedTopAnalysis();
        if (detailedOpportunities && detailedOpportunities.length > 0) {
          lastSpotArbData = detailedOpportunities; // Actualizar caché
          socket.emit("top_20_data", detailedOpportunities);
        } else {
          lastSpotArbData = [];
          socket.emit("top_20_data", []);
        }
      } catch (err) {
        console.error(`SpotSocketController: Error procesando 'request_top_20_data' para ${socket.id}:`, err);
        socket.emit("top_20_data", { error: 'Error obteniendo datos del servidor.' });
      }
    });

    // Escuchar solicitud de actualización de balance y enviar una sola vez
    socket.on('request_balance_update', async () => {
      console.log(`SpotSocketController: Recibida solicitud 'request_balance_update' de ${socket.id}`);
      try {
        const latestBalance = await getLatestBalanceDocument();
        if (latestBalance) {
          socket.emit("balances-update", latestBalance);
        } else {
          socket.emit('balances-update', {});
        }
      } catch (error) {
        console.error(`SpotSocketController: Error procesando 'request_balance_update' para ${socket.id}:`, error);
        socket.emit('balances-update', { error: 'Error al obtener el último balance del servidor.' });
      }
    });

>>>>>>> parent of 5b78e8f (prueba)
    // Listener for training data requests from the Python V3 client
    socket.on('train_ai_model', async (payload) => {
      try {
        console.log(`Received 'train_ai_model' request from ${socket.id} with payload:`, payload);
        const req = { payload }; // Create a mock request object for the controller
        const trainingData = await dataTrainModel(req);
        console.log(`Generated ${trainingData.length} training records. Sending back to client.`);
        
        // Emit the data back on a dedicated response event
        socket.emit('training_data_response', {
          status: 'success',
          data: trainingData
        });
      } catch (error) {
        console.error(`Error processing 'train_ai_model' request for ${socket.id}:`, error);
        socket.emit('training_data_response', { status: 'error', message: error.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`SpotSocketController: Cliente desconectado del namespace ${SPOT_ARB_DATA_NAMESPACE} con ID: ${socket.id}`);
    });

    // Listen for balance updates pushed from V2 client
    socket.on('v2_last_balance_update', async (balanceData) => {
    });

  });

<<<<<<< HEAD
  console.log(
    `SpotSocketController: Iniciando bucle de emisión /'spot-arb/' para el namespace: ${SPOT_ARB_DATA_NAMESPACE}`
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
=======
  // Iniciar bucle de emisión para top_20_data cada 5 segundos
  console.log(
    `SpotSocketController: Iniciando bucle de emisión de 'top_20_data' para el namespace: ${SPOT_ARB_DATA_NAMESPACE}`
  );

  (async () => {
    while (true) {
      try {
        const detailedOpportunities = await getFormattedTopAnalysis();
        if (detailedOpportunities && detailedOpportunities.length > 0) {
          lastSpotArbData = detailedOpportunities; // Actualizar caché
          targetNamespace.emit("top_20_data", detailedOpportunities);
        } else {
          lastSpotArbData = [];
          targetNamespace.emit("top_20_data", []); // Emitir lista vacía si no hay oportunidades
        }
      } catch (err) {
        console.error(
          `Error en el bucle de emisión de top_20_data (namespace: ${SPOT_ARB_DATA_NAMESPACE}):`,
          err
        );
      }
      await new Promise((r) => setTimeout(r, 5000)); // Esperar 5 segundos
    }
  })();
>>>>>>> parent of 5b78e8f (prueba)
}

const getLastSpotArb = (req, res) => {
  res.status(200).json(lastSpotArbData);
};

<<<<<<< HEAD
module.exports = { emitSpotPricesLoop, getLastSpotArb };


=======
module.exports = { setupSpotSocketController, getLastSpotArb };
>>>>>>> parent of 5b78e8f (prueba)
