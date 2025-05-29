class AuthManager {  
    constructor() {  
        this.initializeFirebase();  
        this.setupEventListeners();  
    }  
  
    initializeFirebase() {  
        // Usar la misma configuración que en scripts.js  
        firebase.initializeApp(firebaseConfig);  
        this.auth = firebase.auth();  
        this.database = firebase.database();  
    }  
  
    setupEventListeners() {  
        document.getElementById('loginForm').addEventListener('submit', (e) => {  
            e.preventDefault();  
            this.validateAndLogin();  
        });  
    }  
  
    validateAndLogin() {  
        const email = document.getElementById('email').value.trim();  
        const password = document.getElementById('password').value;  
  
        // Limpiar errores previos  
        this.clearErrors();  
  
        if (!this.validateEmail(email) || !this.validatePassword(password)) {  
            return;  
        }  
  
        this.performLogin(email, password);  
    }  
  
    validateEmail(email) {  
        if (!email) {  
            this.showError('emailError', 'Por favor, ingresa tu correo electrónico');  
            return false;  
        }  
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;  
        if (!emailRegex.test(email)) {  
            this.showError('emailError', 'Por favor, ingresa un correo válido');  
            return false;  
        }  
        return true;  
    }  
  
    validatePassword(password) {  
        if (!password) {  
            this.showError('passwordError', 'Por favor, ingresa tu contraseña');  
            return false;  
        }  
        if (password.length < 6) {  
            this.showError('passwordError', 'La contraseña debe tener al menos 6 caracteres');  
            return false;  
        }  
        return true;  
    }  
  
    async performLogin(email, password) {  
        try {  
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);  
            const user = userCredential.user;  
              
            // Verificar tipo de usuario  
            const userType = await this.getUserType(user.uid);  
              
            // Redirigir según el tipo de usuario  
            if (userType === 'client') {  
                window.location.href = 'dashboard-client.html';  
            } else if (userType === 'worker') {  
                window.location.href = 'dashboard-worker.html';  
            }  
        } catch (error) {  
            this.showError('passwordError', 'Credenciales incorrectas');  
        }  
    }  
  
    async getUserType(uid) {  
        // Verificar en la estructura de Firebase similar a la app móvil  
        const clientRef = this.database.ref(`User/Clientes/${uid}`);  
        const workerRef = this.database.ref(`User/Trabajadores/${uid}`);  
          
        const [clientSnapshot, workerSnapshot] = await Promise.all([  
            clientRef.once('value'),  
            workerRef.once('value')  
        ]);  
  
        if (clientSnapshot.exists()) return 'client';  
        if (workerSnapshot.exists()) return 'worker';  
        return null;  
    }  
  
    showError(elementId, message) {  
        const errorElement = document.getElementById(elementId);  
        errorElement.textContent = message;  
        errorElement.classList.remove('hidden');  
    }  
  
    clearErrors() {  
        ['emailError', 'passwordError'].forEach(id => {  
            const element = document.getElementById(id);  
            element.classList.add('hidden');  
        });  
    }  
}  
  
// Inicializar cuando se carga la página  
document.addEventListener('DOMContentLoaded', () => {  
    new AuthManager();  
});