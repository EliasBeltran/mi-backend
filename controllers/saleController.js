const db = require('../config/db');

exports.createSale = async (req, res) => {
    const { user_id, items, payment_method, qr_reference, customer_name, customer_ci, customer_phone, credit_due_date, is_paid } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'No items in sale' });
    }

    try {
        // Check stock availability
        for (const item of items) {
            const [product] = await db.query('SELECT stock FROM products WHERE id = ?', [item.product_id]);

            if (!product || product.length === 0) {
                return res.status(404).json({ message: `Product ${item.product_id} not found` });
            }

            if (product[0].stock < item.quantity) {
                const [productInfo] = await db.query('SELECT name FROM products WHERE id = ?', [item.product_id]);
                return res.status(400).json({
                    message: `Stock insuficiente para ${productInfo[0].name}. Disponible: ${product[0].stock}, Solicitado: ${item.quantity}`
                });
            }
        }

        const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const [result] = await db.query(
            'INSERT INTO sales (user_id, total, payment_method, qr_reference, customer_name, customer_ci, customer_phone, credit_due_date, is_paid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [user_id, total, payment_method || 'cash', qr_reference, customer_name, customer_ci, customer_phone, credit_due_date, is_paid !== false]
        );

        const saleId = result.lastID;

        // Link ALL sales to active cash register (cash, QR, credit)
        const [activeRegister] = await db.query(
            'SELECT id FROM cash_registers WHERE user_id = ? AND status = ? ORDER BY opening_time DESC LIMIT 1',
            [user_id, 'open']
        );

        if (activeRegister.length > 0) {
            const description = payment_method === 'credit'
                ? `Venta a Crédito #${saleId} - ${customer_name || 'Cliente'}`
                : payment_method === 'qr'
                    ? `Venta QR #${saleId}`
                    : `Venta en Efectivo #${saleId}`;

            await db.query(
                'INSERT INTO cash_movements (cash_register_id, type, category, amount, description, reference_id) VALUES (?, ?, ?, ?, ?, ?)',
                [activeRegister[0].id, 'sale', payment_method, total, description, saleId]
            );
        }

        // Insert sale items and update stock
        for (const item of items) {
            await db.query(
                'INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                [saleId, item.product_id, item.quantity, item.price]
            );

            // Decrease stock
            await db.query(
                'UPDATE products SET stock = stock - ? WHERE id = ?',
                [item.quantity, item.product_id]
            );

            // Check for low stock and create notification if needed
            const [updatedProduct] = await db.query('SELECT name, stock, min_stock FROM products WHERE id = ?', [item.product_id]);
            if (updatedProduct && updatedProduct.length > 0) {
                const prod = updatedProduct[0];
                const minStock = prod.min_stock || 5; // Default to 5 if not set

                if (prod.stock <= minStock) {
                    const type = prod.stock === 0 ? 'critical' : 'warning';
                    const title = prod.stock === 0 ? 'Stock Agotado' : 'Stock Bajo';
                    const message = prod.stock === 0
                        ? `El producto ${prod.name} se ha agotado.`
                        : `El producto ${prod.name} tiene stock bajo (${prod.stock} unidades).`;
                    const color = prod.stock === 0 ? 'red' : 'yellow';
                    const icon = prod.stock === 0 ? 'AlertCircle' : 'TrendingDown';

                    // Check if similar notification exists for today to avoid spam
                    const [existing] = await db.query(
                        "SELECT id FROM notifications_history WHERE title = ? AND message = ? AND date(created_at) = date('now')",
                        [title, message]
                    );

                    if (!existing || existing.length === 0) {
                        await db.query(
                            'INSERT INTO notifications_history (type, title, message, icon, color, action, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [type, title, message, icon, color, 'Ver inventario', user_id]
                        );
                    }
                }
            }
        }

        // If credit sale, create accounts receivable entry
        if (payment_method === 'credit') {
            await db.query(
                'INSERT INTO accounts_receivable (sale_id, customer_name, amount, due_date, paid_amount, status) VALUES (?, ?, ?, ?, ?, ?)',
                [saleId, customer_name || 'Cliente', total, credit_due_date, 0, 'pending']
            );
        }

        // Create audit log (non-blocking)
        try {
            await db.query(
                'INSERT INTO audit_logs (user_id, action, module, details, ip_address) VALUES (?, ?, ?, ?, ?)',
                [user_id, 'CREATE_SALE', 'sales', JSON.stringify({ sale_id: saleId, total, items: items.length, payment_method }), 'system']
            );

            // Create notification for the sale
            await db.query(
                'INSERT INTO notifications_history (type, title, message, icon, color, action, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['success', 'Nueva Venta', `Venta #${saleId} por Bs ${total.toFixed(2)} - ${customer_name || 'Cliente General'}`, 'ShoppingCart', 'green', 'Ver detalles', user_id]
            );
        } catch (auditError) {
            console.error('Audit/Notification error (non-blocking):', auditError.message);
        }

        res.status(201).json({
            message: 'Venta registrada exitosamente',
            id: saleId,
            total: total
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getAllSales = async (req, res) => {
    try {
        const [sales] = await db.query(`
      SELECT s.*, u.username 
      FROM sales s 
      LEFT JOIN users u ON s.user_id = u.id 
      ORDER BY s.created_at DESC
      LIMIT 100
    `);
        res.json(sales);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getSaleDetails = async (req, res) => {
    const { id } = req.params;
    try {
        const [sale] = await db.query(`
      SELECT s.*, u.username 
      FROM sales s 
      LEFT JOIN users u ON s.user_id = u.id 
      WHERE s.id = ?
    `, [id]);

        if (!sale || sale.length === 0) {
            return res.status(404).json({ message: 'Sale not found' });
        }

        const [items] = await db.query(`
      SELECT si.*, p.name as product_name 
      FROM sale_items si 
      LEFT JOIN products p ON si.product_id = p.id 
      WHERE si.sale_id = ?
    `, [id]);

        res.json({ ...sale[0], items });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.voidSale = async (req, res) => {
    const { id } = req.params;
    try {
        // Get sale items to restore stock
        const [items] = await db.query('SELECT product_id, quantity FROM sale_items WHERE sale_id = ?', [id]);

        if (!items || items.length === 0) {
            return res.status(404).json({ message: 'Sale not found' });
        }

        // Restore stock for each item
        for (const item of items) {
            await db.query(
                'UPDATE products SET stock = stock + ? WHERE id = ?',
                [item.quantity, item.product_id]
            );
        }

        // Delete sale items
        await db.query('DELETE FROM sale_items WHERE sale_id = ?', [id]);

        // Delete sale
        await db.query('DELETE FROM sales WHERE id = ?', [id]);

        res.json({ message: 'Venta anulada y stock restaurado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
