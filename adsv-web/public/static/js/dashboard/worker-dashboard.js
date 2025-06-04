// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

class WorkerDashboard {
    constructor() {
        this.auth = firebase.auth();
        this.database = firebase.database();
        this.currentUser = null;
        this.isConnected = false;
        this.map = null;
        this.locationMarker = null;
        this.activeServices = [];
        this.pendingRequests = [];
        
        this.init();
        this.initTheme();
    }

    async init() {
        try {
            // Verificar autenticación
            await this.checkAuthState();
            
            // Configurar event listeners
            this.setupEventListeners();
            
            // Inicializar mapa
            this.initializeMap();
            
            // Cargar servicios activos y solicitudes pendientes
            await this.loadActiveServices();
            await this.loadPendingRequests();
            
            // Ocultar pantalla de carga
            this.hideLoadingScreen();
            
        } catch (error) {
            console.error('Error al inicializar dashboard:', error);
            this.redirectToLogin();
        }
    }

    checkAuthState() {
        return new Promise((resolve, reject) => {
            this.auth.onAuthStateChanged(async (user) => {
                if (user) {
                    this.currentUser = user;
                    
                    // Verificar que sea un trabajador
                    const isWorker = await this.verifyWorkerStatus(user.uid);
                    if (!isWorker) {
                        console.error('Usuario no es trabajador');
                        reject(new Error('Acceso no autorizado'));
                        return;
                    }
                    
                    // Cargar datos del usuario
                    await this.loadUserData(user.uid);
                    resolve();
                    
                } else {
                    reject(new Error('Usuario no autenticado'));
                }
            });
        });
    }

    async verifyWorkerStatus(uid) {
        try {
            const workerRef = this.database.ref(`User/Trabajadores/${uid}`);
            const snapshot = await workerRef.once('value');
            return snapshot.exists();
        } catch (error) {
            console.error('Error verificando estado de trabajador:', error);
            return false;
        }
    }

    async loadUserData(uid) {
        try {
            const workerRef = this.database.ref(`User/Trabajadores/${uid}`);
            const snapshot = await workerRef.once('value');
            
            if (snapshot.exists()) {
                const userData = snapshot.val();
                this.updateUserInterface(userData);
                
                // Cargar datos en el formulario de perfil
                this.populateProfileForm(userData);
            }
        } catch (error) {
            console.error('Error cargando datos del usuario:', error);
        }
    }

    updateUserInterface(userData) {
        // Actualizar información del usuario
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');
        
        if (userName) userName.textContent = userData.name || 'Usuario';
        if (userEmail) userEmail.textContent = userData.email || '';
        
        // Actualizar estadísticas
        document.getElementById('rating').textContent = userData.rating?.toFixed(1) || '5.0';
        document.getElementById('completedServices').textContent = userData.completedJobs || '0';
        document.getElementById('monthlyEarnings').textContent = `$${userData.monthlyEarnings || '0'}`;
        
        // Actualizar estado de conexión
        this.isConnected = userData.isAvailable || false;
        this.updateConnectionStatus();
        
        // Si hay ubicación guardada, actualizar mapa
        if (userData.location) {
            this.updateMapLocation(userData.location.latitude, userData.location.longitude);
        }
    }

    updateConnectionStatus() {
        const statusToggle = document.getElementById('statusToggle');
        const statusText = document.getElementById('statusText');
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        
        if (this.isConnected) {
            statusToggle.className = 'status-badge connected';
            statusText.textContent = 'Conectado';
            connectBtn.disabled = true;
            connectBtn.classList.add('opacity-50');
            disconnectBtn.disabled = false;
            disconnectBtn.classList.remove('opacity-50');
        } else {
            statusToggle.className = 'status-badge disconnected';
            statusText.textContent = 'Desconectado';
            connectBtn.disabled = false;
            connectBtn.classList.remove('opacity-50');
            disconnectBtn.disabled = true;
            disconnectBtn.classList.add('opacity-50');
        }
    }

    initializeMap() {
        this.map = new google.maps.Map(document.getElementById('workerMap'), {
            zoom: 13,
            center: { lat: 4.6097, lng: -74.0817 }, // Bogotá
            styles: [
                {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{ visibility: "off" }]
                }
            ],
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true
        });

