const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '../database.sqlite');

const tableExists = async (db, name) => {
    const row = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        [name]
    );
    return !!row;
};

const migrate = async () => {
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    try {
        await db.exec('PRAGMA foreign_keys=OFF;');
        await db.exec('BEGIN TRANSACTION;');

        if (await tableExists(db, 'products')) {
            await db.exec(`
                CREATE TABLE products_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    price INTEGER NOT NULL,
                    cost_price INTEGER DEFAULT 0,
                    profit_margin REAL DEFAULT 30,
                    stock INTEGER DEFAULT 0,
                    min_stock INTEGER DEFAULT 5,
                    category_id INTEGER,
                    barcode TEXT,
                    last_purchase_date DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (category_id) REFERENCES categories(id)
                );
            `);
            await db.exec(`
                INSERT INTO products_new (id, name, description, price, cost_price, profit_margin, stock, min_stock, category_id, barcode, last_purchase_date, created_at)
                SELECT id, name, description,
                    ROUND(price * 100),
                    ROUND(cost_price * 100),
                    profit_margin, stock, min_stock, category_id, barcode, last_purchase_date, created_at
                FROM products;
            `);
            await db.exec('DROP TABLE products;');
            await db.exec('ALTER TABLE products_new RENAME TO products;');
        }

        if (await tableExists(db, 'sales')) {
            await db.exec(`
                CREATE TABLE sales_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    total INTEGER NOT NULL,
                    payment_method TEXT DEFAULT 'cash' CHECK(payment_method IN ('cash', 'qr', 'credit')),
                    qr_reference TEXT,
                    credit_due_date DATE,
                    is_paid BOOLEAN DEFAULT 1,
                    customer_name TEXT,
                    customer_ci TEXT,
                    customer_phone TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );
            `);
            await db.exec(`
                INSERT INTO sales_new (id, user_id, total, payment_method, qr_reference, credit_due_date, is_paid, customer_name, customer_ci, customer_phone, created_at)
                SELECT id, user_id, ROUND(total * 100), payment_method, qr_reference, credit_due_date, is_paid, customer_name, customer_ci, customer_phone, created_at
                FROM sales;
            `);
            await db.exec('DROP TABLE sales;');
            await db.exec('ALTER TABLE sales_new RENAME TO sales;');
        }

        if (await tableExists(db, 'sale_items')) {
            await db.exec(`
                CREATE TABLE sale_items_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sale_id INTEGER,
                    product_id INTEGER,
                    quantity INTEGER NOT NULL,
                    price INTEGER NOT NULL,
                    FOREIGN KEY (sale_id) REFERENCES sales(id),
                    FOREIGN KEY (product_id) REFERENCES products(id)
                );
            `);
            await db.exec(`
                INSERT INTO sale_items_new (id, sale_id, product_id, quantity, price)
                SELECT id, sale_id, product_id, quantity, ROUND(price * 100)
                FROM sale_items;
            `);
            await db.exec('DROP TABLE sale_items;');
            await db.exec('ALTER TABLE sale_items_new RENAME TO sale_items;');
        }

        if (await tableExists(db, 'cash_registers')) {
            await db.exec(`
                CREATE TABLE cash_registers_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    opening_amount INTEGER NOT NULL,
                    opening_time DATETIME,
                    closing_time DATETIME,
                    expected_amount INTEGER,
                    counted_amount INTEGER,
                    difference INTEGER,
                    status TEXT CHECK(status IN ('open', 'closed')) DEFAULT 'open',
                    notes TEXT,
                    closing_notes TEXT,
                    is_locked BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );
            `);
            await db.exec(`
                INSERT INTO cash_registers_new (id, user_id, opening_amount, opening_time, closing_time, expected_amount, counted_amount, difference, status, notes, closing_notes, is_locked, created_at)
                SELECT id, user_id,
                    ROUND(opening_amount * 100),
                    opening_time, closing_time,
                    CASE WHEN expected_amount IS NULL THEN NULL ELSE ROUND(expected_amount * 100) END,
                    CASE WHEN counted_amount IS NULL THEN NULL ELSE ROUND(counted_amount * 100) END,
                    CASE WHEN difference IS NULL THEN NULL ELSE ROUND(difference * 100) END,
                    status, notes, closing_notes, is_locked, created_at
                FROM cash_registers;
            `);
            await db.exec('DROP TABLE cash_registers;');
            await db.exec('ALTER TABLE cash_registers_new RENAME TO cash_registers;');
        }

        if (await tableExists(db, 'cash_movements')) {
            await db.exec(`
                CREATE TABLE cash_movements_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cash_register_id INTEGER,
                    type TEXT CHECK(type IN ('sale', 'income', 'expense')),
                    category TEXT,
                    amount INTEGER NOT NULL,
                    description TEXT,
                    reference_id INTEGER,
                    authorized_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (cash_register_id) REFERENCES cash_registers(id)
                );
            `);
            await db.exec(`
                INSERT INTO cash_movements_new (id, cash_register_id, type, category, amount, description, reference_id, authorized_by, created_at)
                SELECT id, cash_register_id, type, category, ROUND(amount * 100), description, reference_id, authorized_by, created_at
                FROM cash_movements;
            `);
            await db.exec('DROP TABLE cash_movements;');
            await db.exec('ALTER TABLE cash_movements_new RENAME TO cash_movements;');
        }

        if (await tableExists(db, 'cash_denominations')) {
            await db.exec(`
                CREATE TABLE cash_denominations_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cash_register_id INTEGER,
                    denomination_type TEXT CHECK(denomination_type IN ('bill', 'coin')),
                    value INTEGER,
                    quantity INTEGER,
                    total INTEGER,
                    FOREIGN KEY (cash_register_id) REFERENCES cash_registers(id)
                );
            `);
            await db.exec(`
                INSERT INTO cash_denominations_new (id, cash_register_id, denomination_type, value, quantity, total)
                SELECT id, cash_register_id, denomination_type,
                    CASE WHEN value IS NULL THEN NULL ELSE ROUND(value * 100) END,
                    quantity,
                    CASE WHEN total IS NULL THEN NULL ELSE ROUND(total * 100) END
                FROM cash_denominations;
            `);
            await db.exec('DROP TABLE cash_denominations;');
            await db.exec('ALTER TABLE cash_denominations_new RENAME TO cash_denominations;');
        }

        if (await tableExists(db, 'purchases')) {
            await db.exec(`
                CREATE TABLE purchases_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    product_id INTEGER NOT NULL,
                    product_name TEXT NOT NULL,
                    supplier_name TEXT NOT NULL,
                    quantity INTEGER NOT NULL,
                    cost_price INTEGER NOT NULL,
                    selling_price INTEGER NOT NULL,
                    profit_margin REAL NOT NULL,
                    total_cost INTEGER NOT NULL,
                    is_new_product BOOLEAN DEFAULT 0,
                    category_id INTEGER,
                    user_id INTEGER NOT NULL,
                    payment_method TEXT DEFAULT 'cash',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (product_id) REFERENCES products(id),
                    FOREIGN KEY (category_id) REFERENCES categories(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );
            `);
            await db.exec(`
                INSERT INTO purchases_new (id, product_id, product_name, supplier_name, quantity, cost_price, selling_price, profit_margin, total_cost, is_new_product, category_id, user_id, payment_method, created_at)
                SELECT id, product_id, product_name, supplier_name, quantity,
                    ROUND(cost_price * 100),
                    ROUND(selling_price * 100),
                    profit_margin,
                    ROUND(total_cost * 100),
                    is_new_product, category_id, user_id, payment_method, created_at
                FROM purchases;
            `);
            await db.exec('DROP TABLE purchases;');
            await db.exec('ALTER TABLE purchases_new RENAME TO purchases;');
        }

        if (await tableExists(db, 'accounts_receivable')) {
            await db.exec(`
                CREATE TABLE accounts_receivable_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sale_id INTEGER,
                    customer_name TEXT,
                    amount INTEGER,
                    due_date DATE,
                    paid_amount INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'partial', 'paid')),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (sale_id) REFERENCES sales(id)
                );
            `);
            await db.exec(`
                INSERT INTO accounts_receivable_new (id, sale_id, customer_name, amount, due_date, paid_amount, status, created_at)
                SELECT id, sale_id, customer_name,
                    CASE WHEN amount IS NULL THEN NULL ELSE ROUND(amount * 100) END,
                    due_date,
                    CASE WHEN paid_amount IS NULL THEN 0 ELSE ROUND(paid_amount * 100) END,
                    status, created_at
                FROM accounts_receivable;
            `);
            await db.exec('DROP TABLE accounts_receivable;');
            await db.exec('ALTER TABLE accounts_receivable_new RENAME TO accounts_receivable;');
        }

        if (await tableExists(db, 'accounts_payable')) {
            await db.exec(`
                CREATE TABLE accounts_payable_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    supplier_name TEXT,
                    description TEXT,
                    amount INTEGER,
                    due_date DATE,
                    paid_amount INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'partial', 'paid')),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);
            await db.exec(`
                INSERT INTO accounts_payable_new (id, supplier_name, description, amount, due_date, paid_amount, status, created_at)
                SELECT id, supplier_name, description,
                    CASE WHEN amount IS NULL THEN NULL ELSE ROUND(amount * 100) END,
                    due_date,
                    CASE WHEN paid_amount IS NULL THEN 0 ELSE ROUND(paid_amount * 100) END,
                    status, created_at
                FROM accounts_payable;
            `);
            await db.exec('DROP TABLE accounts_payable;');
            await db.exec('ALTER TABLE accounts_payable_new RENAME TO accounts_payable;');
        }

        if (await tableExists(db, 'account_payments')) {
            await db.exec(`
                CREATE TABLE account_payments_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_type TEXT CHECK(account_type IN ('receivable', 'payable')),
                    account_id INTEGER,
                    amount INTEGER,
                    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);
            await db.exec(`
                INSERT INTO account_payments_new (id, account_type, account_id, amount, payment_date)
                SELECT id, account_type, account_id,
                    CASE WHEN amount IS NULL THEN NULL ELSE ROUND(amount * 100) END,
                    payment_date
                FROM account_payments;
            `);
            await db.exec('DROP TABLE account_payments;');
            await db.exec('ALTER TABLE account_payments_new RENAME TO account_payments;');
        }

        if (await tableExists(db, 'cash_register_history')) {
            await db.exec(`
                CREATE TABLE cash_register_history_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    shift_type TEXT CHECK(shift_type IN ('morning', 'afternoon', 'night')),
                    opening_balance INTEGER NOT NULL,
                    closing_balance INTEGER NOT NULL,
                    expected_balance INTEGER NOT NULL,
                    difference INTEGER NOT NULL,
                    total_sales INTEGER NOT NULL,
                    cash_sales INTEGER NOT NULL,
                    qr_sales INTEGER NOT NULL,
                    credit_sales INTEGER NOT NULL,
                    expenses INTEGER DEFAULT 0,
                    notes TEXT,
                    opened_at DATETIME NOT NULL,
                    closed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );
            `);
            await db.exec(`
                INSERT INTO cash_register_history_new (id, user_id, shift_type, opening_balance, closing_balance, expected_balance, difference, total_sales, cash_sales, qr_sales, credit_sales, expenses, notes, opened_at, closed_at)
                SELECT id, user_id, shift_type,
                    ROUND(opening_balance * 100),
                    ROUND(closing_balance * 100),
                    ROUND(expected_balance * 100),
                    ROUND(difference * 100),
                    ROUND(total_sales * 100),
                    ROUND(cash_sales * 100),
                    ROUND(qr_sales * 100),
                    ROUND(credit_sales * 100),
                    ROUND(expenses * 100),
                    notes, opened_at, closed_at
                FROM cash_register_history;
            `);
            await db.exec('DROP TABLE cash_register_history;');
            await db.exec('ALTER TABLE cash_register_history_new RENAME TO cash_register_history;');
        }

        await db.exec('COMMIT;');
        await db.exec('PRAGMA foreign_keys=ON;');

        console.log('Migration completed successfully.');
    } catch (error) {
        await db.exec('ROLLBACK;');
        console.error('Migration failed:', error);
        process.exitCode = 1;
    } finally {
        await db.close();
    }
};

migrate();
