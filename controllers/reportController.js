const db = require('../config/db');

exports.getDashboardStats = async (req, res) => {
    try {
        // Total Sales
        const [totalSalesResult] = await db.query('SELECT SUM(total) as total FROM sales');
        const totalSales = totalSalesResult[0].total || 0;

        // Total Orders
        const [totalOrdersResult] = await db.query('SELECT COUNT(*) as count FROM sales');
        const totalOrders = totalOrdersResult[0].count || 0;

        // Total Products
        const [totalProductsResult] = await db.query('SELECT COUNT(*) as count FROM products');
        const totalProducts = totalProductsResult[0].count || 0;

        // Recent Sales
        const [recentSales] = await db.query(`
      SELECT s.id, s.total, s.created_at, u.username 
      FROM sales s 
      LEFT JOIN users u ON s.user_id = u.id 
      ORDER BY s.created_at DESC 
      LIMIT 5
    `);

        res.json({
            totalSales,
            totalOrders,
            totalProducts,
            recentSales
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
            const now = new Date();
            let startDate;

            switch (period) {
                case 'week':
                    startDate = new Date(now.setDate(now.getDate() - 7));
                    break;
                case 'month':
                    startDate = new Date(now.setDate(now.getDate() - 30));
                    break;
                case 'year':
                    startDate = new Date(now.setFullYear(now.getFullYear() - 1));
                    break;
                default:
                    startDate = new Date(0); // All time
            }

            salesQuery += ' AND s.created_at >= ?';
            params.push(startDate.toISOString());
        }

        const [sales] = await db.query(salesQuery, params);

        // Calculate metrics
        const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
        const avgSale = sales.length > 0 ? totalSales / sales.length : 0;

        // Get top products for this report
        // Note: This requires parsing the items JSON or having a separate sales_items table
        // For now we'll just return the sales data

        res.json({
            period,
            userId,
            totalSales,
            salesCount: sales.length,
            avgSale,
            sales
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};
