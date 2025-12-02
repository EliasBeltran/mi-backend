const express = require('express');
const router = express.Router();
const cashRegisterController = require('../controllers/cashRegisterController');
const { authenticateToken, checkPermission } = require('../middleware/auth');

// All cash register routes require authentication and 'cash_register' permission
router.post('/open', authenticateToken, checkPermission('cash_register'), cashRegisterController.openRegister);
router.get('/active/:user_id', authenticateToken, checkPermission('cash_register'), cashRegisterController.getActiveRegister);
router.post('/movement', authenticateToken, checkPermission('cash_register'), cashRegisterController.registerMovement);
router.post('/close', authenticateToken, checkPermission('cash_register'), cashRegisterController.closeRegister);
router.get('/:id', authenticateToken, checkPermission('cash_register'), cashRegisterController.getRegisterDetails);
router.get('/', authenticateToken, checkPermission('cash_register'), cashRegisterController.getAllRegisters);

module.exports = router;
