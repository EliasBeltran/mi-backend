const db = require('./config/db');

async function addEmailColumn() {
    try {
        // Check if email column exists
        const result = await db.query("PRAGMA table_info(users)");
        // db.query returns [rows, fields] or similar structure depending on implementation
        // In this project's db.js wrapper, it returns [rows]
        const columns = result[0];
        const hasEmail = Array.isArray(columns) && columns.some(col => col.name === 'email');

        if (!hasEmail) {
            console.log('Adding email column to users table...');
            await db.query("ALTER TABLE users ADD COLUMN email TEXT");
            console.log('Email column added successfully.');
        } else {
            console.log('Email column already exists.');
        }
    } catch (error) {
        console.error('Error adding email column:', error);
    }
}

addEmailColumn();
