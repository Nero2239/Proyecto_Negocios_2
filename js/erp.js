document.addEventListener('DOMContentLoaded', () => {
    (async function initERP() {
        const role = (localStorage.getItem('userRole') || '').toLowerCase();
        const userEmail = (localStorage.getItem('userEmail') || '').trim().toLowerCase();
        if (!['admin', 'ventas', 'logistica'].includes(role) && !userEmail.includes('admin')) return;
        const [{ initializeApp, getApps, getApp }, { getAuth }, { getFirestore, collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, runTransaction, query, where }] = await Promise.all([
            import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'),
            import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js')
        ]);
        const config = {
            apiKey: 'AIzaSyAZCztGChAZ9k81WWBkp9TZBx9XphWqcmc',
            authDomain: 'camping-3a6a4.firebaseapp.com',
            projectId: 'camping-3a6a4',
            storageBucket: 'camping-3a6a4.firebasestorage.app',
            messagingSenderId: '181839243079',
            appId: '1:181839243079:web:df39441f32098fc7ca4e62'
        };
        const app = getApps().length ? getApp() : initializeApp(config);
        const auth = getAuth(app);
        const db = getFirestore(app);
        const $ = id => document.getElementById(id);
        const userName = localStorage.getItem('userName') || userEmail.split('@')[0] || 'Usuario';
        const canManage = role === 'admin';
        const canSell = role === 'admin' || role === 'ventas';
        const canProcess = role === 'admin' || role === 'logistica';
        const canManageResources = role === 'admin' || role === 'logistica';
        const read = async name => (await getDocs(collection(db, name))).docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() }));
        const money = value => `$${Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
        const state = { clients: [], products: [], users: [], orders: [], processes: [], resources: [], reports: [], maturity: null, draft: [], actorId: localStorage.getItem('userUid') || '' };

        function notice(message, type = 'success') {
            const element = $('erpNotice');
            if (!element) return;
            element.textContent = message;
            element.className = `erp-notice ${type}`;
            element.classList.remove('hidden');
            element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        function monthKey(date) {
            const value = new Date(date);
            return Number.isNaN(value.getTime()) ? '' : `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
        }

        const erpApi = {
            async listOrders() { return read('erp_ordenes'); },
            async getOrder(id) {
                if (!id) return null;
                const snapshot = await getDoc(doc(db, 'erp_ordenes', id));
                return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
            },
            async createOrder({ clienteId, items }) {
                if (!canSell) throw new Error('Tu rol no tiene permiso para crear órdenes.');
                if (!clienteId) throw new Error('Selecciona un cliente CRM.');
                if (!Array.isArray(items) || !items.length) throw new Error('Agrega al menos un producto.');
                const authenticatedUid = auth.currentUser?.uid;
                if (!authenticatedUid) throw new Error('La sesión de Firebase expiró. Inicia sesión nuevamente.');
                const orderRef = doc(collection(db, 'erp_ordenes'));
                const timestamp = new Date().toISOString();

                await runTransaction(db, async transaction => {
                    const clientSnapshot = await transaction.get(doc(db, 'clientes', clienteId));
                    if (!clientSnapshot.exists()) throw new Error('El cliente ya no existe en CRM.');

                    const productSnapshots = new Map();
                    const quantitiesByProduct = new Map();
                    for (const item of items) {
                        const productId = String(item.producto_id || '');
                        const quantity = Number(item.cantidad);
                        if (!productId || !Number.isInteger(quantity) || quantity < 1) throw new Error('Las cantidades deben ser enteros mayores que cero.');
                        quantitiesByProduct.set(productId, (quantitiesByProduct.get(productId) || 0) + quantity);
                        if (!productSnapshots.has(productId)) {
                            const productSnapshot = await transaction.get(doc(db, 'scm_productos', productId));
                            if (!productSnapshot.exists()) throw new Error('Uno de los productos ya no está disponible.');
                            productSnapshots.set(productId, productSnapshot);
                        }
                    }

                    for (const [productId, quantity] of quantitiesByProduct) {
                        const product = productSnapshots.get(productId).data();
                        const stock = Number(product.stock_actual || 0);
                        if (stock < quantity) throw new Error(`Stock insuficiente para ${product.nombre}. Disponible: ${stock}.`);
                    }

                    const normalizedItems = items.map(item => {
                        const productSnapshot = productSnapshots.get(String(item.producto_id));
                        const product = productSnapshot.data();
                        const quantity = Number(item.cantidad);
                        const unitPrice = Number(product.precio_venta ?? product.precio ?? product.costo_unitario ?? 0);
                        if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`El precio de ${product.nombre} no es válido.`);
                        return { producto_id: productSnapshot.id, cantidad: quantity, precio_unitario: unitPrice, subtotal: quantity * unitPrice };
                    });
                    const total = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0);
                    if (!Number.isFinite(total)) throw new Error('No se pudo calcular el total de la orden.');

                    transaction.set(orderRef, {
                        cliente_id: clienteId,
                        fecha: timestamp,
                        estado: 'pendiente',
                        total,
                        usuario_id: authenticatedUid,
                        productos: normalizedItems
                    });
                });
                return orderRef.id;
            },
            async processOrder(orderId, usuarioId) {
                if (!canProcess) throw new Error('Tu rol no tiene permiso para procesar órdenes.');
                const actorUid = auth.currentUser?.uid;
                if (!actorUid) throw new Error('La sesión de Firebase expiró. Inicia sesión nuevamente.');
                const orderRef = doc(db, 'erp_ordenes', orderId);
                const processRef = doc(collection(db, 'erp_procesos'));
                const reportRef = doc(collection(db, 'erp_reportes'));
                const timestamp = new Date().toISOString();
                const scmOrders = await read('scm_pedidos');
                const pendingRestockByProduct = new Map(scmOrders.filter(item => item.tipo === 'reposicion' && item.estado === 'pendiente').map(item => [item.producto_id, item]));

                const result = await runTransaction(db, async transaction => {
                    const orderSnapshot = await transaction.get(orderRef);
                    if (!orderSnapshot.exists()) throw new Error('La orden ya no existe.');
                    const order = orderSnapshot.data();
                    if (order.estado !== 'pendiente') throw new Error('La orden ya fue procesada o cancelada.');
                    if (!Array.isArray(order.productos) || !order.productos.length) throw new Error('La orden no contiene productos.');
                    const clientRef = doc(db, 'clientes', order.cliente_id);
                    const clientSnapshot = await transaction.get(clientRef);
                    if (!clientSnapshot.exists()) throw new Error('El cliente relacionado ya no existe en CRM.');

                    const productRows = [];
                    for (const line of order.productos) {
                        const productRef = doc(db, 'scm_productos', line.producto_id);
                        const productSnapshot = await transaction.get(productRef);
                        if (!productSnapshot.exists()) throw new Error('Uno de los productos ya no existe en SCM.');
                        const product = productSnapshot.data();
                        const quantity = Number(line.cantidad);
                        const stock = Number(product.stock_actual || 0);
                        if (!Number.isInteger(quantity) || quantity < 1) throw new Error('La orden contiene una cantidad no válida.');
                        if (stock < quantity) throw new Error(`Stock insuficiente para ${product.nombre}. Disponible: ${stock}.`);
                        const pendingRestockId = product.reposicion_pendiente_id || pendingRestockByProduct.get(productSnapshot.id)?.id;
                        let pendingRestock = null;
                        if (pendingRestockId && product.estrategia_logistica === 'PUSH') {
                            const restockRef = doc(db, 'scm_pedidos', pendingRestockId);
                            const restockSnapshot = await transaction.get(restockRef);
                            if (restockSnapshot.exists()) {
                                const data = restockSnapshot.data();
                                if (data.tipo === 'reposicion' && data.estado === 'pendiente') pendingRestock = { ref: restockRef, id: restockSnapshot.id, data };
                            }
                        }
                        productRows.push({ line, productRef, product, quantity, stockAfterSale: stock - quantity, pendingRestock });
                    }

                    let unitsSold = 0;
                    let total = 0;
                    const scmMovements = [];
                    const restockOrders = [];
                    for (const row of productRows) {
                        const movementRef = doc(collection(db, 'scm_movimientos'));
                        const { line, productRef, product, quantity, pendingRestock } = row;
                        const minimum = Number(product.stock_minimo || 0);
                        const needsPushRestock = product.estrategia_logistica === 'PUSH' && row.stockAfterSale <= minimum;
                        const restockAmount = needsPushRestock ? Math.max(minimum * 2 - row.stockAfterSale, Number(pendingRestock?.data.cantidad || 0), minimum, 1) : 0;
                        const finalStock = row.stockAfterSale + restockAmount;
                        transaction.update(productRef, { stock_actual: finalStock, ultimo_erp_orden_id: orderId, ...(needsPushRestock || pendingRestock ? { reposicion_pendiente_id: null } : {}) });
                        transaction.set(movementRef, {
                            producto_id: line.producto_id,
                            tipo: 'salida',
                            cantidad: quantity,
                            motivo: 'venta',
                            fecha: timestamp,
                            origen: 'erp',
                            erp_orden_id: orderId
                        });
                        scmMovements.push({ producto_id: line.producto_id, tipo: 'salida', cantidad: quantity, motivo: 'venta', origen: 'erp' });
                        unitsSold += quantity;
                        total += Number(line.subtotal || Number(line.precio_unitario || 0) * quantity);

                        if (needsPushRestock) {
                            const replenishmentRef = pendingRestock?.ref || doc(collection(db, 'scm_pedidos'));
                            const replenishmentMovementRef = doc(collection(db, 'scm_movimientos'));
                            const replenishment = {
                                cantidad: restockAmount,
                                estado: 'surtido',
                                fecha_surtido: timestamp,
                                erp_orden_id: orderId
                            };
                            if (pendingRestock) transaction.update(replenishmentRef, replenishment);
                            else transaction.set(replenishmentRef, {
                                ...replenishment,
                                producto_id: line.producto_id,
                                tipo: 'reposicion',
                                origen: 'automatico_push_erp',
                                fecha: timestamp
                            });
                            transaction.set(replenishmentMovementRef, {
                                producto_id: line.producto_id,
                                tipo: 'entrada',
                                cantidad: restockAmount,
                                motivo: 'reposicion_automatica_push',
                                fecha: timestamp,
                                pedido_id: replenishmentRef.id,
                                erp_orden_id: orderId
                            });
                            scmMovements.push({ producto_id: line.producto_id, tipo: 'entrada', cantidad: restockAmount, motivo: 'reposicion_automatica_push' });
                            restockOrders.push(replenishmentRef.id);
                        }
                    }

                    transaction.update(orderRef, { estado: 'procesada', total, fecha_procesamiento: timestamp, usuario_procesa_id: actorUid });
                    transaction.set(processRef, {
                        orden_id: orderId,
                        tipo: 'venta',
                        estado: 'completado',
                        fecha_inicio: timestamp,
                        fecha_fin: timestamp,
                        usuario_id: actorUid,
                        cliente_id: order.cliente_id,
                        total,
                        unidades_vendidas: unitsSold,
                        movimientos: scmMovements,
                        reposiciones_push: restockOrders
                    });
                    transaction.set(reportRef, {
                        tipo: 'orden_procesada',
                        orden_id: orderId,
                        fecha: timestamp,
                        ventas: total,
                        unidades_vendidas: unitsSold,
                        cliente_id: order.cliente_id
                    });
                    return { orderId, total, unitsSold, pushRestocks: restockOrders.length };
                });
                window.dispatchEvent(new CustomEvent('erp-data-updated', { detail: result }));
                return result;
            },
            async updateOrderStatus(orderId, status, actorId) {
                if (status === 'procesada') return this.processOrder(orderId, actorId);
                if (status !== 'cancelada') throw new Error('Estado de orden no permitido.');
                if (!canSell) throw new Error('Tu rol no tiene permiso para cancelar órdenes.');
                const authenticatedUid = auth.currentUser?.uid;
                if (!authenticatedUid) throw new Error('La sesión de Firebase expiró. Inicia sesión nuevamente.');
                const orderRef = doc(db, 'erp_ordenes', orderId);
                const processRef = doc(collection(db, 'erp_procesos'));
                await runTransaction(db, async transaction => {
                    const orderSnapshot = await transaction.get(orderRef);
                    if (!orderSnapshot.exists()) throw new Error('La orden no existe.');
                    if (orderSnapshot.data().estado !== 'pendiente') throw new Error('Solo se pueden cancelar órdenes pendientes.');
                    const timestamp = new Date().toISOString();
                    transaction.update(orderRef, { estado: 'cancelada', fecha_cancelacion: timestamp });
                    transaction.set(processRef, { orden_id: orderId, tipo: 'cancelacion', estado: 'completado', fecha_inicio: timestamp, fecha_fin: timestamp, usuario_id: authenticatedUid });
                });
                window.dispatchEvent(new CustomEvent('erp-order-updated', { detail: { orderId, estado: status } }));
            },
            async getMaturity() {
                const snapshot = await getDoc(doc(db, 'erp_estado', 'actual'));
                return snapshot.exists() ? snapshot.data() : { nivel: 'Básico', actualizado: null };
            },
            async updateMaturity(level, actorId) {
                const allowed = ['Básico', 'Integrado', 'Automatizado', 'Optimizado'];
                if (!canManage || !allowed.includes(level)) throw new Error('No tienes permiso para cambiar el nivel ERP.');
                const data = { nivel: level, actualizado: new Date().toISOString(), usuario_id: actorId || userEmail };
                await setDoc(doc(db, 'erp_estado', 'actual'), data, { merge: true });
                return data;
            },
            async getMetrics() {
                const [clients, products, orders] = await Promise.all([read('clientes'), read('scm_productos'), read('erp_ordenes')]);
                const processed = orders.filter(order => order.estado === 'procesada');
                return {
                    ventas_totales: processed.reduce((sum, order) => sum + Number(order.total || 0), 0),
                    ordenes_procesadas: processed.length,
                    ordenes_pendientes: orders.filter(order => order.estado === 'pendiente').length,
                    productos_vendidos: processed.reduce((sum, order) => sum + (order.productos || []).reduce((units, line) => units + Number(line.cantidad || 0), 0), 0),
                    clientes_activos: clients.filter(client => client.estado !== 'inactivo').length,
                    inventario_disponible: products.reduce((sum, product) => sum + Number(product.stock_actual || 0), 0),
                    productos_en_catalogo: products.length
                };
            },
            async listResources() { return read('erp_recursos'); },
            async addResource(data, actorId) {
                if (!canManageResources) throw new Error('Tu rol no puede administrar recursos ERP.');
                return addDoc(collection(db, 'erp_recursos'), { ...data, estado: 'activo', creado_por: actorId || userEmail, creado_en: new Date().toISOString() });
            },
            async getUserRole(email) {
                const normalizedEmail = String(email || '').trim().toLowerCase();
                if (!normalizedEmail) return null;
                const matches = await getDocs(query(collection(db, 'usuarios'), where('email', '==', normalizedEmail)));
                const record = matches.docs[0];
                return record ? { id: record.id, ...record.data() } : null;
            },
            async updateUserRole(userId, nextRole, actorId) {
                const allowedRoles = ['admin', 'ventas', 'logistica', 'usuario'];
                if (!canManage || !allowedRoles.includes(nextRole)) throw new Error('No tienes permiso para cambiar este rol.');
                const userRef = doc(db, 'usuarios', userId);
                await updateDoc(userRef, { rol: nextRole, rol_actualizado: new Date().toISOString(), actualizado_por: actorId || userEmail });
                return { id: userId, rol: nextRole };
            }
        };

        window.erpApi = erpApi;
        window.dispatchEvent(new CustomEvent('erp-api-ready', { detail: erpApi }));
        $('erpRoleBadge').textContent = ({ admin: 'Administrador', ventas: 'Ventas', logistica: 'Logística' })[role] || 'Usuario';
        document.querySelectorAll('[data-erp-tab="maturity"]').forEach(tab => tab.classList.toggle('hidden', !canManage));
        document.querySelectorAll('[data-erp-tab="resources"]').forEach(tab => tab.classList.toggle('hidden', !canManageResources));
        document.querySelector('.erp-order-builder')?.classList.toggle('hidden', !canSell);
        $('erpResourceForm')?.classList.toggle('hidden', !canManageResources);
        $('erpMaturityForm')?.classList.toggle('hidden', !canManage);
        $('erpCreateOrder')?.classList.toggle('hidden', !canSell);

        function showNotice(message, type = 'success') {
            const element = $('erpNotice');
            element.textContent = message;
            element.className = `erp-notice ${type}`;
            element.classList.remove('hidden');
        }

        function customerName(id) { return state.clients.find(client => client.id === id)?.nombre || 'Cliente CRM'; }
        function productName(id) { return state.products.find(product => product.id === id)?.nombre || 'Producto SCM'; }
        function renderSelects() {
            const selectedClient = $('erpClientSelect').value;
            $('erpClientSelect').innerHTML = `<option value="">Seleccionar cliente</option>${state.clients.filter(client => client.estado !== 'inactivo').map(client => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.nombre)} · ${escapeHtml(client.correo)}</option>`).join('')}`;
            if (state.clients.some(client => client.id === selectedClient)) $('erpClientSelect').value = selectedClient;
            const selectedProduct = $('erpProductSelect').value;
            $('erpProductSelect').innerHTML = `<option value="">Seleccionar producto</option>${state.products.filter(product => Number(product.stock_actual || 0) > 0).map(product => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.nombre)} · ${Number(product.stock_actual || 0)} disponibles · ${money(product.precio_venta ?? product.precio ?? product.costo_unitario)}</option>`).join('')}`;
            if (state.products.some(product => product.id === selectedProduct)) $('erpProductSelect').value = selectedProduct;
            $('erpResourceOwner').innerHTML = `<option value="">Sin asignar</option>${state.users.map(user => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.nombre || user.email)}</option>`).join('')}`;
        }

        function renderDraft() {
            const container = $('erpDraftLines');
            $('erpDraftTotal').textContent = money(state.draft.reduce((sum, line) => sum + line.subtotal, 0));
            $('erpCreateOrder').disabled = !canSell || !state.draft.length || !$('erpClientSelect').value;
            container.innerHTML = state.draft.length ? state.draft.map((line, index) => `<div class="erp-draft-line"><span>${escapeHtml(line.nombre)}<small> × ${line.cantidad}</small></span><small>${money(line.precio_unitario)} c/u</small><strong>${money(line.subtotal)}</strong><button type="button" class="erp-line-remove" data-remove-line="${index}" aria-label="Quitar producto"><i class="bi bi-trash"></i></button></div>`).join('') : '<p class="erp-empty">Agrega productos para calcular el total.</p>';
        }

        function orderRows(orders) {
            if (!orders.length) return '<p class="erp-empty">Aún no hay órdenes empresariales.</p>';
            return `<table class="erp-orders-table"><thead><tr><th>Orden</th><th>Fecha</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${orders.map(order => `<tr><td>${escapeHtml(order.id.slice(0, 7).toUpperCase())}</td><td>${new Date(order.fecha).toLocaleDateString('es-MX')}</td><td>${escapeHtml(customerName(order.cliente_id))}</td><td>${money(order.total)}</td><td><span class="erp-status ${order.estado === 'procesada' ? 'processed' : ''}">${escapeHtml(order.estado)}</span></td><td>${order.estado === 'pendiente' && canProcess ? `<button type="button" class="erp-action-button" data-process-order="${escapeHtml(order.id)}">Procesar</button>` : order.estado === 'pendiente' && canSell ? `<button type="button" class="erp-action-button" data-cancel-order="${escapeHtml(order.id)}">Cancelar</button>` : '—'}</td></tr>`).join('')}</tbody></table>`;
        }

        function renderOrderLines(order) {
            const items = (order.productos || []).map(line => `<span>${escapeHtml(productName(line.producto_id))} × ${Number(line.cantidad || 0)}</span>`).join('<br>');
            return items || '—';
        }

        function renderOrders() {
            const filter = $('erpOrderStatusFilter').value;
            const orders = [...state.orders].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).filter(order => !filter || order.estado === filter);
            $('erpOrdersTable').innerHTML = orders.length ? `<table class="erp-orders-table"><thead><tr><th>Orden</th><th>Fecha</th><th>Cliente</th><th>Productos</th><th>Total</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${orders.map(order => `<tr><td>${escapeHtml(order.id.slice(0, 7).toUpperCase())}</td><td>${new Date(order.fecha).toLocaleDateString('es-MX')}</td><td>${escapeHtml(customerName(order.cliente_id))}</td><td>${renderOrderLines(order)}</td><td>${money(order.total)}</td><td><span class="erp-status ${order.estado === 'procesada' ? 'processed' : ''}">${escapeHtml(order.estado)}</span></td><td>${order.estado === 'pendiente' && canProcess ? `<button type="button" class="erp-action-button" data-process-order="${escapeHtml(order.id)}">Procesar</button>` : order.estado === 'pendiente' && canSell ? `<button type="button" class="erp-action-button" data-cancel-order="${escapeHtml(order.id)}">Cancelar</button>` : '—'}</td></tr>`).join('')}</tbody></table>` : '<p class="erp-empty">No hay órdenes que coincidan con el filtro.</p>';
            $('erpRecentOrders').innerHTML = orderRows([...state.orders].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 5));
        }

        function renderProcesses() {
            $('erpProcessesTable').innerHTML = state.processes.length ? `<table class="erp-orders-table"><thead><tr><th>Fecha</th><th>Orden</th><th>Proceso</th><th>Estado</th><th>Unidades</th><th>Responsable</th></tr></thead><tbody>${[...state.processes].sort((a, b) => new Date(b.fecha_fin || b.fecha_inicio) - new Date(a.fecha_fin || a.fecha_inicio)).map(process => `<tr><td>${new Date(process.fecha_fin || process.fecha_inicio).toLocaleString('es-MX')}</td><td>${escapeHtml(String(process.orden_id || '').slice(0, 7).toUpperCase())}</td><td>${escapeHtml(process.tipo || 'operación')}</td><td><span class="erp-status processed">${escapeHtml(process.estado || 'completado')}</span></td><td>${Number(process.unidades_vendidas || 0)}</td><td>${escapeHtml(process.usuario_id || '—')}</td></tr>`).join('')}</tbody></table>` : '<p class="erp-empty">Los procesos aparecerán aquí al procesar o cancelar órdenes.</p>';
        }

        function renderResources() {
            $('erpResourcesTable').innerHTML = state.resources.length ? `<table class="erp-orders-table"><thead><tr><th>Recurso</th><th>Tipo</th><th>Responsable</th><th>Estado</th><th>Alta</th></tr></thead><tbody>${state.resources.map(resource => `<tr><td>${escapeHtml(resource.nombre)}</td><td>${escapeHtml(resource.tipo)}</td><td>${escapeHtml(state.users.find(user => user.id === resource.responsable_id)?.nombre || 'Sin asignar')}</td><td>${escapeHtml(resource.estado || 'activo')}</td><td>${resource.creado_en ? new Date(resource.creado_en).toLocaleDateString('es-MX') : '—'}</td></tr>`).join('')}</tbody></table>` : '<p class="erp-empty">No hay recursos internos registrados.</p>';
            $('erpResourceSourceSummary').innerHTML = `<div class="erp-resource-summary-row"><strong>Clientes CRM</strong><span>${state.clients.length} registros</span></div><div class="erp-resource-summary-row"><strong>Productos SCM</strong><span>${state.products.length} registros</span></div><div class="erp-resource-summary-row"><strong>Usuarios</strong><span>${state.users.length} registros</span></div>`;
        }

        function renderMaturity() {
            const levels = ['Básico', 'Integrado', 'Automatizado', 'Optimizado'];
            const currentIndex = Math.max(0, levels.indexOf(state.maturity?.nivel || 'Básico'));
            $('erpMaturityBadge').textContent = levels[currentIndex];
            $('erpMaturitySelect').value = levels[currentIndex];
            $('erpMaturityProgress').style.width = `${Math.round(((currentIndex + 1) / levels.length) * 100)}%`;
            $('erpMaturitySteps').innerHTML = levels.map((level, index) => `<div class="erp-maturity-step ${index <= currentIndex ? 'active' : ''}"><i class="bi ${index <= currentIndex ? 'bi-check-circle-fill' : 'bi-circle'}"></i><span>${level}</span></div>`).join('');
            const checks = [
                ['Clientes conectados desde CRM', state.clients.length > 0],
                ['Productos e inventario conectados desde SCM', state.products.length > 0],
                ['Órdenes empresariales disponibles', state.orders.length > 0],
                ['Procesos automáticos registrados', state.processes.length > 0]
            ];
            $('erpMaturityChecklist').innerHTML = checks.map(([label, complete]) => `<li><i class="bi ${complete ? 'bi-check-square-fill' : 'bi-square'}"></i><span>${label}</span></li>`).join('');
        }

        function renderSalesChart() {
            const names = [];
            const now = new Date();
            for (let offset = 5; offset >= 0; offset--) {
                const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
                names.push({ key: monthKey(date), label: date.toLocaleDateString('es-MX', { month: 'short' }) });
            }
            const totals = names.map(month => state.orders.filter(order => order.estado === 'procesada' && monthKey(order.fecha_procesamiento || order.fecha) === month.key).reduce((sum, order) => sum + Number(order.total || 0), 0));
            const max = Math.max(...totals, 1);
            $('erpSalesChart').innerHTML = names.map((month, index) => `<div class="erp-month-column"><div class="erp-month-bar-wrap"><div class="erp-month-bar" style="height:${Math.max(totals[index] ? 8 : 3, totals[index] / max * 100)}%" title="${money(totals[index])}"></div></div><small class="erp-month-value">${totals[index] ? money(totals[index]) : '$0'}</small><span class="erp-month-label">${escapeHtml(month.label)}</span></div>`).join('');
        }

        function renderDashboard(metrics) {
            $('erpSalesTotal').textContent = money(metrics.ventas_totales);
            $('erpOrdersProcessed').textContent = metrics.ordenes_procesadas;
            $('erpOrdersPending').textContent = `${metrics.ordenes_pendientes} pendientes`;
            $('erpProductsSold').textContent = metrics.productos_vendidos;
            $('erpActiveClients').textContent = metrics.clientes_activos;
            $('erpInventoryUnits').textContent = metrics.inventario_disponible;
            $('erpInventorySkus').textContent = `${metrics.productos_en_catalogo} productos`;
            $('erpReportSales').textContent = money(metrics.ventas_totales);
            $('erpReportOrders').textContent = metrics.ordenes_procesadas;
            $('erpReportProducts').textContent = metrics.productos_vendidos;
            $('erpReportClients').textContent = metrics.clientes_activos;
            $('erpReportInventory').textContent = metrics.inventario_disponible;
            const modules = [['CRM · Clientes', `${state.clients.length} clientes`], ['SCM · Productos', `${state.products.length} productos`], ['SCM · Inventario', `${metrics.inventario_disponible} unidades disponibles`], ['ERP · Órdenes', `${state.orders.length} órdenes empresariales`]];
            $('erpIntegrationStatus').innerHTML = modules.map(([label, detail]) => `<div class="erp-integration-row"><div><strong>${label}</strong><br><span>${detail}</span></div><i class="bi bi-check-circle-fill erp-integration-ok" aria-label="Conectado"></i></div>`).join('');
            renderSalesChart();
            renderOrders();
            $('erpReportsTable').innerHTML = state.reports.length ? `<table class="erp-orders-table"><thead><tr><th>Fecha</th><th>Orden</th><th>Ventas</th><th>Unidades</th><th>Cliente</th></tr></thead><tbody>${[...state.reports].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(report => `<tr><td>${new Date(report.fecha).toLocaleString('es-MX')}</td><td>${escapeHtml(String(report.orden_id || '').slice(0, 7).toUpperCase())}</td><td>${money(report.ventas)}</td><td>${Number(report.unidades_vendidas || 0)}</td><td>${escapeHtml(customerName(report.cliente_id))}</td></tr>`).join('')}</tbody></table>` : '<p class="erp-empty">Los reportes se generan al procesar órdenes.</p>';
        }

        async function reload() {
            const authUid = localStorage.getItem('userUid') || '';
            const usersPromise = canManage ? read('usuarios').then(users => users.filter(user => user.auth_uid === user.id)) : authUid ? getDoc(doc(db, 'usuarios', authUid)).then(snapshot => snapshot.exists() ? [{ id: snapshot.id, ...snapshot.data() }] : []) : Promise.resolve([]);
            const [clients, products, users, orders, processes, resources, reports, maturity] = await Promise.all([
                read('clientes'), read('scm_productos'), usersPromise, erpApi.listOrders(), read('erp_procesos'), erpApi.listResources(), read('erp_reportes'), erpApi.getMaturity()
            ]);
            state.clients = clients;
            state.products = products;
            state.users = users;
            state.orders = orders;
            state.processes = processes;
            state.resources = resources;
            state.reports = reports;
            state.maturity = maturity;
            const user = users.find(item => String(item.email || '').toLowerCase() === userEmail);
            if (user) state.actorId = user.id;
            renderSelects();
            renderDraft();
            renderDashboard(await erpApi.getMetrics());
            renderProcesses();
            renderResources();
            renderMaturity();
        }

        function openTab(tabName) {
            document.querySelectorAll('[data-erp-tab]').forEach(tab => tab.classList.toggle('active', tab.dataset.erpTab === tabName));
            document.querySelectorAll('[data-erp-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.erpPanel === tabName));
            if (tabName === 'orders') renderOrders();
            if (tabName === 'processes') renderProcesses();
            if (tabName === 'resources') renderResources();
            if (tabName === 'maturity') renderMaturity();
        }

        document.querySelectorAll('[data-erp-tab]').forEach(tab => tab.addEventListener('click', () => openTab(tab.dataset.erpTab)));
        document.querySelectorAll('[data-erp-open-tab]').forEach(button => button.addEventListener('click', () => openTab(button.dataset.erpOpenTab)));
        const erpView = $('view-erp');
        if (erpView) {
            new MutationObserver(() => {
                if (erpView.classList.contains('active')) reload().catch(error => showNotice(error.message || 'No se pudieron actualizar los datos ERP.', 'error'));
            }).observe(erpView, { attributes: true, attributeFilter: ['class'] });
        }
        $('erpClientSelect').addEventListener('change', renderDraft);
        $('erpProductSelect').addEventListener('change', () => { $('erpProductQuantity').value = 1; });
        $('erpOrderStatusFilter').addEventListener('change', renderOrders);
        $('erpAddProduct').addEventListener('click', () => {
            const product = state.products.find(item => item.id === $('erpProductSelect').value);
            const quantity = Number($('erpProductQuantity').value);
            if (!product) return showNotice('Selecciona un producto SCM.', 'error');
            if (!Number.isInteger(quantity) || quantity < 1) return showNotice('La cantidad debe ser un entero mayor que cero.', 'error');
            const existing = state.draft.find(item => item.producto_id === product.id);
            const nextQuantity = quantity + Number(existing?.cantidad || 0);
            if (nextQuantity > Number(product.stock_actual || 0)) return showNotice(`Stock insuficiente para ${product.nombre}. Disponible: ${product.stock_actual}.`, 'error');
            const unitPrice = Number(product.precio_venta ?? product.precio ?? product.costo_unitario ?? 0);
            if (existing) { existing.cantidad = nextQuantity; existing.subtotal = existing.cantidad * existing.precio_unitario; }
            else state.draft.push({ producto_id: product.id, nombre: product.nombre, cantidad: quantity, precio_unitario: unitPrice, subtotal: quantity * unitPrice });
            $('erpNotice').classList.add('hidden');
            renderDraft();
        });
        $('erpDraftLines').addEventListener('click', event => {
            const button = event.target.closest('[data-remove-line]');
            if (!button) return;
            state.draft.splice(Number(button.dataset.removeLine), 1);
            renderDraft();
        });
        $('erpCreateOrder').addEventListener('click', async () => {
            try {
                const orderId = await erpApi.createOrder({ clienteId: $('erpClientSelect').value, items: state.draft });
                state.draft = [];
                await reload();
                openTab('orders');
                showNotice(`Orden ${orderId.slice(0, 7).toUpperCase()} creada. Lista para procesarse.`);
            } catch (error) { showNotice(error.message || 'No se pudo crear la orden.', 'error'); }
        });
        $('erpOrdersTable').addEventListener('click', async event => {
            const processButton = event.target.closest('[data-process-order]');
            const cancelButton = event.target.closest('[data-cancel-order]');
            const button = processButton || cancelButton;
            if (!button) return;
            button.disabled = true;
            $('erpOrderProcessStatus').innerHTML = '<i class="bi bi-arrow-repeat"></i><span>Procesando orden, inventario y registro de operación…</span>';
            try {
                const result = processButton ? await erpApi.processOrder(button.dataset.processOrder, state.actorId) : await erpApi.updateOrderStatus(button.dataset.cancelOrder, 'cancelada', state.actorId);
                await reload();
                $('erpOrderProcessStatus').innerHTML = `<i class="bi bi-check-circle-fill"></i><span>${processButton ? `Operación completada. ${result.pushRestocks ? `${result.pushRestocks} reposición(es) PUSH aplicada(s). ` : ''}Total: ${money(result.total)}.` : 'Orden cancelada.'}</span>`;
                showNotice(processButton ? 'Operación exitosa: inventario, movimientos e historial actualizados.' : 'Orden cancelada y registrada en procesos.');
            } catch (error) {
                button.disabled = false;
                $('erpOrderProcessStatus').innerHTML = `<i class="bi bi-exclamation-circle"></i><span>${escapeHtml(error.message || 'No se pudo procesar la orden.')}</span>`;
                showNotice(error.message || 'No se pudo procesar la orden.', 'error');
            }
        });
        $('erpResourceForm').addEventListener('submit', async event => {
            event.preventDefault();
            if (!canManageResources) return showNotice('Tu rol no puede administrar recursos ERP.', 'error');
            const formData = new FormData(event.currentTarget);
            const nombre = String(formData.get('nombre') || '').trim();
            if (!nombre) return showNotice('Escribe el nombre del recurso.', 'error');
            try {
                await erpApi.addResource({ nombre, tipo: formData.get('tipo'), responsable_id: formData.get('responsable_id') || '' }, state.actorId);
                event.currentTarget.reset();
                await reload();
                showNotice('Recurso interno registrado.');
            } catch (error) { showNotice(error.message || 'No se pudo registrar el recurso.', 'error'); }
        });
        $('erpMaturityForm').addEventListener('submit', async event => {
            event.preventDefault();
            try {
                state.maturity = await erpApi.updateMaturity($('erpMaturitySelect').value, state.actorId);
                renderMaturity();
                showNotice(`Nivel ERP actualizado a ${state.maturity.nivel}.`);
            } catch (error) { showNotice(error.message || 'No se pudo guardar el nivel ERP.', 'error'); }
        });

        try {
            await reload();
        } catch (error) {
            console.error('No se pudo iniciar ERP:', error);
            showNotice('No se pudieron cargar los datos ERP. Revisa la conexión con Firestore.', 'error');
        }
    })().catch(error => console.error('Error ERP:', error));
});