const express = require('express');
const router = express.Router();
const cashRegisterHistoryController = require('../controllers/cashRegisterHistoryController');
const { authenticateToken } = require('../middleware/auth');

// All routes are protected
router.use(authenticateToken);

router.post('/save', cashRegisterHistoryController.saveCashRegisterHistory);
router.get('/history', cashRegisterHistoryController.getCashRegisterHistory);
router.get('/:id', cashRegisterHistoryController.getCashRegisterById);

module.exports = router;
