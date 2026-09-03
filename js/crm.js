document.addEventListener('DOMContentLoaded', () => {
    (async function initCRM() {
        // --- 1. Firebase Setup (Dynamic Imports) ---
        let app, db;
        try {
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js');
            const { getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp } = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js');

            const firebaseConfig = {
                apiKey: 'AIzaSyAZCztGChAZ9k81WWBkp9TZBx9XphWqcmc',
                authDomain: 'camping-3a6a4.firebaseapp.com',
                projectId: 'camping-3a6a4',
                storageBucket: 'camping-3a6a4.firebasestorage.app',
                messagingSenderId: '181839243079',
                appId: '1:181839243079:web:df39441f32098fc7ca4e62',
                measurementId: 'G-F3WW9ZDP57'
            };

            app = initializeApp(firebaseConfig);
            db = getFirestore(app);

            // --- 2. Funciones de Feedback y Utilidades ---
            function showCRMFeedback(text, type = 'success') {
                const el = document.getElementById('feedbackMessage');
                if (!el) return;
                el.className = `feedback-message ${type} show`;
                el.textContent = text;
                setTimeout(() => { el.className = 'feedback-message'; el.textContent = ''; }, 2400);
            }

            function getInitials(name) {
                if (!name) return '?';
                const parts = name.split(' ');
                return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
            }

            function nameToColor(name) {
                const colors = ['#E07A5F', '#3D405B', '#81B29A', '#F2CC8F', '#5E8B7E', '#A47D6C'];
                let hash = 0;
                for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
                return colors[Math.abs(hash % colors.length)];
            }

            // --- 3. CRUD Functions ---
            async function addCliente(data) {
                const docRef = await addDoc(collection(db, 'clientes'), data);
                return docRef.id;
            }

            async function getClientes() {
                const snapshot = await getDocs(collection(db, 'clientes'));
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }

            async function getClienteById(id) {
                const docSnap = await getDoc(doc(db, 'clientes', id));
                if (docSnap.exists()) {
                    return { id: docSnap.id, ...docSnap.data() };
                }
                return null;
            }

            async function updateCliente(id, data) {
                await updateDoc(doc(db, 'clientes', id), data);
            }

            async function deleteCliente(id) {
                await deleteDoc(doc(db, 'clientes', id));
            }

            async function updateEtapaCRM(id, etapa) {
                await updateDoc(doc(db, 'clientes', id), { etapa_crm: etapa });
            }

            async function addInteraccion(data) {
                const docRef = await addDoc(collection(db, 'interacciones'), data);
                return docRef.id;
            }

            async function getInteraccionesByCliente(clienteId) {
                const q = query(collection(db, 'interacciones'), where('cliente_id', '==', clienteId));
                // Note: Ordering by 'fecha' might require a composite index in Firestore.
                const snapshot = await getDocs(q);
                let interacciones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                interacciones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
                return interacciones;
            }

            async function getAllInteracciones() {
                const snapshot = await getDocs(collection(db, 'interacciones'));
                let interacciones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                interacciones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
                return interacciones;
            }

            // --- 4. Semilla de Datos (Seed Demo Data) ---
            async function seedDemoData() {
                const clientes = await getClientes();
                if (clientes.length === 0) {
                    showCRMFeedback('Iniciando carga de datos de prueba...', 'success');
                    
                    const clientesData = [
                        { nombre: 'Laura Gómez', correo: 'laura@example.com', telefono: '555-0101', empresa: 'Aventuras MX', estado: 'activo', etapa_crm: 'Frecuente' },
                        { nombre: 'Diego Ruiz', correo: 'diego@example.com', telefono: '555-0102', empresa: 'CampPro', estado: 'activo', etapa_crm: 'Activo' },
                        { nombre: 'Mauro Pérez', correo: 'mauro@example.com', telefono: '555-0103', empresa: 'Freelance', estado: 'inactivo', etapa_crm: 'Inactivo' },
                        { nombre: 'Nadia Ortega', correo: 'nadia@example.com', telefono: '555-0104', empresa: 'MontañaVerde', estado: 'activo', etapa_crm: 'Prospecto' },
                        { nombre: 'Camilo Vega', correo: 'camilo@example.com', telefono: '555-0105', empresa: 'OutdoorShop', estado: 'activo', etapa_crm: 'Frecuente' },
                        { nombre: 'Paula Jiménez', correo: 'paula@example.com', telefono: '555-0106', empresa: '—', estado: 'activo', etapa_crm: 'Activo' },
                        { nombre: 'Sergio Lozano', correo: 'sergio@example.com', telefono: '555-0107', empresa: 'TrekMaster', estado: 'inactivo', etapa_crm: 'Inactivo' },
                        { nombre: 'Elena Torres', correo: 'elena@example.com', telefono: '555-0108', empresa: 'NaturalWay', estado: 'activo', etapa_crm: 'Prospecto' },
                        { nombre: 'Bruno Salas', correo: 'bruno@example.com', telefono: '555-0109', empresa: '—', estado: 'activo', etapa_crm: 'Activo' },
                        { nombre: 'Valentina Ríos', correo: 'valentina@example.com', telefono: '555-0110', empresa: 'RutaLibre', estado: 'activo', etapa_crm: 'Frecuente' }
                    ];

                    const adminUser = { email: 'admin@ruta.com', nombre: 'Administrador', rol: 'admin', ultimo_acceso: new Date().toISOString() };
                    const regularUser = { email: 'usuario@ruta.com', nombre: 'Usuario Regular', rol: 'usuario', ultimo_acceso: new Date().toISOString() };
                    
                    const adminRef = await addDoc(collection(db, 'usuarios'), adminUser);
                    await addDoc(collection(db, 'usuarios'), regularUser);

                    const clientIds = {};
                    for (let i = 0; i < clientesData.length; i++) {
                        let data = clientesData[i];
                        let fechaReg = new Date();
                        fechaReg.setMonth(fechaReg.getMonth() - Math.floor(Math.random() * 6));
                        data.fecha_registro = fechaReg.toISOString();
                        let docId = await addCliente(data);
                        clientIds[data.nombre] = docId;
                    }

                    // Interacciones
                    const interactionTypes = ['llamada', 'correo', 'reunion'];
                    const interactionDescs = ['Contacto inicial', 'Seguimiento de cotización', 'Reunión de planificación', 'Llamada de soporte', 'Envío de catálogo'];

                    for (let name of Object.keys(clientIds)) {
                        if (name === 'Sergio Lozano' || name === 'Mauro Pérez') continue; // En riesgo (sin interacciones)
                        
                        let numInteractions = Math.floor(Math.random() * 4) + 1; // 1 a 4 interacciones
                        for (let j = 0; j < numInteractions; j++) {
                            let f = new Date();
                            f.setDate(f.getDate() - Math.floor(Math.random() * 20)); // Últimos 20 días
                            await addInteraccion({
                                cliente_id: clientIds[name],
                                cliente_nombre: name,
                                tipo: interactionTypes[Math.floor(Math.random() * interactionTypes.length)],
                                descripcion: interactionDescs[Math.floor(Math.random() * interactionDescs.length)],
                                fecha: f.toISOString(),
                                usuario_id: adminRef.id,
                                usuario_nombre: adminUser.nombre
                            });
                        }
                    }
                    showCRMFeedback('Datos de prueba cargados exitosamente', 'success');
                }
            }

            // --- 5. Estado y Control de la UI ---
            let currentClients = [];
            let editingClientId = null;
            let currentClientDetailId = null;
            let clientToDelete = null;

            // Elementos del DOM (CRM View)
            const crmClientForm = document.getElementById('crmClientForm');
            const crmClientName = document.getElementById('crmClientName');
            const crmClientEmail = document.getElementById('crmClientEmail');
            const crmClientPhone = document.getElementById('crmClientPhone');
            const crmClientCompany = document.getElementById('crmClientCompany');
            const crmClientStatus = document.getElementById('crmClientStatus');
            const crmClientEtapa = document.getElementById('crmClientEtapa');
            const crmClientFormTitle = document.getElementById('crmClientFormTitle');
            const crmClientFormSubmitBtn = document.getElementById('crmClientFormSubmitBtn');
            const crmClientFormCancelBtn = document.getElementById('crmClientFormCancelBtn');
            const crmClientsTableBody = document.getElementById('crmClientsTableBody');
            const crmSearchInput = document.getElementById('crmSearchInput');
            const crmFilterStatus = document.getElementById('crmFilterStatus');
            const crmFilterEtapa = document.getElementById('crmFilterEtapa');
            const crmClientsPagination = document.getElementById('crmClientsPagination');

            // Elementos del DOM (Interacciones View)
            const interClientSelect = document.getElementById('interClientSelect');
            const interForm = document.getElementById('interForm');
            const interTipo = document.getElementById('interTipo');
            const interDescripcion = document.getElementById('interDescripcion');
            const interTimeline = document.getElementById('interTimeline');
            const interClientInfo = document.getElementById('interClientInfo');

            // Elementos del DOM (Dashboard)
            const crmTotalClientes = document.getElementById('crmTotalClientes');
            const crmClientesActivos = document.getElementById('crmClientesActivos');
            const crmClientesInactivos = document.getElementById('crmClientesInactivos');
            const crmTotalInteracciones = document.getElementById('crmTotalInteracciones');
            const crmChartEtapas = document.getElementById('crmChartEtapas');
            const crmChartTipos = document.getElementById('crmChartTipos');
            const crmClientesEnRiesgo = document.getElementById('crmClientesEnRiesgo');

            // Elementos del DOM (Mi Actividad)
            const miActividadList = document.getElementById('miActividadList');
            const miActividadUserName = document.getElementById('miActividadUserName');
            const miActividadCount = document.getElementById('miActividadCount');
            const miActividadPagination = document.getElementById('miActividadPagination');

            const crmItemsPerPage = 5;
            let crmClientPage = 1;
            let miActividadPage = 1;

            // Modal Detail
            const crmClientDetailModal = document.getElementById('crmClientDetailModal');
            const crmClientDetailBackdrop = document.getElementById('crmClientDetailBackdrop');
            const crmClientDetailClose = document.getElementById('crmClientDetailClose');
            const crmDetailName = document.getElementById('crmDetailName');
            const crmDetailEmail = document.getElementById('crmDetailEmail');
            const crmDetailPhone = document.getElementById('crmDetailPhone');
            const crmDetailCompany = document.getElementById('crmDetailCompany');
            const crmDetailEstado = document.getElementById('crmDetailEstado');
            const crmDetailEtapa = document.getElementById('crmDetailEtapa');
            const crmDetailInteracciones = document.getElementById('crmDetailInteracciones');
            const crmDetailEtapaSelect = document.getElementById('crmDetailEtapaSelect');
            const crmDetailEtapaBtn = document.getElementById('crmDetailEtapaBtn');

            // Delete Confirm Modal
            const deleteConfirmModal = document.getElementById('deleteConfirmModal');
            const deleteConfirmBtn = document.getElementById('deleteConfirmAccept');
            const deleteCancelBtn = document.getElementById('deleteConfirmCancel');

            const etapaColors = {
                'Prospecto': '#3B82F6', // Blue
                'Activo': '#10B981',    // Green
                'Frecuente': '#F59E0B', // Amber
                'Inactivo': '#EF4444'   // Red
            };

            // --- 6. Funciones de Renderizado ---
            function renderPagination(container, currentPage, totalPages, pageAttribute) {
                if (!container) return;
                if (totalPages <= 1) {
                    container.innerHTML = '';
                    return;
                }

                container.innerHTML = `
                    <button class="page-btn" type="button" data-${pageAttribute}="prev" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>
                    <span class="page-indicator">Página ${currentPage} / ${totalPages}</span>
                    <button class="page-btn" type="button" data-${pageAttribute}="next" ${currentPage === totalPages ? 'disabled' : ''}>Siguiente</button>
                `;
            }

            async function renderCRMClients() {
                if (!crmClientsTableBody) return;
                try {
                    currentClients = await getClientes();
                    
                    const searchTerm = crmSearchInput?.value.toLowerCase() || '';
                    const statusFilter = crmFilterStatus?.value || '';
                    const etapaFilter = crmFilterEtapa?.value || '';

                    const filteredClients = currentClients.filter(c => {
                        const matchSearch = c.nombre.toLowerCase().includes(searchTerm) || c.correo.toLowerCase().includes(searchTerm);
                        const matchStatus = statusFilter === '' || c.estado === statusFilter;
                        const matchEtapa = etapaFilter === '' || c.etapa_crm === etapaFilter;
                        return matchSearch && matchStatus && matchEtapa;
                    });

                    const totalPages = Math.max(1, Math.ceil(filteredClients.length / crmItemsPerPage));
                    crmClientPage = Math.min(crmClientPage, totalPages);
                    const firstItem = (crmClientPage - 1) * crmItemsPerPage;
                    const visibleClients = filteredClients.slice(firstItem, firstItem + crmItemsPerPage);

                    crmClientsTableBody.innerHTML = '';
                    visibleClients.forEach(c => {
                        const tr = document.createElement('tr');
                        const bg = nameToColor(c.nombre);
                        const etapaColor = etapaColors[c.etapa_crm] || '#6B7280';
                        const badgeClass = c.estado === 'activo' ? 'bg-success' : 'bg-danger';

                        tr.innerHTML = `
                            <td>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 35px; height: 35px; border-radius: 50%; background: ${bg}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">
                                        ${getInitials(c.nombre)}
                                    </div>
                                    <span>${c.nombre}</span>
                                </div>
                            </td>
                            <td>${c.correo}</td>
                            <td>${c.telefono}</td>
                            <td>${c.empresa || '—'}</td>
                            <td><span class="badge ${badgeClass}" style="padding: 5px 10px; border-radius: 12px; color: white;">${c.estado}</span></td>
                            <td><span style="background: ${etapaColor}; color: white; padding: 5px 10px; border-radius: 12px; font-size: 0.85em;">${c.etapa_crm}</span></td>
                            <td>
                                <button class="btn btn-sm btn-info btn-view-client" data-id="${c.id}" title="Ver Detalle"><i class="bi bi-eye"></i></button>
                                <button class="btn btn-sm btn-primary btn-edit-client" data-id="${c.id}" title="Editar"><i class="bi bi-pencil"></i></button>
                                <button class="btn btn-sm btn-danger btn-delete-client" data-id="${c.id}" title="Eliminar"><i class="bi bi-trash"></i></button>
                            </td>
                        `;
                        crmClientsTableBody.appendChild(tr);
                    });
                    renderPagination(crmClientsPagination, crmClientPage, totalPages, 'crm-page');
                } catch (error) {
                    console.error('Error renderCRMClients:', error);
                    showCRMFeedback('Error al cargar clientes.', 'error');
                }
            }

            async function loadInteraccionesView() {
                if (!interClientSelect) return;
                try {
                    const clientes = await getClientes();
                    interClientSelect.innerHTML = '<option value="">Seleccione un cliente...</option>';
                    clientes.forEach(c => {
                        const opt = document.createElement('option');
                        opt.value = c.id;
                        opt.textContent = c.nombre;
                        interClientSelect.appendChild(opt);
                    });
                    if (interTimeline) interTimeline.innerHTML = '<p class="text-muted">Seleccione un cliente para ver sus interacciones.</p>';
                    if (interClientInfo) interClientInfo.innerHTML = '';
                } catch (error) {
                    console.error(error);
                }
            }

            async function renderInteracciones(clienteId) {
                if (!interTimeline || !clienteId) return;
                try {
                    const cliente = await getClienteById(clienteId);
                    if (cliente && interClientInfo) {
                        interClientInfo.innerHTML = `
                            <div style="padding: 10px; border-left: 4px solid ${nameToColor(cliente.nombre)}; background: #f8f9fa; margin-bottom: 15px;">
                                <strong>${cliente.nombre}</strong> (${cliente.etapa_crm}) - ${cliente.correo}
                            </div>
                        `;
                    }

                    const interacciones = await getInteraccionesByCliente(clienteId);
                    interTimeline.innerHTML = '';
                    
                    if (interacciones.length === 0) {
                        interTimeline.innerHTML = '<p class="text-muted">No hay interacciones registradas para este cliente.</p>';
                        return;
                    }

                    interacciones.forEach(int => {
                        let icon = 'bi-chat';
                        if (int.tipo === 'llamada') icon = 'bi-telephone';
                        if (int.tipo === 'correo') icon = 'bi-envelope';
                        if (int.tipo === 'reunion') icon = 'bi-camera-video';

                        const div = document.createElement('div');
                        div.style.cssText = "display: flex; gap: 15px; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px;";
                        div.innerHTML = `
                            <div style="width: 40px; height: 40px; border-radius: 50%; background: #e9ecef; display: flex; align-items: center; justify-content: center; color: #495057;">
                                <i class="bi ${icon}"></i>
                            </div>
                            <div style="flex: 1;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                    <strong>${int.tipo.charAt(0).toUpperCase() + int.tipo.slice(1)}</strong>
                                    <small class="text-muted">${new Date(int.fecha).toLocaleString()}</small>
                                </div>
                                <p style="margin: 0; color: #333;">${int.descripcion}</p>
                                <small class="text-muted" style="display: block; margin-top: 5px;">Registrado por: ${int.usuario_nombre || 'Usuario'}</small>
                            </div>
                        `;
                        interTimeline.appendChild(div);
                    });
                } catch (error) {
                    console.error('Error renderInteracciones:', error);
                    showCRMFeedback('Error al cargar interacciones.', 'error');
                }
            }

            async function renderDashboardCRM() {
                try {
                    const clientes = await getClientes();
                    const interacciones = await getAllInteracciones();

                    let activos = 0, inactivos = 0;
                    let etapasCount = { 'Prospecto': 0, 'Activo': 0, 'Frecuente': 0, 'Inactivo': 0 };
                    
                    clientes.forEach(c => {
                        if (c.estado === 'activo') activos++;
                        else inactivos++;
                        if (etapasCount[c.etapa_crm] !== undefined) etapasCount[c.etapa_crm]++;
                    });

                    if (crmTotalClientes) crmTotalClientes.textContent = clientes.length;
                    if (crmClientesActivos) crmClientesActivos.textContent = activos;
                    if (crmClientesInactivos) crmClientesInactivos.textContent = inactivos;
                    if (crmTotalInteracciones) crmTotalInteracciones.textContent = interacciones.length;

                    // Bar Chart (Etapas) HTML/CSS
                    if (crmChartEtapas) {
                        let maxVal = Math.max(...Object.values(etapasCount), 1);
                        crmChartEtapas.innerHTML = '';
                        crmChartEtapas.style.display = 'flex';
                        crmChartEtapas.style.alignItems = 'flex-end';
                        crmChartEtapas.style.gap = '20px';
                        crmChartEtapas.style.height = '200px';
                        crmChartEtapas.style.padding = '10px 0';

                        Object.keys(etapasCount).forEach(etapa => {
                            const val = etapasCount[etapa];
                            const heightPct = (val / maxVal) * 100;
                            const color = etapaColors[etapa] || '#333';
                            const barContainer = document.createElement('div');
                            barContainer.style.cssText = "display: flex; flex-direction: column; align-items: center; flex: 1; height: 100%; justify-content: flex-end;";
                            barContainer.innerHTML = `
                                <div style="margin-bottom: 5px; font-weight: bold;">${val}</div>
                                <div style="width: 100%; max-width: 50px; background: ${color}; height: ${heightPct}%; border-radius: 4px 4px 0 0; transition: height 0.5s;"></div>
                                <div style="margin-top: 5px; font-size: 12px; text-align: center;">${etapa}</div>
                            `;
                            crmChartEtapas.appendChild(barContainer);
                        });
                    }

                    // Pie Chart (Tipos) CSS Conic Gradient
                    if (crmChartTipos) {
                        let tiposCount = { 'llamada': 0, 'correo': 0, 'reunion': 0 };
                        interacciones.forEach(i => { if (tiposCount[i.tipo] !== undefined) tiposCount[i.tipo]++; });
                        
                        let totalTipos = interacciones.length || 1;
                        let pctLlamada = (tiposCount['llamada'] / totalTipos) * 100;
                        let pctCorreo = (tiposCount['correo'] / totalTipos) * 100;
                        
                        crmChartTipos.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 30px;">
                                <div style="width: 150px; height: 150px; border-radius: 50%; background: conic-gradient(
                                    #3b82f6 0% ${pctLlamada}%, 
                                    #10b981 ${pctLlamada}% ${pctLlamada + pctCorreo}%, 
                                    #f59e0b ${pctLlamada + pctCorreo}% 100%
                                );"></div>
                                <div>
                                    <div style="margin-bottom: 5px;"><span style="display:inline-block; width:12px; height:12px; background:#3b82f6; margin-right:5px;"></span> Llamada: ${tiposCount['llamada']}</div>
                                    <div style="margin-bottom: 5px;"><span style="display:inline-block; width:12px; height:12px; background:#10b981; margin-right:5px;"></span> Correo: ${tiposCount['correo']}</div>
                                    <div><span style="display:inline-block; width:12px; height:12px; background:#f59e0b; margin-right:5px;"></span> Reunión: ${tiposCount['reunion']}</div>
                                </div>
                            </div>
                        `;
                    }

                    // Clientes en riesgo (Sin interacciones en 30 días)
                    if (crmClientesEnRiesgo) {
                        const hace30Dias = new Date();
                        hace30Dias.setDate(hace30Dias.getDate() - 30);
                        
                        let clientesConUltimaInt = clientes.map(c => {
                            let ints = interacciones.filter(i => i.cliente_id === c.id);
                            let maxDate = ints.length > 0 ? new Date(Math.max(...ints.map(i => new Date(i.fecha)))) : new Date(0);
                            return { ...c, ultima_interaccion: maxDate };
                        });

                        let enRiesgo = clientesConUltimaInt.filter(c => c.ultima_interaccion < hace30Dias && c.estado === 'activo');
                        crmClientesEnRiesgo.innerHTML = '';
                        if (enRiesgo.length === 0) {
                            crmClientesEnRiesgo.innerHTML = '<p class="text-success">No hay clientes en riesgo.</p>';
                        } else {
                            enRiesgo.forEach(c => {
                                const d = document.createElement('div');
                                d.style.cssText = "padding: 10px; border-left: 4px solid #EF4444; background: #FEF2F2; margin-bottom: 10px; border-radius: 4px;";
                                d.innerHTML = `<strong>${c.nombre}</strong> - ${c.correo}<br><small class="text-danger">Sin interacciones recientes</small>`;
                                crmClientesEnRiesgo.appendChild(d);
                            });
                        }
                    }

                } catch (error) {
                    console.error('Error renderDashboardCRM:', error);
                }
            }

            async function renderMiActividad() {
                if (!miActividadList) return;
                try {
                    const currentUserEmail = localStorage.getItem('userEmail') || 'admin@ruta.com';
                    const currentUserName = localStorage.getItem('userName') || '';
                    if (miActividadUserName) miActividadUserName.textContent = currentUserName || currentUserEmail;

                    // Como no tenemos un query simple para buscar por email en la estructura actual (usamos usuario_id que requiere lookup), 
                    // filtraremos en el cliente por simplicidad.
                    const interacciones = await getAllInteracciones();
                    const misInteracciones = interacciones.filter(interaccion => {
                        const coincideEmail = interaccion.usuario_email === currentUserEmail;
                        const coincideNombre = currentUserName && interaccion.usuario_nombre === currentUserName;
                        const demoAdmin = currentUserEmail.toLowerCase().includes('admin') && interaccion.usuario_nombre === 'Administrador';
                        return coincideEmail || coincideNombre || demoAdmin;
                    });

                    const totalPages = Math.max(1, Math.ceil(misInteracciones.length / crmItemsPerPage));
                    miActividadPage = Math.min(miActividadPage, totalPages);
                    const firstItem = (miActividadPage - 1) * crmItemsPerPage;
                    const visibleInteracciones = misInteracciones.slice(firstItem, firstItem + crmItemsPerPage);

                    if (miActividadCount) miActividadCount.textContent = misInteracciones.length;
                    
                    miActividadList.innerHTML = '';
                    if (misInteracciones.length === 0) {
                        miActividadList.innerHTML = '<p class="text-muted">No hay actividad reciente.</p>';
                        return;
                    }

                    visibleInteracciones.forEach(int => {
                        const div = document.createElement('div');
                        div.style.cssText = "padding: 15px; border: 1px solid #eee; margin-bottom: 10px; border-radius: 8px; background: #fff;";
                        div.innerHTML = `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <strong><i class="bi bi-person"></i> ${int.cliente_nombre || 'Cliente'}</strong>
                                <span class="badge bg-secondary">${int.tipo}</span>
                            </div>
                            <p style="margin:0; color:#555;">${int.descripcion}</p>
                            <small class="text-muted">${new Date(int.fecha).toLocaleString()}</small>
                        `;
                        miActividadList.appendChild(div);
                    });
                    renderPagination(miActividadPagination, miActividadPage, totalPages, 'activity-page');
                } catch (error) {
                    console.error('Error renderMiActividad:', error);
                }
            }

            // --- 7. Event Handlers ---

            // Formulario Cliente (Agregar/Editar)
            if (crmClientForm) {
                crmClientForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const data = {
                        nombre: crmClientName.value.trim(),
                        correo: crmClientEmail.value.trim(),
                        telefono: crmClientPhone.value.trim(),
                        empresa: crmClientCompany.value.trim(),
                        estado: crmClientStatus.value,
                        etapa_crm: crmClientEtapa.value
                    };

                    try {
                        if (editingClientId) {
                            await updateCliente(editingClientId, data);
                            showCRMFeedback('Cliente actualizado exitosamente.', 'success');
                        } else {
                            data.fecha_registro = new Date().toISOString();
                            await addCliente(data);
                            showCRMFeedback('Cliente registrado exitosamente.', 'success');
                        }
                        crmClientForm.reset();
                        editingClientId = null;
                        if (crmClientFormTitle) crmClientFormTitle.textContent = 'Registrar Nuevo Cliente';
                        if (crmClientFormSubmitBtn) crmClientFormSubmitBtn.textContent = 'Guardar';
                        if (crmClientFormCancelBtn) crmClientFormCancelBtn.style.display = 'none';
                        renderCRMClients();
                    } catch (error) {
                        console.error(error);
                        showCRMFeedback('Error al guardar el cliente.', 'error');
                    }
                });
            }

            if (crmClientFormCancelBtn) {
                crmClientFormCancelBtn.addEventListener('click', () => {
                    crmClientForm.reset();
                    editingClientId = null;
                    if (crmClientFormTitle) crmClientFormTitle.textContent = 'Registrar Nuevo Cliente';
                    if (crmClientFormSubmitBtn) crmClientFormSubmitBtn.textContent = 'Guardar';
                    crmClientFormCancelBtn.style.display = 'none';
                });
            }

            // Delegación de eventos en Tabla Clientes
            if (crmClientsTableBody) {
                crmClientsTableBody.addEventListener('click', async (e) => {
                    const btn = e.target.closest('button');
                    if (!btn) return;

                    const id = btn.getAttribute('data-id');
                    
                    if (btn.classList.contains('btn-edit-client')) {
                        const cliente = currentClients.find(c => c.id === id);
                        if (cliente) {
                            crmClientName.value = cliente.nombre;
                            crmClientEmail.value = cliente.correo;
                            crmClientPhone.value = cliente.telefono;
                            crmClientCompany.value = cliente.empresa || '';
                            crmClientStatus.value = cliente.estado;
                            crmClientEtapa.value = cliente.etapa_crm;
                            editingClientId = id;
                            if (crmClientFormTitle) crmClientFormTitle.textContent = 'Editar Cliente';
                            if (crmClientFormSubmitBtn) crmClientFormSubmitBtn.textContent = 'Actualizar';
                            if (crmClientFormCancelBtn) crmClientFormCancelBtn.style.display = 'inline-block';
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    } else if (btn.classList.contains('btn-delete-client')) {
                        clientToDelete = id;
                        if (deleteConfirmModal) deleteConfirmModal.classList.remove('hidden');
                    } else if (btn.classList.contains('btn-view-client')) {
                        const cliente = currentClients.find(c => c.id === id);
                        if (cliente && crmClientDetailModal) {
                            currentClientDetailId = id;
                            if(crmDetailName) crmDetailName.textContent = cliente.nombre;
                            if(crmDetailEmail) crmDetailEmail.textContent = cliente.correo;
                            if(crmDetailPhone) crmDetailPhone.textContent = cliente.telefono;
                            if(crmDetailCompany) crmDetailCompany.textContent = cliente.empresa || '—';
                            if(crmDetailEstado) crmDetailEstado.innerHTML = `<span class="badge ${cliente.estado === 'activo' ? 'bg-success' : 'bg-danger'}">${cliente.estado}</span>`;
                            if(crmDetailEtapa) crmDetailEtapa.innerHTML = `<span style="background: ${etapaColors[cliente.etapa_crm]}; color: white; padding: 4px 8px; border-radius: 12px;">${cliente.etapa_crm}</span>`;
                            if(crmDetailEtapaSelect) crmDetailEtapaSelect.value = cliente.etapa_crm;
                            
                            // Load interactions for detail modal
                            if(crmDetailInteracciones) {
                                crmDetailInteracciones.innerHTML = 'Cargando...';
                                try {
                                    const ints = await getInteraccionesByCliente(id);
                                    crmDetailInteracciones.innerHTML = '';
                                    if(ints.length === 0) crmDetailInteracciones.innerHTML = '<p class="text-muted">No hay interacciones.</p>';
                                    ints.forEach(int => {
                                        const d = document.createElement('div');
                                        d.style.cssText = "margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:10px;";
                                        d.innerHTML = `<strong>${int.tipo}</strong> - ${new Date(int.fecha).toLocaleDateString()}<br><small>${int.descripcion}</small>`;
                                        crmDetailInteracciones.appendChild(d);
                                    });
                                } catch(e) {
                                    crmDetailInteracciones.innerHTML = '<span class="text-danger">Error al cargar.</span>';
                                }
                            }
                            crmClientDetailModal.classList.remove('hidden');
                        }
                    }
                });
            }

            // Filtros en CRM
            if (crmSearchInput) crmSearchInput.addEventListener('input', () => {
                crmClientPage = 1;
                renderCRMClients();
            });
            if (crmFilterStatus) crmFilterStatus.addEventListener('change', () => {
                crmClientPage = 1;
                renderCRMClients();
            });
            if (crmFilterEtapa) crmFilterEtapa.addEventListener('change', () => {
                crmClientPage = 1;
                renderCRMClients();
            });

            crmClientsPagination?.addEventListener('click', event => {
                const button = event.target.closest('[data-crm-page]');
                if (!button) return;
                if (button.dataset.crmPage === 'prev' && crmClientPage > 1) crmClientPage--;
                if (button.dataset.crmPage === 'next') crmClientPage++;
                renderCRMClients();
            });

            miActividadPagination?.addEventListener('click', event => {
                const button = event.target.closest('[data-activity-page]');
                if (!button) return;
                if (button.dataset.activityPage === 'prev' && miActividadPage > 1) miActividadPage--;
                if (button.dataset.activityPage === 'next') miActividadPage++;
                renderMiActividad();
            });

            // Modal Update Etapa
            if (crmDetailEtapaBtn) {
                crmDetailEtapaBtn.addEventListener('click', async () => {
                    if (!currentClientDetailId || !crmDetailEtapaSelect) return;
                    try {
                        await updateEtapaCRM(currentClientDetailId, crmDetailEtapaSelect.value);
                        showCRMFeedback('Etapa actualizada exitosamente.', 'success');
                        if (crmClientDetailModal) crmClientDetailModal.classList.add('hidden');
                        renderCRMClients();
                    } catch (error) {
                        console.error(error);
                        showCRMFeedback('Error al actualizar etapa.', 'error');
                    }
                });
            }

            // Cierre modales
            if (crmClientDetailClose) {
                crmClientDetailClose.addEventListener('click', () => { if(crmClientDetailModal) crmClientDetailModal.classList.add('hidden'); });
            }
            if (crmClientDetailBackdrop) {
                crmClientDetailBackdrop.addEventListener('click', () => { if(crmClientDetailModal) crmClientDetailModal.classList.add('hidden'); });
            }

            // Confirmación Eliminar
            if (deleteCancelBtn) {
                deleteCancelBtn.addEventListener('click', () => {
                    clientToDelete = null;
                    if (deleteConfirmModal) deleteConfirmModal.classList.add('hidden');
                });
            }
            if (deleteConfirmBtn) {
                deleteConfirmBtn.addEventListener('click', async () => {
                    if (clientToDelete) {
                        try {
                            await deleteCliente(clientToDelete);
                            showCRMFeedback('Cliente eliminado.', 'success');
                            renderCRMClients();
                        } catch (error) {
                            console.error(error);
                            showCRMFeedback('Error al eliminar.', 'error');
                        }
                        clientToDelete = null;
                        if (deleteConfirmModal) deleteConfirmModal.classList.add('hidden');
                    }
                });
            }

            // Interacciones
            if (interClientSelect) {
                interClientSelect.addEventListener('change', (e) => {
                    const clientId = e.target.value;
                    if (clientId) {
                        renderInteracciones(clientId);
                    } else {
                        if (interTimeline) interTimeline.innerHTML = '<p class="text-muted">Seleccione un cliente para ver sus interacciones.</p>';
                        if (interClientInfo) interClientInfo.innerHTML = '';
                    }
                });
            }

            if (interForm) {
                interForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const clienteId = interClientSelect?.value;
                    if (!clienteId) {
                        showCRMFeedback('Por favor seleccione un cliente primero.', 'error');
                        return;
                    }
                    
                    const clienteText = interClientSelect.options[interClientSelect.selectedIndex].text;
                    const userName = localStorage.getItem('userEmail') || 'admin@ruta.com';

                    const data = {
                        cliente_id: clienteId,
                        cliente_nombre: clienteText,
                        tipo: interTipo?.value,
                        descripcion: interDescripcion?.value.trim(),
                        fecha: new Date().toISOString(),
                        usuario_id: localStorage.getItem('userEmail') || 'admin',
                        usuario_nombre: localStorage.getItem('userName') || userName,
                        usuario_email: userName
                    };

                    try {
                        await addInteraccion(data);
                        showCRMFeedback('Interacción registrada exitosamente.', 'success');
                        interForm.reset();
                        renderInteracciones(clienteId);
                    } catch (error) {
                        console.error(error);
                        showCRMFeedback('Error al registrar interacción.', 'error');
                    }
                });
            }

            // --- 8. Observer para cambios de vista ---
            const contentContainer = document.querySelector('.content') || document.body;
            const observer = new MutationObserver(() => {
                const crmView = document.getElementById('view-crm');
                const interView = document.getElementById('view-interacciones');
                const dashView = document.getElementById('view-dashboard-crm');
                const actView = document.getElementById('view-mi-actividad');
                
                if (crmView && crmView.classList.contains('active')) {
                    renderCRMClients();
                }
                if (interView && interView.classList.contains('active')) {
                    loadInteraccionesView();
                }
                if (dashView && dashView.classList.contains('active')) {
                    renderDashboardCRM();
                }
                if (actView && actView.classList.contains('active')) {
                    renderMiActividad();
                }
            });
            observer.observe(contentContainer, { subtree: true, attributes: true, attributeFilter: ['class'] });

            // --- 9. Inicialización ---
            await seedDemoData();
            
            // Check initial active view
            if (document.getElementById('view-crm')?.classList.contains('active')) {
                renderCRMClients();
            }

        } catch (error) {
            console.error('Error inicializando CRM:', error);
        }
    })();
});
