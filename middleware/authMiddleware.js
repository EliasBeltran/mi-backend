const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        // BYPASS: Allow access even without token
        console.log('Security Bypass (authMiddleware): Access allowed without token');
        return next();
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        // BYPASS: Allow access even with invalid token
        console.log('Security Bypass (authMiddleware): Access allowed with invalid token');
        next();
    }
};

module.exports = { authenticateToken };
