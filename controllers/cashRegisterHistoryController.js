const db = require('../config/db');

// Save closed cash register session
exports.saveCashRegisterHistory = async (req, res) => {
    const {
        shift_type,
        opening_balance,
        closing_balance,
        expected_balance,
        difference,
        total_sales,
        cash_sales,
        qr_sales,
        credit_sales,
        expenses,
        notes,
        opened_at
    } = req.body;

    const user_id = req.user.id;

    try {
        const result = await db.query(
            `INSERT INTO cash_register_history 
            (user_id, shift_type, opening_balance, closing_balance, expected_balance, 
            difference, total_sales, cash_sales, qr_sales, credit_sales, expenses, notes, opened_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, shift_type, opening_balance, closing_balance, expected_balance,
                difference, total_sales, cash_sales, qr_sales, credit_sales, expenses, notes, opened_at]
        );

        res.json({
            message: 'Arqueo guardado exitosamente',
            id: result.lastID
        });
    } catch (error) {
        console.error('Error saving cash register history:', error);
        res.status(500).json({ message: 'Error al guardar el arqueo' });
    }
};

// Get cash register history with filters
exports.getCashRegisterHistory = async (req, res) => {
    const { start_date, end_date, shift_type, user_id } = req.query;

    try {
        let query = `
            SELECT 
                cr.id,
                cr.user_id,
                cr.opening_amount as opening_balance,
                cr.counted_amount as closing_balance,
                cr.expected_amount as expected_balance,
                cr.difference,
                cr.opening_time as opened_at,
                cr.closing_time as closed_at,
                cr.notes,
                u.username, 
                u.full_name
            FROM cash_registers cr
            LEFT JOIN users u ON cr.user_id = u.id
            WHERE cr.status = 'closed'
        `;
        const params = [];

        if (start_date) {
            query += ` AND DATE(cr.closing_time) >= DATE(?)`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND DATE(cr.closing_time) <= DATE(?)`;
            params.push(end_date);
        }

        if (user_id) {
            query += ` AND cr.user_id = ?`;
            params.push(user_id);
        }

        query += ` ORDER BY cr.closing_time DESC`;

        const [history] = await db.query(query, params);
        res.json(history);
    } catch (error) {
        console.error('Error fetching cash register history:', error);
        res.status(500).json({ message: 'Error al obtener el historial' });
    }
};

// Get single cash register session by ID
exports.getCashRegisterById = async (req, res) => {
    const { id } = req.params;

    try {
        const [sessions] = await db.query(
            `SELECT crh.*, u.username, u.full_name
            FROM cash_register_history crh
            LEFT JOIN users u ON crh.user_id = u.id
            WHERE crh.id = ?`,
            [id]
        );

        if (sessions.length === 0) {
            return res.status(404).json({ message: 'Arqueo no encontrado' });
        }

        res.json(sessions[0]);
    } catch (error) {
        console.error('Error fetching cash register session:', error);
        res.status(500).json({ message: 'Error al obtener el arqueo' });
    }
};

module.exports = exports;
