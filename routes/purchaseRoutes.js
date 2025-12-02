const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const { authenticateToken, checkPermission } = require('../middleware/auth');

// All purchase routes require authentication and 'purchases' permission
router.get('/search', authenticateToken, checkPermission('purchases'), purchaseController.searchSimilarProducts);
router.post('/', authenticateToken, checkPermission('purchases'), purchaseController.createPurchase);
router.get('/', authenticateToken, checkPermission('purchases'), purchaseController.getAllPurchases);
router.get('/stats', authenticateToken, checkPermission('purchases'), purchaseController.getPurchaseStats);

module.exports = router;
