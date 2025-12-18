const db = require('../config/db');
const { logAudit } = require('../utils/audit');

exports.getAllCategories = async (req, res) => {
    try {
        const [categories] = await db.query('SELECT * FROM categories ORDER BY name ASC');
        res.json(categories);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.createCategory = async (req, res) => {
    const { name, description } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO categories (name, description) VALUES (?, ?)',
            [name, description]
        );
        await logAudit(req, {
            action: 'CREATE_CATEGORY',
            module: 'categories',
            details: { id: result.lastID, name }
        });

        res.status(201).json({ message: 'Category created', id: result.lastID });
    } catch (error) {
        console.error(error);
        if (error.message.includes('UNIQUE')) {
            return res.status(400).json({ message: 'Category name already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    try {
        await db.query(
            'UPDATE categories SET name = ?, description = ? WHERE id = ?',
            [name, description, id]
        );
        await logAudit(req, {
            action: 'UPDATE_CATEGORY',
            module: 'categories',
            details: { id: Number(id), name }
        });

        res.json({ message: 'Category updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteCategory = async (req, res) => {
    const { id } = req.params;
    try {
        // Check if category has products
        const [products] = await db.query('SELECT COUNT(*) as count FROM products WHERE category_id = ?', [id]);
        if (products[0].count > 0) {
            return res.status(400).json({ message: 'Cannot delete category with products' });
        }

        await db.query('DELETE FROM categories WHERE id = ?', [id]);

        await logAudit(req, {
            action: 'DELETE_CATEGORY',
            module: 'categories',
            details: { id: Number(id) }
        });

        res.json({ message: 'Category deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
