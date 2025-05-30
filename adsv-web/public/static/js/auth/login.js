// Theme toggle functionality
function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');
    
    if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        themeIcon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
    } else {
        body.classList.add('dark-theme');
        themeIcon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeIcon = document.getElementById('theme-icon');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeIcon.className = 'fas fa-sun';
    }
}

class AuthManager {
    constructor() {
        this.auth = window.auth;
        this.database = window.database;
        this.setupEventListeners();
        this.checkAuthState();
    }

    setupEventListeners() {
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.validateAndLogin();
        });

        document.querySelectorAll('.form-input').forEach(input => {
            input.addEventListener('focus', (e) => {
                e.target.parentElement.style.transform = 'scale(1.02)';
            });

            input.addEventListener('blur', (e) => {
                e.target.parentElement.style.transform = 'scale(1)';
            });
        });
    }

    checkAuthState() {
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                const userType = await this.getUserType(user.uid);
                this.redirectUser(userType);
            }
        });
    }

    async validateAndLogin() {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        this.clearErrors();

        if (!this.validateEmail(email) || !this.validatePassword(password)) return;

        await this.performLogin(email, password);
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
        this.setLoading(true);

        try {
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            const userType = await this.getUserType(user.uid);
            if (userType) {
                this.redirectUser(userType);
            } else {
                this.showError('generalError', 'No se pudo determinar tu tipo de cuenta. Contacta al administrador.');
            }

        } catch (error) {
            this.handleLoginError(error);
        } finally {
            this.setLoading(false);
        }
    }

    async getUserType(uid) {
        try {
            const clientRef = this.database.ref(`User/Clientes/${uid}`);
            const clientSnapshot = await clientRef.once('value');

            if (clientSnapshot.exists()) return 'client';

            const workerRef = this.database.ref(`User/Trabajadores/${uid}`);
            const workerSnapshot = await workerRef.once('value');

            if (workerSnapshot.exists()) return 'worker';

            return null;
        } catch (error) {
            console.error('Error al verificar tipo de usuario:', error);
            return null;
        }
    }

    redirectUser(userType) {
        if (userType === 'client') {
            window.location.href = 'dashboard-client.html';
        } else if (userType === 'worker') {
            window.location.href = 'dashboard-worker.html';
        } else {
            this.showError('generalError', 'Tipo de usuario no válido');
        }
    }

    handleLoginError(error) {
        let errorMessage = 'Error al iniciar sesión';

        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No existe una cuenta con este correo electrónico';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Contraseña incorrecta';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Correo electrónico inválido';
                break;
            case 'auth/user-disabled':
                errorMessage = 'Esta cuenta ha sido deshabilitada';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Demasiados intentos fallidos. Intenta más tarde';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Error de conexión. Verifica tu internet';
                break;
            default:
                errorMessage = 'Error: ' + (error.message || 'Credenciales incorrectas');
        }

        this.showError('generalError', errorMessage);
    }

    setLoading(isLoading) {
        const loginButton = document.getElementById('loginButton');
        const loadingIndicator = document.getElementById('loadingIndicator');

        if (isLoading) {
            loginButton.disabled = true;
            loadingIndicator.classList.add('show');
        } else {
            loginButton.disabled = false;
            loadingIndicator.classList.remove('show');
        }
    }

    showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('show');
        }
    }

    clearErrors() {
        ['emailError', 'passwordError', 'generalError'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.remove('show');
                element.textContent = '';
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        if (!window.auth || !window.database) {
            throw new Error('Firebase no está inicializado correctamente');
        }
        loadTheme();
        new AuthManager();
        console.log('✅ AuthManager inicializado correctamente');
    } catch (error) {
        console.error('❌ Error al inicializar AuthManager:', error);
    }
});
