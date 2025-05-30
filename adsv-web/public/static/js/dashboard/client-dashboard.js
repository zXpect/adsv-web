
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
                
                this.init();
            }

            async init() {
                try {
                    // Verificar autenticación
                    await this.checkAuthState();
                    
                    // Configurar event listeners
                    this.setupEventListeners();
                    
                    // Cargar solicitudes para estadísticas
                    await this.loadUserRequests();
                    
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

                // Botón de buscar trabajadores - redirigir al mapa
                document.getElementById('searchWorkersBtn').addEventListener('click', () => {
                    window.location.href = 'map.html';
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
                    setTimeout(() => {
                        loadingScreen.style.opacity = '0';
                        setTimeout(() => {
                            loadingScreen.style.display = 'none';
                        }, 300);
                    }, 500);
                }
            }

            showNotification(message, type = 'info') {
                // Crear notificación temporal
                const notification = document.createElement('div');
                const colors = {
                    success: 'bg-green-500',
                    error: 'bg-red-500',
                    info: 'bg-blue-500',
                    warning: 'bg-yellow-500'
                };
                
                const icons = {
                    success: 'check-circle',
                    error: 'exclamation-circle',
                    info: 'info-circle',
                    warning: 'exclamation-triangle'
                };
                
                notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300`;
                notification.innerHTML = `
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-${icons[type]}"></i>
                        <span>${message}</span>
                    </div>
                `;
                
                document.body.appendChild(notification);
                
                // Mostrar notificación
                setTimeout(() => {
                    notification.classList.remove('translate-x-full');
                }, 100);
                
                // Ocultar después de 3 segundos
                setTimeout(() => {
                    notification.classList.add('translate-x-full');
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 300);
                }, 3000);
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