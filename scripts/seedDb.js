const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const toCents = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.round(num * 100);
};

const seed = async () => {
    try {
        const db = await open({
            filename: path.join(__dirname, '../database.sqlite'),
            driver: sqlite3.Database
        });

        console.log('Connected to SQLite database');

        // Drop existing tables
        console.log('Dropping existing tables...');
        await db.exec(`
            DROP TABLE IF EXISTS purchases;
            DROP TABLE IF EXISTS audit_logs;
            DROP TABLE IF EXISTS account_payments;
            DROP TABLE IF EXISTS accounts_payable;
            DROP TABLE IF EXISTS accounts_receivable;
            DROP TABLE IF EXISTS cash_denominations;
            DROP TABLE IF EXISTS cash_movements;
            DROP TABLE IF EXISTS cash_registers;
            DROP TABLE IF EXISTS cash_counts;
            DROP TABLE IF EXISTS sale_items;
            DROP TABLE IF EXISTS sales;
            DROP TABLE IF EXISTS products;
            DROP TABLE IF EXISTS categories;
            DROP TABLE IF EXISTS notifications;
            DROP TABLE IF EXISTS users;
        `);

        const schemaPath = path.join(__dirname, '../schema.sql');
        if (!fs.existsSync(schemaPath)) {
            console.error('schema.sql not found at ' + schemaPath);
            process.exit(1);
        }

        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('Running schema...');
        await db.exec(schema);

        // Create Admin User with all permissions
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        const allPermissions = JSON.stringify([
            'dashboard', 'inventory', 'categories', 'purchases', 'sales', 'sales_history',
            'cash_register', 'reports', 'users', 'settings', 'accounts', 'audit'
        ]);

        await db.run(
            'INSERT INTO users (username, password, role, full_name, permissions) VALUES (?, ?, ?, ?, ?)',
            ['admin', hashedPassword, 'admin', 'Administrador Principal', allPermissions]
        );

        // Create Stationery Categories
        const categories = [
            { name: 'Papelería', description: 'Productos de papel y escritura' },
            { name: 'Escritura', description: 'Bolígrafos, lápices y marcadores' },
            { name: 'Organización', description: 'Archivadores, carpetas y organizadores' },
            { name: 'Arte y Manualidades', description: 'Materiales artísticos y creativos' },
            { name: 'Tecnología', description: 'Calculadoras, USB y accesorios' },
            { name: 'Mobiliario', description: 'Muebles de oficina' },
            { name: 'Empaque', description: 'Materiales de empaque y envío' }
        ];

        const categoryIds = {};
        for (const cat of categories) {
            const result = await db.run(
                'INSERT INTO categories (name, description) VALUES (?, ?)',
                [cat.name, cat.description]
            );
            categoryIds[cat.name] = result.lastID;
        }

        // Create 500+ Stationery Products
        console.log('Creating 500+ products...');
        const products = [
            // Papelería (100 products)
            ...generateProducts('Cuaderno', 100, categoryIds['Papelería'], 15, 8, 50),
            ...generateProducts('Papel Bond', 50, categoryIds['Papelería'], 25, 15, 100),
            ...generateProducts('Hojas de Colores', 30, categoryIds['Papelería'], 20, 12, 80),

            // Escritura (150 products)
            ...generateProducts('Bolígrafo', 100, categoryIds['Escritura'], 3, 1.5, 200),
            ...generateProducts('Lápiz', 80, categoryIds['Escritura'], 2, 1, 300),
            ...generateProducts('Marcador', 60, categoryIds['Escritura'], 8, 4, 150),
            ...generateProducts('Resaltador', 40, categoryIds['Escritura'], 5, 2.5, 120),

            // Organización (100 products)
            ...generateProducts('Archivador', 50, categoryIds['Organización'], 35, 20, 40),
            ...generateProducts('Carpeta', 70, categoryIds['Organización'], 12, 6, 100),
            ...generateProducts('Folder', 80, categoryIds['Organización'], 5, 2, 200),

            // Arte y Manualidades (80 products)
            ...generateProducts('Pintura', 40, categoryIds['Arte y Manualidades'], 45, 25, 60),
            ...generateProducts('Pincel', 50, categoryIds['Arte y Manualidades'], 15, 8, 80),
            ...generateProducts('Tijeras', 30, categoryIds['Arte y Manualidades'], 18, 10, 70),

            // Tecnología (40 products)
            ...generateProducts('Calculadora', 30, categoryIds['Tecnología'], 85, 50, 30),
            ...generateProducts('USB', 25, categoryIds['Tecnología'], 65, 35, 40),

            // Mobiliario (20 products)
            ...generateProducts('Silla de Oficina', 10, categoryIds['Mobiliario'], 450, 280, 15),
            ...generateProducts('Escritorio', 8, categoryIds['Mobiliario'], 850, 520, 10),

            // Empaque (30 products)
            ...generateProducts('Caja de Cartón', 40, categoryIds['Empaque'], 12, 6, 100),
            ...generateProducts('Cinta Adhesiva', 50, categoryIds['Empaque'], 8, 4, 150),
        ];

        for (const product of products) {
            const profitMargin = ((product.price - product.cost) / product.cost * 100).toFixed(2);
            const priceCents = toCents(product.price);
            const costCents = toCents(product.cost);
            await db.run(
                'INSERT INTO products (name, description, price, cost_price, profit_margin, stock, category_id, min_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [product.name, product.description, priceCents, costCents, profitMargin, product.stock, product.category_id, product.min_stock]
            );
        }

        console.log(`Database seeded successfully with ${products.length} products`);
        await db.close();
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

function generateProducts(baseName, count, categoryId, basePrice, baseCost, baseStock) {
    const products = [];
    const variants = ['A4', 'Carta', 'Oficio', 'Mini', 'Grande', 'Mediano', 'Pequeño', 'Premium', 'Estándar', 'Económico'];
    const colors = ['Azul', 'Rojo', 'Negro', 'Verde', 'Amarillo', 'Blanco', 'Multicolor'];

    for (let i = 0; i < count; i++) {
        const variant = variants[i % variants.length];
        const color = colors[i % colors.length];
        const name = `${baseName} ${variant} ${color}`;
        const priceVariation = (Math.random() * 0.3 - 0.15); // ±15%
        const price = Math.round((basePrice * (1 + priceVariation)) * 100) / 100;
        const cost = Math.round((baseCost * (1 + priceVariation)) * 100) / 100;
        const stock = baseStock + Math.floor(Math.random() * 50);

        products.push({
            name,
            description: `${baseName} de alta calidad ${variant.toLowerCase()}`,
            price,
            cost,
            stock,
            category_id: categoryId,
            min_stock: 10
        });
    }

    return products;
}

seed();
