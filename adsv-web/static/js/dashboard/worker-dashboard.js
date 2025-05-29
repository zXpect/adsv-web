class WorkerDashboard {  
    constructor() {  
        this.isConnected = false;  
        this.currentUser = null;  
        this.connectionStartTime = null;  
        this.locationWatcher = null;  
          
        this.initializeFirebase();  
        this.setupEventListeners();  
        this.checkAuthState();  
    }  
  
    initializeFirebase() {  
        this.auth = firebase.auth();  
        this.database = firebase.database();  
    }  
  
    setupEventListeners() {  
        document.getElementById('connectBtn').addEventListener('click', () => this.connect());  
        document.getElementById('disconnectBtn').addEventListener('click', () => this.disconnect());  
        document.getElementById('updateLocationBtn').addEventListener('click', () => this.updateLocation());  
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());  
    }  
  
    checkAuthState() {  
        this.auth.onAuthStateChanged((user) => {  
            if (user) {  
                this.currentUser = user;  
                document.getElementById('userEmail').textContent = user.email;  
                this.loadWorkerData();  
            } else {  
                window.location.href = 'login.html';  
            }  
        });  
    }  
  
    async loadWorkerData() {  
        try {  
            const workerRef = this.database.ref(`User/Trabajadores/${this.currentUser.uid}`);  
            const snapshot = await workerRef.once('value');  
              
            if (snapshot.exists()) {  
                const workerData = snapshot.val();  
                this.updateStats(workerData);  
                this.checkConnectionStatus();  
            }  
        } catch (error) {  
            console.error('Error cargando datos del trabajador:', error);  
        }  
    }  
  
    updateStats(workerData) {  
        // Actualizar estadísticas en el dashboard  
        document.getElementById('rating').textContent = workerData.rating || '5.0';  
        // Aquí puedes agregar más lógica para calcular servicios y ganancias  
    }  
  
    async connect() {  
        if (this.isConnected) return;  
  
        try {  
            // Obtener ubicación actual  
            const position = await this.getCurrentPosition();  
              
            // Agregar trabajador a la lista de activos  
            const activeWorkerRef = this.database.ref(`active_workers/${this.currentUser.uid}`);  
            await activeWorkerRef.set({  
                timestamp: firebase.database.ServerValue.TIMESTAMP,  
                latitude: position.coords.latitude,  
                longitude: position.coords.longitude  
            });  
  
            // Actualizar estado en la base de datos del trabajador  
            const workerRef = this.database.ref(`User/Trabajadores/${this.currentUser.uid}`);  
            await workerRef.update({  
                isActive: true,  
                latitude: position.coords.latitude,  
                longitude: position.coords.longitude,  
                lastSeen: firebase.database.ServerValue.TIMESTAMP  
            });  
  
            this.isConnected = true;  
            this.connectionStartTime = Date.now();  
            this.updateConnectionUI();  
            this.startLocationTracking();  
            this.startConnectionTimer();  
  
            console.log('Trabajador conectado exitosamente');  
        } catch (error) {  
            console.error('Error al conectar:', error);  
            alert('Error al conectar. Verifica los permisos de ubicación.');  
        }  
    }  
  
    async disconnect() {  
        if (!this.isConnected) return;  
  
        try {  
            // Remover de trabajadores activos  
            const activeWorkerRef = this.database.ref(`active_workers/${this.currentUser.uid}`);  
            await activeWorkerRef.remove();  
  
            // Actualizar estado en la base de datos del trabajador  
            const workerRef = this.database.ref(`User/Trabajadores/${this.currentUser.uid}`);  
            await workerRef.update({  
                isActive: false,  
                lastSeen: firebase.database.ServerValue.TIMESTAMP  
            });  
  
            this.isConnected = false;  
            this.connectionStartTime = null;  
            this.updateConnectionUI();  
            this.stopLocationTracking();  
  
            console.log('Trabajador desconectado exitosamente');  
        } catch (error) {  
            console.error('Error al desconectar:', error);  
        }  
    }  
  
    updateConnectionUI() {  
        const statusToggle = document.getElementById('statusToggle');  
        const statusText = document.getElementById('statusText');  
        const connectBtn = document.getElementById('connectBtn');  
        const disconnectBtn = document.getElementById('disconnectBtn');  
  
        if (this.isConnected) {  
            statusToggle.className = 'px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800';  
            statusText.textContent = 'Conectado';  
            connectBtn.disabled = true;  
            connectBtn.classList.add('opacity-50');  
            disconnectBtn.disabled = false;  
            disconnectBtn.classList.remove('opacity-50');  
        } else {  
            statusToggle.className = 'px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800';  
            statusText.textContent = 'Desconectado';  
            connectBtn.disabled = false;  
            connectBtn.classList.remove('opacity-50');  
            disconnectBtn.disabled = true;  
            disconnectBtn.classList.add('opacity-50');  
        }  
    }  
  
    getCurrentPosition() {  
        return new Promise((resolve, reject) => {  
            if (!navigator.geolocation) {  
                reject(new Error('Geolocalización no soportada'));  
                return;  
            }  
  
            navigator.geolocation.getCurrentPosition(resolve, reject, {  
                enableHighAccuracy: true,  
                timeout: 10000,  
                maximumAge: 60000  
            });  
        });  
    }  
  
    startLocationTracking() {  
        if (navigator.geolocation) {  
            this.locationWatcher = navigator.geolocation.watchPosition(  
                (position) => {  
                    this.updateLocationInDatabase(position);  
                },  
                (error) => {  
                    console.error('Error tracking location:', error);  
                },  
                {  
                    enableHighAccuracy: true,  
                    timeout: 30000,  
                    maximumAge: 60000  
                }  
            );  
        }  
    }  
  
    stopLocationTracking() {  
        if (this.locationWatcher) {  
            navigator.geolocation.clearWatch(this.locationWatcher);  
            this.locationWatcher = null;  
        }  
    }  
  
    async updateLocationInDatabase(position) {  
        if (!this.isConnected) return;  
  
        try {  
            const updates = {  
                latitude: position.coords.latitude,  
                longitude: position.coords.longitude,  
                lastSeen: firebase.database.ServerValue.TIMESTAMP  
            };  
  
            // Actualizar en ambas ubicaciones  
            await Promise.all([  
                this.database.ref(`active_workers/${this.currentUser.uid}`).update(updates),  
                this.database.ref(`User/Trabajadores/${this.currentUser.uid}`).update(updates)  
            ]);  
        } catch (error) {  
            console.error('Error actualizando ubicación:', error);  
        }  
    }  
    async updateLocation() {  
        try {  
            const position = await this.getCurrentPosition();  
              
            if (this.isConnected) {  
                await this.updateLocationInDatabase(position);  
                alert('Ubicación actualizada correctamente');  
            } else {  
                alert('Debes estar conectado para actualizar la ubicación');  
            }  
        } catch (error) {  
            console.error('Error actualizando ubicación:', error);  
            alert('Error al obtener la ubicación');  
        }  
    }  
  
    startConnectionTimer() {  
        setInterval(() => {  
            if (this.isConnected && this.connectionStartTime) {  
                const elapsed = Date.now() - this.connectionStartTime;  
                const hours = Math.floor(elapsed / (1000 * 60 * 60));  
                const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));  
                  
                document.getElementById('connectedTime').textContent = `${hours}h ${minutes}m`;  
            }  
        }, 60000); // Actualizar cada minuto  
    }  
  
    checkConnectionStatus() {  
        // Verificar si el trabajador está en la lista de activos  
        const activeWorkerRef = this.database.ref(`active_workers/${this.currentUser.uid}`);  
        activeWorkerRef.once('value', (snapshot) => {  
            if (snapshot.exists()) {  
                this.isConnected = true;  
                this.updateConnectionUI();  
                this.startLocationTracking();  
            }  
        });  
    }  
  
    logout() {  
        if (this.isConnected) {  
            this.disconnect();  
        }  
        this.auth.signOut().then(() => {  
            window.location.href = 'login.html';  
        });  
    }  
}  
  
// Inicializar dashboard cuando se carga la página  
document.addEventListener('DOMContentLoaded', () => {  
    new WorkerDashboard();  
});