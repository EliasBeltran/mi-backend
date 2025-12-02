const db = require('../config/db');

exports.createLog = async (req, res) => {
    const { user_id, action, module, record_id, details, ip_address } = req.body;

    try {
        await db.query(
            'INSERT INTO audit_logs (user_id, action, module, record_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
            [user_id, action, module, record_id, details, ip_address]
        );
        res.status(201).json({ message: 'Log created' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getAllLogs = async (req, res) => {
    try {
        const [logs] = await db.query(`
      SELECT al.*, u.username 
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 500
    `);
        res.json(logs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getLogsByUser = async (req, res) => {
    const { userId } = req.params;
    try {
        const [logs] = await db.query(`
      SELECT al.*, u.username 
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.user_id = ?
      ORDER BY al.created_at DESC
      LIMIT 100
    `, [userId]);
        res.json(logs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
