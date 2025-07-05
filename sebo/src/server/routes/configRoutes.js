const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const {getAllExchangeSecurity, getExchangeSecurity, createExchangeSecurity, updateExchangeSecurity, deleteExchangeSecurity, getConfiguredExchanges } = require('../controllers/exchangeSecurityController');


// Obtener configuración
router.get('/', (req, res) => {
    configController.getConfig(req, res);
});

// Actualizar configuración
router.put('/', (req, res) => {
    configController.updateConfig(req, res);
});

// Obtener exchanges configurados
router.get('/exchanges/configured', getConfiguredExchanges);
router.get('/exchangeSecurity', getAllExchangeSecurity); // GET /api/config/exchangeSecurity
router.get('/exchangeSecurity/:id_exchange', getExchangeSecurity); // GET /api/config/exchangeSecurity/:id_exchange
router.post('/exchangeSecurity', createExchangeSecurity); // POST /api/config/exchangeSecurity
router.put('/exchangeSecurity/:id', updateExchangeSecurity); // PUT /api/config/exchangeSecurity/:id
router.delete('/exchangeSecurity/:id', deleteExchangeSecurity); // DELETE /api/config/exchangeSecuri