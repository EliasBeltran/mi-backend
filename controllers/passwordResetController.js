const db = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Configure email transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail', // You can change this to other services
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });
};

// Request password reset
exports.requestPasswordReset = async (req, res) => {
    const { email } = req.body;

    try {
        // Find user by email
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(404).json({ message: 'No se encontró un usuario con ese correo electrónico' });
        }

        const user = users[0];

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

        // Save token to database
        await db.query(
            'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
            [resetToken, resetTokenExpires.toISOString(), user.id]
        );

        // Create reset URL
        const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;

        // Send email
        const transporter = createTransporter();
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Recuperación de Contraseña - Time Office',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Recuperación de Contraseña</h2>
                    <p>Hola <strong>${user.full_name || user.username}</strong>,</p>
                    <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
                    <div style="margin: 30px 0;">
                        <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                            Restablecer Contraseña
                        </a>
                    </div>
                    <p>Este enlace expirará en 1 hora.</p>
                    <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px;">Time Office System</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.json({ message: 'Se ha enviado un correo con las instrucciones para restablecer tu contraseña' });
    } catch (error) {
        console.error('Error in password reset request:', error);
        res.status(500).json({ message: 'Error al procesar la solicitud. Verifica la configuración de correo.' });
    }
};

// Reset password with token
exports.resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        // Find user with valid token
        const [users] = await db.query(
            'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > datetime("now")',
            [token]
        );

        if (users.length === 0) {
            return res.status(400).json({ message: 'Token inválido o expirado' });
        }

        const user = users[0];

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password and clear reset token
        await db.query(
            'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
            [hashedPassword, user.id]
        );

        res.json({ message: 'Contraseña actualizada exitosamente' });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ message: 'Error al restablecer la contraseña' });
    }
};

// Verify reset token
exports.verifyResetToken = async (req, res) => {
    const { token } = req.params;

    try {
        const [users] = await db.query(
            'SELECT id, username FROM users WHERE reset_token = ? AND reset_token_expires > datetime("now")',
            [token]
        );

        if (users.length === 0) {
            return res.status(400).json({ valid: false, message: 'Token inválido o expirado' });
        }

        res.json({ valid: true, username: users[0].username });
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(500).json({ valid: false, message: 'Error al verificar el token' });
    }
};
