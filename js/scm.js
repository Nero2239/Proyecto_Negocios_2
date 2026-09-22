document.addEventListener('DOMContentLoaded', () => {
    (async function initSCM() {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js');
        const { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js');
        const config = {
            apiKey: 'AIzaSyAZCztGChAZ9k81WWBkp9TZBx9XphWqcmc', authDomain: 'camping-3a6a4.firebaseapp.com',
            projectId: 'camping-3a6a4', storageBucket: 'camping-3a6a4.firebasestorage.app',
            messagingSenderId: '181839243079', appId: '1:181839243079:web:df39441f32098fc7ca4e62'
        };
        const db = getFirestore(initializeApp(config, 'scmApp'));
        const $ = id => document.getElementById(id);
        const feedback = (text, type = 'success') => {
            const el = $('feedbackMessage'); if (!el) return;
            el.textContent = text; el.className = `feedback-message ${type} show`;
            setTimeout(() => { el.className = 'feedback-message'; }, 2800);
        };
        const read = async name => (await getDocs(collection(db, name))).docs.map(item => ({ id: item.id, ...item.data() }));
        const save = async (name, id, data) => id ? updateDoc(doc(db, name, id), data) : addDoc(collection(db, name), data);
        const remove = (name, id) => deleteDoc(doc(db, name, id));
        let products = [], suppliers = [], movements = [], orders = [], pendingDelete = null, page = { products: 1, inventory: 1, orders: 1 };
        const perPage = 5;
        const campingCatalog = [
            { nombre: 'Tienda Pro-Series', descripcion: 'Resistente al agua y viento, para 2 personas.', categoria: 'tiendas', stock_actual: 8, stock_minimo: 3, costo_unitario: 120, estrategia_logistica: 'PUSH' },
            { nombre: 'Saco Térmico -5°C', descripcion: 'Máximo confort en noches frías de montaña.', categoria: 'sacos', stock_actual: 5, stock_minimo: 2, costo_unitario: 85, estrategia_logistica: 'PULL' },
            { nombre: 'Linterna Solar LED', descripcion: 'Recargable y duradera.', categoria: 'iluminacion', stock_actual: 12, stock_minimo: 4, costo_unitario: 30, estrategia_logistica: 'PUSH' },
            { nombre: 'Mochila Ergonómica 50L', descripcion: 'Espacio y comodidad para travesías largas.', categoria: 'mochilas', stock_actual: 6, stock_minimo: 2, costo_unitario: 95, estrategia_logistica: 'PULL' },
            { nombre: 'Tienda Compact 1P', descripcion: 'Ligera y fácil de montar.', categoria: 'tiendas', stock_actual: 4, stock_minimo: 2, costo_unitario: 70, estrategia_logistica: 'PULL' },
            { nombre: 'Saco UltraLight 0°C', descripcion: 'Aislamiento alto con bajo peso.', categoria: 'sacos', stock_actual: 7, stock_minimo: 3, costo_unitario: 110, estrategia_logistica: 'PUSH' },
            { nombre: 'Luz Frontal PRO', descripcion: 'Fuerte y cómoda.', categoria: 'iluminacion', stock_actual: 10, stock_minimo: 3, costo_unitario: 22, estrategia_logistica: 'PULL' },
            { nombre: 'Organizador de Mochila', descripcion: 'Bolsillos y funda impermeable.', categoria: 'accesorios', stock_actual: 9, stock_minimo: 3, costo_unitario: 18, estrategia_logistica: 'PULL' },
            { nombre: 'Tienda 3 Estaciones', descripcion: 'Versátil y ligera para 3 estaciones.', categoria: 'tiendas', stock_actual: 5, stock_minimo: 2, costo_unitario: 150, estrategia_logistica: 'PUSH' },
            { nombre: 'Colchoneta Aislante', descripcion: 'Aislamiento y comodidad para acampar.', categoria: 'accesorios', stock_actual: 11, stock_minimo: 4, costo_unitario: 45, estrategia_logistica: 'PULL' }
        ];
        const campingSuppliers = [
            { nombre: 'The North Face', contacto: 'Equipo comercial', correo: 'proveedores@thenorthface.com', telefono: '555-100-1001' },
            { nombre: 'Coleman', contacto: 'Distribución outdoor', correo: 'ventas@coleman.com', telefono: '555-100-1002' },
            { nombre: 'Petzl', contacto: 'Atención a tiendas', correo: 'comercial@petzl.com', telefono: '555-100-1003' },
            { nombre: 'Osprey', contacto: 'Ventas mayoristas', correo: 'ventas@osprey.com', telefono: '555-100-1004' }
        ];
        const campingTerms = ['camp', 'tienda', 'saco', 'linterna', 'luz', 'mochila', 'colchoneta', 'cocina', 'hornillo', 'botiquín', 'botiquin', 'bota', 'trekking', 'aventura', 'outdoor', 'pesca', 'faro', 'casco', 'equipo'];
        const isCampingText = value => campingTerms.some(term => String(value || '').toLowerCase().includes(term));

        function communityProducts() {
            const result = [];
            for (let index = 0; index < localStorage.length; index++) {
                const key = localStorage.key(index);
                if (!key?.startsWith('userPublications_')) continue;
                try { result.push(...JSON.parse(localStorage.getItem(key) || '[]').map(item => ({ ...item, publicationKey: key }))); } catch (error) { /* Ignorar publicaciones inválidas. */ }
            }
            return result;
        }

        function syncCommunityPublications() {
            const syncedProducts = products.filter(item => item.origen === 'comunidad' && item.publicacion_id);
            for (let index = 0; index < localStorage.length; index++) {
                const key = localStorage.key(index);
                if (!key?.startsWith('userPublications_')) continue;
                try {
                    const publications = JSON.parse(localStorage.getItem(key) || '[]');
                    const updated = publications.map(publication => {
                        const scmProduct = syncedProducts.find(item => item.publicacion_id === String(publication.id));
                        return scmProduct ? { ...publication, name: scmProduct.nombre, description: scmProduct.descripcion, price: Number(scmProduct.costo_unitario || publication.price), stock: Number(scmProduct.stock_actual || publication.stock || 1) } : publication;
                    });
                    localStorage.setItem(key, JSON.stringify(updated));
                } catch (error) { /* Ignorar publicaciones inválidas. */ }
            }
        }

        async function syncCatalogSources() {
            const sources = [...campingCatalog, ...communityProducts().filter(item => !['hola', 'sd'].includes(String(item.name || '').toLowerCase()) && isCampingText(`${item.name} ${item.description}`)).map(item => ({
                nombre: item.name, descripcion: item.description || '', categoria: 'comunidad', stock_actual: Number(item.stock || 1), stock_minimo: 1,
                costo_unitario: Number(item.price || 0), estrategia_logistica: 'PULL', origen: 'comunidad', publicacion_id: String(item.id), publicacion_key: item.publicationKey
            }))];
            for (const source of sources) {
                const existing = products.find(item => item.nombre === source.nombre && (source.publicacion_id ? item.publicacion_id === source.publicacion_id : !item.publicacion_id));
                if (!existing) await save('scm_productos', null, { ...source, origen: source.origen || 'tienda' });
            }
            for (const item of products.filter(product => !product.origen)) {
                await save('scm_productos', item.id, { origen: 'demo_scm' });
            }
            products = await read('scm_productos');
            localStorage.setItem('scm_catalog_cache', JSON.stringify(products));
        }

        async function cleanAndConfigureScm() {
            suppliers = await read('scm_proveedores');
            products = await read('scm_productos');
            movements = await read('scm_movimientos');
            orders = await read('scm_pedidos');

            const demoProducts = products.filter(item => item.origen === 'demo_scm' || ['Vasija de barro', 'Textil bordado', 'Alebrije', 'Collar artesanal'].includes(item.nombre));
            const unrelatedCommunityProducts = products.filter(item => item.origen === 'comunidad' && (!isCampingText(`${item.nombre} ${item.descripcion}`) || ['hola', 'sd'].includes(String(item.nombre || '').toLowerCase())));
            for (const item of [...demoProducts, ...unrelatedCommunityProducts]) {
                for (const movement of movements.filter(entry => entry.producto_id === item.id)) await remove('scm_movimientos', movement.id);
                for (const order of orders.filter(entry => entry.producto_id === item.id)) await remove('scm_pedidos', order.id);
                await remove('scm_productos', item.id);
            }

            suppliers = await read('scm_proveedores');
            for (let index = 0; index < campingSuppliers.length; index++) {
                const data = campingSuppliers[index];
                if (suppliers[index]) await save('scm_proveedores', suppliers[index].id, data);
                else await save('scm_proveedores', null, data);
            }
            suppliers = await read('scm_proveedores');
            const extraSuppliers = suppliers.slice(campingSuppliers.length);
            for (const supplier of extraSuppliers) await remove('scm_proveedores', supplier.id);

            products = await read('scm_productos');
            const storeProducts = products.filter(item => item.origen === 'tienda');
            for (let index = 0; index < storeProducts.length; index++) {
                const item = storeProducts[index];
                if (!item.proveedor_id || !suppliers.some(supplier => supplier.id === item.proveedor_id)) {
                    await save('scm_productos', item.id, { proveedor_id: suppliers[index % suppliers.length].id });
                }
            }
        }

        async function seed() {
            products = await read('scm_productos');
            suppliers = await read('scm_proveedores');
            if (!suppliers.length) {
                for (const data of [
                    { nombre: 'Artesanías del Sol', contacto: 'Juan Pérez', correo: 'juan@artesanias.com', telefono: '555-123-4573' },
                    { nombre: 'Textiles del Sur', contacto: 'María López', correo: 'maria@textiles.com', telefono: '555-876-4221' },
                    { nombre: 'Maderas Regionales', contacto: 'Carlos Ruiz', correo: 'carlos@maderas.com', telefono: '555-321-4517' }
                ]) await save('scm_proveedores', null, data);
                suppliers = await read('scm_proveedores');
            }
            if (!products.length) {
                for (const data of [
                    { nombre: 'Vasija de barro', descripcion: 'Pieza artesanal', categoria: 'Cerámica', stock_actual: 10, stock_minimo: 5, proveedor_id: suppliers[0].id, costo_unitario: 120, estrategia_logistica: 'PUSH' },
                    { nombre: 'Textil bordado', descripcion: 'Textil tradicional', categoria: 'Textiles', stock_actual: 12, stock_minimo: 10, proveedor_id: suppliers[1].id, costo_unitario: 85, estrategia_logistica: 'PULL' },
                    { nombre: 'Alebrije', descripcion: 'Figura decorativa', categoria: 'Decoración', stock_actual: 8, stock_minimo: 5, proveedor_id: suppliers[2].id, costo_unitario: 240, estrategia_logistica: 'PUSH' },
                    { nombre: 'Collar artesanal', descripcion: 'Accesorio hecho a mano', categoria: 'Joyería', stock_actual: 3, stock_minimo: 10, proveedor_id: suppliers[0].id, costo_unitario: 150, estrategia_logistica: 'PULL' }
                ]) await save('scm_productos', null, data);
                products = await read('scm_productos');
            }
            movements = await read('scm_movimientos'); orders = await read('scm_pedidos');
        }
        const supplierName = id => suppliers.find(item => item.id === id)?.nombre || 'Sin proveedor';
        const relevantProducts = () => products.filter(item => !['hola', 'sd'].includes(String(item.nombre || '').toLowerCase()));
        const paginate = (items, type) => {
            const total = Math.max(1, Math.ceil(items.length / perPage)); page[type] = Math.min(page[type], total);
            return { visible: items.slice((page[type] - 1) * perPage, page[type] * perPage), total };
        };
        const pagination = (id, type, total) => {
            const el = $(id); if (!el) return;
            el.innerHTML = total > 1 ? `<button class="page-btn" data-scm-page="prev" data-type="${type}" ${page[type] === 1 ? 'disabled' : ''}>Anterior</button><span class="page-indicator">Página ${page[type]} / ${total}</span><button class="page-btn" data-scm-page="next" data-type="${type}" ${page[type] === total ? 'disabled' : ''}>Siguiente</button>` : '';
        };
        function renderProducts() {
            const term = ($('scmProductSearch')?.value || '').toLowerCase(), strategy = $('scmStrategyFilter')?.value || '';
            const filtered = relevantProducts().filter(item => `${item.nombre} ${item.categoria}`.toLowerCase().includes(term) && (!strategy || item.estrategia_logistica === strategy));
            const result = paginate(filtered, 'products');
            $('scmProductsBody').innerHTML = result.visible.map(item => `<tr><td>${item.nombre}</td><td>${item.categoria}</td><td class="${item.stock_actual <= item.stock_minimo ? 'stock-critical' : ''}">${item.stock_actual}</td><td>${item.stock_minimo}</td><td>${supplierName(item.proveedor_id)}</td><td><span class="role-badge ${item.estrategia_logistica === 'PUSH' ? 'role-admin' : 'role-user'}">${item.estrategia_logistica}</span></td><td><button class="btn btn-sm btn-primary scm-edit-product" data-id="${item.id}">Editar</button> <button class="btn btn-sm btn-danger scm-delete-product" data-id="${item.id}">Eliminar</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty-state">No hay productos.</td></tr>';
            pagination('scmProductsPagination', 'products', result.total);
        }
        function renderInventory() {
            const result = paginate(relevantProducts(), 'inventory');
            $('scmInventoryBody').innerHTML = result.visible.map(item => { const last = movements.filter(m => m.producto_id === item.id).sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0]; return `<tr><td>${item.nombre}</td><td class="${item.stock_actual <= item.stock_minimo ? 'stock-critical' : ''}">${item.stock_actual}</td><td>${item.stock_minimo}</td><td><span class="badge ${item.stock_actual <= item.stock_minimo ? 'badge-warn' : 'badge-ok'}">${item.stock_actual <= item.stock_minimo ? 'Stock bajo' : 'Normal'}</span></td><td>${last ? new Date(last.fecha).toLocaleDateString() : 'Sin movimientos'}</td><td><button class="btn btn-outline scm-history" data-id="${item.id}">Ver historial</button></td></tr>`; }).join('');
            pagination('scmInventoryPagination', 'inventory', result.total);
            $('scmLowStockList').innerHTML = relevantProducts().filter(item => item.stock_actual <= item.stock_minimo).map(item => `<div class="risk-item"><strong>${item.nombre}</strong><span>${item.stock_actual} / mínimo ${item.stock_minimo}</span></div>`).join('') || '<p class="text-success">No hay productos en riesgo.</p>';
        }
        function renderHistory(productId) {
            const product = products.find(item => item.id === productId);
            const history = movements.filter(item => item.producto_id === productId).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            $('scmHistoryTitle').textContent = `Movimientos: ${product?.nombre || 'Producto'}`;
            $('scmHistoryList').innerHTML = history.length ? history.map(item => `<div class="risk-item"><strong>${item.tipo.toUpperCase()} · ${item.cantidad}</strong><span>${item.motivo} · ${new Date(item.fecha).toLocaleString()}</span></div>`).join('') : '<p class="empty-state">No hay movimientos registrados.</p>';
            $('scmHistoryModal').classList.remove('hidden');
        }
        function renderSuppliers() { $('scmSuppliersBody').innerHTML = suppliers.map(item => `<tr><td>${item.nombre}</td><td>${item.contacto}</td><td>${item.correo}</td><td>${item.telefono}</td><td><button class="btn btn-sm btn-primary scm-edit-supplier" data-id="${item.id}">Editar</button> <button class="btn btn-sm btn-danger scm-delete-supplier" data-id="${item.id}">Eliminar</button></td></tr>`).join(''); }
        function renderOrders() { const result = paginate(orders.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)), 'orders'); $('scmOrdersBody').innerHTML = result.visible.map(item => `<tr><td>${products.find(p => p.id === item.producto_id)?.nombre || 'Producto'}</td><td>${item.cantidad}</td><td>${item.tipo.toUpperCase()}</td><td><span class="badge ${item.estado === 'surtido' ? 'badge-ok' : 'badge-warn'}">${item.estado}</span></td><td>${new Date(item.fecha).toLocaleDateString()}</td><td>${item.estado === 'pendiente' ? `<button class="btn btn-sm btn-primary scm-supply-order" data-id="${item.id}">Marcar surtido</button>` : 'Completado'}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">No hay pedidos.</td></tr>'; pagination('scmOrdersPagination', 'orders', result.total); }
        async function renderReports() { const reportProducts = relevantProducts(); const level = (await read('scm_config'))[0]?.nivel_scm || 'Inicial'; $('scmProductsMetric').textContent = reportProducts.length; $('scmSuppliersMetric').textContent = suppliers.length; $('scmPendingMetric').textContent = orders.filter(item => item.estado === 'pendiente').length; $('scmCriticalMetric').textContent = reportProducts.filter(item => item.stock_actual <= item.stock_minimo).length; $('scmMaturityPanel').innerHTML = `<strong>${level}</strong><p>${level === 'Optimizado' ? 'Procesos integrados y medidos.' : level === 'En desarrollo' ? 'Inventario y logística en integración.' : 'Procesos básicos identificados.'}</p>`; const push = reportProducts.filter(p => p.estrategia_logistica === 'PUSH').length, pull = reportProducts.filter(p => p.estrategia_logistica === 'PULL').length; $('scmStrategyChart').innerHTML = `<div class="scm-bar"><span>PUSH</span><b style="width:${Math.max(push * 25, 4)}%">${push}</b></div><div class="scm-bar"><span>PULL</span><b style="width:${Math.max(pull * 25, 4)}%">${pull}</b></div>`; $('scmReportList').innerHTML = reportProducts.filter(p => p.stock_actual <= p.stock_minimo).map(p => `<div class="risk-item"><strong>${p.nombre}</strong><span>Inventario crítico</span></div>`).join('') || '<p>No hay inventario crítico.</p>'; }
        function modal(id, title, fields, onSave) { const root = $('scmModal'); root.querySelector('h3').textContent = title; root.querySelector('.scm-form-fields').innerHTML = fields; root.classList.remove('hidden'); root.querySelector('form').onsubmit = async e => { e.preventDefault(); try { await onSave(new FormData(e.target)); root.classList.add('hidden'); await reload(); feedback('Cambios guardados correctamente.'); } catch (error) { feedback(error.message || 'No se pudo guardar.', 'error'); } }; }
        function productFields(item = {}) { return `<label>Nombre<input name="nombre" required value="${item.nombre || ''}"></label><label>Descripción<textarea name="descripcion">${item.descripcion || ''}</textarea></label><label>Categoría<input name="categoria" required value="${item.categoria || ''}"></label><label>Stock actual<input name="stock_actual" type="number" min="0" required value="${item.stock_actual ?? 0}"></label><label>Stock mínimo<input name="stock_minimo" type="number" min="0" required value="${item.stock_minimo ?? 0}"></label><label>Proveedor<select name="proveedor_id">${suppliers.map(s => `<option value="${s.id}" ${s.id === item.proveedor_id ? 'selected' : ''}>${s.nombre}</option>`).join('')}</select></label><label>Costo unitario<input name="costo_unitario" type="number" min="0" step="0.01" required value="${item.costo_unitario ?? 0}"></label><label>Estrategia<select name="estrategia_logistica"><option ${item.estrategia_logistica === 'PUSH' ? 'selected' : ''}>PUSH</option><option ${item.estrategia_logistica === 'PULL' ? 'selected' : ''}>PULL</option></select></label>`; }
        async function reload() {
            products = await read('scm_productos');
            const invalidProducts = products.filter(item => ['hola', 'sd'].includes(String(item.nombre || '').toLowerCase()));
            for (const item of invalidProducts) await remove('scm_productos', item.id);
            products = await read('scm_productos');
            suppliers = await read('scm_proveedores');
            movements = await read('scm_movimientos');
            orders = await read('scm_pedidos');
            syncCommunityPublications();
            localStorage.setItem('scm_catalog_cache', JSON.stringify(products));
            renderProducts(); renderInventory(); renderSuppliers(); renderOrders(); await renderReports();
        }
        document.querySelectorAll('.nav-link[data-view^="scm-"]').forEach(link => link.addEventListener('click', () => { setTimeout(() => { const title = { 'scm-productos': 'Productos SCM', 'scm-inventario': 'Inventario', 'scm-proveedores': 'Proveedores', 'scm-pedidos': 'Pedidos SCM', 'scm-reportes': 'Reportes SCM' }[link.dataset.view]; if ($('pageTitle')) $('pageTitle').textContent = title; }, 0); }));
        $('scmProductSearch')?.addEventListener('input', () => { page.products = 1; renderProducts(); }); $('scmStrategyFilter')?.addEventListener('change', () => { page.products = 1; renderProducts(); });
        document.addEventListener('click', async event => { const button = event.target.closest('[data-scm-page]'); if (button) { page[button.dataset.type] += button.dataset.scmPage === 'next' ? 1 : -1; await reload(); return; }
            if (event.target.closest('#openScmProductModal')) return modal('scmModal', 'Nuevo producto SCM', productFields(), async data => save('scm_productos', null, { ...Object.fromEntries(data), stock_actual: Number(data.get('stock_actual')), stock_minimo: Number(data.get('stock_minimo')), costo_unitario: Number(data.get('costo_unitario')) }));
            const productEdit = event.target.closest('.scm-edit-product'); if (productEdit) { const item = products.find(p => p.id === productEdit.dataset.id); return modal('scmModal', 'Editar producto SCM', productFields(item), async data => save('scm_productos', item.id, { ...Object.fromEntries(data), stock_actual: Number(data.get('stock_actual')), stock_minimo: Number(data.get('stock_minimo')), costo_unitario: Number(data.get('costo_unitario')) })); }
            const productDelete = event.target.closest('.scm-delete-product'); if (productDelete) { pendingDelete = { collection: 'scm_productos', id: productDelete.dataset.id, label: products.find(p => p.id === productDelete.dataset.id)?.nombre || 'producto' }; $('scmDeleteText').textContent = `¿Deseas eliminar el ${pendingDelete.label}?`; $('scmDeleteModal').classList.remove('hidden'); }
            if (event.target.closest('#openSupplierModal')) return modal('scmModal', 'Nuevo proveedor', '<label>Nombre<input name="nombre" required></label><label>Contacto<input name="contacto" required></label><label>Correo<input name="correo" type="email" required></label><label>Teléfono<input name="telefono" required></label>', async data => save('scm_proveedores', null, Object.fromEntries(data)));
            const supplierEdit = event.target.closest('.scm-edit-supplier'); if (supplierEdit) { const item = suppliers.find(s => s.id === supplierEdit.dataset.id); return modal('scmModal', 'Editar proveedor', `<label>Nombre<input name="nombre" required value="${item.nombre}"></label><label>Contacto<input name="contacto" required value="${item.contacto}"></label><label>Correo<input name="correo" type="email" required value="${item.correo}"></label><label>Teléfono<input name="telefono" required value="${item.telefono}"></label>`, async data => save('scm_proveedores', item.id, Object.fromEntries(data))); }
            const supplierDelete = event.target.closest('.scm-delete-supplier'); if (supplierDelete) { pendingDelete = { collection: 'scm_proveedores', id: supplierDelete.dataset.id, label: suppliers.find(s => s.id === supplierDelete.dataset.id)?.nombre || 'proveedor' }; $('scmDeleteText').textContent = `¿Deseas eliminar el ${pendingDelete.label}?`; $('scmDeleteModal').classList.remove('hidden'); }
            const historyButton = event.target.closest('.scm-history'); if (historyButton) { renderHistory(historyButton.dataset.id); return; }
            const movementButton = event.target.closest('#openMovementModal'); if (movementButton) return modal('scmModal', 'Registrar movimiento', `<label>Producto<select name="producto_id">${products.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}</select></label><label>Tipo<select name="tipo"><option>entrada</option><option>salida</option></select></label><label>Cantidad<input name="cantidad" type="number" min="1" required></label><label>Motivo<select name="motivo"><option>venta</option><option>ajuste</option><option>reposicion</option></select></label>`, async data => { const item = products.find(p => p.id === data.get('producto_id')); const amount = Number(data.get('cantidad')); const type = data.get('tipo'); const stock = Number(item.stock_actual) + (type === 'entrada' ? amount : -amount); if (stock < 0) throw new Error('Stock insuficiente'); await updateDoc(doc(db, 'scm_productos', item.id), { stock_actual: stock }); await save('scm_movimientos', null, { ...Object.fromEntries(data), cantidad: amount, fecha: new Date().toISOString() }); const hasPendingPush = orders.some(order => order.producto_id === item.id && order.tipo === 'reposicion' && order.estado === 'pendiente'); if (item.estrategia_logistica === 'PUSH' && stock <= item.stock_minimo && !hasPendingPush) await save('scm_pedidos', null, { producto_id: item.id, cantidad: Math.max(item.stock_minimo * 2 - stock, item.stock_minimo), tipo: 'reposicion', estado: 'pendiente', fecha: new Date().toISOString(), origen: 'automatico_push' }); });
            if (event.target.closest('#openOrderModal')) return modal('scmModal', 'Generar pedido', `<label>Producto<select name="producto_id">${products.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}</select></label><label>Cantidad<input name="cantidad" type="number" min="1" required></label><label>Tipo<select name="tipo"><option>reposicion</option><option>venta</option></select></label>`, async data => save('scm_pedidos', null, { ...Object.fromEntries(data), cantidad: Number(data.get('cantidad')), estado: 'pendiente', fecha: new Date().toISOString() }));
            const supply = event.target.closest('.scm-supply-order'); if (supply) { const order = orders.find(o => o.id === supply.dataset.id); await updateDoc(doc(db, 'scm_pedidos', order.id), { estado: 'surtido' }); await reload(); }
            if (event.target.closest('#saveScmLevel')) { const level = $('scmLevelSelect').value; const config = (await read('scm_config'))[0]; await save('scm_config', config?.id, { nivel_scm: level, actualizado: new Date().toISOString() }); feedback('Nivel SCM actualizado.'); await renderReports(); }
        });
        document.addEventListener('click', async event => { if (event.target.closest('#scmModalClose, #scmModalCancel')) $('scmModal')?.classList.add('hidden'); if (event.target.closest('#scmDeleteCancel')) { pendingDelete = null; $('scmDeleteModal').classList.add('hidden'); } if (event.target.closest('#scmDeleteAccept') && pendingDelete) { await remove(pendingDelete.collection, pendingDelete.id); $('scmDeleteModal').classList.add('hidden'); feedback('Registro eliminado.'); pendingDelete = null; await reload(); } });
        await seed(); await cleanAndConfigureScm(); await syncCatalogSources(); await reload();
    })().catch(error => { console.error('Error SCM:', error); });
});
