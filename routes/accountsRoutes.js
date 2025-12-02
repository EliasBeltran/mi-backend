const express = require('express');
const router = express.Router();
const accountsController = require('../controllers/accountsController');
const { authenticateToken, checkPermission } = require('../middleware/auth');

// All accounts routes require authentication and 'accounts' permission
// Receivables
router.get('/receivable', authenticateToken, checkPermission('accounts'), accountsController.getAllReceivables);
router.post('/receivable', authenticateToken, checkPermission('accounts'), accountsController.createReceivable);
router.post('/receivable/:id/payment', authenticateToken, checkPermission('accounts'), accountsController.recordReceivablePayment);

// Payables
router.get('/payable', authenticateToken, checkPermission('accounts'), accountsController.getAllPayables);
router.post('/payable', authenticateToken, checkPermission('accounts'), accountsController.createPayable);
router.post('/payable/:id/payment', authenticateToken, checkPermission('accounts'), accountsController.recordPayablePayment);

module.exports = router;
