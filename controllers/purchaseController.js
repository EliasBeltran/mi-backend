const db = require('../config/db');

// Función para calcular similitud entre strings (Levenshtein simplificado)
function calculateSimilarity(str1, str2) {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    // Si uno contiene al otro, alta similitud
    if (s1.includes(s2) || s2.includes(s1)) {
        return 0.85;
    }

    // Calcular distancia de Levenshtein
    const matrix = [];
    for (let i = 0; i <= s1.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= s2.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= s1.length; i++) {
        for (let j = 1; j <= s2.length; j++) {
            if (s1[i - 1] === s2[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    const distance = matrix[s1.length][s2.length];
    const maxLength = Math.max(s1.length, s2.length);
    const similarity = 1 - (distance / maxLength);

    return similarity;
}

// Buscar productos similares
exports.searchSimilarProducts = async (req, res) => {
    const { searchTerm } = req.query;

    if (!searchTerm || searchTerm.trim().length < 2) {
        return res.json([]);
    }

    try {
        const [products] = await db.query('SELECT * FROM products');

        // Calcular similitud para cada producto
        const productsWithSimilarity = products.map(product => ({
            ...product,
            similarity: calculateSimilarity(searchTerm, product.name)
        }));

        // Filtrar y ordenar por similitud
        const similarProducts = productsWithSimilarity
            .filter(p => p.similarity > 0.3) // Umbral de similitud
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 5); // Top 5 resultados

        res.json(similarProducts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al buscar productos' });
    }
};

// Crear compra
exports.createPurchase = async (req, res) => {
    const {
        product_id,
        product_name,
        supplier_name,
        quantity,
        cost_price,
        profit_margin,
        category_id,
        is_new_product,
        payment_method,
        due_date,
        user_id
    } = req.body;

    if (!product_name || !supplier_name || !quantity || !cost_price || profit_margin === undefined) {
        return res.status(400).json({ message: 'Faltan datos requeridos' });
    }

    if (payment_method === 'credit' && !due_date) {
        return res.status(400).json({ message: 'Fecha de vencimiento requerida para compras a crédito' });
    }

    try {
        // Calcular precio de venta
        const selling_price = cost_price + (cost_price * profit_margin / 100);
        const total_cost = cost_price * quantity;

        let finalProductId = product_id;

        // Si es producto nuevo, crearlo
        if (is_new_product) {
            const [result] = await db.query(
                'INSERT INTO products (name, price, cost_price, profit_margin, stock, category_id, last_purchase_date) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                [product_name, selling_price, cost_price, profit_margin, quantity, category_id]
            );
            finalProductId = result.lastID;
        } else {
            // Actualizar producto existente
            await db.query(
                'UPDATE products SET stock = stock + ?, cost_price = ?, price = ?, profit_margin = ?, last_purchase_date = CURRENT_TIMESTAMP WHERE id = ?',
                [quantity, cost_price, selling_price, profit_margin, finalProductId]
            );
        }

        // Registrar la compra
        const [purchaseResult] = await db.query(
            'INSERT INTO purchases (product_id, product_name, supplier_name, quantity, cost_price, selling_price, profit_margin, total_cost, is_new_product, category_id, user_id, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [finalProductId, product_name, supplier_name, quantity, cost_price, selling_price, profit_margin, total_cost, is_new_product ? 1 : 0, category_id, user_id, payment_method || 'cash']
        );

        // Si es compra a crédito, crear cuenta por pagar
        if (payment_method === 'credit') {
            await db.query(
                'INSERT INTO accounts_payable (supplier_name, description, amount, due_date, paid_amount, status) VALUES (?, ?, ?, ?, ?, ?)',
                [supplier_name, `Compra de ${quantity} ${product_name}`, total_cost, due_date, 0, 'pending']
            );
        }

        // Audit log (non-blocking)
        try {
            await db.query(
                'INSERT INTO audit_logs (user_id, action, module, details, ip_address) VALUES (?, ?, ?, ?, ?)',
                [user_id, 'CREATE_PURCHASE', 'purchases', JSON.stringify({ product_name, quantity, total_cost, payment_method }), 'system']
            );

            // Create notification for the purchase
            await db.query(
                'INSERT INTO notifications_history (type, title, message, icon, color, action, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['info', 'Nueva Compra', `Compra de ${quantity} ${product_name} por Bs ${total_cost.toFixed(2)}`, 'ShoppingBag', 'blue', 'Ver inventario', user_id]
            );
        } catch (auditError) {
            console.error('Audit/Notification error:', auditError.message);
        }

        res.status(201).json({
            message: is_new_product ? 'Producto creado y compra registrada' : 'Compra registrada exitosamente',
            purchase_id: purchaseResult.lastID,
            product_id: finalProductId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al registrar compra: ' + error.message });
    }
};

// Obtener todas las compras
exports.getAllPurchases = async (req, res) => {
    try {
        const [purchases] = await db.query(`
            SELECT p.*, u.username, c.name as category_name
            FROM purchases p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN categories c ON p.category_id = c.id
            ORDER BY p.created_at DESC
            LIMIT 100
        `);
        res.json(purchases);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener compras' });
    }
};

// Obtener estadísticas de compras
exports.getPurchaseStats = async (req, res) => {
    try {
        const [totalInvested] = await db.query('SELECT SUM(total_cost) as total FROM purchases');
        const [totalPurchases] = await db.query('SELECT COUNT(*) as count FROM purchases');
        const [topProducts] = await db.query(`
            SELECT product_name, SUM(quantity) as total_quantity, SUM(total_cost) as total_invested
            FROM purchases
            GROUP BY product_name
            ORDER BY total_quantity DESC
            LIMIT 5
        `);

        res.json({
            total_invested: totalInvested[0].total || 0,
            total_purchases: totalPurchases[0].count || 0,
            top_products: topProducts
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener estadísticas' });
    }
};
