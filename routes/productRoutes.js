const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken, checkPermission } = require('../middleware/auth');

// All product routes require authentication and 'inventory' permission
router.get('/', authenticateToken, checkPermission('inventory'), productController.getAllProducts);
router.post('/', authenticateToken, checkPermission('inventory'), productController.createProduct);
router.put('/:id', authenticateToken, checkPermission('inventory'), productController.updateProduct);
router.delete('/:id', authenticateToken, checkPermission('inventory'), productController.deleteProduct);

module.exports = router;
