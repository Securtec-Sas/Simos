const express = require('express');
const router = express.Router();
const TradingController = require('../controllers/TradingController');

router.post('/create-training-csv', TradingController.createTrainingCSV);
router.get('/training-files', TradingController.getTrainingCSVFiles);
router.get('/training-files/:filename', TradingController.serveCSVFile);
router.post('/get-file-path', TradingController.getCSVFilePath);

module.exports = router;
