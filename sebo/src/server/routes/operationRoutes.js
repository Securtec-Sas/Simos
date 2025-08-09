const express = require('express');
const router = express.Router();
const operationController = require('../controllers/operationController');

// Production routes
router.post('/connect', operationController.connect);
router.get('/balance', operationController.getWalletBalance);
router.post('/transfer', operationController.transferCurrency);
router.post('/buy', operationController.buySymbol);
router.post('/sell', operationController.sellSymbol);
router.get('/history', operationController.getOperationHistory);

module.exports = router;
