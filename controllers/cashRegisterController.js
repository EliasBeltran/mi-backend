const db = require('../config/db');

// Open Cash Register
exports.openRegister = async (req, res) => {
    const { user_id, opening_amount, notes } = req.body;

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
            [user_id, opening_amount, notes, 'open']
        );

        res.status(201).json({
            message: 'Caja abierta exitosamente',
            id: result.lastID,
            opening_amount
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
            'SELECT * FROM cash_registers WHERE user_id = ? AND status = ? ORDER BY opening_time DESC LIMIT 1',
            [user_id, 'open']
        );

        if (registers.length === 0) {
            return res.json({ hasActiveRegister: false });
        }

        const register = registers[0];

        // Get all movements for this register
        const [movements] = await db.query(
            'SELECT * FROM cash_movements WHERE cash_register_id = ? ORDER BY created_at ASC',
            [register.id]
        );

        // Calculate totals
        const sales = movements.filter(m => m.type === 'sale').reduce((sum, m) => sum + m.amount, 0);
        const income = movements.filter(m => m.type === 'income').reduce((sum, m) => sum + m.amount, 0);
        const expenses = movements.filter(m => m.type === 'expense').reduce((sum, m) => sum + m.amount, 0);
        const expected = register.opening_amount + sales + income - expenses;

        res.json({
            hasActiveRegister: true,
            register: {
                ...register,
                movements,
                totals: {
                    sales,
                    income,
                    expenses,
                    expected
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
            [cash_register_id, type, category, amount, description, authorized_by]
        );

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

        // Calculate counted amount from denominations
        const counted_amount = denominations.reduce((sum, d) => sum + d.total, 0);

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

        // Save denominations
        for (const denom of denominations) {
            await db.query(
                'INSERT INTO cash_denominations (cash_register_id, denomination_type, value, quantity, total) VALUES (?, ?, ?, ?, ?)',
                [register_id, denom.type, denom.value, denom.quantity, denom.total]
            );
        }

        res.json({
            message: 'Caja cerrada exitosamente',
            expected_amount,
            counted_amount,
            difference
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

        res.json({
            register,
            movements,
            denominations
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

        res.json(registers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};
