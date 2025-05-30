class RegisterManager {  
    constructor() {  
        this.initializeFirebase();  
        this.setupEventListeners();  
    }  
  
    initializeFirebase() {  
        this.auth = firebase.auth();  
        this.database = firebase.database();  
    }  
  
    setupEventListeners() {  
        document.getElementById('registerForm').addEventListener('submit', (e) => {  
            e.preventDefault();  
            this.validateAndRegister();  
        });  
    }  
  
    async validateAndRegister() {  
        const formData = this.getFormData();  
          
        if (!this.validateForm(formData)) {  
            return;  
        }  
  
        try {  
            const user = await this.registerUser(formData);  
              
            // Redirigir según el tipo de usuario  
            if (formData.userType === 'client') {  
                window.location.href = 'dashboard-client.html';  
            } else {  
                window.location.href = 'dashboard-worker.html';  
            }  
        } catch (error) {  
            this.showError('generalError', this.getErrorMessage(error.code));  
        }  
    }  
  
    getFormData() {  
        return {  
            userType: document.querySelector('input[name="userType"]:checked').value,  
            fullName: document.getElementById('fullName').value.trim(),  
            email: document.getElementById('email').value.trim(),  
            phone: document.getElementById('phone').value.trim(),  
            password: document.getElementById('password').value,  
            confirmPassword: document.getElementById('confirmPassword').value,  
            serviceType: document.getElementById('serviceType').value,  
            experience: document.getElementById('experience').value  
        };  
    }  
  
    validateForm(formData) {  
        this.clearErrors();  
  
        // Validar campos básicos  
        if (!formData.fullName) {  
            this.showError('generalError', 'El nombre completo es requerido');  
            return false;  
        }  
  
        if (!this.validateEmail(formData.email)) {  
            return false;  
        }  
  
        if (!formData.phone) {  
            this.showError('generalError', 'El teléfono es requerido');  
            return false;  
        }  
  
        if (formData.password.length < 6) {  
            this.showError('generalError', 'La contraseña debe tener al menos 6 caracteres');  
            return false;  
        }  
  
        if (formData.password !== formData.confirmPassword) {  
            this.showError('generalError', 'Las contraseñas no coinciden');  
            return false;  
        }  
  
        // Validar campos específicos para trabajadores  
        if (formData.userType === 'worker') {  
            if (!formData.serviceType) {  
                this.showError('generalError', 'Debes seleccionar un tipo de servicio');  
                return false;  
            }  
        }  
  
        return true;  
    }  
  
    validateEmail(email) {  
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;  
        if (!emailRegex.test(email)) {  
            this.showError('generalError', 'Por favor, ingresa un correo válido');  
            return false;  
        }  
        return true;  
    }  
  
    async registerUser(formData) {  
        const userCredential = await this.auth.createUserWithEmailAndPassword(  
            formData.email,   
            formData.password  
        );  
        const user = userCredential.user;  
  
        // Preparar datos del usuario  
        const userData = {  
            email: user.email,  
            fullName: formData.fullName,  
            phone: formData.phone,  
            createdAt: firebase.database.ServerValue.TIMESTAMP,  
            isActive: false  
        };  
  
        // Agregar campos específicos según el tipo de usuario  
        if (formData.userType === 'worker') {  
            userData.work = formData.serviceType;  
            userData.experience = parseInt(formData.experience) || 0;  
            userData.rating = 5.0;  
            userData.completedServices = 0;  
        }  
  
        // Guardar en la ruta correspondiente  
        const userPath = formData.userType === 'client' ? 'User/Clientes' : 'User/Trabajadores';  
        await this.database.ref(`${userPath}/${user.uid}`).set(userData);  
  
        return user;  
    }  
  
    showError(elementId, message) {  
        const errorElement = document.getElementById(elementId);  
        errorElement.textContent = message;  
        document.getElementById('errorMessages').classList.remove('hidden');  
    }  
  
    clearErrors() {  
        document.getElementById('errorMessages').classList.add('hidden');  
    }  
  
    getErrorMessage(errorCode) {  
        const errorMessages = {  
            'auth/email-already-in-use': 'Este correo ya está registrado',  
            'auth/invalid-email': 'Correo electrónico inválido',  
            'auth/weak-password': 'La contraseña es muy débil',  
            'auth/operation-not-allowed': 'Operación no permitida'  
        };  
        return errorMessages[errorCode] || 'Error al crear la cuenta. Inténtalo de nuevo.';  
    }  
}  
  
// Inicializar cuando se carga la página  
document.addEventListener('DOMContentLoaded', () => {  
    new RegisterManager();  
});