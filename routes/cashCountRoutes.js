const express = require('express');
const router = express.Router();
const cashCountController = require('../controllers/cashCountController');

router.post('/', cashCountController.createCashCount);
router.get('/', cashCountController.getCashCounts);
router.get('/status', cashCountController.getRegisterStatus);
router.get('/:id', cashCountController.getCashCountDetails);

module.exports = router;
