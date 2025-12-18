const db = require('../config/db');
const { toCents, fromCents, mapMoneyFields } = require('../utils/money');

exports.createCashCount = async (req, res) => {
    const { user_id, type, denominations, description } = req.body;

    if (!['open', 'close', 'withdrawal', 'deposit'].includes(type)) {
        return res.status(400).json({ message: 'Invalid cash count type' });
    }

    try {
        // Calculate actual amount from denominations
        let actual_amount = 0;
        if (denominations && denominations.length > 0) {
            actual_amount = denominations.reduce((sum, d) => sum + toCents(d.total), 0);
        }

        // Get expected amount (from sales if closing)
        let expected_amount = 0;
        if (type === 'close') {
            const [salesData] = await db.query(`
        SELECT COALESCE(SUM(total), 0) as total_sales
        FROM sales
        WHERE DATE(created_at) = DATE('now')
        AND payment_method = 'cash'
      `);
            expected_amount = salesData[0]?.total_sales || 0;
        }

        const difference = actual_amount - expected_amount;

        // Create cash count
        const [result] = await db.query(
            'INSERT INTO cash_counts (user_id, type, expected_amount, actual_amount, difference, description) VALUES (?, ?, ?, ?, ?, ?)',
            [user_id, type, expected_amount, actual_amount, difference, description]
        );

        const cashCountId = result.lastID;

        // Save denominations
        if (denominations && denominations.length > 0) {
            for (const denom of denominations) {
                await db.query(
                    'INSERT INTO cash_denominations (cash_count_id, type, denomination, quantity, total) VALUES (?, ?, ?, ?, ?)',
                    [cashCountId, denom.type, denom.denomination, denom.quantity, toCents(denom.total)]
                );
            }
        }

        // Create notification
        try {
            let notifTitle = 'Arqueo de Caja';
            let notifIcon = 'DollarSign';
            let notifColor = 'blue';

            if (type === 'open') { notifTitle = 'Apertura de Caja'; notifIcon = 'Check'; notifColor = 'green'; }
            else if (type === 'close') { notifTitle = 'Cierre de Caja'; notifIcon = 'Lock'; notifColor = 'purple'; }
            else if (type === 'withdrawal') { notifTitle = 'Retiro de Caja'; notifIcon = 'ArrowDown'; notifColor = 'orange'; }
            else if (type === 'deposit') { notifTitle = 'Depósito en Caja'; notifIcon = 'ArrowUp'; notifColor = 'blue'; }

            await db.query(
                'INSERT INTO notifications_history (type, title, message, icon, color, action, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['info', notifTitle, `${notifTitle} registrada por Bs ${fromCents(actual_amount).toFixed(2)}`, notifIcon, notifColor, 'Ver historial', user_id]
            );
        } catch (notifError) {
            console.error('Notification error:', notifError.message);
        }

        res.status(201).json({
            message: 'Arqueo registrado',
            id: cashCountId,
            expected_amount: fromCents(expected_amount),
            actual_amount: fromCents(actual_amount),
            difference: fromCents(difference)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getCashCounts = async (req, res) => {
    try {
        const [counts] = await db.query(`
      SELECT c.*, u.username 
      FROM cash_counts c 
      LEFT JOIN users u ON c.user_id = u.id 
      ORDER BY c.created_at DESC
    `);
        const normalized = counts.map((count) => mapMoneyFields(count, ['expected_amount', 'actual_amount', 'difference']));
        res.json(normalized);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getCashCountDetails = async (req, res) => {
    const { id } = req.params;
    try {
        const [count] = await db.query('SELECT * FROM cash_counts WHERE id = ?', [id]);

        if (!count || count.length === 0) {
            return res.status(404).json({ message: 'Cash count not found' });
        }

        const [denominations] = await db.query(
            'SELECT * FROM cash_denominations WHERE cash_count_id = ? ORDER BY type, denomination DESC',
            [id]
        );

        const countOut = mapMoneyFields(count[0], ['expected_amount', 'actual_amount', 'difference']);
        const denomsOut = denominations.map((denom) => mapMoneyFields(denom, ['total']));

        res.json({ ...countOut, denominations: denomsOut });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getRegisterStatus = async (req, res) => {
    try {
        const [lastOpen] = await db.query(`
      SELECT * FROM cash_counts 
      WHERE type = 'open' 
      ORDER BY created_at DESC 
      LIMIT 1
    `);

        const [lastClose] = await db.query(`
      SELECT * FROM cash_counts 
      WHERE type = 'close' 
      ORDER BY created_at DESC 
      LIMIT 1
    `);

        if (!lastOpen || lastOpen.length === 0) {
            return res.json({ status: 'closed', message: 'Caja cerrada' });
        }

        if (!lastClose || lastClose.length === 0) {
            return res.json({ status: 'open', message: 'Caja abierta', openedAt: lastOpen[0].created_at });
        }

        const openDate = new Date(lastOpen[0].created_at);
        const closeDate = new Date(lastClose[0].created_at);

        if (openDate > closeDate) {
            return res.json({ status: 'open', message: 'Caja abierta', openedAt: lastOpen[0].created_at });
        } else {
            return res.json({ status: 'closed', message: 'Caja cerrada' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
