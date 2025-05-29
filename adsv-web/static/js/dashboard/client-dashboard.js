class ClientDashboard {  
    constructor() {  
        this.currentUser = null;  
        this.initializeFirebase();  
        this.setupEventListeners();  
        this.checkAuthState();  
    }  
  
    initializeFirebase() {  
        this.auth = firebase.auth();  
        this.database = firebase.database();  
    }  
  
    setupEventListeners() {  
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());  
    }  
  
    checkAuthState() {  
        this.auth.onAuthStateChanged((user) => {  
            if (user) {  
                this.currentUser = user;  
                document.getElementById('userEmail').textContent = user.email;  
                this.loadClientData();  
            } else {  
                window.location.href = 'login.html';  
            }  
        });  
    }  
  
    async loadClientData() {  
        try {  
            const clientRef = this.database.ref(`User/Clientes/${this.currentUser.uid}`);  
            const snapshot = await clientRef.once('value');  
              
            if (snapshot.exists()) {  
                const clientData = snapshot.val();  
                this.loadUserRequests();  
            }  
        } catch (error) {  
            console.error('Error cargando datos del cliente:', error);  
        }  
    }  
  
    async loadUserRequests() {  
        try {  
            const requestsRef = this.database.ref('service_requests')  
                .orderByChild('clientId')  
                .equalTo(this.currentUser.uid);  
              
            const snapshot = await requestsRef.once('value');  
            const requests = snapshot.val();  
              
            this.displayRequests(requests);  
        } catch (error) {  
            console.error('Error cargando solicitudes:', error);  
        }  
    }  
  
    displayRequests(requests) {  
        const requestsList = document.getElementById('requestsList');  
          
        if (!requests) {  
            requestsList.innerHTML = `  
                <div class="text-center py-8 text-gray-500">  
                    <i class="fas fa-inbox text-4xl mb-4"></i>  
                    <p>No tienes solicitudes aún</p>  
                    <p class="text-sm">Crea tu primera solicitud de servicio</p>  
                </div>  
            `;  
            return;  
        }  
  
        const requestsArray = Object.entries(requests).map(([id, data]) => ({  
            id,  
            ...data  
        }));  
  
        requestsList.innerHTML = requestsArray.map(request => `  
            <div class="border border-gray-200 rounded-lg p-4">  
                <div class="flex justify-between items-start">  
                    <div>  
                        <h4 class="font-medium text-gray-900">${request.serviceType}</h4>  
                        <p class="text-sm text-gray-600 mt-1">${request.description}</p>  
                        <p class="text-xs text-gray-500 mt-2">  
                            Creado: ${new Date(request.createdAt).toLocaleDateString()}  
                        </p>  
                    </div>  
                    <span class="px-2 py-1 text-xs font-medium rounded-full ${this.getStatusClass(request.status)}">  
                        ${this.getStatusText(request.status)}  
                    </span>  
                </div>  
            </div>  
        `).join('');  
    }  
  
    getStatusClass(status) {  
        const classes = {  
            'pending': 'bg-yellow-100 text-yellow-800',  
            'accepted': 'bg-blue-100 text-blue-800',  
            'in_progress': 'bg-purple-100 text-purple-800',  
            'completed': 'bg-green-100 text-green-800',  
            'cancelled': 'bg-red-100 text-red-800'  
        };  
        return classes[status] || 'bg-gray-100 text-gray-800';  
    }  
  
    getStatusText(status) {  
        const texts = {  
            'pending': 'Pendiente',  
            'accepted': 'Aceptado',  
            'in_progress': 'En Progreso',  
            'completed': 'Completado',  
            'cancelled': 'Cancelado'  
        };  
        return texts[status] || 'Desconocido';  
    }  
  
    async logout() {  
        try {  
            await this.auth.signOut();  
            window.location.href = 'login.html';  
        } catch (error) {  
            console.error('Error al cerrar sesión:', error);  
        }  
    }  
}  
  
// Inicializar cuando se carga la página  
document.addEventListener('DOMContentLoaded', () => {  
    new ClientDashboard();  
});