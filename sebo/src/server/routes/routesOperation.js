const express = require('express');
const router = express.Router();
const operationController = require('../controllers/operationController');
const sandboxOperationController = require('../controllers/sandboxOperationController');

// Production routes
router.post('/operations/connect', operationController.connect);
router.get('/operations/balance', operationController.getWalletBalance);
router.post('/operations/transfer', operationController.transferCurrency);
router.post('/operations/buy', operationController.buySymbol);
router.post('/operations/sell', operationController.sellSymbol);
router.get('/operations/history', operationController.getOperationHistory);

// Sandbox routes
router.post('/sandbox-operations/connect', sandboxOperationController.connect);
router.get('/sandbox-operations/balance', sandboxOperationController.getWalletBalance);
router.post('/sandbox-operations/transfer', sandboxOperationController.transferCurrency);
router.post('/sandbox-operations/buy', sandboxOperationController.buySymbol);
router.post('/sandbox-operations/sell', sandboxOperationController.sellSymbol);
router.get('/sandbox-operations/history', sandboxOperationController.getOperationHistory);

module.exports = router;