        // Intentar cargar la última ubicación guardada
        this.loadLastLocation();
    }

    async loadLastLocation() {
        try {
            if (!this.currentUser) return;
            
            const locationSnapshot = await this.database.ref(`User/Trabajadores/${this.currentUser.uid}/location`).once('value');
            const locationData = locationSnapshot.val();
            
            if (locationData && locationData.latitude && locationData.longitude) {
                this.updateMapLocation(locationData.latitude, locationData.longitude);
            } else {
                // Si no hay ubicación guardada, intentar obtener la ubicación actual
                this.updateLocation();
            }
        } catch (error) {
            console.error('Error cargando última ubicación:', error);
        }
    }

    async updateMapLocation(lat, lng) {
        const position = { lat: parseFloat(lat), lng: parseFloat(lng) };
        
        try {
            // Obtener el tipo de trabajo del usuario actual
            const workerSnapshot = await this.database.ref(`User/Trabajadores/${this.currentUser.uid}`).once('value');
            const workerData = workerSnapshot.val();
            const workType = workerData.work || 'Sin especificar';
            
            const workerIcon = this.getWorkerIcon(workType);
            const markerColor = this.getCategoryColor(workType);
            
            if (!this.locationMarker) {
                this.locationMarker = new google.maps.Marker({
                    position: position,
                    map: this.map,
                    title: `${workerData.name} - ${workType}`,
                    icon: {
                        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                            <svg width="50" height="50" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="25" cy="25" r="22" fill="${markerColor}" stroke="white" stroke-width="3"/>
                                <text x="25" y="30" text-anchor="middle" font-size="16" fill="white">${workerIcon}</text>
                            </svg>
                        `)}`,
                        scaledSize: new google.maps.Size(50, 50),
                        anchor: new google.maps.Point(25, 25)
                    },
                    animation: google.maps.Animation.DROP
                });

                // Agregar círculo de radio de servicio
                new google.maps.Circle({
                    map: this.map,
                    center: position,
                    radius: 2000, // 2km de radio
                    fillColor: markerColor,
                    fillOpacity: 0.1,
                    strokeColor: markerColor,
                    strokeOpacity: 0.3,
                    strokeWeight: 2
                });

                // Agregar InfoWindow con información del trabajador
                const infoWindow = new google.maps.InfoWindow({
                    content: this.createWorkerInfoContent(workerData)
                });

                this.locationMarker.addListener('click', () => {
                    infoWindow.open(this.map, this.locationMarker);
                });
            } else {
                this.locationMarker.setPosition(position);
            }
            
            this.map.setCenter(position);
            this.map.setZoom(15);
        } catch (error) {
            console.error('Error actualizando marcador:', error);
            // Fallback a marcador básico si hay error
            if (!this.locationMarker) {
                this.locationMarker = new google.maps.Marker({
                    position: position,
                    map: this.map,
                    title: 'Mi ubicación',
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        fillColor: '#3b82f6',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2,
                        scale: 8
                    }
                });
            } else {
                this.locationMarker.setPosition(position);
            }
        }
    }

    createWorkerInfoContent(worker) {
        return `
            <div class="info-window p-4 min-w-[300px] bg-white dark:bg-gray-800 shadow-lg rounded-lg">
                <!-- Encabezado -->
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center">
                        <div class="w-12 h-12 rounded-full flex items-center justify-center text-2xl mr-3"
                             style="background: ${this.getCategoryColor(worker.work)}">
                            ${this.getWorkerIcon(worker.work)}
                        </div>
                        <div>
                            <h3 class="font-bold text-gray-800 dark:text-white text-lg">${worker.name}</h3>
                            <div class="flex items-center space-x-2">
                                <span class="text-sm font-medium" style="color: ${this.getCategoryColor(worker.work)}">${worker.work}</span>
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                    ● Disponible
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Calificación y Servicios -->
                <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg mb-4">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center">
                            <span class="text-yellow-400 text-lg mr-2">★</span>
                            <span class="font-bold text-gray-700 dark:text-gray-200">${worker.rating?.toFixed(1) || '5.0'}</span>
                        </div>
                        <div class="text-sm text-blue-600 dark:text-blue-400">
                            <i class="fas fa-check-circle mr-1"></i>
                            ${worker.completedJobs || '0'} servicios completados
                        </div>
                    </div>
                </div>

                <!-- Descripción -->
                <div class="mb-4">
                    <p class="text-gray-600 dark:text-gray-300 text-sm">
                        ${worker.description || 'Sin descripción disponible'}
                    </p>
                </div>

                <!-- Información de Contacto -->
                <div class="space-y-2 mb-4">
                    <div class="flex items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        <i class="fas fa-phone text-green-500 dark:text-green-400 w-5"></i>
                        <span class="ml-2 text-gray-700 dark:text-gray-200 text-sm">${worker.phone || 'No disponible'}</span>
                    </div>
                    <div class="flex items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        <i class="fas fa-envelope text-blue-500 dark:text-blue-400 w-5"></i>
                        <span class="ml-2 text-gray-700 dark:text-gray-200 text-sm">${worker.email || 'No disponible'}</span>
                    </div>
                    <div class="flex items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        <i class="fas fa-map-marker-alt text-red-500 dark:text-red-400 w-5"></i>
                        <span class="ml-2 text-gray-700 dark:text-gray-200 text-sm">${worker.location || 'Ubicación no especificada'}</span>
                    </div>
                </div>

                <!-- Botones de Acción -->
                <div class="flex space-x-2 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <button onclick="viewServiceDetails('${worker.id}')" 
                            class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                        <i class="fas fa-eye mr-2"></i>Ver Detalles
                    </button>
                    <button onclick="contactWorker('${worker.id}')"
                            class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                        <i class="fas fa-phone mr-2"></i>Contactar
                    </button>
                </div>
            </div>
        `;
    }

    async loadActiveServices() {
        try {
            const servicesRef = this.database.ref('services')
                .orderByChild('workerId')
                .equalTo(this.currentUser.uid);
            
            const snapshot = await servicesRef.once('value');
            const activeServicesList = document.getElementById('activeServicesList');
            
            if (snapshot.exists()) {
                const services = [];
                snapshot.forEach((childSnapshot) => {
                    const service = childSnapshot.val();
                    if (service.status === 'in_progress') {
                        services.push({
                            id: childSnapshot.key,
                            ...service
                        });
                    }
                });
                
                this.activeServices = services;
                
                if (services.length > 0) {
                    activeServicesList.innerHTML = services.map(service => this.createServiceCard(service)).join('');
                } else {
                    activeServicesList.innerHTML = `
                        <div class="text-center text-secondary py-4">
                            <i class="fas fa-briefcase text-4xl mb-2 text-blue-200"></i>
                            <p>No hay servicios activos</p>
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error('Error cargando servicios activos:', error);
        }
    }

    async loadPendingRequests() {
        try {
            const requestsRef = this.database.ref('requests')
                .orderByChild('status')
                .equalTo('pending');
            
            const snapshot = await requestsRef.once('value');
            const pendingRequestsList = document.getElementById('pendingRequestsList');
            
            if (snapshot.exists()) {
                const requests = [];
                snapshot.forEach((childSnapshot) => {
                    const request = childSnapshot.val();
                    if (request.serviceType === this.currentUser.work) {
                        requests.push({
                            id: childSnapshot.key,
                            ...request
                        });
                    }
                });
                
                this.pendingRequests = requests;
                
                if (requests.length > 0) {
                    pendingRequestsList.innerHTML = requests.map(request => this.createRequestCard(request)).join('');
                } else {
                    pendingRequestsList.innerHTML = `
                        <div class="text-center text-secondary py-4">
                            <i class="fas fa-clock text-4xl mb-2 text-blue-200"></i>
                            <p>No hay solicitudes pendientes</p>
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error('Error cargando solicitudes pendientes:', error);
        }
    }

    createServiceCard(service) {
        return `
            <div class="request-item">
                <div class="flex items-center justify-between mb-2">
                    <span class="font-medium text-primary">${service.serviceType}</span>
                    <span class="text-sm text-secondary">${this.formatDate(service.startDate)}</span>
                </div>
                <p class="text-sm text-secondary mb-2">${service.description}</p>
                <div class="flex justify-end">
                    <button onclick="viewServiceDetails('${service.id}')" class="btn btn-primary text-sm">
                        <i class="fas fa-eye mr-1"></i>Ver Detalles
                    </button>
                </div>
            </div>
        `;
    }

    createRequestCard(request) {
        return `
            <div class="request-item">
                <div class="flex items-center justify-between mb-2">
                    <span class="font-medium text-primary">${request.serviceType}</span>
                    <span class="text-sm text-secondary">${this.formatDate(request.createdAt)}</span>
                </div>
                <p class="text-sm text-secondary mb-2">${request.description}</p>
                <div class="flex justify-end space-x-2">
                    <button onclick="acceptRequest('${request.id}')" class="btn btn-success text-sm">
                        <i class="fas fa-check mr-1"></i>Aceptar
                    </button>
                    <button onclick="rejectRequest('${request.id}')" class="btn btn-danger text-sm">
                        <i class="fas fa-times mr-1"></i>Rechazar
                    </button>
                </div>
            </div>
        `;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    setupEventListeners() {
        // Botón de cerrar sesión
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.showLogoutModal();
        });

        // Mobile menu handling with Bootstrap
        const navbarToggler = document.querySelector('.navbar-toggler');
        const headerMenu = document.getElementById('headerMenu');

        // Initialize Bootstrap collapse
        if (navbarToggler && headerMenu) {
            new bootstrap.Collapse(headerMenu, {
                toggle: false
            });
        }

        // Close menu on click outside
        document.addEventListener('click', (e) => {
            const isNavbarToggler = e.target.closest('.navbar-toggler');
            const isHeaderMenu = e.target.closest('#headerMenu');
            
            if (!isNavbarToggler && !isHeaderMenu && headerMenu.classList.contains('show')) {
                bootstrap.Collapse.getInstance(headerMenu).hide();
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 992 && headerMenu.classList.contains('show')) {
                bootstrap.Collapse.getInstance(headerMenu).hide();
            }
        });

        // Modal de confirmación de logout
        document.getElementById('cancelLogout').addEventListener('click', () => {
            this.hideLogoutModal();
        });

        document.getElementById('confirmLogout').addEventListener('click', () => {
            this.performLogout();
        });

        // Botones de conexión
        document.getElementById('connectBtn').addEventListener('click', () => {
            this.toggleConnection(true);
        });

        document.getElementById('disconnectBtn').addEventListener('click', () => {
            this.toggleConnection(false);
        });

        // Botón de actualizar ubicación
        document.getElementById('updateLocationBtn').addEventListener('click', () => {
            this.updateLocation();
        });

        // Botón de editar perfil y manejo del modal
        const viewProfileBtn = document.getElementById('viewProfileBtn');
        const profileModal = document.getElementById('profileModal');
        const closeProfileModal = document.getElementById('closeProfileModal');

        if (viewProfileBtn) {
            viewProfileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showProfileModal();
            });
        }

        if (closeProfileModal) {
            closeProfileModal.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideProfileModal();
            });
        }

        // Cerrar modal al hacer clic fuera
        if (profileModal) {
            profileModal.addEventListener('click', (e) => {
                if (e.target === profileModal) {
                    this.hideProfileModal();
                }
            });
        }

        // Prevenir que el scroll del body cuando el modal está abierto
        document.addEventListener('touchmove', (e) => {
            if (profileModal && !profileModal.classList.contains('hidden')) {
                if (!profileModal.contains(e.target)) {
                    e.preventDefault();
                }
            }
        }, { passive: false });

        // Manejar cambios de orientación
        window.addEventListener('orientationchange', () => {
            if (profileModal && !profileModal.classList.contains('hidden')) {
                // Reajustar el modal después del cambio de orientación
                setTimeout(() => {
                    this.adjustModalPosition();
                }, 100);
            }
        });

        // Formulario de perfil
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.updateProfile();
            });
        }

        // Tema oscuro/claro
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme(themeIcon, themeIconDesktop);
        });

        // Cerrar modales al hacer clic fuera
        document.querySelectorAll('.modal-content').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideAllModals();
                }
            });
        });

        // Handle mobile back button
        window.addEventListener('popstate', () => {
            this.hideAllModals();
            headerMenu?.classList.add('hidden');
            headerMenu?.classList.remove('show');
        });

        // Optimize map for mobile
        this.setupResponsiveMap();
    }

    setupResponsiveMap() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (this.map) {
                    google.maps.event.trigger(this.map, 'resize');
                    if (this.locationMarker) {
                        this.map.setCenter(this.locationMarker.getPosition());
                    }
                }
            }, 250);
        });
    }

    showLogoutModal() {
        document.getElementById('logoutModal').classList.remove('hidden');
    }

    hideLogoutModal() {
        document.getElementById('logoutModal').classList.add('hidden');
    }

    showProfileModal() {
        const modal = document.getElementById('profileModal');
        if (modal) {
            // Cargar datos actuales antes de mostrar el modal
            this.loadCurrentUserData().then(() => {
                modal.classList.remove('hidden');
                document.body.style.overflow = 'hidden'; // Prevenir scroll del body
                this.adjustModalPosition();
            });
        }
    }

    hideProfileModal() {
        const modal = document.getElementById('profileModal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = ''; // Restaurar scroll del body
        }
    }

    hideAllModals() {
        document.getElementById('logoutModal').classList.add('hidden');
        document.getElementById('profileModal').classList.add('hidden');
    }

    populateProfileForm(userData) {
        document.getElementById('profileName').value = userData.name || '';
        document.getElementById('profileWork').value = userData.work || '';
        document.getElementById('profileDescription').value = userData.description || '';
        document.getElementById('profilePhone').value = userData.phone || '';
    }

    async loadCurrentUserData() {
        try {
            if (!this.currentUser) return;

            const workerRef = this.database.ref(`User/Trabajadores/${this.currentUser.uid}`);
            const snapshot = await workerRef.once('value');
            const userData = snapshot.val();

            if (userData) {
                document.getElementById('profileName').value = userData.name || '';
                document.getElementById('profileWork').value = userData.work || '';
                document.getElementById('profileDescription').value = userData.description || '';
                document.getElementById('profilePhone').value = userData.phone || '';

                // Actualizar vista previa del avatar si existe
                const avatarPreview = document.querySelector('.worker-avatar-preview');
                if (avatarPreview) {
                    avatarPreview.style.backgroundColor = this.getCategoryColor(userData.work);
                    avatarPreview.innerHTML = this.getWorkerIcon(userData.work);
                }
            }
        } catch (error) {
            console.error('Error cargando datos del usuario:', error);
            this.showNotification('Error al cargar datos del perfil', 'error');
        }
    }

    async updateProfile() {
        const submitBtn = document.querySelector('#profileForm button[type="submit"]');
        const spinner = document.getElementById('profileSpinner');
        
        try {
            submitBtn.disabled = true;
            spinner.classList.remove('hidden');
            
            const profileData = {
                name: document.getElementById('profileName').value.trim(),
                work: document.getElementById('profileWork').value,
                description: document.getElementById('profileDescription').value.trim(),
                phone: document.getElementById('profilePhone').value.trim(),
                updatedAt: new Date().toISOString()
            };

            // Validaciones
            if (!profileData.name) {
                throw new Error('El nombre es requerido');
            }
            if (!profileData.work) {
                throw new Error('Debes seleccionar una profesión');
            }
            if (!profileData.phone) {
                throw new Error('El teléfono es requerido');
            }
            
            await this.database.ref(`User/Trabajadores/${this.currentUser.uid}`).update(profileData);
            
            this.showNotification('Perfil actualizado exitosamente', 'success');
            this.hideProfileModal();
            
            // Recargar datos del usuario
            await this.loadUserData(this.currentUser.uid);
            
            // Actualizar marcador en el mapa si existe
            if (this.locationMarker) {
                const position = this.locationMarker.getPosition();
                await this.updateMapLocation(position.lat(), position.lng());
            }
            
        } catch (error) {
            console.error('Error actualizando perfil:', error);
            this.showNotification(error.message || 'Error al actualizar perfil', 'error');
        } finally {
            submitBtn.disabled = false;
            spinner.classList.add('hidden');
        }
    }

    async performLogout() {
        const confirmBtn = document.getElementById('confirmLogout');
        const spinner = document.getElementById('logoutSpinner');
        
        try {
            confirmBtn.disabled = true;
            spinner.classList.remove('hidden');
            
            if (this.isConnected && this.currentUser) {
                await this.updateWorkerStatus(this.currentUser.uid, false);
            }
            
            await this.auth.signOut();
            this.redirectToLogin();
            
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            confirmBtn.disabled = false;
            spinner.classList.add('hidden');
            this.showNotification('Error al cerrar sesión', 'error');
        }
    }

    async toggleConnection(connect) {
        if (!this.currentUser) return;
        
        try {
            await this.updateWorkerStatus(this.currentUser.uid, connect);
            this.isConnected = connect;
            this.updateConnectionStatus();
            
            const message = connect ? 'Te has conectado exitosamente' : 'Te has desconectado';
            this.showNotification(message, connect ? 'success' : 'info');
            
        } catch (error) {
            console.error('Error al cambiar estado de conexión:', error);
            this.showNotification('Error al actualizar estado de conexión', 'error');
        }
    }

    async updateWorkerStatus(uid, isAvailable) {
        const updates = {
            [`User/Trabajadores/${uid}/isAvailable`]: isAvailable,
            [`User/Trabajadores/${uid}/lastSeen`]: new Date().toISOString()
        };

        if (isAvailable) {
            const workerRef = this.database.ref(`User/Trabajadores/${uid}`);
            const snapshot = await workerRef.once('value');
            const workerData = snapshot.val();
            
            // Obtener la ubicación actual del trabajador
            let locationData = workerData.location || {};
            
            updates[`active_workers/${uid}`] = {
                name: workerData.name,
                work: workerData.work,
                isAvailable: true,
                lastSeen: new Date().toISOString(),
                l: locationData.latitude && locationData.longitude ? 
                   [locationData.latitude, locationData.longitude] : 
                   null
            };

            // Si no hay ubicación guardada, intentar obtener la ubicación actual
            if (!locationData.latitude || !locationData.longitude) {
                try {
                    const position = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            enableHighAccuracy: true,
                            timeout: 10000,
                            maximumAge: 300000
                        });
                    });

                    const { latitude, longitude } = position.coords;
                    updates[`active_workers/${uid}/l`] = [latitude, longitude];
                    updates[`User/Trabajadores/${uid}/location`] = {
                        latitude,
                        longitude,
                        updatedAt: new Date().toISOString()
                    };
                } catch (error) {
                    console.warn('No se pudo obtener la ubicación actual:', error);
                }
            }
        } else {
            updates[`active_workers/${uid}`] = null;
        }

        await this.database.ref().update(updates);
    }

    updateLocation() {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    
                    try {
                        // Guardar en Firebase
                        await this.saveLocation(latitude, longitude);
                        
                        // Actualizar mapa
                        this.updateMapLocation(latitude, longitude);
                        
                        this.showNotification('Ubicación actualizada exitosamente', 'success');
                    } catch (error) {
                        console.error('Error guardando ubicación:', error);
                        this.showNotification('Error al guardar ubicación', 'error');
                    }
                },
                (error) => {
                    console.error('Error obteniendo ubicación:', error);
                    this.showNotification('Error al obtener ubicación', 'error');
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000
                }
            );
        } else {
            this.showNotification('Geolocalización no disponible', 'error');
        }
    }

    async saveLocation(lat, lng) {
        if (!this.currentUser) return;
        
        const locationData = {
            latitude: lat,
            longitude: lng,
            updatedAt: new Date().toISOString()
        };
        
        // Actualizar ubicación en el perfil del trabajador
        await this.database.ref(`User/Trabajadores/${this.currentUser.uid}/location`).set(locationData);
        
        // Si el trabajador está activo, actualizar también en active_workers
        if (this.isConnected) {
            await this.database.ref(`active_workers/${this.currentUser.uid}/l`).set([lat, lng]);
        }
    }

    toggleTheme(mobileIcon, desktopIcon) {
        const html = document.documentElement;
        html.classList.toggle('dark');
        
        // Update both icons
        if (html.classList.contains('dark')) {
            mobileIcon.classList.remove('fa-moon');
            mobileIcon.classList.add('fa-sun');
            desktopIcon.classList.remove('fa-moon');
            desktopIcon.classList.add('fa-sun');
            localStorage.setItem('theme', 'dark');
        } else {
            mobileIcon.classList.remove('fa-sun');
            mobileIcon.classList.add('fa-moon');
            desktopIcon.classList.remove('fa-sun');
            desktopIcon.classList.add('fa-moon');
            localStorage.setItem('theme', 'light');
        }

        // Update map styles if map exists
        if (this.map) {
            this.updateMapStyle();
        }
    }

    updateMapStyle() {
        const isDark = document.documentElement.classList.contains('dark');
        const styles = isDark ? [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            {
                featureType: "administrative.locality",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }]
            },
            {
                featureType: "poi",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }]
            },
            {
                featureType: "poi.park",
                elementType: "geometry",
                stylers: [{ color: "#263c3f" }]
            },
            {
                featureType: "poi.park",
                elementType: "labels.text.fill",
                stylers: [{ color: "#6b9a76" }]
            },
            {
                featureType: "road",
                elementType: "geometry",
                stylers: [{ color: "#38414e" }]
            },
            {
                featureType: "road",
                elementType: "geometry.stroke",
                stylers: [{ color: "#212a37" }]
            },
            {
                featureType: "road",
                elementType: "labels.text.fill",
                stylers: [{ color: "#9ca5b3" }]
            },
            {
                featureType: "road.highway",
                elementType: "geometry",
                stylers: [{ color: "#746855" }]
            },
            {
                featureType: "road.highway",
                elementType: "geometry.stroke",
                stylers: [{ color: "#1f2835" }]
            },
            {
                featureType: "road.highway",
                elementType: "labels.text.fill",
                stylers: [{ color: "#f3d19c" }]
            },
            {
                featureType: "transit",
                elementType: "geometry",
                stylers: [{ color: "#2f3948" }]
            },
            {
                featureType: "transit.station",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }]
            },
            {
                featureType: "water",
                elementType: "geometry",
                stylers: [{ color: "#17263c" }]
            },
            {
                featureType: "water",
                elementType: "labels.text.fill",
                stylers: [{ color: "#515c6d" }]
            },
            {
                featureType: "water",
                elementType: "labels.text.stroke",
                stylers: [{ color: "#17263c" }]
            }
        ] : [];

        this.map.setOptions({ styles });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 transition-all duration-300 ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.remove();
            }, 300);
        }
    }

    redirectToLogin() {
        window.location.href = 'login.html';
    }

    getWorkerIcon(workerType) {
        const iconMap = {
            'Carpintería': '🔨',
            'Electricista': '⚡',
            'Plomería': '🔧',
            'Pintor': '🎨',
            'Jardinería': '🌱',
            'Albañilería': '🧱',
            'Ferretería': '🛠️'
        };
        return iconMap[workerType] || '👷';
    }

    getCategoryColor(workType) {
        const colorMap = {
            'Carpintería': '#3b82f6', // azul
            'Electricista': '#eab308', // amarillo
            'Plomería': '#22c55e', // verde
            'Pintor': '#a855f7', // morado
            'Jardinería': '#ef4444', // rojo
            'Albañilería': '#6b7280', // gris
            'Ferretería': '#f97316' // naranja
        };
        return colorMap[workType] || '#6b7280';
    }

    initTheme() {
        const themeToggleBtn = document.getElementById('themeToggle');
        const themeToggleDesktop = document.getElementById('themeToggleDesktop');
        const themeIcon = themeToggleBtn.querySelector('i');
        const themeIconDesktop = themeToggleDesktop.querySelector('i');
        const html = document.documentElement;
        
        // Check for saved theme preference or use system preference
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Apply initial theme
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            html.classList.add('dark');
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
            themeIconDesktop.classList.remove('fa-moon');
            themeIconDesktop.classList.add('fa-sun');
        }
        
        // Toggle theme on button click (mobile)
        themeToggleBtn.addEventListener('click', () => {
            this.toggleTheme(themeIcon, themeIconDesktop);
        });

        // Toggle theme on button click (desktop)
        themeToggleDesktop.addEventListener('click', () => {
            this.toggleTheme(themeIcon, themeIconDesktop);
        });
    }

    adjustModalPosition() {
        const modal = document.getElementById('profileModal');
        const modalContent = modal?.querySelector('.modal-content');
        if (modalContent) {
            // Asegurar que el modal esté dentro de la ventana visible
            const viewportHeight = window.innerHeight;
            const modalHeight = modalContent.offsetHeight;
            
            if (modalHeight > viewportHeight) {
                modalContent.style.height = '90vh';
                modalContent.style.overflowY = 'auto';
            } else {
                modalContent.style.height = '';
                modalContent.style.overflowY = '';
            }
        }
    }
}

// Funciones globales para los botones de las tarjetas
function viewServiceDetails(serviceId) {
    // Implementar vista detallada del servicio
    console.log('Ver detalles del servicio:', serviceId);
}

function acceptRequest(requestId) {
    // Implementar aceptación de solicitud
    console.log('Aceptar solicitud:', requestId);
}

function rejectRequest(requestId) {
    // Implementar rechazo de solicitud
    console.log('Rechazar solicitud:', requestId);
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    new WorkerDashboard();
});