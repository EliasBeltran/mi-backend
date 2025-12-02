const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticateToken, checkPermission } = require('../middleware/auth');

// All category routes require authentication and 'inventory' permission
router.get('/', authenticateToken, checkPermission('inventory'), categoryController.getAllCategories);
router.post('/', authenticateToken, checkPermission('inventory'), categoryController.createCategory);
router.put('/:id', authenticateToken, checkPermission('inventory'), categoryController.updateCategory);
router.delete('/:id', authenticateToken, checkPermission('inventory'), categoryController.deleteCategory);

module.exports = router;
