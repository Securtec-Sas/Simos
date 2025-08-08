const express = require('express');
const router = express.Router();
const TradingController = require('../controllers/TradingController');

router.post('/create-training-csv', TradingController.createTrainingCSV);

module.exports = router;
