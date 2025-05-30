// Utility functions optimizadas
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Theme toggle functionality - Optimizado
function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');
    
    body.classList.toggle('dark-theme');
    
    if (body.classList.contains('dark-theme')) {
        themeIcon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
    } else {
        themeIcon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
    }
}

// Load saved theme - Optimizado
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeIcon = document.getElementById('theme-icon');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        if (themeIcon) themeIcon.className = 'fas fa-sun';
    } else {
        if (themeIcon) themeIcon.className = 'fas fa-moon';
    }
}

// User type selection - Optimizado
function setupUserTypeSelection() {
    const userTypeCards = document.querySelectorAll('.user-type-card');
    const workerFields = document.getElementById('workerFields');
    
    if (!userTypeCards.length) return;
    
    userTypeCards.forEach(card => {
        card.addEventListener('click', () => {
            // Remove selected class from all cards
            userTypeCards.forEach(c => c.classList.remove('selected'));
            
            // Add selected class to clicked card
            card.classList.add('selected');
            
            // Update radio button
            const radio = card.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
                
                // Show/hide worker fields
                if (workerFields) {
                    if (radio.value === 'worker') {
                        workerFields.classList.remove('hidden');
                    } else {
                        workerFields.classList.add('hidden');
                    }
                }
            }
        });
    });
}

// Performance optimization for mobile
function optimizeForMobile() {
    const isMobile = window.innerWidth <= 768;
    const body = document.body;
    
    if (isMobile) {
        // Reduce animation complexity on mobile
        body.style.setProperty('--animation-duration', '40s');
        
        // Disable complex animations if performance is poor
        if (navigator.hardwareConcurrency <= 4) {
            const style = document.createElement('style');
            style.textContent = `
                body::before { animation: none !important; }
                * { transition-duration: 0.1s !important; }
            `;
            document.head.appendChild(style);
        }
    }
}

// Viewport height fix for mobile
function setViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// RegisterManager Class - Optimizado
class RegisterManager {
    constructor() {
        this.auth = firebase.auth();
        this.database = firebase.database();
        this.isSubmitting = false; // Prevenir múltiples envíos
        this.setupEventListeners();
        this.checkAuthState();
    }

