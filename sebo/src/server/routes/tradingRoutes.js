const express = require('express');
const router = express.Router();
const TradingController = require('../controllers/TradingController');
const dbCotroller = require('../controllers/dbCotroller');

router.post('/create-training-csv', TradingController.createTrainingCSV);
router.get('/optimize', dbCotroller.deleteAnalysisWithoutActiveNetworks);
router.get('/delete-low-count-symbols', dbCotroller.deleteLowCountExchangeSymbols);

module.exports = router;
