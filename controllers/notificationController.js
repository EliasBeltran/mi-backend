const db = require('../config/db');

const accountsController = require('./accountsController');

// Get notifications history
exports.getHistory = async (req, res) => {
    try {
        // Check for due accounts first (non-blocking)
        try {
            if (accountsController && typeof accountsController.checkDueAccounts === 'function') {
                await accountsController.checkDueAccounts();
            }
        } catch (checkError) {
            console.error('Error checking due accounts:', checkError);
        }

        const { limit = 100, offset = 0, filter = 'all' } = req.query;

        let query = 'SELECT * FROM notifications_history';
        const params = [];

        if (filter === 'unread') {
            query += ' WHERE is_read = 0';
        } else if (filter === 'read') {
            query += ' WHERE is_read = 1';
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [notifications] = await db.query(query, params);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(
            'UPDATE notifications_history SET is_read = 1 WHERE id = ?',
            [id]
        );
        res.json({ message: 'Notificación marcada como leída' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Mark all as read
exports.markAllAsRead = async (req, res) => {
    try {
        const [result] = await db.query(
            'UPDATE notifications_history SET is_read = 1 WHERE is_read = 0',
            []
        );
        res.json({ message: 'Todas las notificaciones marcadas como leídas', updated: result.changes });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create notification
exports.createNotification = async (req, res) => {
    try {
        const { type, title, message, icon, color, action, user_id } = req.body;

        const [result] = await db.query(
            'INSERT INTO notifications_history (type, title, message, icon, color, action, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [type, title, message, icon, color, action, user_id]
        );
        res.json({ id: result.lastID, message: 'Notificación creada' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT COUNT(*) as count FROM notifications_history WHERE is_read = 0',
            []
        );
        res.json({ count: rows[0].count });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete old notifications (older than 30 days)
exports.cleanOldNotifications = async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [result] = await db.query(
            'DELETE FROM notifications_history WHERE created_at < ? AND is_read = 1',
            [thirtyDaysAgo.toISOString()]
        );
        res.json({ message: 'Notificaciones antiguas eliminadas', deleted: result.changes });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = exports;
