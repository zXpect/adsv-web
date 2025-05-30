class ServiceRequestManager {  
    constructor() {  
        this.initializeFirebase();  
        this.setupEventListeners();  
        this.checkAuthState();  
        this.loadWorkerFromURL();  
    }  
  
    initializeFirebase() {  
        this.auth = firebase.auth();  
        this.database = firebase.database();  
    }  
  
    setupEventListeners() {  
        document.getElementById('serviceForm').addEventListener('submit', (e) => {  
            e.preventDefault();  
            this.submitServiceRequest();  
        });  
    }  
  
    checkAuthState() {  
        this.auth.onAuthStateChanged((user) => {  
            if (!user) {  
                window.location.href = 'login.html';  
            } else {  
                this.currentUser = user;  
            }  
        });  
    }  
  
    loadWorkerFromURL() {  
        const urlParams = new URLSearchParams(window.location.search);  
        const workerId = urlParams.get('workerId');  
          
        if (workerId) {  
            this.selectedWorkerId = workerId;  
            this.loadWorkerInfo(workerId);  
        }  
    }  
  
    async loadWorkerInfo(workerId) {  
        try {  
            const workerRef = this.database.ref(`User/Trabajadores/${workerId}`);  
            const snapshot = await workerRef.once('value');  
              
            if (snapshot.exists()) {  
                const workerData = snapshot.val();  
                this.displayWorkerInfo(workerData);  
            }  
        } catch (error) {  
            console.error('Error cargando información del trabajador:', error);  
        }  
    }  
  
    displayWorkerInfo(workerData) {  
        // Crear una sección para mostrar información del trabajador seleccionado  
        const workerInfoDiv = document.createElement('div');  
        workerInfoDiv.className = 'bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6';  
        workerInfoDiv.innerHTML = `  
            <h3 class="font-semibold text-blue-800 mb-2">Trabajador Seleccionado</h3>  
            <p class="text-blue-700">${workerData.name || workerData.firstName || ''} ${workerData.lastName || ''}</p>  
            <p class="text-blue-600 text-sm">${workerData.work || workerData.typeOfWork || ''}</p>  
        `;  
          
        // Insertar antes del formulario  
        const form = document.getElementById('serviceForm');  
        form.parentNode.insertBefore(workerInfoDiv, form);  
          
        // Pre-seleccionar el tipo de servicio  
        const serviceType = workerData.work || workerData.typeOfWork;  
        if (serviceType) {  
            document.getElementById('serviceType').value = serviceType;  
        }  
    }  
  
    async submitServiceRequest() {  
        try {  
            const formData = this.getFormData();  
              
            // Validar datos  
            if (!this.validateFormData(formData)) {  
                return;  
            }  
  
            // Crear solicitud en Firebase  
            const requestId = await this.createServiceRequest(formData);  
              
            // Enviar notificación  
            await this.sendNotification(formData, requestId);  
              
            alert('Solicitud enviada exitosamente');  
            window.location.href = 'dashboard-client.html';  
              
        } catch (error) {  
            console.error('Error enviando solicitud:', error);  
            alert('Error al enviar la solicitud. Inténtalo de nuevo.');  
        }  
    }  
  
    getFormData() {  
        return {  
            serviceType: document.getElementById('serviceType').value,  
            address: document.getElementById('address').value,  
            description: document.getElementById('description').value,  
            preferredDate: document.getElementById('preferredDate').value,  
            preferredTime: document.getElementById('preferredTime').value,  
            budget: document.getElementById('budget').value,  
            workerId: this.selectedWorkerId || null  
        };  
    }  
  
    validateFormData(data) {  
        if (!data.serviceType) {  
            alert('Por favor selecciona un tipo de servicio');  
            return false;  
        }  
          
        if (!data.address.trim()) {  
            alert('Por favor ingresa una dirección');  
            return false;  
        }  
          
        if (!data.description.trim()) {  
            alert('Por favor describe el trabajo que necesitas');  
            return false;  
        }  
          
        return true;  
    }  
  
    async createServiceRequest(formData) {  
        const requestsRef = this.database.ref('service_requests');  
        const newRequestRef = requestsRef.push();  
          
        const requestData = {  
            clientId: this.currentUser.uid,  
            clientEmail: this.currentUser.email,  
            serviceType: formData.serviceType,  
            address: formData.address,  
            description: formData.description,  
            preferredDate: formData.preferredDate,  
            preferredTime: formData.preferredTime,  
            budget: formData.budget ? parseFloat(formData.budget) : null,  
            workerId: formData.workerId,  
            status: 'pending',  
            timestamp: firebase.database.ServerValue.TIMESTAMP,  
            createdAt: new Date().toISOString()  
        };  
          
        await newRequestRef.set(requestData);  
        return newRequestRef.key;  
    }  
  
    async sendNotification(formData, requestId) {  
        const payload = {  
            title: `Nueva solicitud de ${formData.serviceType}`,  
            body: `Dirección: ${formData.address}\nDescripción: ${formData.description}`,  
            data: {  
                type: 'service_request',  
                requestId: requestId,  
                serviceType: formData.serviceType,  
                address: formData.address,  
                description: formData.description  
            }  
        };  
  
        // Si hay un trabajador específico seleccionado, enviar notificación dirigida  
        if (formData.workerId) {  
            payload.targetWorkerId = formData.workerId;  
        }  
  
        const response = await fetch('/.netlify/functions/sendNotification', {  
            method: 'POST',  
            headers: {  
                'Content-Type': 'application/json'  
            },  
            body: JSON.stringify(payload)  
        });  
  
        if (!response.ok) {  
            throw new Error('Error enviando notificación');  
        }  
    }  
}  
  
// Inicializar cuando se carga la página  
document.addEventListener('DOMContentLoaded', () => {  
    new ServiceRequestManager();  
});