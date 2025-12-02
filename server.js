const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/password-reset', require('./routes/passwordResetRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/sales', require('./routes/saleRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/backup', require('./routes/backupRoutes'));
app.use('/api/accounts', require('./routes/accountsRoutes'));
app.use('/api/audit', require('./routes/auditRoutes'));
app.use('/api/cash-register', require('./routes/cashRegisterRoutes'));
app.use('/api/purchases', require('./routes/purchaseRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/cash-register-history', require('./routes/cashRegisterHistoryRoutes'));

app.get('/', (req, res) => {
    res.json({ message: 'Time Office Backend API is running (Node.js)' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
