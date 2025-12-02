const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.get('/dashboard', authenticateToken, reportController.getDashboardStats);
router.get('/detailed', authenticateToken, reportController.getDetailedReport);

module.exports = router;
