const db = require('../config/db');
const { logAudit } = require('../utils/audit');
const bcrypt = require('bcryptjs');

exports.getAllUsers = async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, username, role, full_name, email, permissions, created_at FROM users ORDER BY created_at DESC');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.createUser = async (req, res) => {
    const { username, password, role, full_name, email, permissions } = req.body;
    try {
        // Check if user exists
        const [existing] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const [result] = await db.query(
            'INSERT INTO users (username, password, role, full_name, email, permissions) VALUES (?, ?, ?, ?, ?, ?)',
            [username, hashedPassword, role, full_name, email, permissions || '[]']
        );

        // Create notification
        try {
            await db.query(
                "INSERT INTO notifications_history (type, title, message, icon, color, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
                ['warning', 'Nuevo Usuario', `Se ha registrado el usuario: ${username} (${role})`, 'User', 'purple']
            );
        } catch (e) { console.error(e); }

        await logAudit(req, {
            action: 'CREATE_USER',
            module: 'users',
            details: { id: result.lastID, username, role }
        });

        res.status(201).json({ message: 'User created', id: result.lastID });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { role, full_name, email, permissions } = req.body;
    try {
        await db.query(
            'UPDATE users SET role = ?, full_name = ?, email = ?, permissions = ? WHERE id = ?',
            [role, full_name, email, permissions || '[]', id]
        );
        await logAudit(req, {
            action: 'UPDATE_USER',
            module: 'users',
            details: { id: Number(id), role, full_name, email }
        });

        res.json({ message: 'User updated' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const [user] = await db.query('SELECT username, role FROM users WHERE id = ?', [id]);
        await db.query('DELETE FROM users WHERE id = ?', [id]);

        await logAudit(req, {
            action: 'DELETE_USER',
            module: 'users',
            details: { id: Number(id), username: user && user.length > 0 ? user[0].username : null, role: user && user.length > 0 ? user[0].role : null }
        });

        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
