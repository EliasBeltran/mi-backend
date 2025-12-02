const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("Checking notifications_history table schema...");
    db.all("PRAGMA table_info(notifications_history)", (err, rows) => {
        if (err) {
            console.error("Error getting table info:", err);
            return;
        }
        console.log(rows);
    });

    console.log("\nChecking if table exists...");
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='notifications_history'", (err, rows) => {
        if (err) {
            console.error("Error checking table existence:", err);
            return;
        }
        console.log(rows);
    });
});

db.close();
