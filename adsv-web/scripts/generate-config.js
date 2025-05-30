// scripts/generate-config.js
// Script para generar firebase-config.js con variables de entorno en tiempo de build

const fs = require('fs');
const path = require('path');

// Leer variables de entorno
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

// Verificar que todas las variables estén presentes
const missingVars = Object.keys(firebaseConfig).filter(key => !firebaseConfig[key]);

if (missingVars.length > 0) {
    console.error('❌ Faltan las siguientes variables de entorno:', missingVars);
    process.exit(1);
}

// Generar manualmente la cadena JS con claves sin comillas
const firebaseConfigString = Object.entries(firebaseConfig)
    .map(([key, value]) => `    ${key}: "${value}"`)
    .join(',\n');

const configContent = `// firebase-config.js
// ⚠️ ARCHIVO GENERADO AUTOMÁTICAMENTE - NO EDITAR MANUALMENTE
// Este archivo se genera durante el build con las variables de entorno

// Configuración de Firebase
const firebaseConfig = {
${firebaseConfigString}
};

console.log('✅ Configuración Firebase cargada para proyecto:', firebaseConfig.projectId);

// Inicializar Firebase solo si no está ya inicializado
if (!firebase.apps.length) {
    try {
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase inicializado correctamente');
    } catch (error) {
        console.error('❌ Error al inicializar Firebase:', error);
    }
} else {
    console.log('ℹ️ Firebase ya estaba inicializado');
}

// Exportar referencias globales para uso en otros archivos
window.firebaseConfig = firebaseConfig;
window.auth = firebase.auth();
window.database = firebase.database();

// También exportar como módulo si es necesario
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { firebaseConfig, auth: firebase.auth(), database: firebase.database() };
}
`;

// Ruta final: adsv-web/public/static/js/config/firebase-config.js
const configDir = path.join(__dirname, '..', 'public', 'static', 'js', 'config');
const configPath = path.join(configDir, 'firebase-config.js');

if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
}

fs.writeFileSync(configPath, configContent);

console.log('✅ firebase-config.js generado exitosamente en:', configPath);
console.log('🔧 Configuración para proyecto:', firebaseConfig.projectId);
