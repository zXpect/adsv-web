const firebaseConfig = {  
    apiKey: process.env.FIREBASE_API_KEY,  
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,  
    databaseURL: process.env.FIREBASE_DATABASE_URL,  
    projectId: process.env.FIREBASE_PROJECT_ID,  
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,  
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,  
    appId: process.env.FIREBASE_APP_ID  
};
  
// Inicializar Firebase solo si no está ya inicializado  
if (!firebase.apps.length) {  
    firebase.initializeApp(firebaseConfig);  
}  
  
// Exportar referencias globales  
window.firebaseConfig = firebaseConfig;  
window.database = firebase.database();  
window.auth = firebase.auth();