    setupEventListeners() {
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (!this.isSubmitting) {
                    this.validateAndRegister();
                }
            });
        }
    }

    checkAuthState() {
        this.auth.onAuthStateChanged(async (user) => {
            if (user && !this.isSubmitting) {
                try {
                    const userType = await this.getUserType(user.uid);
                    if (userType) {
                        this.redirectUser(userType);
                    }
                } catch (error) {
                    console.error('Error checking auth state:', error);
                }
            }
        });
    }

    async validateAndRegister() {
        if (this.isSubmitting) return;
        
        const formData = this.getFormData();
        
        // Limpiar errores previos
        this.clearErrors();

        if (!this.validateForm(formData)) {
            return;
        }

        await this.performRegistration(formData);
    }

    getFormData() {
        const userTypeElement = document.querySelector('input[name="userType"]:checked');
        
        return {
            userType: userTypeElement ? userTypeElement.value : '',
            fullName: this.getElementValue('fullName'),
            email: this.getElementValue('email'),
            phone: this.getElementValue('phone'),
            password: this.getElementValue('password'),
            confirmPassword: this.getElementValue('confirmPassword'),
            serviceType: this.getElementValue('serviceType'),
            experience: this.getElementValue('experience')
        };
    }

    getElementValue(id) {
        const element = document.getElementById(id);
        return element ? element.value.trim() : '';
    }

    validateForm(data) {
        // Validar tipo de usuario
        if (!data.userType) {
            this.showError('Por favor, selecciona el tipo de usuario');
            return false;
        }

        // Validar nombre
        if (!data.fullName || data.fullName.length < 2) {
            this.showError('El nombre debe tener al menos 2 caracteres');
            return false;
        }

        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            this.showError('Por favor, ingresa un correo válido');
            return false;
        }

        // Validar teléfono
        const phoneRegex = /^\d{9,15}$/;
        if (!phoneRegex.test(data.phone.replace(/\s/g, ''))) {
            this.showError('Por favor, ingresa un teléfono válido (9-15 dígitos)');
            return false;
        }

        // Validar contraseña
        if (data.password.length < 6) {
            this.showError('La contraseña debe tener al menos 6 caracteres');
            return false;
        }

        if (data.password !== data.confirmPassword) {
            this.showError('Las contraseñas no coinciden');
            return false;
        }

        // Validaciones específicas para trabajadores
        if (data.userType === 'worker') {
            if (!data.serviceType) {
                this.showError('Por favor, selecciona tu especialidad');
                return false;
            }
            if (!data.experience || data.experience < 0) {
                this.showError('Por favor, ingresa los años de experiencia');
                return false;
            }
        }

        return true;
    }

    async performRegistration(data) {
        this.isSubmitting = true;
        this.setLoading(true);
        
        try {
            console.log('Creando usuario con:', data.email);
            
            // Crear usuario en Firebase Auth
            const userCredential = await this.auth.createUserWithEmailAndPassword(data.email, data.password);
            const user = userCredential.user;
            
            console.log('Usuario creado:', user.uid);

            // Actualizar perfil del usuario
            await user.updateProfile({
                displayName: data.fullName
            });

            // Guardar información adicional en la base de datos
            await this.saveUserData(user.uid, data);
            
            // Mostrar mensaje de éxito
            this.showSuccessMessage('¡Cuenta creada exitosamente! Redirigiendo...');
            
            // Redirigir después de un breve delay
            setTimeout(() => {
                this.redirectUser(data.userType);
            }, 2000);
            
        } catch (error) {
            console.error('Error de registro:', error);
            this.handleRegistrationError(error);
        } finally {
            this.setLoading(false);
            this.isSubmitting = false;
        }
    }

    async saveUserData(uid, data) {
        const timestamp = new Date().toISOString();
        const commonData = {
            name: data.fullName,
            email: data.email,
            phone: data.phone,
            createdAt: timestamp,
            updatedAt: timestamp
        };

        if (data.userType === 'client') {
            // Guardar en User/Clientes
            await this.database.ref(`User/Clientes/${uid}`).set({
                ...commonData,
                isActive: true
            });
            
            console.log('Cliente guardado en la base de datos');
            
        } else if (data.userType === 'worker') {
            // Guardar en User/Trabajadores
            const workerData = {
                ...commonData,
                work: data.serviceType,
                experience: parseInt(data.experience),
                isActive: true,
                isAvailable: true,
                rating: 0,
                completedJobs: 0
            };
            
            await this.database.ref(`User/Trabajadores/${uid}`).set(workerData);
            
            // También agregar a active_workers para facilitar búsquedas
            await this.database.ref(`active_workers/${uid}`).set({
                name: data.fullName,
                work: data.serviceType,
                isAvailable: true,
                lastSeen: timestamp
            });
            
            console.log('Trabajador guardado en la base de datos');
        }
    }

    async getUserType(uid) {
        try {
            // Verificar en clientes
            const clientSnapshot = await this.database.ref(`User/Clientes/${uid}`).once('value');
            if (clientSnapshot.exists()) {
                return 'client';
            }

            // Verificar en trabajadores
            const workerSnapshot = await this.database.ref(`User/Trabajadores/${uid}`).once('value');
            if (workerSnapshot.exists()) {
                return 'worker';
            }

            return null;
            
        } catch (error) {
            console.error('Error al verificar tipo de usuario:', error);
            return null;
        }
    }

    redirectUser(userType) {
        console.log('Redirigiendo usuario tipo:', userType);
        
        if (userType === 'client') {
            window.location.href = 'dashboard-client.html';
        } else if (userType === 'worker') {
            window.location.href = 'dashboard-worker.html';
        } else {
            this.showError('Tipo de usuario no válido');
        }
    }

    handleRegistrationError(error) {
        let errorMessage = 'Error al crear la cuenta';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'Ya existe una cuenta con este correo electrónico';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Correo electrónico inválido';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'El registro está deshabilitado temporalmente';
                break;
            case 'auth/weak-password':
                errorMessage = 'La contraseña es muy débil';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Error de conexión. Verifica tu internet';
                break;
            default:
                errorMessage = 'Error: ' + (error.message || 'No se pudo crear la cuenta');
                break;
        }
        
        this.showError(errorMessage);
    }

    setLoading(isLoading) {
        const registerButton = document.getElementById('registerButton');
        const loadingIndicator = document.getElementById('loadingIndicator');
        
        if (registerButton) {
            registerButton.disabled = isLoading;
        }
        
        if (loadingIndicator) {
            if (isLoading) {
                loadingIndicator.classList.remove('hidden');
            } else {
                loadingIndicator.classList.add('hidden');
            }
        }
    }

    showError(message) {
        const errorElement = document.getElementById('generalError');
        const errorContainer = document.getElementById('errorMessages');
        
        if (errorElement && errorContainer) {
            errorElement.textContent = message;
            errorContainer.classList.remove('hidden');
            
            // Scroll hacia el error suavemente
            setTimeout(() => {
                errorContainer.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }, 100);
        }
    }

    showSuccessMessage(message) {
        this.setLoading(false);
        
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
            loadingIndicator.className = 'loading-indicator success show';
        }
    }

    clearErrors() {
        const errorContainer = document.getElementById('errorMessages');
        const errorElement = document.getElementById('generalError');
        
        if (errorContainer) errorContainer.classList.add('hidden');
        if (errorElement) errorElement.textContent = '';
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Optimize for mobile first
        optimizeForMobile();
        setViewportHeight();
        
        // Load theme
        loadTheme();
        
        // Setup user type selection
        setupUserTypeSelection();
        
        // Initialize RegisterManager only if Firebase is available
        if (typeof firebase !== 'undefined' && firebase.apps) {
            new RegisterManager();
            console.log('RegisterManager inicializado correctamente');
        } else {
            console.warn('Firebase no está disponible');
        }
        
    } catch (error) {
        console.error('Error al inicializar:', error);
        
        // Show error to user
        const generalError = document.getElementById('generalError');
        const errorContainer = document.getElementById('errorMessages');
        if (generalError && errorContainer) {
            generalError.textContent = 'Error al inicializar la aplicación. Recarga la página.';
            errorContainer.classList.remove('hidden');
        }
    }
});

// Handle viewport changes (mobile orientation, etc.)
window.addEventListener('resize', debounce(() => {
    setViewportHeight();
    optimizeForMobile();
}, 250));

// Optimize performance on page visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Pause animations when page is not visible
        document.body.style.setProperty('--animation-play-state', 'paused');
    } else {
        // Resume animations when page becomes visible
        document.body.style.setProperty('--animation-play-state', 'running');
    }
});