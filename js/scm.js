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
        async function compressProductImage(file) {
            if (!file || !file.type.startsWith('image/')) throw new Error('Selecciona una imagen válida del equipo.');
            const bitmap = await createImageBitmap(file);
            const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(bitmap.width * scale);
            canvas.height = Math.round(bitmap.height * scale);
            const context = canvas.getContext('2d');
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            bitmap.close();
            const imageData = canvas.toDataURL('image/jpeg', 0.78);
            if (imageData.length > 900000) throw new Error('La imagen es demasiado grande. Prueba con otra foto.');
            return imageData;
        }
        let products = [], suppliers = [], movements = [], orders = [], pendingDelete = null, selectedProductImages = [], page = { products: 1, inventory: 1, orders: 1 };
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
                        return scmProduct ? { ...publication, name: scmProduct.nombre, description: scmProduct.descripcion, price: Number(scmProduct.costo_unitario || publication.price), stock: Number(scmProduct.stock_actual || publication.stock || 1), photo: scmProduct.imagen_url || publication.photo, images: productGallery(scmProduct) } : publication;
                    });
                    localStorage.setItem(key, JSON.stringify(updated));
                } catch (error) { /* Ignorar publicaciones inválidas. */ }
            }
        }

        async function syncCatalogSources() {
            const sources = [...campingCatalog, ...communityProducts().filter(item => !['hola', 'sd'].includes(String(item.name || '').toLowerCase()) && isCampingText(`${item.name} ${item.description}`)).map(item => ({
                nombre: item.name, descripcion: item.description || '', categoria: 'comunidad', stock_actual: Number(item.stock || 1), stock_minimo: 1,
                costo_unitario: Number(item.price || 0), estrategia_logistica: 'PULL', origen: 'comunidad', publicacion_id: String(item.id), publicacion_key: item.publicationKey,
                imagenes: normalizeImageList(item.images || item.imagenes || item.photos || item.photo), imagen_url: normalizeImageList(item.images || item.imagenes || item.photos || item.photo)[0] || ''
            }))];
            for (const source of sources) {
                const existing = products.find(item => item.nombre === source.nombre && (source.publicacion_id ? item.publicacion_id === source.publicacion_id : !item.publicacion_id));
                if (!existing) await save('scm_productos', null, { ...source, origen: source.origen || 'tienda' });
                else if (source.publicacion_id && source.imagen_url && JSON.stringify(productGallery(existing)) !== JSON.stringify(productGallery(source))) await save('scm_productos', existing.id, { imagenes: source.imagenes, imagen_url: source.imagen_url });
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
            const legacySupplierNames = ['Artesanías del Sol', 'Textiles del Sur', 'Maderas Regionales'];
            const updatedSupplierIds = new Set();
            for (let index = 0; index < campingSuppliers.length; index++) {
                const data = campingSuppliers[index];
                const exactMatch = suppliers.find(supplier => supplier.nombre === data.nombre && !updatedSupplierIds.has(supplier.id));
                const legacyMatch = suppliers.find(supplier => legacySupplierNames.includes(supplier.nombre) && !updatedSupplierIds.has(supplier.id));
                const target = exactMatch || legacyMatch;
                const savedId = target ? target.id : (await save('scm_proveedores', null, data)).id;
                if (target) await save('scm_proveedores', target.id, data);
                updatedSupplierIds.add(savedId);
            }
            suppliers = await read('scm_proveedores');

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
                for (const data of campingSuppliers) await save('scm_proveedores', null, data);
                suppliers = await read('scm_proveedores');
            }
            movements = await read('scm_movimientos'); orders = await read('scm_pedidos');
        }
        const supplierName = id => suppliers.find(item => item.id === id)?.nombre || 'Sin proveedor';
        const normalizeImageList = value => {
            const list = Array.isArray(value) ? value : (value ? [value] : []);
            return [...new Set(list.filter(Boolean).map(item => String(item).trim()).filter(Boolean))];
        };
        const escapeAttribute = value => String(value).replace(/[&"<>]/g, character => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[character]);
        const productImageCards = () => selectedProductImages.map((image, index) => `<div class="scm-image-card"><img src="${escapeAttribute(image.src)}" alt="Foto ${index + 1} del equipo"><button type="button" class="scm-image-remove" data-remove-product-image="${index}" aria-label="Quitar foto ${index + 1}" title="Quitar foto"><i class="bi bi-x" aria-hidden="true"></i></button></div>`).join('');
        function renderProductImageSelection() {
            const gallery = $('scmImageGallery');
            if (gallery) gallery.innerHTML = productImageCards() || '<p class="scm-image-empty">Aún no hay fotos seleccionadas.</p>';
            const count = $('scmImageCount');
            if (count) count.textContent = `${selectedProductImages.length} ${selectedProductImages.length === 1 ? 'foto' : 'fotos'}`;
        }
        const normalizeCategoryValue = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const validCategoryName = value => /^[a-záéíóúüñ0-9][a-záéíóúüñ0-9 _-]*$/i.test(String(value || '').trim());
        const categoryStorageKey = 'rutaSalvajeCategories';
        const readSharedCategories = () => {
            try { return JSON.parse(localStorage.getItem(categoryStorageKey) || '[]').map(normalizeCategoryValue).filter(Boolean); }
            catch (error) { return []; }
        };
        const saveSharedCategories = values => {
            const categories = [...new Set(values.map(normalizeCategoryValue).filter(Boolean))];
            localStorage.setItem(categoryStorageKey, JSON.stringify(categories));
            window.dispatchEvent(new CustomEvent('ruta-salvaje-categories-updated', { detail: { categories } }));
            return categories;
        };
        const categoryOptions = () => {
            const defaults = ['tiendas', 'sacos', 'iluminacion', 'mochilas', 'accesorios', 'comunidad'];
            const values = new Set([...defaults, ...readSharedCategories()]);
            for (const item of products) {
                if (item.categoria) values.add(normalizeCategoryValue(item.categoria));
            }
            return Array.from(values);
        };
        const refreshScmCategorySelect = () => {
            const select = $('scmModal')?.querySelector('[name="categoria"]');
            if (!select) return;
            const selected = select.value;
            select.innerHTML = categoryOptions().map(category => `<option value="${escapeAttribute(category)}">${escapeAttribute(category)}</option>`).join('');
            if (categoryOptions().includes(selected)) select.value = selected;
        };
        window.addEventListener('ruta-salvaje-categories-updated', refreshScmCategorySelect);
        window.addEventListener('storage', event => { if (event.key === categoryStorageKey) refreshScmCategorySelect(); });
        const relevantProducts = () => products.filter(item => !['hola', 'sd'].includes(String(item.nombre || '').toLowerCase()));
        const productImage = item => {
            const gallery = normalizeImageList(item?.imagenes || item?.images || item?.imagen_url || item?.photo);
            return gallery[0] || '';
        };
        const productGallery = item => normalizeImageList(item?.imagenes || item?.images || item?.imagen_url || item?.photo || []);
        const paginate = (items, type) => {
            const total = Math.max(1, Math.ceil(items.length / perPage)); page[type] = Math.min(page[type], total);
            return { visible: items.slice((page[type] - 1) * perPage, page[type] * perPage), total };
        };
        const renderPanelPage = (containerId, items, pageKey, emptyText, formatter, pageSize = 3) => {
            const panel = $(containerId); if (!panel) return;
            const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
            page[pageKey] = Math.min(page[pageKey] || 1, totalPages);
            const visible = items.slice((page[pageKey] - 1) * pageSize, page[pageKey] * pageSize);
            panel.innerHTML = visible.length ? [
                visible.map(formatter).join(''),
                totalPages > 1 ? `
                    <div class="scm-page-pagination">
                        <button type="button" class="page-btn" data-scm-page="prev" data-type="${pageKey}" ${page[pageKey] === 1 ? 'disabled' : ''}>Anterior</button>
                        <span class="page-indicator">Página ${page[pageKey]} / ${totalPages}</span>
                        <button type="button" class="page-btn" data-scm-page="next" data-type="${pageKey}" ${page[pageKey] === totalPages ? 'disabled' : ''}>Siguiente</button>
                    </div>` : ''
            ].join('') : emptyText;
        };
        const pagination = (id, type, total) => {
            const el = $(id); if (!el) return;
            el.innerHTML = total > 1 ? `<button class="page-btn" data-scm-page="prev" data-type="${type}" ${page[type] === 1 ? 'disabled' : ''}>Anterior</button><span class="page-indicator">Página ${page[type]} / ${total}</span><button class="page-btn" data-scm-page="next" data-type="${type}" ${page[type] === total ? 'disabled' : ''}>Siguiente</button>` : '';
        };
        function renderProducts() {
            const term = ($('scmProductSearch')?.value || '').toLowerCase(), strategy = $('scmStrategyFilter')?.value || '';
            const origin = $('scmOriginFilter')?.value || '';
            const filtered = relevantProducts().filter(item => `${item.nombre} ${item.categoria}`.toLowerCase().includes(term) && (!strategy || item.estrategia_logistica === strategy) && (!origin || item.origen === origin));
            const result = paginate(filtered, 'products');
            $('scmProductsBody').innerHTML = result.visible.map(item => `<tr><td><button class="scm-product-image-button scm-view-product" type="button" data-id="${item.id}" aria-label="Ver ${item.nombre}">${productImage(item) ? `<img src="${productImage(item)}" alt="">` : '<i class="bi bi-backpack3"></i>'}</button></td><td>${item.nombre}</td><td><span class="source-badge source-${item.origen || 'tienda'}">${item.origen === 'comunidad' ? 'Comunidad' : 'Tienda'}</span></td><td>${item.categoria}</td><td>$${Number(item.costo_unitario || 0).toFixed(2)}</td><td class="${item.stock_actual <= item.stock_minimo ? 'stock-critical' : ''}">${item.stock_actual}</td><td>${supplierName(item.proveedor_id)}</td><td><span class="role-badge ${item.estrategia_logistica === 'PUSH' ? 'role-admin' : 'role-user'}">${item.estrategia_logistica}</span></td><td><div class="table-actions"><button class="btn btn-small scm-view-product" data-id="${item.id}" type="button" aria-label="Ver detalle" title="Ver detalle"><i class="bi bi-eye"></i></button><button class="btn btn-small scm-edit-product" data-id="${item.id}" type="button" aria-label="Editar" title="Editar"><i class="bi bi-pencil"></i></button><button class="btn btn-small scm-delete-product" data-id="${item.id}" type="button" aria-label="Eliminar" title="Eliminar"><i class="bi bi-trash"></i></button></div></td></tr>`).join('') || '<tr><td colspan="9" class="empty-state">No hay equipos en el catálogo.</td></tr>';
            pagination('scmProductsPagination', 'products', result.total);
        }
        function renderInventory() {
            const result = paginate(relevantProducts(), 'inventory');
            $('scmInventoryBody').innerHTML = result.visible.map(item => { const last = movements.filter(m => m.producto_id === item.id).sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0]; return `<tr><td>${item.nombre}</td><td class="${item.stock_actual <= item.stock_minimo ? 'stock-critical' : ''}">${item.stock_actual}</td><td>${item.stock_minimo}</td><td><span class="badge ${item.stock_actual <= item.stock_minimo ? 'badge-warn' : 'badge-ok'}">${item.stock_actual <= item.stock_minimo ? 'Stock bajo' : 'Normal'}</span></td><td>${last ? new Date(last.fecha).toLocaleDateString() : 'Sin movimientos'}</td><td><button class="btn btn-outline scm-history" data-id="${item.id}">Ver historial</button></td></tr>`; }).join('');
            pagination('scmInventoryPagination', 'inventory', result.total);
            renderPanelPage('scmLowStockList', relevantProducts().filter(item => item.stock_actual <= item.stock_minimo), 'inventoryAlerts', '<p class="text-success">No hay productos en riesgo.</p>', item => `<div class="risk-item"><strong>${item.nombre}</strong><span>${item.stock_actual} / mínimo ${item.stock_minimo}</span></div>`);
        }
        function renderHistory(productId) {
            const product = products.find(item => item.id === productId);
            const history = movements.filter(item => item.producto_id === productId).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            $('scmHistoryTitle').textContent = `Movimientos: ${product?.nombre || 'Producto'}`;
            $('scmHistoryList').innerHTML = history.length ? history.map(item => `<div class="risk-item"><strong>${item.tipo.toUpperCase()} · ${item.cantidad}</strong><span>${item.motivo} · ${new Date(item.fecha).toLocaleString()}</span></div>`).join('') : '<p class="empty-state">No hay movimientos registrados.</p>';
            $('scmHistoryModal').classList.remove('hidden');
        }
        function showProductDetail(productId) {
            const item = products.find(product => product.id === productId);
            if (!item) return;
            const gallery = productGallery(item);
            const imageElement = $('scmProductDetailImage');
            const oldGallery = document.querySelector('.scm-detail-gallery');
            if (oldGallery) oldGallery.remove();
            if (imageElement) {
                imageElement.id = 'scmMainImage';
                imageElement.src = gallery[0] || '';
                imageElement.classList.toggle('hidden', !gallery[0]);
                imageElement.alt = item.nombre;
            }
            $('scmProductDetailOrigin').textContent = item.origen === 'comunidad' ? 'Publicación de la comunidad' : 'Catálogo de tienda';
            $('scmProductDetailTitle').textContent = item.nombre;
            $('scmProductDetailDescription').textContent = item.descripcion || 'Sin descripción.';
            $('scmProductDetailMeta').innerHTML = `<span>Categoría: ${item.categoria}</span><span>Precio/costo: $${Number(item.costo_unitario || 0).toFixed(2)}</span><span>Stock: ${item.stock_actual}</span><span>Stock mínimo: ${item.stock_minimo}</span><span>Proveedor: ${supplierName(item.proveedor_id)}</span><span>Estrategia: ${item.estrategia_logistica}</span>`;
            const detailImageContainer = $('scmProductDetailImage');
            if (detailImageContainer && gallery.length > 1) {
                const imageButtons = gallery.map((img, index) => `<button type="button" class="scm-thumb ${index === 0 ? 'active' : ''}" data-scm-image="${img}" aria-label="Ver imagen ${index + 1}"><img src="${img}" alt="${item.nombre} ${index + 1}" /></button>`).join('');
                detailImageContainer.insertAdjacentHTML('afterend', `<div class="scm-detail-gallery"><div class="scm-thumb-strip">${imageButtons}</div></div>`);
            }
            $('scmProductDetailEdit').dataset.id = item.id;
            $('scmProductDetailModal').classList.remove('hidden');
        }
        function renderSuppliers() { const term = ($('scmSupplierSearch')?.value || '').trim().toLowerCase(); const filtered = suppliers.filter(item => `${item.nombre} ${item.contacto} ${item.correo}`.toLowerCase().includes(term)); $('scmSuppliersBody').innerHTML = filtered.map(item => `<tr><td>${item.nombre}</td><td>${item.contacto}</td><td>${item.correo}</td><td>${item.telefono}</td><td><div class="table-actions"><button class="btn btn-small scm-edit-supplier" data-id="${item.id}" type="button" aria-label="Editar proveedor" title="Editar"><i class="bi bi-pencil"></i></button><button class="btn btn-small scm-delete-supplier" data-id="${item.id}" type="button" aria-label="Eliminar proveedor" title="Eliminar"><i class="bi bi-trash"></i></button></div></td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No hay proveedores que coincidan.</td></tr>'; }
        function renderOrders() { const result = paginate(orders.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)), 'orders'); $('scmOrdersBody').innerHTML = result.visible.map(item => `<tr><td>${products.find(p => p.id === item.producto_id)?.nombre || 'Producto'}</td><td>${item.cantidad}</td><td>${item.tipo.toUpperCase()}</td><td><span class="badge ${item.estado === 'surtido' ? 'badge-ok' : 'badge-warn'}">${item.estado}</span></td><td>${new Date(item.fecha).toLocaleDateString()}</td><td>${item.estado === 'pendiente' ? `<button class="btn btn-sm btn-primary scm-supply-order" data-id="${item.id}">Marcar surtido</button>` : 'Completado'}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">No hay pedidos.</td></tr>'; pagination('scmOrdersPagination', 'orders', result.total); }
        async function renderReports() {
            const reportProducts = relevantProducts();
            const level = (await read('scm_config'))[0]?.nivel_scm || 'Inicial';
            const pendingOrders = orders.filter(item => item.estado === 'pendiente').length;
            const criticalProducts = reportProducts.filter(item => item.stock_actual <= item.stock_minimo);
            const push = reportProducts.filter(product => product.estrategia_logistica === 'PUSH').length;
            const pull = reportProducts.filter(product => product.estrategia_logistica === 'PULL').length;
            const salesByProduct = movements.filter(move => move.motivo === 'venta').reduce((totals, move) => {
                totals[move.producto_id] = (totals[move.producto_id] || 0) + Number(move.cantidad || 0);
                return totals;
            }, {});
            const bestSellers = reportProducts.map(product => ({ ...product, sales: salesByProduct[product.id] || 0 })).filter(product => product.sales > 0).sort((a, b) => b.sales - a.sales);
            const slowMoving = reportProducts.filter(product => {
                const lastMove = movements.filter(move => move.producto_id === product.id).sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0];
                return !lastMove || Date.now() - new Date(lastMove.fecha).getTime() >= 30 * 24 * 60 * 60 * 1000;
            });
            const lowStockList = criticalProducts;
            const totalStrategy = Math.max(push + pull, 1);
            const pushPercent = Math.round((push / totalStrategy) * 100);
            const pullPercent = Math.round((pull / totalStrategy) * 100);
            $('scmProductsMetric').textContent = reportProducts.length;
            $('scmSuppliersMetric').textContent = suppliers.length;
            $('scmPendingMetric').textContent = pendingOrders;
            $('scmCriticalMetric').textContent = criticalProducts.length;
            $('scmMaturityPanel').innerHTML = `<strong>${level}</strong><p>${level === 'Optimizado' ? 'Procesos integrados y medidos.' : level === 'En desarrollo' ? 'Inventario y logística en integración.' : 'Procesos básicos identificados.'}</p>`;
            $('scmStrategyChart').innerHTML = `
                <div class="scm-donut-chart">
                    <div class="scm-donut" style="--donut-value:${pushPercent}%; --donut-color:#3e7d5d;">
                        <div class="scm-donut-inner"><strong>${pushPercent}%</strong><span>PUSH</span></div>
                    </div>
                    <div class="scm-donut-legend">
                        <div class="scm-legend-row"><span><i class="scm-legend-swatch" style="background:#3e7d5d"></i> PUSH</span><strong>${pushPercent}%</strong></div>
                        <div class="scm-legend-row"><span><i class="scm-legend-swatch" style="background:#d9e2ec"></i> PULL</span><strong>${pullPercent}%</strong></div>
                        <div class="scm-legend-row"><span>Total</span><strong>${push + pull}</strong></div>
                    </div>
                </div>`;
            renderPanelPage('scmReportList', criticalProducts, 'critical', '<p>No hay inventario crítico.</p>', product => `<div class="risk-item"><strong>${product.nombre}</strong><span>${product.stock_actual} / mínimo ${product.stock_minimo}</span></div>`, 3);
            renderPanelPage('scmBestSellers', bestSellers, 'bestSellers', '<p>Aún no hay movimientos de venta registrados.</p>', product => `<div class="risk-item"><strong>${product.nombre}</strong><span>${product.sales} ventas</span></div>`, 3);
            renderPanelPage('scmSlowMoving', slowMoving, 'slowMoving', '<p>No hay productos con rotación lenta.</p>', product => `<div class="risk-item"><strong>${product.nombre}</strong><span>${product.stock_actual} disponibles</span></div>`, 3);
            renderPanelPage('scmHomeLowStock', lowStockList, 'lowStock', '<p>No hay alertas de inventario.</p>', product => `<div class="risk-item"><strong>${product.nombre}</strong><span>${product.stock_actual} disponibles</span></div>`, 3);
            const checklist = $('scmMaturityChecklist');
            if (checklist) checklist.innerHTML = `<li>${reportProducts.length ? '☑' : '☐'} Catálogo de camping y proveedores integrados</li><li>${movements.length ? '☑' : '☐'} Trazabilidad de movimientos de inventario</li><li>${orders.length ? '☑' : '☐'} Pedidos de reposición administrados</li><li>${push && pull ? '☑' : '☐'} Estrategias PUSH y PULL configuradas</li><li>${bestSellers.length && slowMoving.length ? '☑' : '☐'} Reportes de ventas y rotación disponibles</li>`;
            if ($('scmHomeProducts')) $('scmHomeProducts').textContent = reportProducts.length;
            if ($('scmHomeSuppliers')) $('scmHomeSuppliers').textContent = suppliers.length;
            if ($('scmHomeOrders')) $('scmHomeOrders').textContent = pendingOrders;
            if ($('scmHomeCritical')) $('scmHomeCritical').textContent = criticalProducts.length;
            if ($('scmHomeStrategies')) $('scmHomeStrategies').innerHTML = `<div class="scm-strategy-card is-push"><strong>${push}</strong><span>PUSH</span><small>Reposición al llegar al mínimo</small></div><div class="scm-strategy-card is-pull"><strong>${pull}</strong><span>PULL</span><small>Reposición bajo pedido</small></div>`;
        }
        function modal(id, title, fields, onSave) { const root = $('scmModal'); root.querySelector('h3').textContent = title; root.querySelector('.scm-form-fields').innerHTML = fields; root.classList.remove('hidden'); document.body.classList.add('scm-modal-open'); root.querySelector('form').onsubmit = async e => { e.preventDefault(); try { await onSave(new FormData(e.target)); root.classList.add('hidden'); document.body.classList.remove('scm-modal-open'); await reload(); feedback('Cambios guardados correctamente.'); } catch (error) { feedback(error.message || 'No se pudo guardar.', 'error'); } }; }
        async function readProductForm(data, existing) {
            const result = Object.fromEntries(data);
            const gallery = [];
            for (const image of selectedProductImages) gallery.push(image.file ? await compressProductImage(image.file) : image.src);
            delete result.imagen_archivo;
            const customCategory = String(result.nueva_categoria || '').trim();
            if (customCategory) {
                result.categoria = normalizeCategoryValue(customCategory);
                if (!validCategoryName(customCategory)) throw new Error('Usa letras, números, espacios o guiones en el nombre de categoría.');
                saveSharedCategories([...readSharedCategories(), result.categoria]);
            }
            result.stock_actual = Number(result.stock_actual);
            result.stock_minimo = Number(result.stock_minimo);
            result.costo_unitario = Number(result.costo_unitario);
            result.origen = existing?.origen || 'tienda';
            if (existing?.publicacion_id) { result.publicacion_id = existing.publicacion_id; result.publicacion_key = existing.publicacion_key; }
            if (!gallery.length) throw new Error('Sube una foto del equipo para continuar.');
            if (gallery.reduce((size, image) => size + image.length, 0) > 900000) throw new Error('Las fotos superan el espacio disponible. Quita alguna imagen o usa archivos más ligeros.');
            result.imagenes = gallery;
            result.imagen_url = gallery[0];
            delete result.nueva_categoria;
            return result;
        }
        function productFields(item = {}) {
            const selectedCategory = item.categoria || 'tiendas';
            const gallery = productGallery(item);
            selectedProductImages = gallery.map(src => ({ src, file: null }));
            const options = categoryOptions().map(category => `<option value="${category}" ${category === selectedCategory ? 'selected' : ''}>${category}</option>`).join('');
            return `<div class="scm-image-upload"><div class="scm-image-upload-head"><div><strong>Fotos del equipo</strong><span>Las fotos actuales se conservan; puedes añadir o quitar imágenes.</span></div><label for="scmImageFile" class="scm-image-trigger"><i class="bi bi-image"></i> Añadir fotos</label></div><input id="scmImageFile" class="scm-image-input" name="imagen_archivo" type="file" accept="image/*" multiple><div id="scmImageGallery" class="scm-image-grid">${productImageCards() || '<p class="scm-image-empty">Aún no hay fotos seleccionadas.</p>'}</div><span id="scmImageCount" class="scm-image-count">${gallery.length} ${gallery.length === 1 ? 'foto' : 'fotos'}</span></div><label>Nombre<input name="nombre" required value="${item.nombre || ''}"></label><label>Descripción<textarea name="descripcion">${item.descripcion || ''}</textarea></label><label>Categoría<select name="categoria" required>${options}</select></label><label>Otra categoría<input name="nueva_categoria" placeholder="Ej: botas o cocina" value=""></label><label>Stock actual<input name="stock_actual" type="number" min="0" required value="${item.stock_actual ?? 0}"></label><label>Stock mínimo<input name="stock_minimo" type="number" min="0" required value="${item.stock_minimo ?? 0}"></label><label>Proveedor<select name="proveedor_id" required>${suppliers.map(s => `<option value="${s.id}" ${s.id === item.proveedor_id ? 'selected' : ''}>${s.nombre}</option>`).join('')}</select></label><label>Costo unitario<input name="costo_unitario" type="number" min="0" step="0.01" required value="${item.costo_unitario ?? 0}"></label><label>Estrategia<select name="estrategia_logistica"><option value="PUSH" ${item.estrategia_logistica === 'PUSH' ? 'selected' : ''}>PUSH</option><option value="PULL" ${item.estrategia_logistica === 'PULL' ? 'selected' : ''}>PULL</option></select></label>`; }
        function editProduct(item) { modal('scmModal', 'Editar equipo', productFields(item), async data => save('scm_productos', item.id, await readProductForm(data, item))); }
        async function reload() {
            products = await read('scm_productos');
            const invalidProducts = products.filter(item => ['hola', 'sd'].includes(String(item.nombre || '').toLowerCase()));
            for (const item of invalidProducts) await remove('scm_productos', item.id);
            products = await read('scm_productos');
            suppliers = await read('scm_proveedores');
            movements = await read('scm_movimientos');
            orders = await read('scm_pedidos');
            saveSharedCategories([...readSharedCategories(), ...products.map(item => item.categoria)]);
            syncCommunityPublications();
            localStorage.setItem('scm_catalog_cache', JSON.stringify(products));
            renderProducts(); renderInventory(); renderSuppliers(); renderOrders(); await renderReports();
        }
        document.querySelectorAll('.nav-link[data-view^="scm-"]').forEach(link => link.addEventListener('click', () => { setTimeout(() => { const title = { 'scm-dashboard': 'Dashboard SCM', 'scm-productos': 'Productos SCM', 'scm-inventario': 'Inventario', 'scm-proveedores': 'Proveedores', 'scm-pedidos': 'Pedidos SCM', 'scm-reportes': 'Reportes SCM' }[link.dataset.view]; if ($('pageTitle')) $('pageTitle').textContent = title; }, 0); }));
        $('scmProductSearch')?.addEventListener('input', () => { page.products = 1; renderProducts(); }); $('scmStrategyFilter')?.addEventListener('change', () => { page.products = 1; renderProducts(); }); $('scmOriginFilter')?.addEventListener('change', () => { page.products = 1; renderProducts(); });
        $('scmSupplierSearch')?.addEventListener('input', renderSuppliers);
        document.addEventListener('change', event => {
            if (event.target.id !== 'scmImageFile' || !event.target.files?.length) return;
            const newFiles = Array.from(event.target.files);
            for (const file of newFiles) {
                const duplicate = selectedProductImages.some(image => image.file && image.file.name === file.name && image.file.size === file.size && image.file.lastModified === file.lastModified);
                if (!duplicate) selectedProductImages.push({ src: URL.createObjectURL(file), file });
            }
            event.target.value = '';
            renderProductImageSelection();
        });
        document.addEventListener('click', event => {
            const removeImage = event.target.closest('[data-remove-product-image]');
            if (removeImage) {
                const [removed] = selectedProductImages.splice(Number(removeImage.dataset.removeProductImage), 1);
                if (removed?.file) URL.revokeObjectURL(removed.src);
                renderProductImageSelection();
                return;
            }
            const thumb = event.target.closest('[data-scm-image]');
            if (!thumb) return;
            const mainImage = document.getElementById('scmMainImage') || document.getElementById('scmProductDetailImage');
            if (mainImage) mainImage.src = thumb.dataset.scmImage;
            document.querySelectorAll('.scm-thumb').forEach(item => item.classList.toggle('active', item === thumb));
        });
        document.querySelectorAll('.scm-shortcut').forEach(button => button.addEventListener('click', () => document.querySelector(`.nav-link[data-view="${button.dataset.view}"]`)?.click()));
        document.addEventListener('click', async event => { const button = event.target.closest('[data-scm-page]'); if (button) { page[button.dataset.type] += button.dataset.scmPage === 'next' ? 1 : -1; await reload(); return; }
            if (event.target.closest('#openScmProductModal')) return modal('scmModal', 'Nuevo equipo de camping', productFields(), async data => save('scm_productos', null, await readProductForm(data, null)));
            const productEdit = event.target.closest('.scm-edit-product, #scmProductDetailEdit'); if (productEdit) { const item = products.find(p => p.id === productEdit.dataset.id); if (item) { $('scmProductDetailModal').classList.add('hidden'); return editProduct(item); } }
            const productDetail = event.target.closest('.scm-view-product'); if (productDetail) { showProductDetail(productDetail.dataset.id); return; }
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
        document.addEventListener('click', async event => { if (event.target.closest('#scmModalClose, #scmModalCancel') || event.target.matches('#scmModal > .modal-backdrop')) { $('scmModal')?.classList.add('hidden'); document.body.classList.remove('scm-modal-open'); } if (event.target.closest('#scmHistoryClose')) $('scmHistoryModal')?.classList.add('hidden'); if (event.target.closest('#scmProductDetailClose') || event.target.id === 'scmProductDetailModal') $('scmProductDetailModal')?.classList.add('hidden'); if (event.target.closest('#scmDeleteCancel')) { pendingDelete = null; $('scmDeleteModal').classList.add('hidden'); } if (event.target.closest('#scmDeleteAccept') && pendingDelete) { await remove(pendingDelete.collection, pendingDelete.id); $('scmDeleteModal').classList.add('hidden'); feedback('Registro eliminado.'); pendingDelete = null; await reload(); } });
        $('newProductBtn')?.addEventListener('click', () => { document.querySelector('.nav-link[data-view="scm-productos"]')?.click(); setTimeout(() => $('openScmProductModal')?.click(), 50); });
        await seed(); await cleanAndConfigureScm(); await syncCatalogSources(); await reload();
    })().catch(error => { console.error('Error SCM:', error); });
});
