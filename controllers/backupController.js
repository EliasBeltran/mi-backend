const path = require('path');
const fs = require('fs');

exports.downloadBackup = async (req, res) => {
    try {
        // Try multiple possible database paths
        const possiblePaths = [
            path.join(__dirname, '../time_office.db'),
            path.join(__dirname, '../database.sqlite'),
            path.join(__dirname, '../db/time_office.db')
        ];

        let dbPath = null;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                dbPath = p;
                break;
            }
        }

        if (!dbPath) {
            return res.status(404).json({ message: 'Archivo de base de datos no encontrado' });
        }

        const filename = `backup-time-office-${new Date().toISOString().split('T')[0]}.db`;

        res.download(dbPath, filename, (err) => {
            if (err) {
                console.error('Error downloading backup:', err);
                if (!res.headersSent) {
                    res.status(500).json({ message: 'Error al descargar el backup' });
                }
            }
        });
    } catch (error) {
        console.error('Backup error:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

