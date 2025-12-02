const rateLimit = require('express-rate-limit');

// Rate limiter for login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter for general API requests
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Demasiadas solicitudes. Por favor, espere un momento.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Validation middleware
const validateInput = (req, res, next) => {
    // Sanitize string inputs
    const sanitize = (str) => {
        if (typeof str !== 'string') return str;
        return str.trim().replace(/[<>]/g, '');
    };

    // Recursively sanitize object
    const sanitizeObject = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;

        const sanitized = {};
        for (const key in obj) {
            sanitized[key] = typeof obj[key] === 'string' ? sanitize(obj[key]) :
                typeof obj[key] === 'object' ? sanitizeObject(obj[key]) :
                    obj[key];
        }
        return sanitized;
    };

    req.body = sanitizeObject(req.body);
    next();
};

// Check permissions middleware
const checkPermission = (module) => {
    return (req, res, next) => {
        const user = req.user;

        if (!user) {
            return res.status(401).json({ message: 'No autenticado' });
        }

        // Admin always has access
        if (user.role === 'admin') {
            return next();
        }

        try {
            const permissions = JSON.parse(user.permissions || '[]');

            if (!permissions.includes(module)) {
                return res.status(403).json({
                    message: 'No tiene permisos para acceder a este módulo'
                });
            }

            next();
        } catch (error) {
            return res.status(500).json({ message: 'Error al verificar permisos' });
        }
    };
};

// Audit log middleware
const auditLog = (action, module) => {
    return async (req, res, next) => {
        const originalSend = res.send;

        res.send = function (data) {
            // Log successful actions
            if (res.statusCode < 400) {
                const db = require('../config/db');
                const user = req.user || { id: null };
                const ip = req.ip || req.connection.remoteAddress;

                db.query(
                    'INSERT INTO audit_logs (user_id, action, module, details, ip_address) VALUES (?, ?, ?, ?, ?)',
                    [user.id, action, module, JSON.stringify(req.body), ip]
                ).catch(err => console.error('Audit log error:', err));
            }

            originalSend.call(this, data);
        };

        next();
    };
};

module.exports = {
    loginLimiter,
    apiLimiter,
    validateInput,
    checkPermission,
    auditLog
};
