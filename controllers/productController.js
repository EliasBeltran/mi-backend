const db = require('../config/db');
const { logAudit } = require('../utils/audit');
const { toCents, fromCents, mapMoneyFields } = require('../utils/money');

exports.getAllProducts = async (req, res) => {
    try {
        const [products] = await db.query('SELECT * FROM products ORDER BY created_at DESC');
        const normalized = products.map((product) => mapMoneyFields(product, ['price', 'cost_price']));
        res.json(normalized);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.createProduct = async (req, res) => {
    const { name, description, price, stock } = req.body;
    const priceCents = toCents(price);
    try {
        const [result] = await db.query(
            'INSERT INTO products (name, description, price, stock) VALUES (?, ?, ?, ?)',
            [name, description, priceCents, stock]
        );

        // Create notification
        try {
            await db.query(
                "INSERT INTO notifications_history (type, title, message, icon, color, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
                ['info', 'Producto Creado', `Se ha creado el producto: ${name}`, 'Package', 'blue']
            );
        } catch (e) { console.error(e); }

        await logAudit(req, {
            action: 'CREATE_PRODUCT',
            module: 'products',
            details: { id: result.lastID, name, price: fromCents(priceCents), stock }
        });

        res.status(201).json({ id: result.lastID, name, description, price: fromCents(priceCents), stock });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateProduct = async (req, res) => {
    const { id } = req.params;
    const { name, description, price, stock } = req.body;
    const priceCents = toCents(price);
    try {
        await db.query(
            'UPDATE products SET name = ?, description = ?, price = ?, stock = ? WHERE id = ?',
            [name, description, priceCents, stock, id]
        );

        // Create notification
        try {
            await db.query(
                "INSERT INTO notifications_history (type, title, message, icon, color, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
                ['info', 'Producto Actualizado', `Se ha actualizado el producto: ${name}`, 'Edit', 'blue']
            );
        } catch (e) { console.error(e); }

        await logAudit(req, {
            action: 'UPDATE_PRODUCT',
            module: 'products',
            details: { id: Number(id), name, price: fromCents(priceCents), stock }
        });

        res.json({ message: 'Product updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteProduct = async (req, res) => {
    const { id } = req.params;
    try {
        // Get product name before deleting for notification
        const [product] = await db.query('SELECT name FROM products WHERE id = ?', [id]);

        await db.query('DELETE FROM products WHERE id = ?', [id]);

        if (product && product.length > 0) {
            try {
                await db.query(
                    "INSERT INTO notifications_history (type, title, message, icon, color, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
                    ['warning', 'Producto Eliminado', `Se ha eliminado el producto: ${product[0].name}`, 'Trash2', 'red']
                );
            } catch (e) { console.error(e); }
        }

        await logAudit(req, {
            action: 'DELETE_PRODUCT',
            module: 'products',
            details: { id: Number(id), name: product && product.length > 0 ? product[0].name : null }
        });

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
