const db = require('../config/db');

const getRequestIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
};

const logAudit = async (req, { userId, action, module, details }) => {
    try {
        const actorId = userId ?? (req.user && req.user.id) ?? null;
        const ip = getRequestIp(req);
        const payload = details ? JSON.stringify(details) : null;
        await db.query(
            'INSERT INTO audit_logs (user_id, action, module, details, ip_address) VALUES (?, ?, ?, ?, ?)',
            [actorId, action, module, payload, ip]
        );
    } catch (error) {
        console.error('Audit log error (non-blocking):', error.message);
    }
};

module.exports = { logAudit };
