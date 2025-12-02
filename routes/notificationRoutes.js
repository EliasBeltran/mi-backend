const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

// All routes are protected
router.use(authenticateToken);

router.get('/history', notificationController.getHistory);
router.get('/unread-count', notificationController.getUnreadCount);
router.post('/mark-read/:id', notificationController.markAsRead);
router.post('/mark-all-read', notificationController.markAllAsRead);
router.post('/create', notificationController.createNotification);
router.delete('/clean-old', notificationController.cleanOldNotifications);

module.exports = router;
