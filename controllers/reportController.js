const db = require('../config/db');
const { fromCents, mapMoneyFields } = require('../utils/money');

exports.getDashboardStats = async (req, res) => {
    try {
        // Total Sales
        const [totalSalesResult] = await db.query('SELECT COALESCE(SUM(total), 0) as total FROM sales');
        const totalSalesCents = totalSalesResult[0].total || 0;

        // Total Orders / Transactions
        const [totalOrdersResult] = await db.query('SELECT COUNT(*) as count FROM sales');
        const totalOrders = totalOrdersResult[0].count || 0;

        // Total Products
        const [totalProductsResult] = await db.query('SELECT COUNT(*) as count FROM products');
        const totalProducts = totalProductsResult[0].count || 0;

        // Sales today (using SQLite date functions; defaults to localtime)
        const [salesTodayResult] = await db.query(
            "SELECT COALESCE(SUM(total), 0) as total FROM sales WHERE date(created_at) = date('now','localtime')"
        );
        const salesTodayCents = salesTodayResult[0].total || 0;

        // Recent Sales
        const [recentSales] = await db.query(`
            SELECT s.id, s.total, s.created_at, u.username 
            FROM sales s 
            LEFT JOIN users u ON s.user_id = u.id 
            ORDER BY s.created_at DESC 
            LIMIT 5
        `);
        const recentSalesOut = recentSales.map((sale) => mapMoneyFields(sale, ['total']));

        res.json({
            totalSales: fromCents(totalSalesCents),
            totalOrders,
            totalProducts,
            salesToday: fromCents(salesTodayCents),
            recentSales: recentSalesOut
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getDetailedReport = async (req, res) => {
    const { userId, period } = req.query;

    try {
        let salesQuery = 'SELECT s.*, u.username FROM sales s LEFT JOIN users u ON s.user_id = u.id WHERE 1=1';
        const params = [];

        if (userId) {
            salesQuery += ' AND s.user_id = ?';
            params.push(userId);
        }

        if (period) {
            // Use SQLite date arithmetic to avoid timezone/format mismatches
            switch (period) {
                case 'week':
                    salesQuery += " AND date(s.created_at) >= date('now','-7 days','localtime')";
                    break;
                case 'month':
                    salesQuery += " AND date(s.created_at) >= date('now','-30 days','localtime')";
                    break;
                case 'year':
                    salesQuery += " AND date(s.created_at) >= date('now','-1 year','localtime')";
                    break;
                default:
                    // All time: no filter
                    break;
            }
        }

        const [sales] = await db.query(salesQuery, params);

        // Calculate metrics
        const totalSalesCents = sales.reduce((sum, s) => sum + s.total, 0);
        const avgSaleCents = sales.length > 0 ? totalSalesCents / sales.length : 0;
        const salesOut = sales.map((sale) => mapMoneyFields(sale, ['total']));

        // Get top products for this report
        // Note: This requires parsing the items JSON or having a separate sales_items table
        // For now we'll just return the sales data

        res.json({
            period,
            userId,
            totalSales: fromCents(totalSalesCents),
            salesCount: sales.length,
            avgSale: fromCents(avgSaleCents),
            sales: salesOut
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};
