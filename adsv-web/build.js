const fs = require('fs');
const path = require('path');

// Rutas principales
const publicDir = path.join(__dirname, 'public');
const staticDir = path.join(__dirname, 'static');
const configPath = path.join(staticDir, 'js', 'config', 'firebase-config.js');
const outputDir = path.join(publicDir, 'static', 'js', 'config');
const outputFile = path.join(outputDir, 'firebase-config.js');

// Crear carpetas si no existen
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

if (fs.existsSync(configPath)) {
    let configContent = fs.readFileSync(configPath, 'utf8');

    // Reemplazos de variables de entorno
    configContent = configContent.replace(/process\.env\.FIREBASE_API_KEY/g, `"${process.env.FIREBASE_API_KEY}"`);
    configContent = configContent.replace(/process\.env\.FIREBASE_AUTH_DOMAIN/g, `"${process.env.FIREBASE_AUTH_DOMAIN}"`);
    configContent = configContent.replace(/process\.env\.FIREBASE_DATABASE_URL/g, `"${process.env.FIREBASE_DATABASE_URL}"`);
    configContent = configContent.replace(/process\.env\.FIREBASE_PROJECT_ID/g, `"${process.env.FIREBASE_PROJECT_ID}"`);
    configContent = configContent.replace(/process\.env\.FIREBASE_STORAGE_BUCKET/g, `"${process.env.FIREBASE_STORAGE_BUCKET}"`);
    configContent = configContent.replace(/process\.env\.FIREBASE_MESSAGING_SENDER_ID/g, `"${process.env.FIREBASE_MESSAGING_SENDER_ID}"`);
    configContent = configContent.replace(/process\.env\.FIREBASE_APP_ID/g, `"${process.env.FIREBASE_APP_ID}"`);

    // Eliminar comillas de claves como "apiKey": => apiKey:
    configContent = configContent.replace(/"(\w+)"\s*:/g, '$1:');

    // Guardar archivo final
    fs.writeFileSync(outputFile, configContent);
    console.log('✅ Firebase config procesado correctamente');
} else {
    console.warn('⚠️ No se encontró firebase-config.js en static/js/config/');
}

// Copiar archivos estáticos
if (fs.existsSync(staticDir)) {
    const copyRecursiveSync = (src, dest) => {
        const exists = fs.existsSync(src);
        const stats = exists && fs.statSync(src);
        const isDirectory = exists && stats.isDirectory();

        if (isDirectory) {
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
            }
            fs.readdirSync(src).forEach(name => {
                copyRecursiveSync(path.join(src, name), path.join(dest, name));
            });
        } else {
            fs.copyFileSync(src, dest);
        }
    };

    copyRecursiveSync(staticDir, path.join(publicDir, 'static'));
    console.log('✅ Archivos estáticos copiados');
}

console.log('🚀 Build completado');
