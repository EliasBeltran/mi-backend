const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Middleware to verify JWT token (PERMISSIVE MODE)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        // BYPASS: Allow access even without token
        console.log('Security Bypass: Access allowed without token');
        return next();
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            // BYPASS: Allow access even with invalid token
            console.log('Security Bypass: Access allowed with invalid token');
            return next();
        }
        req.user = user; // Attach user info to request if valid
        next();
    });
};

// Middleware to check if user has permission for a specific module (PERMISSIVE MODE)
const checkPermission = (requiredModule) => {
    return async (req, res, next) => {
        // BYPASS: Always allow access
        return next();
    };
};

// Middleware to check if user is admin (PERMISSIVE MODE)
const requireAdmin = async (req, res, next) => {
    // BYPASS: Always allow access
    return next();
};

module.exports = {
    authenticateToken,
    checkPermission,
    requireAdmin
};
