const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, checkPermission } = require('../middleware/auth');

// All user routes require authentication and 'users' permission
router.get('/', authenticateToken, checkPermission('users'), userController.getAllUsers);
router.post('/', authenticateToken, checkPermission('users'), userController.createUser);
router.put('/:id', authenticateToken, checkPermission('users'), userController.updateUser);
router.delete('/:id', authenticateToken, checkPermission('users'), userController.deleteUser);

module.exports = router;
