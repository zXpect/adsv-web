

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
                
                this.init();
            }

            async init() {
                try {
                    // Verificar autenticación
                    await this.checkAuthState();
                    
                    // Configurar event listeners
                    this.setupEventListeners();
                    
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
                document.getElementById('rating').textContent = userData.rating || '5.0';
                document.getElementById('completedServices').textContent = userData.completedJobs || '0';
                document.getElementById('monthlyEarnings').textContent = `$${userData.monthlyEarnings || '0'}`;
                
                // Actualizar estado de conexión
                this.isConnected = userData.isAvailable || false;
                this.updateConnectionStatus();
            }

            updateConnectionStatus() {
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

                // Cerrar modal al hacer clic fuera de él
                document.getElementById('logoutModal').addEventListener('click', (e) => {
                    if (e.target.id === 'logoutModal') {
                        this.hideLogoutModal();
                    }
                });
            }

            showLogoutModal() {
                document.getElementById('logoutModal').classList.remove('hidden');
            }

            hideLogoutModal() {
                document.getElementById('logoutModal').classList.add('hidden');
            }

            async performLogout() {
                const confirmBtn = document.getElementById('confirmLogout');
                const spinner = document.getElementById('logoutSpinner');
                
                try {
                    // Mostrar indicador de carga
                    confirmBtn.disabled = true;
                    spinner.classList.remove('hidden');
                    
                    // Si está conectado, desconectar primero
                    if (this.isConnected && this.currentUser) {
                        await this.updateWorkerStatus(this.currentUser.uid, false);
                    }
                    
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
                    alert('Error al cerrar sesión. Inténtalo de nuevo.');
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
                    // Agregar a trabajadores activos
                    const workerRef = this.database.ref(`User/Trabajadores/${uid}`);
                    const snapshot = await workerRef.once('value');
                    const workerData = snapshot.val();
                    
                    updates[`active_workers/${uid}`] = {
                        name: workerData.name,
                        work: workerData.work,
                        isAvailable: true,
                        lastSeen: new Date().toISOString()
                    };
                } else {
                    // Remover de trabajadores activos
                    updates[`active_workers/${uid}`] = null;
                }

                await this.database.ref().update(updates);
            }

            updateLocation() {
                if ("geolocation" in navigator) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const { latitude, longitude } = position.coords;
                            this.saveLocation(latitude, longitude);
                        },
                        (error) => {
                            console.error('Error obteniendo ubicación:', error);
                            this.showNotification('Error al obtener ubicación', 'error');
                        }
                    );
                } else {
                    this.showNotification('Geolocalización no disponible', 'error');
                }
            }

            async saveLocation(lat, lng) {
                if (!this.currentUser) return;
                
                try {
                    await this.database.ref(`User/Trabajadores/${this.currentUser.uid}/location`).set({
                        latitude: lat,
                        longitude: lng,
                        updatedAt: new Date().toISOString()
                    });
                    
                    this.showNotification('Ubicación actualizada exitosamente', 'success');
                    
                } catch (error) {
                    console.error('Error guardando ubicación:', error);
                    this.showNotification('Error al guardar ubicación', 'error');
                }
            }

            showNotification(message, type = 'info') {
                // Crear elemento de notificación
                const notification = document.createElement('div');
                notification.className = `fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 transition-all duration-300 ${
                    type === 'success' ? 'bg-green-500 text-white' :
                    type === 'error' ? 'bg-red-500 text-white' :
                    'bg-blue-500 text-white'
                }`;
                notification.textContent = message;
                
                document.body.appendChild(notification);
                
                // Remover después de 3 segundos
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
        }

        // Inicializar cuando se carga la página
        document.addEventListener('DOMContentLoaded', () => {
            new WorkerDashboard();
        });