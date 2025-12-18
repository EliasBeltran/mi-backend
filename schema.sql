-- Users with permissions
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user', 'manager')),
    full_name TEXT,
    permissions TEXT DEFAULT '[]',
    reset_token TEXT,
    reset_token_expires DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Categories
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Products with cost tracking
CREATE TABLE products (
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

-- Sales with payment methods and customer data
CREATE TABLE sales (
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

CREATE TABLE sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    product_id INTEGER,
    quantity INTEGER NOT NULL,
    price INTEGER NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Professional Cash Register System
CREATE TABLE cash_registers (
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

-- Cash Movements (sales, income, expenses)
CREATE TABLE cash_movements (
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

-- Cash Denominations (for closing count)
CREATE TABLE cash_denominations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cash_register_id INTEGER,
    denomination_type TEXT CHECK(denomination_type IN ('bill', 'coin')),
    value INTEGER,
    quantity INTEGER,
    total INTEGER,
    FOREIGN KEY (cash_register_id) REFERENCES cash_registers(id)
);

-- Purchases table
CREATE TABLE purchases (
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

-- Accounts Receivable
CREATE TABLE accounts_receivable (
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

-- Accounts Payable
CREATE TABLE accounts_payable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_name TEXT,
    description TEXT,
    amount INTEGER,
    due_date DATE,
    paid_amount INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'partial', 'paid')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Account Payments
CREATE TABLE account_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_type TEXT CHECK(account_type IN ('receivable', 'payable')),
    account_id INTEGER,
    amount INTEGER,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT CHECK(type IN ('low_stock', 'sale', 'critical_stock', 'payment_due')),
    title TEXT,
    message TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs table
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Notifications History (for persistent notification tracking)
CREATE TABLE notifications_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('warning', 'critical', 'success', 'info', 'alert', 'urgent', 'financial', 'seasonal')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    action TEXT,
    user_id INTEGER,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Cash Register History (for storing closed cash register sessions)
CREATE TABLE cash_register_history (
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

