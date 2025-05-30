
        // Inicializar Firebase
        firebase.initializeApp(firebaseConfig);
        const database = firebase.database();
        

        

        class MapClient {
            constructor() {
                this.map = null;
                this.currentLocation = null;
                this.workersMarkers = new Map();
                this.currentFilter = 'all';
                this.workers = [];
                this.infoWindows = [];
                this.locationObtained = false;
                this.firebaseConnected = false;

                this.updateStatus('loadingStatus', 'Inicializando aplicación...');
                this.setupEventListeners();
                this.testFirebaseConnection();
            }

            updateStatus(elementId, message, isError = false) {
                const element = document.getElementById(elementId);
                if (element) {
                    element.textContent = message;
                    if (isError) {
                        element.className += ' text-red-500';
                    }
                }
                console.log(`[${elementId}] ${message}`);
            }

            updateDebugStatus(statusId, message, status = 'warning') {
                const element = document.getElementById(statusId);
                if (element) {
                    const indicator = element.querySelector('.status-indicator');
                    const text = element.querySelector('span:last-child');
                    
                    indicator.className = `status-indicator status-${status}`;
                    text.textContent = message;
                }
            }

            async testFirebaseConnection() {
                try {
                    this.updateStatus('loadingStatus', 'Conectando a Firebase...');
                    this.updateDebugStatus('firebaseStatus', 'Firebase: Conectando...', 'warning');
                    
                    // Probar conexión básica
                    await database.ref('.info/connected').once('value');
                    this.firebaseConnected = true;
                    
                    this.updateDebugStatus('firebaseStatus', 'Firebase: Conectado', 'success');
                    this.updateStatus('loadingStatus', 'Cargando trabajadores activos...');
                    
                    await this.loadWorkersFromFirebase();
                    
                } catch (error) {
                    console.error('Error conectando a Firebase:', error);
                    this.updateDebugStatus('firebaseStatus', 'Firebase: Error de conexión', 'error');
                    this.updateStatus('loadingStatus', 'Error de conexión a Firebase', true);
                    this.loadDemoWorkers(); // Cargar datos demo como fallback
                }
            }

            async loadWorkersFromFirebase() {
    try {
        this.updateDebugStatus('workersStatus', 'Trabajadores: Obteniendo lista activa...', 'warning');
        
        // Obtener la lista de trabajadores activos - CAMBIO AQUÍ
        const activeWorkersSnapshot = await database.ref('active_workers').once('value');
        const activeWorkersData = activeWorkersSnapshot.val();
        
        console.log('Datos de active_workers:', activeWorkersData);
        
        if (!activeWorkersData || Object.keys(activeWorkersData).length === 0) {
            console.log('No hay trabajadores activos registrados');
            this.updateDebugStatus('workersStatus', 'Trabajadores: Sin activos', 'warning');
            this.loadDemoWorkers();
            return;
        }

        // Extraer los IDs de trabajadores activos - CAMBIO PRINCIPAL AQUÍ
        const activeWorkerIds = Object.keys(activeWorkersData);
        console.log('IDs de trabajadores activos:', activeWorkerIds);

        // Obtener datos completos de cada trabajador activo
        const workerPromises = activeWorkerIds.map(async (workerId) => {
            try {
                console.log(`Buscando datos del trabajador: ${workerId}`);
                
                // Buscar en la ruta principal de trabajadores
                const workerSnapshot = await database.ref(`User/Trabajadores/${workerId}`).once('value');
                const workerData = workerSnapshot.val();
                
                if (workerData) {
                    console.log(`Datos encontrados para ${workerId}:`, workerData);
                    
                    // Verificar que tenga coordenadas (pueden estar en active_workers)
                    let latitude = workerData.latitude;
                    let longitude = workerData.longitude;
                    
                    // Si no tiene coordenadas en User/Trabajadores, usar las de active_workers
                    if ((!latitude || !longitude) && activeWorkersData[workerId] && activeWorkersData[workerId].l) {
                        latitude = activeWorkersData[workerId].l[0];
                        longitude = activeWorkersData[workerId].l[1];
                        console.log(`Usando coordenadas de active_workers para ${workerId}: ${latitude}, ${longitude}`);
                    }
                    
                    if (!latitude || !longitude) {
                        console.warn(`Trabajador ${workerId} sin coordenadas válidas`);
                        return null;
                    }
                    
                    return {
                        id: workerId,
                        name: workerData.name || workerData.firstName || 'Sin nombre',
                        lastName: workerData.lastName || workerData.lastNombre || '',
                        work: (workerData.work || workerData.typeOfWork || 'Sin especificar').trim(),
                        description: workerData.description || workerData.descripcion || 'Sin descripción disponible',
                        phone: workerData.phone || workerData.telefono || 'No disponible',
                        email: workerData.email || 'No disponible',
                        rating: workerData.rating || 4.0,
                        latitude: parseFloat(latitude),
                        longitude: parseFloat(longitude),
                        location: workerData.location || 'Bogotá',
                        isActive: true
                    };
                } else {
                    console.warn(`No se encontraron datos para el trabajador: ${workerId}`);
                    return null;
                }
            } catch (error) {
                console.error(`Error obteniendo datos del trabajador ${workerId}:`, error);
                return null;
            }
        });

        const workers = await Promise.all(workerPromises);
        this.workers = workers.filter(worker => worker !== null);
        
        console.log(`Trabajadores cargados exitosamente: ${this.workers.length}`);
        this.updateDebugStatus('workersStatus', `Trabajadores: ${this.workers.length} cargados`, 'success');
        
        // Actualizar contador en debug
        document.getElementById('workersCount').textContent = `Trabajadores activos: ${this.workers.length}`;
        
        if (this.workers.length === 0) {
            console.log('No se pudieron cargar trabajadores válidos, usando datos demo');
            this.loadDemoWorkers();
        } else {
            this.displayWorkersOnMap();
        }
        
    } catch (error) {
        console.error('Error cargando trabajadores:', error);
        this.updateDebugStatus('workersStatus', 'Trabajadores: Error al cargar', 'error');
        this.loadDemoWorkers();
    }
}



            loadDemoWorkers() {
                console.log('Cargando trabajadores demo...');
                this.updateDebugStatus('workersStatus', 'Trabajadores: Usando datos demo', 'warning');
                
                // Datos demo para pruebas (coordenadas reales de Bogotá)
                this.workers = [
                    {
                        id: 'demo1',
                        name: 'Carlos',
                        lastName: 'Martínez',
                        work: 'Carpintería',
                        description: 'Especialista en muebles a medida y reparaciones de madera',
                        phone: '+57 300 123 4567',
                        email: 'carlos.martinez@email.com',
                        rating: 4.8,
                        latitude: 4.6097,
                        longitude: -74.0817,
                        location: 'Centro, Bogotá',
                        isActive: true
                    },
                    {
                        id: 'demo2',
                        name: 'Ana',
                        lastName: 'Rodríguez',
                        work: 'Electricista',
                        description: 'Instalaciones eléctricas residenciales y comerciales',
                        phone: '+57 301 234 5678',
                        email: 'ana.rodriguez@email.com',
                        rating: 4.5,
                        latitude: 4.6351,
                        longitude: -74.0703,
                        location: 'Chapinero, Bogotá',
                        isActive: true
                    },
                    {
                        id: 'demo3',
                        name: 'Miguel',
                        lastName: 'Torres',
                        work: 'Plomería',
                        description: 'Reparación de tuberías y instalaciones sanitarias',
                        phone: '+57 302 345 6789',
                        email: 'miguel.torres@email.com',
                        rating: 4.2,
                        latitude: 4.6286,
                        longitude: -74.0936,
                        location: 'Zona Rosa, Bogotá',
                        isActive: true
                    }
                ];
                
                document.getElementById('workersCount').textContent = `Trabajadores activos: ${this.workers.length} (demo)`;
                this.displayWorkersOnMap();
            }

            setupEventListeners() {
                document.getElementById('serviceFilter').addEventListener('change', (e) => {
                    this.currentFilter = e.target.value;
                    this.displayWorkersOnMap();
                });

                document.getElementById('legendToggle').addEventListener('click', () => {
                    this.toggleLegend();
                });

                this.setupLocationSearch();
            }

            initMap() {
                this.updateStatus('loadingStatus', 'Inicializando mapa...');
                
                // Inicializar mapa centrado en Bogotá
                this.map = new google.maps.Map(document.getElementById('map'), {
                    zoom: 12,
                    center: { lat: 4.6097, lng: -74.0817 },
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

                this.getCurrentLocation();
            }

            getCurrentLocation() {
                this.updateDebugStatus('locationStatus', 'Ubicación: Obteniendo...', 'warning');
                
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            this.currentLocation = {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude
                            };

                            this.locationObtained = true;
                            this.updateDebugStatus('locationStatus', 'Ubicación: Obtenida', 'success');

                            // Centrar mapa en ubicación actual
                            this.map.setCenter(this.currentLocation);
                            this.map.setZoom(15);

                            // Agregar marcador de ubicación actual
                            const currentLocationMarker = new google.maps.Marker({
                                position: this.currentLocation,
                                map: this.map,
                                title: 'Mi ubicación actual',
                                icon: {
                                    path: google.maps.SymbolPath.CIRCLE,
                                    fillColor: '#3b82f6',
                                    fillOpacity: 1,
                                    strokeColor: '#ffffff',
                                    strokeWeight: 4,
                                    scale: 10
                                },
                                animation: google.maps.Animation.DROP
                            });

                            this.hideLoadingOverlay();
                        },
                        (error) => {
                            console.warn('Error obteniendo ubicación:', error);
                            this.updateDebugStatus('locationStatus', 'Ubicación: Error (usando Bogotá)', 'warning');
                            
                            // Usar Bogotá como predeterminado
                            this.map.setCenter({ lat: 4.6097, lng: -74.0817 });
                            this.map.setZoom(13);
                            this.hideLoadingOverlay();
                        },
                        {
                            enableHighAccuracy: true,
                            timeout: 10000,
                            maximumAge: 300000
                        }
                    );
                } else {
                    console.error('Geolocalización no soportada');
                    this.updateDebugStatus('locationStatus', 'Ubicación: No soportada', 'error');
                    this.hideLoadingOverlay();
                }
            }

            hideLoadingOverlay() {
                document.getElementById('loadingOverlay').style.display = 'none';
            }

            displayWorkersOnMap() {
                this.clearWorkersFromMap();

                let filteredWorkers = this.workers;

                if (this.currentFilter !== 'all') {
                    filteredWorkers = this.workers.filter(worker =>
                        worker.work.toLowerCase() === this.currentFilter.toLowerCase()
                    );
                }

                document.getElementById('workerCount').textContent = filteredWorkers.length;

                filteredWorkers.forEach((worker) => {
                    if (!worker.latitude || !worker.longitude) return;

                    const position = {
                        lat: parseFloat(worker.latitude),
                        lng: parseFloat(worker.longitude)
                    };

                    const workerIcon = this.getWorkerIcon(worker.work);
                    const markerColor = this.getCategoryColor(worker.work);

                    const marker = new google.maps.Marker({
                        position: position,
                        map: this.map,
                        title: `${worker.name} ${worker.lastName} - ${worker.work}`,
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

                    const infoWindow = new google.maps.InfoWindow({
                        content: this.createWorkerInfoContent(worker)
                    });

                    marker.addListener('click', () => {
                        this.closeAllInfoWindows();
                        infoWindow.open(this.map, marker);
                        this.map.panTo(position);
                        this.map.setZoom(Math.max(this.map.getZoom(), 16));
                    });

                    this.workersMarkers.set(worker.id, { marker, infoWindow });
                    this.infoWindows.push(infoWindow);
                });

                if (!this.locationObtained && filteredWorkers.length > 0) {
                    const bounds = new google.maps.LatLngBounds();
                    filteredWorkers.forEach(worker => {
                        bounds.extend({
                            lat: parseFloat(worker.latitude),
                            lng: parseFloat(worker.longitude)
                        });
                    });
                    this.map.fitBounds(bounds);
                }
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
                    'Carpintería': '#3b82f6',
                    'Electricista': '#eab308',
                    'Plomería': '#22c55e',
                    'Pintor': '#a855f7',
                    'Jardinería': '#ef4444',
                    'Albañilería': '#6b7280',
                    'Ferretería': '#f97316'
                };
                return colorMap[workType] || '#6b7280';
            }

            createWorkerInfoContent(worker) {
                const fullName = `${worker.name} ${worker.lastName}`.trim();
                const stars = '★'.repeat(Math.floor(worker.rating)) + '☆'.repeat(5 - Math.floor(worker.rating));
                const workerIcon = this.getWorkerIcon(worker.work);

                return `
                    <div class="info-window p-4 min-w-[280px]">
                        <div class="flex items-center mb-3">
                            <div class="text-2xl mr-2">${workerIcon}</div>
                            <div>
                                <span class="font-semibold text-sm text-gray-600">${worker.work}</span>
                                <div class="w-3 h-3 rounded-full inline-block ml-2" style="background-color: ${this.getCategoryColor(worker.work)}"></div>
                            </div>
                        </div>
                        
                        <h3 class="font-bold text-lg mb-2">${fullName}</h3>
                        <p class="text-gray-600 text-sm mb-3 leading-relaxed">${worker.description}</p>
                        
                        <div class="flex items-center mb-3">
                            <span class="text-yellow-500 mr-2">${stars}</span>
                            <span class="text-sm font-medium">${worker.rating}/5</span>
                        </div>
                        
                        <div class="space-y-2 text-sm mb-4">
                            <div class="flex items-center">
                                <i class="fas fa-phone text-green-500 w-5"></i>
                                <span class="ml-2">${worker.phone}</span>
                            </div>
                            <div class="flex items-center">
                                <i class="fas fa-envelope text-blue-500 w-5"></i>
                                <span class="ml-2 break-all">${worker.email}</span>
                            </div>
                            <div class="flex items-center">
                                <i class="fas fa-map-marker-alt text-red-500 w-5"></i>
                                <span class="ml-2">${worker.location}</span>
                            </div>
                        </div>
                        
                        <div class="flex space-x-2">
                            <button onclick="callWorker('${worker.phone}')" 
                                    class="flex-1 bg-green-500 text-white py-2 px-3 rounded-lg text-sm hover:bg-green-600 transition-colors font-medium">
                                <i class="fas fa-phone mr-1"></i> Llamar
                            </button>
                            <button onclick="requestService('${worker.id}')" 
                                    class="flex-1 bg-blue-500 text-white py-2 px-3 rounded-lg text-sm hover:bg-blue-600 transition-colors font-medium">
                                <i class="fas fa-briefcase mr-1"></i> Contratar
                            </button>
                        </div>
                    </div>
                `;
            }
            clearWorkersFromMap() {
                this.workersMarkers.forEach(({ marker, infoWindow }) => {
                    marker.setMap(null);
                    infoWindow.close();
                });
                this.workersMarkers.clear();
                this.infoWindows = [];
            }

            closeAllInfoWindows() {
                this.infoWindows.forEach(infoWindow => {
                    infoWindow.close();
                });
            }

            toggleLegend() {
                const legendCard = document.getElementById('legendCard');
                legendCard.classList.toggle('hidden');
            }

            setupLocationSearch() {
                const searchInput = document.getElementById('locationSearch');
                let autocomplete;

                // Inicializar autocompletado cuando Google Maps esté listo
                const initAutocomplete = () => {
                    if (typeof google !== 'undefined' && google.maps && google.maps.places) {
                        autocomplete = new google.maps.places.Autocomplete(searchInput, {
                            bounds: new google.maps.LatLngBounds(
                                new google.maps.LatLng(4.4, -74.3),
                                new google.maps.LatLng(4.8, -73.8)
                            ),
                            componentRestrictions: { country: 'co' },
                            fields: ['geometry', 'name', 'formatted_address']
                        });

                        autocomplete.addListener('place_changed', () => {
                            const place = autocomplete.getPlace();
                            if (place.geometry) {
                                this.map.setCenter(place.geometry.location);
                                this.map.setZoom(15);
                            }
                        });
                    } else {
                        // Reintentar después de un tiempo si Google Maps no está listo
                        setTimeout(initAutocomplete, 500);
                    }
                };

                // Iniciar el autocompletado
                setTimeout(initAutocomplete, 1000);
            }
        }

        // Funciones globales para los botones de los InfoWindows
        function callWorker(phone) {
            if (phone && phone !== '') {
                window.open(`tel:${phone}`, '_self');
            } else {
                alert('Número de teléfono no disponible');
            }
        }

        function requestService(workerId) {
            // Simular solicitud de servicio
            alert(`Función de contratación para trabajador ${workerId} - Próximamente disponible`);
            // Aquí puedes implementar la lógica para enviar una solicitud de servicio
            // Por ejemplo, redirigir a un formulario o abrir un modal
        }

        // Función para toggle del debug
        function toggleDebug() {
            const debugInfo = document.getElementById('debugInfo');
            debugInfo.classList.toggle('hidden');
        }

        // Inicializar la aplicación
        let mapClient;

        // Función de callback para Google Maps API
        function initGoogleMaps() {
            mapClient = new MapClient();
            mapClient.initMap();
        }

        // Cargar Google Maps API dinámicamente
        function loadGoogleMapsAPI() {
            const script = document.createElement('script');
            script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyA6j7YaKesOKWEgaGTsNruStFRKH0pxeQY&libraries=places&callback=initGoogleMaps';
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }

        // Iniciar la carga cuando el DOM esté listo
        document.addEventListener('DOMContentLoaded', () => {
            // Verificar si Google Maps ya está cargado
            if (typeof google === 'undefined') {
                loadGoogleMapsAPI();
            } else {
                initGoogleMaps();
            }
        });

        // Manejo de errores de carga de Google Maps
        window.gm_authFailure = function() {
            console.error('Error de autenticación con Google Maps API');
            document.getElementById('loadingStatus').textContent = 'Error: API Key de Google Maps inválida';
            document.getElementById('loadingStatus').classList.add('text-red-500');
        };