const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const { authenticateToken, checkPermission } = require('../middleware/auth');

// All sale routes require authentication and 'sales' or 'sales_history' permission
router.post('/', authenticateToken, checkPermission('sales'), saleController.createSale);
router.get('/', authenticateToken, checkPermission('sales_history'), saleController.getAllSales);
router.get('/:id', authenticateToken, checkPermission('sales_history'), saleController.getSaleDetails);
router.delete('/:id', authenticateToken, checkPermission('sales'), saleController.voidSale);

module.exports = router;
