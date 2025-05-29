
const firebaseConfig = {  
    apiKey: process.env.FIREBASE_API_KEY,  
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,  
    databaseURL: process.env.FIREBASE_DATABASE_URL,  
    projectId: process.env.FIREBASE_PROJECT_ID,  
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,  
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,  
    appId: process.env.FIREBASE_APP_ID  
};

        // Inicializar Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        class AuthManager {
            constructor() {
                this.auth = firebase.auth();
                this.database = firebase.database();
                this.setupEventListeners();
                this.checkAuthState();
            }

            setupEventListeners() {
                document.getElementById('loginForm').addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.validateAndLogin();
                });
            }

            checkAuthState() {
                // Verificar si el usuario ya está autenticado
                this.auth.onAuthStateChanged(async (user) => {
                    if (user) {
                        // Usuario ya está logueado, redirigir
                        const userType = await this.getUserType(user.uid);
                        this.redirectUser(userType);
                    }
                });
            }

            async validateAndLogin() {
                const email = document.getElementById('email').value.trim();
                const password = document.getElementById('password').value;

                // Limpiar errores previos
                this.clearErrors();

                if (!this.validateEmail(email) || !this.validatePassword(password)) {
                    return;
                }

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
                    console.log('Intentando iniciar sesión con:', email);

                    const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
                    const user = userCredential.user;

                    console.log('Usuario autenticado:', user.uid);

                    // Verificar tipo de usuario
                    const userType = await this.getUserType(user.uid);

                    if (userType) {
                        console.log('Tipo de usuario encontrado:', userType);
                        this.redirectUser(userType);
                    } else {
                        console.error('No se pudo determinar el tipo de usuario');
                        this.showError('generalError', 'No se pudo determinar tu tipo de cuenta. Contacta al administrador.');
                    }

                } catch (error) {
                    console.error('Error de login:', error);
                    this.handleLoginError(error);
                } finally {
                    this.setLoading(false);
                }
            }

            async getUserType(uid) {
                try {
                    console.log('Verificando tipo de usuario para UID:', uid);

                    // Verificar en clientes
                    const clientRef = this.database.ref(`User/Clientes/${uid}`);
                    const clientSnapshot = await clientRef.once('value');

                    if (clientSnapshot.exists()) {
                        console.log('Usuario encontrado como cliente');
                        return 'client';
                    }

                    // Verificar en trabajadores
                    const workerRef = this.database.ref(`User/Trabajadores/${uid}`);
                    const workerSnapshot = await workerRef.once('value');

                    if (workerSnapshot.exists()) {
                        console.log('Usuario encontrado como trabajador');
                        return 'worker';
                    }

                    console.log('Usuario no encontrado en ninguna categoría');
                    return null;

                } catch (error) {
                    console.error('Error al verificar tipo de usuario:', error);
                    return null;
                }
            }

            redirectUser(userType) {
                console.log('Redirigiendo usuario tipo:', userType);

                if (userType === 'client') {
                    // Verificar si existe la página antes de redirigir
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
                        break;
                }

                this.showError('generalError', errorMessage);
            }

            setLoading(isLoading) {
                const loginButton = document.getElementById('loginButton');
                const loadingIndicator = document.getElementById('loadingIndicator');

                if (isLoading) {
                    loginButton.disabled = true;
                    loadingIndicator.classList.remove('hidden');
                } else {
                    loginButton.disabled = false;
                    loadingIndicator.classList.add('hidden');
                }
            }

            showError(elementId, message) {
                const errorElement = document.getElementById(elementId);
                if (errorElement) {
                    errorElement.textContent = message;
                    errorElement.classList.remove('hidden');
                }
            }

            clearErrors() {
                ['emailError', 'passwordError', 'generalError'].forEach(id => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.classList.add('hidden');
                        element.textContent = '';
                    }
                });
            }
        }

        // Inicializar cuando se carga la página
        document.addEventListener('DOMContentLoaded', () => {
            try {
                new AuthManager();
                console.log('AuthManager inicializado correctamente');
            } catch (error) {
                console.error('Error al inicializar AuthManager:', error);
            }
        });