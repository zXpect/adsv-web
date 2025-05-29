class MapClient {  
    constructor() {  
        this.map = null;  
        this.currentLocation = null;  
        this.workersMarkers = new Map();  
        this.currentFilter = 'all';  
        this.radius = 10; // 10km radius  
          
        this.initializeFirebase();  
        this.setupEventListeners();  
    }  
  
    initializeFirebase() {  
        firebase.initializeApp(firebaseConfig);  
        this.database = firebase.database();  
        this.activeWorkersRef = this.database.ref('active_workers');  
    }  
  
    setupEventListeners() {  
        // Filtro de servicios  
        document.getElementById('serviceFilter').addEventListener('change', (e) => {  
            this.currentFilter = e.target.value;  
            this.clearWorkersFromMap();  
            this.getActiveWorkers();  
        });  
  
        // Toggle de leyenda  
        document.getElementById('legendToggle').addEventListener('click', () => {  
            this.toggleLegend();  
        });  
  
        // Búsqueda de ubicación  
        this.setupLocationSearch();  
    }  
  
    initMap() {  
        // Inicializar mapa centrado en una ubicación por defecto  
        this.map = new google.maps.Map(document.getElementById('map'), {  
            zoom: 13,  
            center: { lat: -12.0464, lng: -77.0428 }, // Lima, Perú  
            styles: [  
                {  
                    featureType: "poi",  
                    elementType: "labels",  
                    stylers: [{ visibility: "off" }]  
                }  
            ]  
        });  
  
        // Obtener ubicación actual del usuario  
        this.getCurrentLocation();  
          
        // Cargar trabajadores activos  
        this.getActiveWorkers();  
    }  
  
    getCurrentLocation() {  
        if (navigator.geolocation) {  
            navigator.geolocation.getCurrentPosition(  
                (position) => {  
                    this.currentLocation = {  
                        lat: position.coords.latitude,  
                        lng: position.coords.longitude  
                    };  
                      
                    // Centrar mapa en ubicación actual  
                    this.map.setCenter(this.currentLocation);  
                      
                    // Agregar marcador de ubicación actual  
                    new google.maps.Marker({  
                        position: this.currentLocation,  
                        map: this.map,  
                        title: 'Mi ubicación',  
                        icon: {  
                            url: '/static/images/current-location.png',  
                            scaledSize: new google.maps.Size(40, 40)  
                        }  
                    });  
                },  
                (error) => {  
                    console.error('Error obteniendo ubicación:', error);  
                }  
            );  
        }  
    }  
  
    getActiveWorkers() {  
        this.activeWorkersRef.once('value')  
            .then(snapshot => {  
                if (!snapshot.exists()) {  
                    console.log('No hay trabajadores activos');  
                    return;  
                }  
  
                const activeWorkerIds = Object.keys(snapshot.val());  
                this.loadWorkerDetails(activeWorkerIds);  
            })  
            .catch(error => {  
                console.error('Error cargando trabajadores activos:', error);  
            });  
    }  
  
    async loadWorkerDetails(workerIds) {  
        const workerPromises = workerIds.map(async (workerId) => {  
            // Intentar cargar desde múltiples rutas como en la app móvil  
            const paths = [  
                `User/Trabajadores/${workerId}`,  
                `users/${workerId}`,  
                `${workerId}`  
            ];  
  
            for (const path of paths) {  
                try {  
                    const snapshot = await this.database.ref(path).once('value');  
                    if (snapshot.exists()) {  
                        const workerData = snapshot.val();  
                        workerData.id = workerId;  
                        return workerData;  
                    }  
                } catch (error) {  
                    console.error(`Error cargando trabajador desde ${path}:`, error);  
                }  
            }  
            return null;  
        });  
  
        const workers = await Promise.all(workerPromises);  
        const validWorkers = workers.filter(worker => worker !== null);  
          
        this.displayWorkersOnMap(validWorkers);  
    }  
  
    displayWorkersOnMap(workers) {  
        // Limpiar marcadores existentes  
        this.clearWorkersFromMap();  
  
        workers.forEach(worker => {  
            // Filtrar por tipo de servicio si está activo  
            if (this.currentFilter !== 'all') {  
                const workerType = (worker.work || worker.typeOfWork || '').toLowerCase();  
                if (workerType !== this.currentFilter.toLowerCase()) {  
                    return;  
                }  
            }  
  
            // Verificar si el trabajador tiene ubicación  
            if (!worker.latitude || !worker.longitude) {  
                return;  
            }  
  
            const position = {  
                lat: parseFloat(worker.latitude),  
                lng: parseFloat(worker.longitude)  
            };  
  
            // Crear marcador con icono específico por tipo de trabajo  
            const marker = new google.maps.Marker({  
                position: position,  
                map: this.map,  
                title: `${worker.name || worker.firstName || ''} - ${worker.work || worker.typeOfWork || ''}`,  
                icon: this.getWorkerIcon(worker.work || worker.typeOfWork)  
            });  
  
            // Crear ventana de información  
            const infoWindow = new google.maps.InfoWindow({  
                content: this.createWorkerInfoContent(worker)  
            });  
  
            // Agregar evento click al marcador  
            marker.addListener('click', () => {  
                // Cerrar otras ventanas abiertas  
                this.closeAllInfoWindows();  
                infoWindow.open(this.map, marker);  
            });  
  
            // Guardar referencia del marcador  
            this.workersMarkers.set(worker.id, { marker, infoWindow });  
        });  
    }  
  
    getWorkerIcon(workerType) {  
        const iconMap = {  
            'carpintería': '/static/images/icons/carpenter.png',  
            'electricista': '/static/images/icons/electrician.png',  
            'plomería': '/static/images/icons/plumber.png',  
            'pintor': '/static/images/icons/painter.png',  
            'jardinería': '/static/images/icons/gardener.png',  
            'albañilería': '/static/images/icons/mason.png',  
            'ferretería': '/static/images/icons/hardware.png'  
        };  
  
        const iconUrl = iconMap[workerType?.toLowerCase()] || '/static/images/icons/default-worker.png';  
          
        return {  
            url: iconUrl,  
            scaledSize: new google.maps.Size(40, 40),  
            anchor: new google.maps.Point(20, 40)  
        };  
    }  
  
    createWorkerInfoContent(worker) {  
        const name = worker.name || worker.firstName || 'Sin nombre';  
        const lastName = worker.lastName || worker.lastNombre || '';  
        const fullName = `${name} ${lastName}`.trim();  
        const workType = worker.work || worker.typeOfWork || 'No especificado';  
        const description = worker.description || worker.descripcion || 'Sin descripción';  
        const phone = worker.phone || worker.telefono || '';  
        const email = worker.email || '';  
        const rating = worker.rating || 0;  
  
        return `  
            <div class="p-4 max-w-sm">  
                <div class="flex items-center mb-2">  
                    <div class="w-3 h-3 rounded-full mr-2" style="background-color: ${this.getCategoryColor(workType)}"></div>  
                    <span class="font-semibold text-sm text-gray-600">${workType}</span>  
                </div>  
                <h3 class="font-bold text-lg mb-1">${fullName}</h3>  
                <p class="text-gray-600 text-sm mb-3">${description}</p>  
                  
                ${rating > 0 ? `  
                    <div class="flex items-center mb-2">  
                        <span class="text-yellow-500">★</span>  
                        <span class="ml-1 text-sm">${rating}</span>  
                    </div>  
                ` : ''}  
                  
                <div class="space-y-1 text-sm">  
                    ${phone ? `<div><i class="fas fa-phone text-blue-500"></i> ${phone}</div>` : ''}  
                    ${email ? `<div><i class="fas fa-envelope text-blue-500"></i> ${email}</div>` : ''}  
                </div>  
                  
                <button onclick="requestService('${worker.id}')"   
                        class="mt-3 w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors">  
                    Solicitar Servicio  
                </button>  
            </div>  
        `;  
    }  
  
    getCategoryColor(workType) {  
        // Usar el mismo mapeo de colores que en el sistema existente  
        const colorMap = {  
            'carpintería': '#A27023',  
            'electricista': '#FFC107',  
            'plomería': '#2196F3',  
            'pintor': '#9C27B0',  
            'jardinería': '#4CAF50',  
            'albañilería': '#F44336',  
            'ferretería': '#607D8B'  
        };  
          
        return colorMap[workType?.toLowerCase()] || '#607D8B';  
    }  
  
    clearWorkersFromMap() {  
        this.workersMarkers.forEach(({ marker, infoWindow }) => {  
            marker.setMap(null);  
            infoWindow.close();  
        });  
        this.workersMarkers.clear();  
    }  
  
    closeAllInfoWindows() {  
        this.workersMarkers.forEach(({ infoWindow }) => {  
            infoWindow.close();  
        });  
    }  
  
    toggleLegend() {  
        const legendCard = document.getElementById('legendCard');  
        legendCard.classList.toggle('hidden');  
    }  
  
    setupLocationSearch() {  
        const searchInput = document.getElementById('locationSearch');  
        const autocomplete = new google.maps.places.Autocomplete(searchInput);  
          
        autocomplete.addListener('place_changed', () => {  
            const place = autocomplete.getPlace();  
            if (place.geometry) {  
                this.map.setCenter(place.geometry.location);  
                this.map.setZoom(15);  
            }  
        });  
    }  
}  
  
// Función global para solicitar servicio  
function requestService(workerId) {  
    // Redirigir a página de solicitud con ID del trabajador  
    window.location.href = `service-request.html?workerId=${workerId}`;  
}  
  
// Función de callback para Google Maps API  
function initMap() {  
    window.mapClient = new MapClient();  
    window.mapClient.initMap();  
}