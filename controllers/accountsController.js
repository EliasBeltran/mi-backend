const db = require('../config/db');
const { toCents, fromCents, mapMoneyFields } = require('../utils/money');
const { logAudit } = require('../utils/audit');

// Receivables
exports.getAllReceivables = async (req, res) => {
    try {
        const [receivables] = await db.query(`
      SELECT * FROM accounts_receivable 
      ORDER BY due_date ASC
    `);
        const normalized = receivables.map((acc) => mapMoneyFields(acc, ['amount', 'paid_amount']));
        res.json(normalized);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.createReceivable = async (req, res) => {
    const { sale_id, customer_name, amount, due_date } = req.body;
    const amountCents = toCents(amount);
    try {
        const [result] = await db.query(
            'INSERT INTO accounts_receivable (sale_id, customer_name, amount, due_date) VALUES (?, ?, ?, ?)',
            [sale_id, customer_name, amountCents, due_date]
        );

        // Create notification
        await db.query(
            "INSERT INTO notifications_history (type, title, message, icon, color, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
            ['info', 'Nueva Cuenta por Cobrar', `Cliente: ${customer_name} - Monto: Bs ${fromCents(amountCents).toFixed(2)}`, 'TrendingUp', 'blue']
        );

        await logAudit(req, {
            action: 'CREATE_RECEIVABLE',
            module: 'accounts',
            details: { id: result.lastID, customer_name, amount: fromCents(amountCents), due_date }
        });

        res.status(201).json({ message: 'Cuenta por cobrar creada', id: result.lastID });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.recordReceivablePayment = async (req, res) => {
    const { id } = req.params;
    const { amount } = req.body;
    const amountCents = toCents(amount);

    try {
        const [account] = await db.query('SELECT * FROM accounts_receivable WHERE id = ?', [id]);

        if (!account || account.length === 0) {
            return res.status(404).json({ message: 'Account not found' });
        }

        const newPaidAmount = account[0].paid_amount + amountCents;
        const totalAmount = account[0].amount;

        let status = 'pending';
        if (newPaidAmount >= totalAmount) {
            status = 'paid';
        } else if (newPaidAmount > 0) {
            status = 'partial';
        }

        await db.query(
            'UPDATE accounts_receivable SET paid_amount = ?, status = ? WHERE id = ?',
            [newPaidAmount, status, id]
        );

        await db.query(
            'INSERT INTO account_payments (account_type, account_id, amount) VALUES (?, ?, ?)',
            ['receivable', id, amountCents]
        );

        // Create notification
        await db.query(
            "INSERT INTO notifications_history (type, title, message, icon, color, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
            ['success', 'Pago Recibido', `Se registr? un pago de Bs ${fromCents(amountCents).toFixed(2)} de ${account[0].customer_name}`, 'DollarSign', 'green']
        );

        await logAudit(req, {
            action: 'PAY_RECEIVABLE',
            module: 'accounts',
            details: { id: Number(id), amount: fromCents(amountCents), status }
        });

        res.json({ message: 'Pago registrado', newStatus: status });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Payables
exports.getAllPayables = async (req, res) => {
    try {
        const [payables] = await db.query(`
      SELECT * FROM accounts_payable 
      ORDER BY due_date ASC
    `);
        const normalized = payables.map((acc) => mapMoneyFields(acc, ['amount', 'paid_amount']));
        res.json(normalized);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.createPayable = async (req, res) => {
    const { supplier_name, description, amount, due_date } = req.body;
    const amountCents = toCents(amount);
    try {
        const [result] = await db.query(
            'INSERT INTO accounts_payable (supplier_name, description, amount, due_date) VALUES (?, ?, ?, ?)',
            [supplier_name, description, amountCents, due_date]
        );

        // Create notification
        await db.query(
            "INSERT INTO notifications_history (type, title, message, icon, color, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
            ['info', 'Nueva Cuenta por Pagar', `Proveedor: ${supplier_name} - Monto: Bs ${fromCents(amountCents).toFixed(2)}`, 'TrendingDown', 'orange']
        );

        await logAudit(req, {
            action: 'CREATE_PAYABLE',
            module: 'accounts',
            details: { id: result.lastID, supplier_name, amount: fromCents(amountCents), due_date }
        });

        res.status(201).json({ message: 'Cuenta por pagar creada', id: result.lastID });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.recordPayablePayment = async (req, res) => {
    const { id } = req.params;
    const { amount } = req.body;
    const amountCents = toCents(amount);

    try {
        const [account] = await db.query('SELECT * FROM accounts_payable WHERE id = ?', [id]);

        if (!account || account.length === 0) {
            return res.status(404).json({ message: 'Account not found' });
        }

        const newPaidAmount = account[0].paid_amount + amountCents;
        const totalAmount = account[0].amount;

        let status = 'pending';
        if (newPaidAmount >= totalAmount) {
            status = 'paid';
        } else if (newPaidAmount > 0) {
            status = 'partial';
        }

        await db.query(
            'UPDATE accounts_payable SET paid_amount = ?, status = ? WHERE id = ?',
            [newPaidAmount, status, id]
        );

        await db.query(
            'INSERT INTO account_payments (account_type, account_id, amount) VALUES (?, ?, ?)',
            ['payable', id, amountCents]
        );

        // Create notification
        await db.query(
            "INSERT INTO notifications_history (type, title, message, icon, color, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
            ['success', 'Pago Realizado', `Se registr? un pago de Bs ${fromCents(amountCents).toFixed(2)} a ${account[0].supplier_name}`, 'CreditCard', 'green']
        );

        await logAudit(req, {
            action: 'PAY_PAYABLE',
            module: 'accounts',
            details: { id: Number(id), amount: fromCents(amountCents), status }
        });

        res.json({ message: 'Pago registrado', newStatus: status });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Check for due accounts and generate notifications
exports.checkDueAccounts = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Check receivables
        const [receivables] = await db.query(
            "SELECT * FROM accounts_receivable WHERE status != 'paid' AND due_date <= date(?, '+3 days')",
            [today]
        );

        if (receivables) {
            for (const acc of receivables) {
                const type = acc.due_date < today ? 'critical' : 'warning';
                const title = acc.due_date < today ? 'Cuenta Vencida (Cobrar)' : 'Cuenta por Vencer (Cobrar)';
                const message = `Cliente: ${acc.customer_name} - Monto: Bs ${fromCents(acc.amount - acc.paid_amount).toFixed(2)}`;

                const [existing] = await db.query(
                    "SELECT * FROM notifications_history WHERE title = ? AND message = ? AND date(created_at) = date('now')",
                    [title, message]
                );

                if (existing.length === 0) {
                    await db.query(
                        "INSERT INTO notifications_history (type, title, message, icon, color, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
                        [type, title, message, 'DollarSign', type === 'critical' ? 'red' : 'yellow']
                    );
                }
            }
        }

        // Check payables
        const [payables] = await db.query(
            "SELECT * FROM accounts_payable WHERE status != 'paid' AND due_date <= date(?, '+3 days')",
            [today]
        );

        if (payables) {
            for (const acc of payables) {
                const type = acc.due_date < today ? 'critical' : 'warning';
                const title = acc.due_date < today ? 'Cuenta Vencida (Pagar)' : 'Cuenta por Vencer (Pagar)';
                const message = `Proveedor: ${acc.supplier_name} - Monto: Bs ${fromCents(acc.amount - acc.paid_amount).toFixed(2)}`;

                const [existing] = await db.query(
                    "SELECT * FROM notifications_history WHERE title = ? AND message = ? AND date(created_at) = date('now')",
                    [title, message]
                );

                if (existing.length === 0) {
                    await db.query(
                        "INSERT INTO notifications_history (type, title, message, icon, color, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
                        [type, title, message, 'CreditCard', type === 'critical' ? 'red' : 'yellow']
                    );
                }
            }
        }
    } catch (error) {
        console.error('Error checking due accounts:', error);
    }
};
