const express = require('express');
const router = express.Router();
const sandboxOperationController = require('../controllers/sandboxOperationController');

// Sandbox routes
router.post('/connect', sandboxOperationController.connect);
router.get('/balance', sandboxOperationController.getWalletBalance);
router.post('/transfer', sandboxOperationController.transferCurrency);
router.post('/buy', sandboxOperationController.buySymbol);
router.post('/sell', sandboxOperationController.sellSymbol);
router.get('/history', sandboxOperationController.getOperationHistory);

module.exports = router;
