const fs = require('fs');
const path = require('path');

// List of files to update
const filesToUpdate = [
    'Inventory.jsx',
    'Sales.jsx',
    'Purchases.jsx',
    'CashCount.jsx',
    'Accounts.jsx',
    'Users.jsx',
    'Dashboard.jsx',
    'SalesHistory.jsx',
    'Categories.jsx',
    'AuditLogs.jsx',
    'Settings.jsx'
];

const pagesDir = path.join(__dirname, '..', 'frontend', 'src', 'pages');

filesToUpdate.forEach(fileName => {
    const filePath = path.join(pagesDir, fileName);

    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${fileName}`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Check if fetchWithAuth is already imported
    if (!content.includes('fetchWithAuth')) {
        // Add import at the top (after other imports)
        const importLine = "import fetchWithAuth from '../utils/fetchWithAuth';";

        // Find the last import statement
        const lines = content.split('\n');
        let lastImportIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('import ')) {
                lastImportIndex = i;
            }
        }

        if (lastImportIndex !== -1) {
            lines.splice(lastImportIndex + 1, 0, importLine);
            content = lines.join('\n');
            modified = true;
        }
    }

    // Replace fetch with fetchWithAuth (only for localhost:5000 API calls)
    const originalContent = content;
    content = content.replace(
        /(\s+)await fetch\('http:\/\/localhost:5000\/api\//g,
        '$1await fetchWithAuth(\'http://localhost:5000/api/'
    );
    content = content.replace(
        /(\s+)fetch\('http:\/\/localhost:5000\/api\//g,
        '$1fetchWithAuth(\'http://localhost:5000/api/'
    );

    if (content !== originalContent) {
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Updated: ${fileName}`);
    } else {
        console.log(`ℹ️  No changes needed: ${fileName}`);
    }
});

console.log('\n✨ Frontend update complete!');
