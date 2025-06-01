        // Inicializar Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        class ClientDashboard {
            constructor() {
                this.auth = firebase.auth();
                this.database = firebase.database();
                this.currentUser = null;
                this.userRequests = [];
                this.map = null;
                this.currentLocation = null;
                this.workersMarkers = new Map();
                this.workers = [];
                this.infoWindows = [];
                this.activeWorkersListener = null;
                
                this.init();
            }

            async init() {
                try {
                    // Iniciar verificación de autenticación
                    await this.checkAuthState();
                    
                    // Ocultar pantalla de carga principal inmediatamente después de la autenticación
                    this.hideLoadingScreen();
                    
                    // Inicializar componentes principales de manera asíncrona
                    Promise.all([
                        this.setupEventListeners(),
                        this.initializeMap(),
                        this.startRealTimeUpdates()
                    ]).catch(error => {
                        console.error('Error en la inicialización de componentes:', error);
                    });
                    
                } catch (error) {
                    console.error('Error initializing dashboard:', error);
                    window.location.href = 'login.html';
                }
            }

            checkAuthState() {
                return new Promise((resolve, reject) => {
                    this.auth.onAuthStateChanged(async (user) => {
                        if (user) {
                            this.currentUser = user;
                            
                            // Verificar que sea un cliente
                            const isClient = await this.verifyClientStatus(user.uid);
                            if (!isClient) {
                                console.error('Usuario no es cliente');
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

            async verifyClientStatus(uid) {
                try {
                    const clientRef = this.database.ref(`User/Clientes/${uid}`);
                    const snapshot = await clientRef.once('value');
                    return snapshot.exists();
                } catch (error) {
                    console.error('Error verificando estado de cliente:', error);
                    return false;
                }
            }

            async loadUserData(uid) {
                try {
                    const clientRef = this.database.ref(`User/Clientes/${uid}`);
                    const snapshot = await clientRef.once('value');
                    
                    if (snapshot.exists()) {
                        const userData = snapshot.val();
                        this.updateUserInterface(userData);
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
            }

            async loadUserRequests() {
                if (!this.currentUser) return;

                try {
                    const requestsRef = this.database.ref(`requests`);
                    const snapshot = await requestsRef.orderByChild('clientId').equalTo(this.currentUser.uid).once('value');
                    
                    this.userRequests = [];
                    if (snapshot.exists()) {
                        snapshot.forEach((childSnapshot) => {
                            const request = {
                                id: childSnapshot.key,
                                ...childSnapshot.val()
                            };
                            this.userRequests.push(request);
                        });
                    }
                    
                    this.updateStatistics();
                    
                } catch (error) {
                    console.error('Error cargando solicitudes:', error);
                }
            }

            updateStatistics() {
                const totalRequests = this.userRequests.length;
                const completedServices = this.userRequests.filter(req => req.status === 'completed').length;
                const activeRequests = this.userRequests.filter(req => ['pending', 'accepted', 'in_progress'].includes(req.status)).length;
                
                document.getElementById('totalRequests').textContent = totalRequests;
                document.getElementById('completedServices').textContent = completedServices;
                document.getElementById('activeRequests').textContent = activeRequests;
            }

            setupEventListeners() {
                // Botón de cerrar sesión
                document.getElementById('logoutBtn').addEventListener('click', () => {
                    this.showLogoutModal();
                });

                // Modal de confirmación de logout
                document.getElementById('cancelLogout').addEventListener('click', () => {
                    this.hideLogoutModal();
                });

                document.getElementById('confirmLogout').addEventListener('click', () => {
                    this.performLogout();
                });

                document.getElementById('newRequestBtn').addEventListener('click', () => {
                    this.showNewRequestModal();
                });

                // Modal de nueva solicitud
                document.getElementById('closeRequestModal').addEventListener('click', () => {
                    this.hideNewRequestModal();
                });

                document.getElementById('cancelRequest').addEventListener('click', () => {
                    this.hideNewRequestModal();
                });

                document.getElementById('newRequestForm').addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.createNewRequest();
                });

                // Cerrar modales al hacer clic fuera
                document.getElementById('logoutModal').addEventListener('click', (e) => {
                    if (e.target.id === 'logoutModal') {
                        this.hideLogoutModal();
                    }
                });

                document.getElementById('newRequestModal').addEventListener('click', (e) => {
                    if (e.target.id === 'newRequestModal') {
                        this.hideNewRequestModal();
                    }
                });

                // Botón para centrar el mapa en la ubicación actual
                document.getElementById('centerMapBtn').addEventListener('click', () => {
                    this.centerMapOnUser();
                });

                // Add new event listeners for map controls
                document.getElementById('refreshMapBtn').addEventListener('click', () => {
                    this.refreshWorkers();
                });

                // Actualizar trabajadores cada 5 minutos
                setInterval(() => this.loadActiveWorkers(), 300000);
            }

            showLogoutModal() {
                document.getElementById('logoutModal').classList.remove('hidden');
            }

            hideLogoutModal() {
                document.getElementById('logoutModal').classList.add('hidden');
            }

            showNewRequestModal() {
                document.getElementById('newRequestModal').classList.remove('hidden');
                // Limpiar formulario
                document.getElementById('newRequestForm').reset();
            }

            hideNewRequestModal() {
                document.getElementById('newRequestModal').classList.add('hidden');
            }

            async performLogout() {
                const confirmBtn = document.getElementById('confirmLogout');
                const spinner = document.getElementById('logoutSpinner');
                
                try {
                    // Mostrar indicador de carga
                    confirmBtn.disabled = true;
                    spinner.classList.remove('hidden');
                    
                    // Cerrar sesión
                    await this.auth.signOut();
                    
                    // Redirigir a login
                    this.redirectToLogin();
                    
                } catch (error) {
                    console.error('Error al cerrar sesión:', error);
                    
                    // Ocultar indicador de carga
                    confirmBtn.disabled = false;
                    spinner.classList.add('hidden');
                    
                    // Mostrar error
                    this.showNotification('Error al cerrar sesión. Inténtalo de nuevo.', 'error');
                }
            }

            async createNewRequest() {
                const form = document.getElementById('newRequestForm');
                const submitBtn = form.querySelector('button[type="submit"]');
                const spinner = document.getElementById('requestSpinner');
                
                try {
                    // Obtener datos del formulario
                    const serviceType = document.getElementById('serviceType').value;
                    const description = document.getElementById('serviceDescription').value;
                    const estimatedBudget = document.getElementById('estimatedBudget').value;
                    
                    if (!serviceType || !description) {
                        this.showNotification('Por favor completa todos los campos requeridos', 'error');
                        return;
                    }
                    
                    // Mostrar indicador de carga
                    submitBtn.disabled = true;
                    spinner.classList.remove('hidden');
                    
                    // Crear nueva solicitud
                    const requestData = {
                        clientId: this.currentUser.uid,
                        clientName: this.currentUser.displayName || 'Cliente',
                        clientEmail: this.currentUser.email,
                        serviceType: serviceType,
                        description: description,
                        estimatedBudget: estimatedBudget ? parseFloat(estimatedBudget) : null,
                        status: 'pending',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    
                    // Guardar en Firebase
                    const requestRef = this.database.ref('requests').push();
                    await requestRef.set(requestData);
                    
                    // Ocultar modal
                    this.hideNewRequestModal();
                    
                    // Mostrar confirmación
                    this.showNotification('Solicitud creada exitosamente', 'success');
                    
                    // Recargar solicitudes para actualizar estadísticas
                    await this.loadUserRequests();
                    
                } catch (error) {
                    console.error('Error creando solicitud:', error);
                    this.showNotification('Error al crear solicitud. Inténtalo de nuevo.', 'error');
                } finally {
                    submitBtn.disabled = false;
                    spinner.classList.add('hidden');
                }
            }

            redirectToLogin() {
                // Limpiar cualquier dato local
                localStorage.clear();
                sessionStorage.clear();
                
                // Redirigir a la página de login
                window.location.href = 'login.html';
            }

            hideLoadingScreen() {
                const loadingScreen = document.getElementById('loadingScreen');
                if (loadingScreen) {
                    loadingScreen.style.opacity = '0';
                    setTimeout(() => {
                        loadingScreen.style.display = 'none';
                    }, 300);
                }
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
                }, 5000);
            }

            async initializeMap() {
                // Inicializar el mapa
                this.map = new google.maps.Map(document.getElementById('workersMap'), {
                    zoom: 13,
                    center: { lat: 4.6097, lng: -74.0817 }, // Bogotá por defecto
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

                // Obtener ubicación actual
                await this.getCurrentLocation();
            }

            async getCurrentLocation() {
                return new Promise((resolve, reject) => {
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                            (position) => {
                                this.currentLocation = {
                                    lat: position.coords.latitude,
                                    lng: position.coords.longitude
                                };

                                // Agregar marcador de ubicación actual
                                new google.maps.Marker({
                                    position: this.currentLocation,
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

                                this.map.setCenter(this.currentLocation);
                                this.map.setZoom(15);
                                resolve(this.currentLocation);
                            },
                            (error) => {
                                console.warn('Error getting location:', error);
                                resolve({ lat: 4.6097, lng: -74.0817 }); // Bogotá como fallback
                            }
                        );
                    } else {
                        resolve({ lat: 4.6097, lng: -74.0817 }); // Bogotá como fallback
                    }
                });
            }

            async loadActiveWorkers() {
                try {
                    this.showWorkersLoadingIndicator();

                    const workersGrid = document.getElementById('workersGrid');
                    const noWorkersState = document.getElementById('noWorkersState');

                    // Get current location first (if not already obtained)
                    if (!this.currentLocation) {
                        await this.getCurrentLocation();
                    }

                    // Get active workers from Firebase
                    const activeWorkersSnapshot = await this.database.ref('active_workers').once('value');
                    const activeWorkersData = activeWorkersSnapshot.val();

                    if (!activeWorkersData) {
                        noWorkersState.classList.remove('hidden');
                        document.getElementById('activeWorkersCount').textContent = '0 trabajadores activos';
                        this.hideWorkersLoadingIndicator();
                        return;
                    }

                    const workerPromises = Object.keys(activeWorkersData).map(async (workerId) => {
                        try {
                            const workerSnapshot = await this.database.ref(`User/Trabajadores/${workerId}`).once('value');
                            const workerData = workerSnapshot.val();

                            if (workerData && activeWorkersData[workerId].isAvailable) {
                                let latitude = workerData.location?.latitude;
                                let longitude = workerData.location?.longitude;

                                if ((!latitude || !longitude) && activeWorkersData[workerId].l) {
                                    latitude = activeWorkersData[workerId].l[0];
                                    longitude = activeWorkersData[workerId].l[1];
                                }

                                if (!latitude || !longitude) return null;

                                const distance = this.calculateDistance(
                                    this.currentLocation.lat,
                                    this.currentLocation.lng,
                                    parseFloat(latitude),
                                    parseFloat(longitude)
                                );

                                return {
                                    id: workerId,
                                    name: workerData.name || 'Sin nombre',
                                    lastName: workerData.lastName || '',
                                    work: workerData.work || 'Sin especificar',
                                    description: workerData.description || 'Sin descripción disponible',
                                    phone: workerData.phone || 'No disponible',
                                    email: workerData.email || 'No disponible',
                                    rating: workerData.rating || 4.0,
                                    completedJobs: workerData.completedJobs || 0,
                                    schedule: workerData.schedule || {
                                        days: 'Lunes a Viernes',
                                        hours: '8:00 AM - 6:00 PM'
                                    },
                                    latitude: parseFloat(latitude),
                                    longitude: parseFloat(longitude),
                                    location: workerData.location?.address || 'Ubicación no especificada',
                                    isActive: true,
                                    distance: distance
                                };
                            }
                            return null;
                        } catch (error) {
                            console.error(`Error loading worker ${workerId}:`, error);
                            return null;
                        }
                    });

                    this.workers = (await Promise.all(workerPromises))
                        .filter(worker => worker !== null)
                        .sort((a, b) => a.distance - b.distance);

                    // Update active workers count
                    document.getElementById('activeWorkersCount').textContent = 
                        `${this.workers.length} trabajador${this.workers.length !== 1 ? 'es' : ''} activo${this.workers.length !== 1 ? 's' : ''}`;

                    if (this.workers.length === 0) {
                        noWorkersState.classList.remove('hidden');
                    } else {
                        noWorkersState.classList.add('hidden');
                        // Display workers on map and grid
                        this.displayWorkersOnMap();
                        this.displayWorkersInGrid();
                    }

                } catch (error) {
                    console.error('Error loading workers:', error);
                    document.getElementById('noWorkersState').classList.remove('hidden');
                } finally {
                    this.hideWorkersLoadingIndicator();
                }
            }

            displayWorkersInGrid() {
                const workersGrid = document.getElementById('workersGrid');
                // Filtrar solo trabajadores activos y por distancia/profesión
                const activeWorkers = this.workers.filter(worker => worker.isActive);
                const filteredWorkers = this.filterWorkersByDistance(activeWorkers);
                
                if (filteredWorkers.length === 0) {
                    document.getElementById('noWorkersState').classList.remove('hidden');
                    workersGrid.innerHTML = '';
                } else {
                    document.getElementById('noWorkersState').classList.add('hidden');
                    workersGrid.innerHTML = filteredWorkers
                        .map(worker => `
                            <div class="worker-card transform hover:-translate-y-1 transition-all duration-200">
                                <div class="p-4 border-b border-gray-100">
                                    <div class="flex items-center space-x-4">
                                        <div class="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                                             style="background: linear-gradient(135deg, ${this.getCategoryColor(worker.work)}, ${this.getLighterColor(worker.work)}); color: white;">
                                            ${this.getWorkerIcon(worker.work)}
                                        </div>
                                        <div>
                                            <h3 class="font-semibold text-lg text-gray-800">${worker.name} ${worker.lastName}</h3>
                                            <div class="flex items-center space-x-2">
                                                <span class="text-sm" style="color: ${this.getCategoryColor(worker.work)}">${worker.work}</span>
                                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                    ● Disponible
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="p-4 space-y-3">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center">
                                            <span class="text-yellow-400 text-sm mr-1">
                                                ${'★'.repeat(Math.floor(worker.rating))}${'☆'.repeat(5 - Math.floor(worker.rating))}
                                            </span>
                                            <span class="text-sm text-gray-600">${worker.rating.toFixed(1)}</span>
                                        </div>
                                        <span class="text-sm text-blue-600">
                                            <i class="fas fa-check-circle mr-1"></i>${worker.completedJobs} servicios
                                        </span>
                                    </div>

                                    <p class="text-sm text-gray-600 line-clamp-2">${worker.description}</p>

                                    <div class="flex items-center text-sm text-gray-500">
                                        <i class="fas fa-map-marker-alt text-red-500 mr-2"></i>
                                        <span>${(worker.distance / 1000).toFixed(1)} km de distancia</span>
                                    </div>

                                    <div class="flex space-x-2 pt-3">
                                        <button onclick="requestService('${worker.id}')" 
                                                class="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white py-2 px-3 rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-600 transition-all shadow-sm hover:shadow-md">
                                            <i class="fas fa-handshake mr-1"></i>Solicitar
                                        </button>
                                        <button onclick="viewWorkerProfile('${worker.id}')"
                                                class="flex-1 bg-gradient-to-r from-gray-600 to-gray-500 text-white py-2 px-3 rounded-lg text-sm font-medium hover:from-gray-700 hover:to-gray-600 transition-all shadow-sm hover:shadow-md">
                                            <i class="fas fa-user mr-1"></i>Ver Perfil
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                }

                // Actualizar contador de trabajadores activos
                document.getElementById('activeWorkersCount').textContent = 
                    `${filteredWorkers.length} trabajador${filteredWorkers.length !== 1 ? 'es' : ''} activo${filteredWorkers.length !== 1 ? 's' : ''}`;
            }

            filterWorkersByDistance(workers) {
                const maxDistance = document.getElementById('distanceRange').value;
                const profession = document.getElementById('filterProfession').value;
                
                return workers.filter(worker => {
                    const matchesDistance = !maxDistance || (worker.distance / 1000) <= parseFloat(maxDistance);
                    const matchesProfession = !profession || worker.work.toLowerCase() === profession.toLowerCase();
                    return matchesDistance && matchesProfession;
                });
            }

            displayWorkersOnMap() {
                // Limpiar marcadores existentes
                this.workersMarkers.forEach(({ marker, infoWindow }) => {
                    marker.setMap(null);
                    infoWindow.close();
                });
                this.workersMarkers.clear();
                this.infoWindows = [];

                // Filtrar trabajadores según los filtros actuales
                const filteredWorkers = this.filterWorkersByDistance(this.workers);

                // Crear bounds para ajustar el mapa
                const bounds = new google.maps.LatLngBounds();
                if (this.currentLocation) {
                    bounds.extend(this.currentLocation);
                }

                filteredWorkers.forEach(worker => {
                    const position = {
                        lat: worker.latitude,
                        lng: worker.longitude
                    };

                    // Crear marcador con ícono personalizado
                    const marker = new google.maps.Marker({
                        position: position,
                        map: this.map,
                        title: `${worker.name} ${worker.lastName} - ${worker.work}`,
                        icon: {
                            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                                <svg width="50" height="50" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="25" cy="25" r="22" fill="${this.getCategoryColor(worker.work)}" stroke="white" stroke-width="3"/>
                                    <text x="25" y="32" text-anchor="middle" font-size="20" fill="white">${this.getWorkerIcon(worker.work)}</text>
                                </svg>
                            `)}`,
                            scaledSize: new google.maps.Size(50, 50),
                            anchor: new google.maps.Point(25, 25)
                        },
                        animation: google.maps.Animation.DROP
                    });

                    // Crear ventana de información
                    const infoWindow = new google.maps.InfoWindow({
                        content: this.createWorkerInfoContent(worker),
                        position: position
                    });

                    // Agregar evento click al marcador
                    marker.addListener('click', () => {
                        // Cerrar todas las ventanas de información abiertas
                        this.infoWindows.forEach(iw => iw.close());
                        
                        // Abrir la ventana de información del trabajador seleccionado
                        infoWindow.open(this.map, marker);
                        
                        // Centrar el mapa en el marcador
                        this.map.panTo(position);
                        
                        // Ajustar el zoom si está muy alejado
                        if (this.map.getZoom() < 14) {
                            this.map.setZoom(15);
                        }
                    });

                    // Guardar referencias del marcador y la ventana de información
                    this.workersMarkers.set(worker.id, { marker, infoWindow });
                    this.infoWindows.push(infoWindow);
                    
                    // Extender los límites del mapa
                    bounds.extend(position);
                });

                // Ajustar el mapa para mostrar todos los marcadores
                if (!bounds.isEmpty()) {
                    this.map.fitBounds(bounds);
                    
                    // Ajustar el zoom máximo
                    const listener = google.maps.event.addListener(this.map, 'idle', () => {
                        if (this.map.getZoom() > 15) {
                            this.map.setZoom(15);
                        }
                        google.maps.event.removeListener(listener);
                    });
                }
            }

            createWorkerCard(worker) {
                return `
                    <div class="worker-card">
                        <h3 class="font-semibold text-lg mb-2">${worker.name} ${worker.lastName}</h3>
                        <p class="text-sm mb-2">
                            <span class="text-xl mr-2">${this.getWorkerIcon(worker.work)}</span>
                            ${worker.work}
                        </p>
                        <p class="text-sm text-gray-600">
                            <i class="fas fa-star text-yellow-400 mr-1"></i>
                            ${worker.rating.toFixed(1)} / 5.0
                        </p>
                        ${worker.description ? `<p class="text-sm mt-2">${worker.description}</p>` : ''}
                        <div class="mt-4 flex space-x-2">
                            <button onclick="requestService('${worker.id}')" 
                                    class="btn btn-primary text-sm py-1 px-3">
                                <i class="fas fa-handshake mr-1"></i>Contratar
                            </button>
                            <button onclick="viewWorkerProfile('${worker.id}')"
                                    class="btn btn-secondary text-sm py-1 px-3">
                                <i class="fas fa-user mr-1"></i>Ver Perfil
                            </button>
                        </div>
                    </div>
                `;
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

            calculateDistance(lat1, lon1, lat2, lon2) {
                const R = 6371000; // Radio de la Tierra en metros
                const φ1 = lat1 * Math.PI/180;
                const φ2 = lat2 * Math.PI/180;
                const Δφ = (lat2-lat1) * Math.PI/180;
                const Δλ = (lon2-lon1) * Math.PI/180;

                const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                        Math.cos(φ1) * Math.cos(φ2) *
                        Math.sin(Δλ/2) * Math.sin(Δλ/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

                return R * c; // Distancia en metros
            }

            startRealTimeUpdates() {
                // Cleanup any existing listener
                if (this.activeWorkersListener) {
                    this.activeWorkersListener();
                }

                // Set up real-time listener for active workers
                this.activeWorkersListener = this.database.ref('active_workers').on('value', async (snapshot) => {
                    const activeWorkersData = snapshot.val() || {};
                    const currentWorkerIds = new Set(this.workers.map(w => w.id));
                    const newWorkerIds = new Set(Object.keys(activeWorkersData));

                    // Identificar trabajadores desconectados
                    for (const workerId of currentWorkerIds) {
                        if (!newWorkerIds.has(workerId) || !activeWorkersData[workerId].isAvailable) {
                            // Remover marcador del mapa con animación
                            const markerInfo = this.workersMarkers.get(workerId);
                            if (markerInfo) {
                                markerInfo.infoWindow.close();
                                markerInfo.marker.setAnimation(google.maps.Animation.DROP);
                                setTimeout(() => {
                                    markerInfo.marker.setMap(null);
                                    this.workersMarkers.delete(workerId);
                                }, 200);
                            }
                            // Mostrar notificación de desconexión
                            const worker = this.workers.find(w => w.id === workerId);
                            if (worker) {
                                this.showNotification(`${worker.name} ${worker.lastName} se ha desconectado`, 'info');
                            }
                        }
                    }

                    // Identificar nuevos trabajadores conectados
                    for (const workerId of newWorkerIds) {
                        if (!currentWorkerIds.has(workerId) && activeWorkersData[workerId].isAvailable) {
                            const workerRef = this.database.ref(`User/Trabajadores/${workerId}`);
                            const workerSnapshot = await workerRef.once('value');
                            const workerData = workerSnapshot.val();
                            
                            if (workerData) {
                                this.showNotification(`${workerData.name} está disponible para servicios`, 'success');
                            }
                        }
                    }

                    // Recargar trabajadores
                    await this.loadActiveWorkers();
                });
            }

            createWorkerInfoContent(worker) {
                return `
                    <div class="info-window p-4 min-w-[300px] bg-white shadow-lg rounded-lg">
                        <div class="flex items-center mb-4 bg-gradient-to-r from-blue-50 to-white p-3 rounded-lg">
                            <div class="text-3xl mr-3" style="color: ${this.getCategoryColor(worker.work)}">
                                ${this.getWorkerIcon(worker.work)}
                            </div>
                            <div>
                                <h3 class="font-bold text-lg text-gray-800">${worker.name} ${worker.lastName}</h3>
                                <div class="flex items-center">
                                    <span class="text-sm font-medium" style="color: ${this.getCategoryColor(worker.work)}">${worker.work}</span>
                                    <span class="ml-2 px-2 py-0.5 rounded-full text-xs ${worker.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}">
                                        ${worker.isActive ? '● Disponible' : '○ No disponible'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="mb-4 p-3 bg-gray-50 rounded-lg">
                            <div class="flex items-center justify-between mb-2">
                                <div class="flex items-center">
                                    <span class="text-yellow-400 text-lg mr-2">
                                        ${'★'.repeat(Math.floor(worker.rating))}${'☆'.repeat(5 - Math.floor(worker.rating))}
                                    </span>
                                    <span class="text-gray-700 font-medium">${worker.rating.toFixed(1)}/5.0</span>
                                </div>
                                <span class="text-sm text-blue-600">
                                    <i class="fas fa-check-circle mr-1"></i>${worker.completedJobs} servicios
                                </span>
                            </div>
                            <p class="text-gray-600 text-sm leading-relaxed">${worker.description}</p>
                        </div>
                        
                        <div class="space-y-3 mb-4">
                            <div class="flex items-center px-3 py-2 hover:bg-gray-50 rounded transition-colors">
                                <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                                    <i class="fas fa-phone text-green-600"></i>
                                </div>
                                <span class="text-gray-700">${worker.phone}</span>
                            </div>
                            <div class="flex items-center px-3 py-2 hover:bg-gray-50 rounded transition-colors">
                                <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                                    <i class="fas fa-envelope text-blue-600"></i>
                                </div>
                                <span class="text-gray-700">${worker.email}</span>
                            </div>
                            <div class="flex items-center px-3 py-2 hover:bg-gray-50 rounded transition-colors">
                                <div class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center mr-3">
                                    <i class="fas fa-map-marker-alt text-red-600"></i>
                                </div>
                                <span class="text-gray-700">${worker.location}</span>
                            </div>
                            <div class="flex items-center px-3 py-2 hover:bg-gray-50 rounded transition-colors">
                                <div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                                    <i class="fas fa-route text-purple-600"></i>
                                </div>
                                <span class="text-gray-700">${(worker.distance / 1000).toFixed(1)} km de distancia</span>
                            </div>
                        </div>
                        
                        <div class="flex space-x-2 pt-3 border-t border-gray-100">
                            <button onclick="requestService('${worker.id}')" 
                                    class="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white py-2 px-4 rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-600 transition-all shadow-md hover:shadow-lg">
                                <i class="fas fa-handshake mr-2"></i>Solicitar
                            </button>
                            <button onclick="viewWorkerProfile('${worker.id}')"
                                    class="flex-1 bg-gradient-to-r from-gray-600 to-gray-500 text-white py-2 px-4 rounded-lg text-sm font-medium hover:from-gray-700 hover:to-gray-600 transition-all shadow-md hover:shadow-lg">
                                <i class="fas fa-user mr-2"></i>Ver Perfil
                            </button>
                        </div>
                    </div>
                `;
            }

            displayWorkerDetails(worker) {
                try {
                    const modal = document.getElementById('workerDetailsModal');
                    const content = document.getElementById('workerDetailsContent');

                    content.innerHTML = `
                        <div class="space-y-6 bg-white p-6 rounded-xl max-w-3xl mx-auto">
                            <!-- Encabezado del perfil -->
                            <div class="flex items-center space-x-6 bg-gradient-to-r from-blue-50 to-white p-6 rounded-xl">
                                <div class="worker-avatar-large w-28 h-28 rounded-full flex items-center justify-center text-white text-5xl shadow-lg"
                                     style="background: linear-gradient(135deg, ${this.getCategoryColor(worker.work)}, ${this.getLighterColor(worker.work)})">
                                    ${this.getWorkerIcon(worker.work)}
                                </div>
                                <div>
                                    <h3 class="text-2xl font-bold text-gray-800 mb-2">${worker.name} ${worker.lastName}</h3>
                                    <div class="flex items-center space-x-3">
                                        <span class="text-lg font-medium" style="color: ${this.getCategoryColor(worker.work)}">${worker.work}</span>
                                        <span class="px-3 py-1 rounded-full text-sm font-medium ${worker.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}">
                                            ${worker.isActive ? '● Disponible' : '○ No disponible'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <!-- Estadísticas -->
                            <div class="grid grid-cols-2 gap-4">
                                <div class="bg-gradient-to-br from-yellow-50 to-white p-4 rounded-xl shadow-sm">
                                    <div class="text-sm font-medium text-gray-600 mb-2">Calificación</div>
                                    <div class="flex items-center">
                                        <div class="text-3xl font-bold text-gray-800 mr-3">${worker.rating.toFixed(1)}</div>
                                        <div class="text-yellow-400 text-xl">
                                            ${'★'.repeat(Math.floor(worker.rating))}${'☆'.repeat(5 - Math.floor(worker.rating))}
                                        </div>
                                    </div>
                                </div>
                                <div class="bg-gradient-to-br from-blue-50 to-white p-4 rounded-xl shadow-sm">
                                    <div class="text-sm font-medium text-gray-600 mb-2">Servicios Completados</div>
                                    <div class="text-3xl font-bold text-gray-800">${worker.completedJobs}</div>
                                </div>
                            </div>

                            <!-- Información de Contacto -->
                            <div class="grid grid-cols-2 gap-6">
                                <div class="space-y-4">
                                    <h4 class="font-semibold text-gray-800 mb-3">Información de Contacto</h4>
                                    <div class="space-y-3">
                                        <div class="flex items-center p-3 bg-green-50 rounded-lg">
                                            <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-4">
                                                <i class="fas fa-phone text-green-600"></i>
                                            </div>
                                            <div>
                                                <div class="text-xs font-medium text-green-600">Teléfono</div>
                                                <div class="text-gray-700">${worker.phone}</div>
                                            </div>
                                        </div>
                                        <div class="flex items-center p-3 bg-blue-50 rounded-lg">
                                            <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                                                <i class="fas fa-envelope text-blue-600"></i>
                                            </div>
                                            <div>
                                                <div class="text-xs font-medium text-blue-600">Email</div>
                                                <div class="text-gray-700">${worker.email}</div>
                                            </div>
                                        </div>
                                        <div class="flex items-center p-3 bg-red-50 rounded-lg">
                                            <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mr-4">
                                                <i class="fas fa-map-marker-alt text-red-600"></i>
                                            </div>
                                            <div>
                                                <div class="text-xs font-medium text-red-600">Ubicación</div>
                                                <div class="text-gray-700">${worker.location}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h4 class="font-semibold text-gray-800 mb-3">Horario de Trabajo</h4>
                                    <div class="p-4 bg-gray-50 rounded-lg">
                                        <div class="space-y-3">
                                            <div class="flex items-center">
                                                <i class="far fa-calendar-alt text-gray-500 w-6"></i>
                                                <span class="text-gray-700">${worker.schedule.days}</span>
                                            </div>
                                            <div class="flex items-center">
                                                <i class="far fa-clock text-gray-500 w-6"></i>
                                                <span class="text-gray-700">${worker.schedule.hours}</span>
                                            </div>
                                            <div class="flex items-center">
                                                <i class="fas fa-route text-gray-500 w-6"></i>
                                                <span class="text-gray-700">${(worker.distance / 1000).toFixed(1)} km de distancia</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Botones de Acción -->
                            <div class="flex space-x-4 pt-6 border-t border-gray-100">
                                <button onclick="requestService('${worker.id}')" 
                                        class="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3 px-6 rounded-xl text-sm font-medium hover:from-blue-700 hover:to-blue-600 transition-all shadow-md hover:shadow-lg">
                                    <i class="fas fa-handshake mr-2"></i>Solicitar Servicio
                                </button>
                                <button onclick="contactWorker('${worker.id}')"
                                        class="flex-1 bg-gradient-to-r from-green-600 to-green-500 text-white py-3 px-6 rounded-xl text-sm font-medium hover:from-green-700 hover:to-green-600 transition-all shadow-md hover:shadow-lg">
                                    <i class="fas fa-phone mr-2"></i>Contactar
                                </button>
                            </div>
                        </div>
                    `;

                    modal.classList.remove('hidden');
                } catch (error) {
                    console.error('Error displaying worker details:', error);
                    this.showNotification('Error al cargar los detalles del trabajador', 'error');
                }
            }

            getLighterColor(workType) {
                const colorMap = {
                    'Carpintería': '#60A5FA',
                    'Electricista': '#FCD34D',
                    'Plomería': '#34D399',
                    'Pintor': '#C084FC',
                    'Jardinería': '#F87171',
                    'Albañilería': '#9CA3AF',
                    'Ferretería': '#FB923C'
                };
                return colorMap[workType] || '#9CA3AF';
            }

            refreshWorkers() {
                this.loadActiveWorkers();
            }

            centerMapOnUser() {
                if (this.currentLocation && this.map) {
                    this.map.setCenter(this.currentLocation);
                    this.map.setZoom(15);
                }
            }

            showWorkersLoadingIndicator() {
                const indicator = document.getElementById('workersLoadingIndicator');
                if (indicator) {
                    indicator.style.transform = 'translateY(0)';
                }
            }

            hideWorkersLoadingIndicator() {
                const indicator = document.getElementById('workersLoadingIndicator');
                if (indicator) {
                    indicator.style.transform = 'translateY(full)';
                }
            }
        }

        // Inicializar dashboard cuando se carga la página
        let clientDashboard;
        
        document.addEventListener('DOMContentLoaded', () => {
            clientDashboard = new ClientDashboard();
        });

        // Manejar errores globales
        window.addEventListener('error', (e) => {
            console.error('Error global:', e.error);
            if (clientDashboard) {
                clientDashboard.showNotification('Ha ocurrido un error inesperado', 'error');
            }
        });

        // Manejar promesas rechazadas no capturadas
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Promise rejection no manejada:', e.reason);
            if (clientDashboard) {
                clientDashboard.showNotification('Error de conexión', 'error');
            }
        });

        // Funciones globales para los botones en InfoWindows
        function requestService(workerId) {
            // Implementar lógica para solicitar servicio
            document.getElementById('newRequestModal').classList.remove('hidden');
        }

        function viewWorkerProfile(workerId) {
            // Implementar lógica para ver perfil del trabajador
            const worker = clientDashboard.workers.find(w => w.id === workerId);
            if (worker) {
                clientDashboard.displayWorkerDetails(worker);
            }
        }