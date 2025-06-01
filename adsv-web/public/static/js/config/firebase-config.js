// firebase-config.js
// ⚠️ ARCHIVO GENERADO AUTOMÁTICAMENTE - NO EDITAR MANUALMENTE
// Este archivo se genera durante el build con las variables de entorno

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBmSX2DEjIarC3acpn2xoL5Gfe-rW6-JrE",
    authDomain: "adsv-d87e1.firebaseapp.com",
    databaseURL: "https://adsv-d87e1-default-rtdb.firebaseio.com",
    projectId: "adsv-d87e1",
    storageBucket: "adsv-d87e1.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
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
