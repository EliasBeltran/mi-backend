const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let dbInstance = null;

const getDb = async () => {
    if (dbInstance) return dbInstance;

    dbInstance = await open({
        filename: path.join(__dirname, '../database.sqlite'),
        driver: sqlite3.Database
    });

    return dbInstance;
};

// Wrapper to mimic MySQL2 promise interface slightly for easier migration
// or just export the db instance getter
module.exports = {
    query: async (sql, params) => {
        const db = await getDb();
        // SQLite 'all' returns just rows. MySQL2 returns [rows, fields].
        // We will return [rows] to match the destructuring in controllers: const [rows] = await db.query(...)
        // For INSERT/UPDATE, 'run' returns { lastID, changes }.

        if (sql.trim().toUpperCase().startsWith('SELECT')) {
            const rows = await db.all(sql, params);
            return [rows];
        } else {
            const result = await db.run(sql, params);
            return [result]; // result has lastID, changes
        }
    }
};
