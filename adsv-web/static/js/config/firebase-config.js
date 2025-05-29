const firebaseConfig = {  
    apiKey: "**apiKeyTetsAIzaSyBmSX-fortets",  
    authDomain: "adsv-d87e1.firebaseapp.com",  
    databaseURL: "https://adsv-d87e1-default-rtdb.firebaseio.com",  
    projectId: "adsv-d87e1",  
    storageBucket: "adsv-d87e1.appspot.com",  
    messagingSenderId: "123456789012",  
    appId: "1:123456789012:web:abcdef1234567890"  
};  
  
// Inicializar Firebase solo si no está ya inicializado  
if (!firebase.apps.length) {  
    firebase.initializeApp(firebaseConfig);  
}  
  
// Exportar referencias globales  
window.firebaseConfig = firebaseConfig;  
window.database = firebase.database();  
window.auth = firebase.auth();