const db = require('../config/db');
const { toCents, fromCents, mapMoneyFields } = require('../utils/money');
const { logAudit } = require('../utils/audit');

// Open Cash Register
exports.openRegister = async (req, res) => {
    const { user_id, opening_amount, notes } = req.body;
    const openingAmountCents = toCents(opening_amount);

    try {
        // Check if user already has an open register
        const [openRegisters] = await db.query(
            'SELECT * FROM cash_registers WHERE user_id = ? AND status = ?',
            [user_id, 'open']
        );

        if (openRegisters.length > 0) {
            return res.status(400).json({
                message: 'Ya tiene una caja abierta. Debe cerrarla primero.'
            });
        }

        const [result] = await db.query(
            'INSERT INTO cash_registers (user_id, opening_amount, opening_time, notes, status) VALUES (?, ?, datetime("now", "-4 hours"), ?, ?)',
            [user_id, openingAmountCents, notes, 'open']
        );

        try {
            await db.query(
                'INSERT INTO notifications_history (type, title, message, icon, color, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
                ['info', 'Caja Abierta', `Caja #${result.lastID} abierta con Bs ${fromCents(openingAmountCents).toFixed(2)}`, 'Check', 'green']
            );
        } catch (e) { console.error(e); }

        await logAudit(req, {
            action: 'OPEN_CASH_REGISTER',
            module: 'cash_register',
            details: { id: result.lastID, opening_amount: fromCents(openingAmountCents) }
        });

        res.status(201).json({
            message: 'Caja abierta exitosamente',
            id: result.lastID,
            opening_amount: fromCents(openingAmountCents)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

// Get Active Register
exports.getActiveRegister = async (req, res) => {
    const { user_id } = req.params;

    try {
        const [registers] = await db.query(
            'SELECT * FROM cash_registers WHERE user_id = ? AND status = ? ORDER BY opening_time DESC',
            [user_id, 'open']
        );

        if (registers.length === 0) {
            return res.json({ hasActiveRegister: false });
        }

        const register = registers[0];
        const multipleOpen = registers.length > 1;

        // Get all movements for this register
        const [movements] = await db.query(
            'SELECT * FROM cash_movements WHERE cash_register_id = ? ORDER BY created_at ASC',
            [register.id]
        );

        // Calculate totals (in cents)
        const sales = movements.filter(m => m.type === 'sale').reduce((sum, m) => sum + m.amount, 0);
        const income = movements.filter(m => m.type === 'income').reduce((sum, m) => sum + m.amount, 0);
        const expenses = movements.filter(m => m.type === 'expense').reduce((sum, m) => sum + m.amount, 0);
        const expected = register.opening_amount + sales + income - expenses;

        const registerOut = mapMoneyFields(register, ['opening_amount', 'expected_amount', 'counted_amount', 'difference']);
        const movementsOut = movements.map((movement) => mapMoneyFields(movement, ['amount']));

        res.json({
            hasActiveRegister: true,
            multipleOpen,
            openRegistersCount: registers.length,
            register: {
                ...registerOut,
                movements: movementsOut,
                totals: {
                    sales: fromCents(sales),
                    income: fromCents(income),
                    expenses: fromCents(expenses),
                    expected: fromCents(expected)
                }
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

// Register Movement (Income or Expense)
exports.registerMovement = async (req, res) => {
    const { cash_register_id, type, category, amount, description, authorized_by } = req.body;
    const amountCents = toCents(amount);

    try {
        // Verify register is open
        const [registers] = await db.query(
            'SELECT * FROM cash_registers WHERE id = ? AND status = ?',
            [cash_register_id, 'open']
        );

        if (registers.length === 0) {
            return res.status(400).json({ message: 'La caja no está abierta' });
        }

        await db.query(
            'INSERT INTO cash_movements (cash_register_id, type, category, amount, description, authorized_by, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now", "-4 hours"))',
            [cash_register_id, type, category, amountCents, description, authorized_by]
        );

        try {
            const movementTitle = type === 'income' ? 'Ingreso de Caja' : 'Egreso de Caja';
            const movementIcon = type === 'income' ? 'ArrowUp' : 'ArrowDown';
            const movementColor = type === 'income' ? 'green' : 'red';
            await db.query(
                'INSERT INTO notifications_history (type, title, message, icon, color, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
                ['info', movementTitle, `${movementTitle} por Bs ${fromCents(amountCents).toFixed(2)} (${category || 'Sin categoría'})`, movementIcon, movementColor]
            );
        } catch (e) { console.error(e); }

        await logAudit(req, {
            action: 'REGISTER_CASH_MOVEMENT',
            module: 'cash_register',
            details: { cash_register_id: cash_register_id, type, category, amount: fromCents(amountCents) }
        });

        res.status(201).json({ message: 'Movimiento registrado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

// Close Register
exports.closeRegister = async (req, res) => {
    const { register_id, denominations, closing_notes } = req.body;

    try {
        // Get register
        const [registers] = await db.query(
            'SELECT * FROM cash_registers WHERE id = ? AND status = ?',
            [register_id, 'open']
        );

        if (registers.length === 0) {
            return res.status(400).json({ message: 'Caja no encontrada o ya cerrada' });
        }

        const register = registers[0];

        const normalizedDenoms = (denominations || []).map((denom) => {
            const valueCents = toCents(denom.value);
            const quantity = Number(denom.quantity) || 0;
            const totalCents = valueCents * quantity;
            return {
                ...denom,
                valueCents,
                totalCents,
                quantity
            };
        });

        // Calculate counted amount from denominations
        const counted_amount = normalizedDenoms.reduce((sum, d) => sum + d.totalCents, 0);

        // Get all movements
        const [movements] = await db.query(
            'SELECT * FROM cash_movements WHERE cash_register_id = ?',
            [register_id]
        );

        const sales = movements.filter(m => m.type === 'sale').reduce((sum, m) => sum + m.amount, 0);
        const income = movements.filter(m => m.type === 'income').reduce((sum, m) => sum + m.amount, 0);
        const expenses = movements.filter(m => m.type === 'expense').reduce((sum, m) => sum + m.amount, 0);
        const expected_amount = register.opening_amount + sales + income - expenses;
        const difference = counted_amount - expected_amount;

        // Update register
        await db.query(
            'UPDATE cash_registers SET status = ?, closing_time = datetime("now", "-4 hours"), expected_amount = ?, counted_amount = ?, difference = ?, closing_notes = ?, is_locked = 1 WHERE id = ?',
            ['closed', expected_amount, counted_amount, difference, closing_notes, register_id]
        );

        try {
            await db.query(
                'INSERT INTO notifications_history (type, title, message, icon, color, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
                ['info', 'Caja Cerrada', `Caja #${register_id} cerrada. Diferencia: Bs ${fromCents(difference).toFixed(2)}`, 'Lock', 'purple']
            );
        } catch (e) { console.error(e); }

        // Save denominations
        for (const denom of normalizedDenoms) {
            await db.query(
                'INSERT INTO cash_denominations (cash_register_id, denomination_type, value, quantity, total) VALUES (?, ?, ?, ?, ?)',
                [register_id, denom.type, denom.valueCents, denom.quantity, denom.totalCents]
            );
        }

        await logAudit(req, {
            action: 'CLOSE_CASH_REGISTER',
            module: 'cash_register',
            details: { id: Number(register_id), expected_amount: fromCents(expected_amount), counted_amount: fromCents(counted_amount), difference: fromCents(difference) }
        });

        res.json({
            message: 'Caja cerrada exitosamente',
            expected_amount: fromCents(expected_amount),
            counted_amount: fromCents(counted_amount),
            difference: fromCents(difference)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

// Get Register Details (for PDF)
exports.getRegisterDetails = async (req, res) => {
    const { id } = req.params;

    try {
        const [registers] = await db.query(
            'SELECT cr.*, u.username, u.full_name FROM cash_registers cr LEFT JOIN users u ON cr.user_id = u.id WHERE cr.id = ?',
            [id]
        );

        if (registers.length === 0) {
            return res.status(404).json({ message: 'Registro no encontrado' });
        }

        const register = registers[0];

        // Get movements
        const [movements] = await db.query(
            'SELECT * FROM cash_movements WHERE cash_register_id = ? ORDER BY created_at ASC',
            [id]
        );

        // Get denominations
        const [denominations] = await db.query(
            'SELECT * FROM cash_denominations WHERE cash_register_id = ?',
            [id]
        );

        const registerOut = mapMoneyFields(register, ['opening_amount', 'expected_amount', 'counted_amount', 'difference']);
        const movementsOut = movements.map((movement) => mapMoneyFields(movement, ['amount']));
        const denominationsOut = denominations.map((denom) => mapMoneyFields(denom, ['value', 'total']));

        res.json({
            register: registerOut,
            movements: movementsOut,
            denominations: denominationsOut
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

// Get All Registers (History)
exports.getAllRegisters = async (req, res) => {
    try {
        const [registers] = await db.query(`
      SELECT cr.*, u.username, u.full_name 
      FROM cash_registers cr 
      LEFT JOIN users u ON cr.user_id = u.id 
      ORDER BY cr.opening_time DESC 
      LIMIT 50
    `);

        const normalized = registers.map((register) => mapMoneyFields(register, ['opening_amount', 'expected_amount', 'counted_amount', 'difference']));
        res.json(normalized);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};
