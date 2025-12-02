const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

(async () => {
    try {
        const db = await open({
            filename: path.join(__dirname, 'database.sqlite'),
            driver: sqlite3.Database
        });

        console.log('Connected to database.');

        await db.exec(`
            CREATE TABLE IF NOT EXISTS cash_register_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                shift_type TEXT CHECK(shift_type IN ('morning', 'afternoon', 'night')),
                opening_balance REAL NOT NULL,
                closing_balance REAL NOT NULL,
                expected_balance REAL NOT NULL,
                difference REAL NOT NULL,
                total_sales REAL NOT NULL,
                cash_sales REAL NOT NULL,
                qr_sales REAL NOT NULL,
                credit_sales REAL NOT NULL,
                expenses REAL DEFAULT 0,
                notes TEXT,
                opened_at DATETIME NOT NULL,
                closed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        console.log('Table cash_register_history created or already exists.');
    } catch (error) {
        console.error('Error creating table:', error);
    }
})();
