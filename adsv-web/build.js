const fs = require('fs');  
const path = require('path');  
  
// Verificar que existen las carpetas necesarias  
const publicDir = path.join(__dirname, 'public');  
const staticDir = path.join(__dirname, 'static');  
  
if (!fs.existsSync(publicDir)) {  
    fs.mkdirSync(publicDir, { recursive: true });  
}  
  
// Crear la estructura de carpetas en public si no existe  
const publicStaticDir = path.join(publicDir, 'static', 'js', 'config');  
if (!fs.existsSync(publicStaticDir)) {  
    fs.mkdirSync(publicStaticDir, { recursive: true });  
}  
  
// Leer el archivo de configuración original  
const configPath = path.join(__dirname, 'static/js/config/firebase-config.js');  
  
if (fs.existsSync(configPath)) {  
    let configContent = fs.readFileSync(configPath, 'utf8');  
  
    // Reemplazar las variables de entorno  
    configContent = configContent.replace(/process\.env\.FIREBASE_API_KEY/g, `"${process.env.FIREBASE_API_KEY}"`);  
    configContent = configContent.replace(/process\.env\.FIREBASE_AUTH_DOMAIN/g, `"${process.env.FIREBASE_AUTH_DOMAIN}"`);  
    configContent = configContent.replace(/process\.env\.FIREBASE_DATABASE_URL/g, `"${process.env.FIREBASE_DATABASE_URL}"`);  
    configContent = configContent.replace(/process\.env\.FIREBASE_PROJECT_ID/g, `"${process.env.FIREBASE_PROJECT_ID}"`);  
    configContent = configContent.replace(/process\.env\.FIREBASE_STORAGE_BUCKET/g, `"${process.env.FIREBASE_STORAGE_BUCKET}"`);  
    configContent = configContent.replace(/process\.env\.FIREBASE_MESSAGING_SENDER_ID/g, `"${process.env.FIREBASE_MESSAGING_SENDER_ID}"`);  
    configContent = configContent.replace(/process\.env\.FIREBASE_APP_ID/g, `"${process.env.FIREBASE_APP_ID}"`);  
  
    // Escribir el archivo procesado en public  
    fs.writeFileSync(path.join(publicStaticDir, 'firebase-config.js'), configContent);  
    console.log('✅ Firebase config procesado correctamente');  
} else {  
    console.log('⚠️ No se encontró firebase-config.js en static/js/config/');  
}  
  
// Copiar otros archivos estáticos si existen  
if (fs.existsSync(staticDir)) {  
    const copyRecursiveSync = (src, dest) => {  
        const exists = fs.existsSync(src);  
        const stats = exists && fs.statSync(src);  
        const isDirectory = exists && stats.isDirectory();  
          
        if (isDirectory) {  
            if (!fs.existsSync(dest)) {  
                fs.mkdirSync(dest, { recursive: true });  
            }  
            fs.readdirSync(src).forEach(childItemName => {  
                copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));  
            });  
        } else {  
            fs.copyFileSync(src, dest);  
        }  
    };  
  
    copyRecursiveSync(staticDir, path.join(publicDir, 'static'));  
    console.log('✅ Archivos estáticos copiados');  
}  
  
console.log('🚀 Build completado');