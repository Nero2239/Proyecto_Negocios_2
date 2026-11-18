function showToast(message, type = 'success') {
    // Remove any existing toasts
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Trigger the animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Hide the toast after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        // Remove the element after the animation completes
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

let productos = [];
const shopEscape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
let productDetailFocus;

function readShopCart() {
    try {
        const rows = JSON.parse(localStorage.getItem('campingCart') || '[]');
        if (!Array.isArray(rows)) return [];
        return rows.filter(row => row && row.id != null && Number.isInteger(Number(row.quantity)) && Number(row.quantity) > 0).map(row => ({
            ...row, quantity: Number(row.quantity), name: String(row.name || row.nombre || 'Producto'),
            price: Number.isFinite(Number(row.price)) ? Number(row.price) : Number.isFinite(Number(row.priceCents)) ? Number(row.priceCents) / 100 : 0
        }));
    } catch { return []; }
}

function normalizeImageList(value) {
    const items = Array.isArray(value) ? value : (value ? [value] : []);
    return [...new Set(items.filter(Boolean).map(item => String(item).trim()).filter(Boolean))];
}

function getProductImages(producto) {
    const sources = [producto?.imagenes, producto?.images, producto?.photo, producto?.imagen_url, producto?.photos];
    const gallery = normalizeImageList(sources.flatMap(item => Array.isArray(item) ? item : [item]));
    return gallery.length ? gallery : [producto?.photo || producto?.imagen_url || ''];
}

function getSharedCategories() {
    try {
        const categories = JSON.parse(localStorage.getItem('rutaSalvajeCategories') || '[]');
        return categories.map(category => String(category || '').trim().toLowerCase()).filter(Boolean);
    } catch (error) {
        return [];
    }
}

function renderShopCategoryOptions() {
    const categorySelect = document.getElementById('categorySelect');
    if (!categorySelect) return;
    const categories = [...new Set([...productos.map(producto => String(producto.categoria || '').trim().toLowerCase()), ...getSharedCategories()].filter(Boolean))];
    const selectedCategory = categorySelect.value;
    const escapeOption = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    categorySelect.innerHTML = `<option value="all">Todas las categorías</option>${categories.map(value => `<option value="${escapeOption(value)}">${escapeOption(value.charAt(0).toLocaleUpperCase('es') + value.slice(1))}</option>`).join('')}`;
    if (categories.includes(selectedCategory)) categorySelect.value = selectedCategory;
}

function buildProductGalleryMarkup(producto, selectedImage = null) {
    const images = getProductImages(producto).filter(Boolean);
    if (!images.length) return '';
    const activeImage = selectedImage || images[0];
    return `
        <div class="product-gallery">
            <div class="product-gallery-main">
                <img src="${shopEscape(activeImage)}" alt="${shopEscape(producto.nombre)}" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&h=600&fit=crop';" />
            </div>
            <div class="product-gallery-thumbs">
                ${images.map((image, index) => `
                    <button type="button" class="product-gallery-thumb ${image === activeImage ? 'active' : ''}" data-gallery-image="${shopEscape(image)}" aria-label="Ver imagen ${index + 1}">
                        <img src="${shopEscape(image)}" alt="${shopEscape(producto.nombre)} ${index + 1}" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=200&h=140&fit=crop';" />
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

async function loadScmCatalog() {
    try {
        let scmProducts = [];
        try {
            const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js');
            const { getFirestore, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js');
            const firebaseConfig = {
                apiKey: 'AIzaSyAZCztGChAZ9k81WWBkp9TZBx9XphWqcmc',
                authDomain: 'camping-3a6a4.firebaseapp.com',
                projectId: 'camping-3a6a4',
                storageBucket: 'camping-3a6a4.firebasestorage.app',
                messagingSenderId: '181839243079',
                appId: '1:181839243079:web:df39441f32098fc7ca4e62'
            };
            const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
            const snapshot = await getDocs(collection(getFirestore(app), 'scm_productos'));
            scmProducts = snapshot.docs.map(productDoc => ({ ...productDoc.data(), id: productDoc.id }));
            localStorage.setItem('scm_catalog_cache', JSON.stringify(scmProducts));
        } catch (error) {
            scmProducts = JSON.parse(localStorage.getItem('scm_catalog_cache') || '[]');
        }
        const communityProducts = [];
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (!key?.startsWith('userPublications_')) continue;
            try {
                communityProducts.push(...JSON.parse(localStorage.getItem(key) || '[]').map(item => ({ ...item, _source: 'community' })));
            } catch (error) {
                console.warn('Se ignoró una publicación comunitaria inválida.', error);
            }
        }
        const sourceProducts = scmProducts.filter(item => item.activo !== false && item.origen !== 'comunidad').map(item => ({ ...item, _source: 'store' }));
        const syncedCommunityIds = new Set(scmProducts.filter(item => item.origen === 'comunidad').map(item => String(item.publicacion_id)));
        for (const item of scmProducts.filter(product => product.activo !== false && product.origen === 'comunidad')) {
            sourceProducts.push({ ...item, _source: 'community', communityListing: true });
        }
        for (const item of communityProducts) {
            if (syncedCommunityIds.has(String(item.id))) continue;
            sourceProducts.push({
                id: `community-${item.id}`,
                nombre: item.name,
                descripcion: item.description || '',
                categoria: 'comunidad',
                costo_unitario: Number(item.price || 0),
                stock_actual: Number(item.stock || 1),
                estrategia_logistica: 'PULL',
                origen: 'comunidad',
                imagen_url: item.photo || '',
                _source: 'community',
                communityListing: true
            });
        }
        productos = sourceProducts.map(item => ({
            id: item.id,
            nombre: item.nombre,
            precio: Number(item.precio_venta ?? item.precio ?? item.costo_unitario ?? 0),
            descripcion: item.descripcion || '',
            detalle: item.descripcion || '',
            categoria: String(item.categoria || 'accesorios').trim().toLowerCase(),
            stock: Number(item.stock_actual || 0),
            photo: item.imagen_url || item.photo || '',
            origen: item.origen,
            communityListing: item._source === 'community' || item.origen === 'comunidad',
            descuento: 0,
            rating: item.rating,
            esRecomendado: item.estrategia_logistica === 'PUSH',
            imagenes: normalizeImageList(item.imagenes || item.images || [item.imagen_url || item.photo || ''])
        }));

        renderShopCategoryOptions();
    } catch (error) {
        console.warn('No se pudo cargar el catálogo SCM:', error);
    }
}

const state = {
    cart: readShopCart(),
    activeFilter: 'all',
    activeQuery: '',
    activeCategory: 'all',
    selectedProductId: null,
    promoCode: localStorage.getItem('campingPromo') || '',
    promoMessage: '',
    currentPage: 1,
    pageSize: 8,
};

function savePromoCode() {
    localStorage.setItem('campingPromo', state.promoCode);
}

function cartAmounts(code = state.promoCode) {
    const subtotal = state.cart.reduce((sum,row)=>sum+Math.round(Number(row.price)*100)*row.quantity,0);
    const promo = (window.rutaPromotions||[]).find(row=>row.id===String(code||'').toUpperCase());
    let discount=0;
    if(promo&&promo.activa&&Date.parse(promo.inicio)<=Date.now()&&Date.parse(promo.fin)>=Date.now()&&subtotal>=(promo.minimoCents||0)&&(!promo.limiteUsos||promo.usos<promo.limiteUsos)){
        const eligible=state.cart.reduce((sum,row)=>{const product=productos.find(p=>String(p.id)===String(row.id));return sum+((!promo.categoria||product?.categoria===promo.categoria)&&(!promo.productoId||String(row.id)===promo.productoId)?Math.round(row.price*100)*row.quantity:0);},0);
        discount=Math.floor((eligible*promo.descuentoBps+5000)/10000);if(promo.maximoCents)discount=Math.min(discount,promo.maximoCents);
    }
    const rate=window.rutaTax?.activo===false?0:window.rutaTax?.ivaBps??1600;
    const tax=Math.floor(((subtotal-discount)*rate+5000)/10000);
    return {subtotal,discount,tax,total:subtotal-discount+tax,rate};
}
function getPromoDiscount(code) { const values=cartAmounts(code);return values.subtotal?values.discount/values.subtotal:0; }

function formatPrice(value) {
    return `$${Number(value).toFixed(2)}`;
}

function saveCart() {
    const draft = state.cart.map(row => ({ ...row }));
    localStorage.setItem('campingCart', JSON.stringify(draft));
    if (!window.RutaCommerce) {
        showToast('El cliente Firebase de compras no se cargó. Recarga la página; el carrito se conserva localmente.', 'error');
        return Promise.resolve(false);
    }
    return window.RutaCommerce.saveCart(draft).then(() => true).catch(error => {
        showToast(error.message + ' El carrito local se conserva.', 'error');
        return false;
    });
}

function getCartCount() {
    return state.cart.reduce((total, item) => total + item.quantity, 0);
}

function renderProducts() {
    const grid = document.getElementById('productGrid');
    const detail = document.getElementById('productDetail');
    const cartCount = document.getElementById('cartCount');
    const cartCountInline = document.getElementById('cartCountInline');

    if (cartCount) {
        cartCount.textContent = getCartCount();
    }
    if (cartCountInline) {
        cartCountInline.textContent = `${getCartCount()} artículos`;
    }

    if (!grid) return;

    const list = productos.filter((producto) => {
        if (state.activeFilter === 'recommended' && !producto.esRecomendado) return false;
        if (state.activeCategory !== 'all' && producto.categoria !== state.activeCategory) return false;
        if (state.activeQuery && !(`${producto.nombre} ${producto.descripcion}`).toLowerCase().includes(state.activeQuery)) return false;
        return true;
    });

    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    const start = (state.currentPage - 1) * state.pageSize;
    const pageItems = list.slice(start, start + state.pageSize);

    const html = pageItems.map((producto) => {
        const recomendado = producto.esRecomendado ? '<span class="product-recommendation">Recomendado</span>' : '';
        const origenBadge = producto.communityListing ? '<span class="product-origin-badge">Comunidad</span>' : '';
        const descuentoBadge = producto.descuento ? `<span class="product-discount">-${producto.descuento}%</span>` : '';
        const imageMarkup = producto.photo
            ? `<img src="${shopEscape(producto.photo)}" alt="${shopEscape(producto.nombre)}" loading="lazy" onerror="this.onerror=null;this.parentElement.textContent='Equipo de camping'">`
            : '<span aria-hidden="true">⛺</span>';
        return `
            <article class="product-card">
                ${recomendado}
                ${descuentoBadge}
                ${origenBadge}
                <div class="product-image">${imageMarkup}</div>
                <div class="product-body">
                    <h2 class="product-title">${shopEscape(producto.nombre)}</h2>
                    <p class="product-description">${shopEscape(producto.descripcion)}</p>
                    <p class="product-price">${formatPrice(producto.precio)}</p>
                    <div class="product-actions">
                        <button class="btn btn-secondary" type="button" data-product-detail="${String(producto.id).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">Ver Detalle</button>
                    </div>
                </div>
            </article>
        `;
    }).join('');

    let placeholders = '';
    if (list.length > 0 && list.length < 4) {
        for (let i = 0; i < 4 - list.length; i += 1) {
            placeholders += '<div class="product-card placeholder" aria-hidden="true"></div>';
        }
    }

    grid.innerHTML = html + placeholders;
    // pagination controls
    const paginationContainerId = 'productsPagination';
    let paginationHtml = '';
    if (totalPages > 1) {
        paginationHtml = `<div id="${paginationContainerId}" class="mt-6 flex items-center justify-center gap-3">`;
        paginationHtml += `<button class="btn btn-secondary btn-small" onclick="window.shop.changePage(${Math.max(1, state.currentPage-1)})">‹</button>`;
        for (let p = 1; p <= totalPages; p++) {
            paginationHtml += `<button class="btn ${p===state.currentPage? 'btn-primary' : 'btn-secondary'} btn-small" onclick="window.shop.setPage(${p})">${p}</button>`;
        }
        paginationHtml += `<button class="btn btn-secondary btn-small" onclick="window.shop.changePage(${Math.min(totalPages, state.currentPage+1)})">›</button>`;
        paginationHtml += `</div>`;
    }
    const wrapper = document.querySelector('#productGrid').parentElement;
    const existing = document.getElementById(paginationContainerId);
    if (existing) existing.remove();
    if (paginationHtml) wrapper.insertAdjacentHTML('beforeend', paginationHtml);
    if (detail && !state.selectedProductId) {
        detail.classList.add('hidden');
        detail.innerHTML = '';
    }
}

function showProductDetail(id) {
    const producto = productos.find((item) => String(item.id) === String(id));
    if (!producto) return;

    const reopening = state.selectedProductId !== null && String(state.selectedProductId) === String(id);
    state.selectedProductId = id;
    const detail = document.getElementById('productDetail');
    if (!detail) return;
    const oldQuantity = reopening ? detail.querySelector('#quantityInput')?.value : null;
    const oldImage = reopening ? detail.querySelector('.product-gallery-thumb.active')?.dataset.galleryImage : null;
    const oldScroll = reopening ? detail.querySelector('.product-modal-card')?.scrollTop || 0 : 0;
    if (!reopening) productDetailFocus = document.activeElement;

    document.body.classList.add('modal-open');
    const galleryMarkup = buildProductGalleryMarkup(producto, oldImage && getProductImages(producto).includes(oldImage) ? oldImage : producto.photo || getProductImages(producto)[0]);
    detail.innerHTML = `
        <div class="product-modal-backdrop" data-product-backdrop>
            <div class="product-modal-card" role="dialog" aria-modal="true" aria-labelledby="productDetailTitle">
                <button class="detail-close-btn" type="button" data-close-product aria-label="Cerrar ventana">
                    <i class="bi bi-x-lg"></i>
                </button>
                <div class="modal-card-header">
                    <span class="text-sm uppercase tracking-[0.3em] text-naranja font-semibold">Detalle del producto</span>
                    <h3 id="productDetailTitle">${shopEscape(producto.nombre)}</h3>
                </div>
                <div class="left">
                    ${galleryMarkup || '<div class="detalle-imagen"><span aria-hidden="true">⛺</span></div>'}
                    <div class="rounded-2xl bg-crema p-4 text-sm text-gray-700">
                        <p class="font-semibold text-bosque">${shopEscape(producto.nombre)}</p>
                        <p class="mt-1 product-description-text">${shopEscape(producto.detalle)}</p>
                    </div>
                </div>
                <div class="right">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="text-sm text-gray-500">(${producto.stock} disponibles)</div>
                    </div>
                    <p class="text-gray-700 mb-4 product-description-text">${shopEscape(producto.descripcion)}</p>
                    <p class="text-3xl font-extrabold text-naranja mb-4">${formatPrice(producto.precio)}</p>
                    <p class="text-gray-700 mb-6">Categoría: ${shopEscape(producto.categoria)}</p>
                    <div class="flex items-center gap-3 mb-6">
                        <label class="text-sm font-semibold text-gray-700" for="quantityInput">Cantidad</label>
                        <input id="quantityInput" type="number" min="1" max="${Math.max(1, Math.min(producto.stock,99))}" step="1" value="1" ${producto.stock < 1 ? 'disabled' : ''} class="w-20 rounded-lg border border-gray-300 px-3 py-2" />
                    </div>
                    <div class="detalle-actions">
                        ${producto.communityListing ? '<button class="btn btn-welcome" type="button" data-community-link><i class="bi bi-people"></i> Ver comunidad</button>' : `<button class="btn btn-welcome" type="button" data-add-product="${shopEscape(producto.id)}" ${producto.stock < 1 ? 'disabled' : ''}><i class="bi bi-cart-check-fill"></i> ${producto.stock < 1 ? 'Sin existencias' : 'Agregar al carrito'}</button>`}
                    </div>
                </div>
            </div>
            <div id="addFeedback" class="cart-feedback hidden"><i class="bi bi-cart-check-fill"></i></div>
        </div>
    `;

    const galleryButtons = detail.querySelectorAll('[data-gallery-image]');
    galleryButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const mainImage = detail.querySelector('.product-gallery-main img');
            if (!mainImage) return;
            const selected = button.dataset.galleryImage;
            mainImage.src = selected;
            galleryButtons.forEach((item) => item.classList.toggle('active', item === button));
        });
    });
    detail.classList.remove('hidden');
    if (oldQuantity) detail.querySelector('#quantityInput').value = oldQuantity;
    detail.querySelector('.product-modal-card').scrollTop = oldScroll;
    if (!reopening) detail.querySelector('[data-close-product]').focus({ preventScroll: true });
}

function closeProductModal() {
    state.selectedProductId = null;
    const detail = document.getElementById('productDetail');
    if (detail) {
        detail.classList.add('hidden');
        detail.innerHTML = '';
    }
    if (!document.body.classList.contains('cart-open')) document.body.classList.remove('modal-open');
    if (productDetailFocus?.isConnected && !document.body.classList.contains('cart-open')) productDetailFocus.focus({ preventScroll: true });
    productDetailFocus = null;
}

function showAddFeedback() {
    const feedback = document.getElementById('addFeedback');
    if (!feedback) return;

    feedback.classList.remove('hidden');
    clearTimeout(feedback.hideTimer);
    feedback.hideTimer = setTimeout(() => {
        feedback.classList.add('hidden');
    }, 1800);
}

function addToCart(productId, showFeedback = false) {
    const producto = productos.find((item) => String(item.id) === String(productId));
    const quantityInput = showFeedback ? document.getElementById('quantityInput') : null;
    const quantity = quantityInput ? Number(quantityInput.value) : 1;

    if (!producto) return;
    const current = state.cart.find(item => String(item.id) === String(productId))?.quantity || 0;
    if (!Number.isInteger(quantity) || quantity < 1 || current + quantity > producto.stock || current + quantity > 99) return showToast('Cantidad inválida o stock insuficiente.', 'error');

    const existing = state.cart.find((item) => String(item.id) === String(productId));
    if (existing) {
        existing.quantity += quantity;
    } else {
        state.cart.push({ id: productId, name: producto.nombre, price: producto.precio, quantity });
    }

    saveCart();
    renderCart();
    renderProducts();

    if (showFeedback) {
        showAddFeedback();
        showToast(`${producto.nombre} añadido al carrito`, 'success');
    }
}

function renderCart() {
    const cartBody = document.getElementById('cartBody');
    const cartSummary = document.getElementById('cartSummary');
    const cartEmpty = document.getElementById('cartEmpty');
    const recommendedProducts = document.getElementById('recommendedProducts');
    let checkoutButton = document.getElementById('checkoutButton');
    const cartCount = document.getElementById('cartCount');
    const cartCountInline = document.getElementById('cartCountInline');

    if (cartCount) {
        cartCount.textContent = getCartCount();
    }
    if (cartCountInline) {
        cartCountInline.textContent = `${getCartCount()} artículos`;
    }

    if (!cartBody || !cartSummary || !cartEmpty) return;

    if (state.cart.length === 0) {
        cartEmpty.classList.remove('hidden');
        cartBody.innerHTML = '';
        cartSummary.innerHTML = '';
    } else {
        cartEmpty.classList.add('hidden');

        const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        cartBody.innerHTML = state.cart.map((item) => `
            <div class="flex items-center justify-between border-b border-gray-200 py-3">
                <div>
                    <p class="font-semibold text-bosque">${shopEscape(item.name)}</p>
                    <p class="text-sm text-gray-500">${formatPrice(item.price)} c/u</p>
                </div>
                <div class="flex items-center gap-2">
                    <button class="rounded-full border px-2 py-1" type="button" onclick='window.shop.changeQuantity(${JSON.stringify(item.id)}, -1)'>-</button>
                    <span class="min-w-6 text-center">${item.quantity}</span>
                    <button class="rounded-full border px-2 py-1" type="button" onclick='window.shop.changeQuantity(${JSON.stringify(item.id)}, 1)'>+</button>
                    <button class="ml-2 text-sm text-red-500" type="button" onclick='window.shop.removeFromCart(${JSON.stringify(item.id)})'>Quitar</button>
                </div>
            </div>
        `).join('');

        const discountPercent = getPromoDiscount(state.promoCode);
        const discountAmount = subtotal * discountPercent;
        const amounts = cartAmounts();
        const total = amounts.total / 100;

        cartSummary.innerHTML = `
            <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <label class="text-sm font-semibold text-bosque" for="promoCodeInput">Código promocional</label>
                <div class="mt-2 flex gap-2">
                    <input id="promoCodeInput" type="text" value="${shopEscape(state.promoCode)}" placeholder="Código de promoción" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    <button id="applyPromoButton" type="button" class="btn btn-welcome btn-small">Aplicar</button>
                </div>
                <div class="mt-3 flex justify-end">
                    <button id="clearCartButton" type="button" class="text-sm font-semibold text-red-500">Vaciar carrito</button>
                </div>
                <div id="promoAlert" class="popout-alert hidden mt-3"></div>
                ${state.promoCode ? `<p id="promoStatus" class="mt-2 text-xs text-emerald-600">Descuento ${shopEscape(state.promoCode)} aplicado</p>` : ''}
            </div>
            <div class="flex items-center justify-between text-sm text-gray-600 mt-4">
                <span>Subtotal</span>
                <span>${formatPrice(subtotal)}</span>
            </div>
            ${discountPercent > 0 ? `<div class="flex items-center justify-between text-sm text-emerald-600">
                <span>Descuento</span>
                <span>- ${formatPrice(discountAmount)}</span>
            </div>` : ''}
            <div class="flex items-center justify-between text-lg font-bold text-bosque">
                <span>Total estimado (IVA ${amounts.rate/100}%)</span>
                <span>${formatPrice(total)}</span>
            </div>
            <p class="text-sm">Base gravable: ${formatPrice((amounts.subtotal-amounts.discount)/100)} · IVA: ${formatPrice(amounts.tax/100)}. El checkout verifica precios y promociones.</p>
            <a href="checkout.html" class="btn btn-primary w-full mt-4 inline-flex justify-center" id="checkoutButton">Checkout</a>
        `;
    }

    const promoInput = document.getElementById('promoCodeInput');
    const applyPromoButton = document.getElementById('applyPromoButton');
    const promoAlert = document.getElementById('promoAlert');
    const clearCartButton = document.getElementById('clearCartButton');

    if (promoAlert) {
        if (state.promoMessage) {
            promoAlert.textContent = state.promoMessage;
            promoAlert.classList.remove('hidden');
        } else {
            promoAlert.classList.add('hidden');
        }
    }

    if (clearCartButton) {
        clearCartButton.addEventListener('click', clearCart);
    }

    if (promoInput && applyPromoButton) {
        applyPromoButton.onclick = () => {
            const code = promoInput.value.trim().toUpperCase();
            if (!code) {
                state.promoCode = '';
                state.promoMessage = '';
                savePromoCode();
                renderCart();
                return;
            }

            const discountPercent = getPromoDiscount(code);
            if (!discountPercent) {
                state.promoCode = '';
                state.promoMessage = 'Código no válido';
                savePromoCode();
                renderCart();
                return;
            }

            state.promoCode = code;
            state.promoMessage = '';
            savePromoCode();
            renderCart();
        };

        promoInput.onkeydown = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                applyPromoButton.click();
            }
        };
    }

    checkoutButton = document.getElementById('checkoutButton');
    if (checkoutButton) {
        checkoutButton.onclick = async event => {
            event.preventDefault();
            try { await window.RutaCommerce.flushCart(); window.location.href='checkout.html'; } catch(error) { showToast(error.message, 'error'); }
        };
        checkoutButton.addEventListener('click', event => {
            event.preventDefault();
            closeCart();
        });
    }

    if (recommendedProducts) {
        const recommended = productos.filter((producto) => producto.esRecomendado).slice(0, 3);
        recommendedProducts.innerHTML = recommended.map((producto) => `
            <div class="recommended-card">
                <div class="recommended-avatar"><i class="bi bi-person-circle"></i></div>
                <div class="recommended-content">
                    <h4>${shopEscape(producto.nombre)}</h4>
                    <p class="text-sm text-gray-600">${shopEscape(producto.descripcion)}</p>
                    <p class="text-sm font-semibold text-naranja mt-2">${formatPrice(producto.precio)}</p>
                </div>
                        <button class="btn btn-welcome btn-small" type="button" onclick='window.shop.addToCart(${JSON.stringify(producto.id)})'>Agregar</button>
            </div>
        `).join('');
    }
}

function clearCart() {
    state.cart = [];
    saveCart();
    renderCart();
    renderProducts();
}

function setPage(p) {
    state.currentPage = p;
    renderProducts();
}

function changePage(p) {
    state.currentPage = p;
    renderProducts();
}

function changeQuantity(productId, delta) {
    const item = state.cart.find((entry) => String(entry.id) === String(productId));
    if (!item) return;
    const product = productos.find(row => String(row.id) === String(productId));
    if (delta > 0 && (!product || item.quantity + delta > product.stock || item.quantity + delta > 99)) return showToast('Stock insuficiente.', 'error');
    item.quantity += delta;
    if (item.quantity <= 0) {
        state.cart = state.cart.filter((entry) => String(entry.id) !== String(productId));
    }
    saveCart();
    renderCart();
    renderProducts();
}

function removeFromCart(productId) {
    state.cart = state.cart.filter((item) => String(item.id) !== String(productId));
    saveCart();
    renderCart();
    renderProducts();
}

function openCart() {
    const cartPage = document.getElementById('cartPage');
    if (!cartPage) return;
    cartPage.classList.remove('hidden');
    document.body.classList.add('modal-open');
    document.body.classList.add('cart-open');
    renderCart();
}

function closeCart() {
    const cartPage = document.getElementById('cartPage');
    if (!cartPage) return;
    cartPage.classList.add('hidden');
    if (!state.selectedProductId) document.body.classList.remove('modal-open');
    document.body.classList.remove('cart-open');
}

function showCartPanel() {
    openCart();
}

function toggleCartPanel() {
    const cartPage = document.getElementById('cartPage');
    if (!cartPage) return;
    if (cartPage.classList.contains('hidden')) {
        openCart();
    } else {
        closeCart();
    }
}

function initCookieConsent() {
    const bannerHTML = `
        <div id="cookieConsentBanner" class="cookie-consent-banner">
            <p class="font-semibold text-lg mb-2">Tu privacidad es importante</p>
            <p class="text-sm">
                Para ofrecerte la mejor experiencia, usamos cookies y te pedimos que aceptes nuestros términos de compra.
            </p>
            <div class="cookie-options">
                <label class="cookie-option">
                    <input type="checkbox" id="acceptCookiesCheck" name="consent" value="cookies">
                    <span>Acepto el uso de <strong>cookies</strong> funcionales.</span>
                </label>
                <label class="cookie-option">
                    <input type="checkbox" id="acceptTermsCheck" name="consent" value="terms">
                    <span>He leído y acepto los <a href="politicas.html" target="_blank" rel="noopener noreferrer">Términos de Compra</a>.</span>
                </label>
            </div>
            <button id="acceptCookiesBtn" class="btn btn-primary w-full mt-4" disabled>Aceptar y continuar</button>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', bannerHTML);

    const acceptBtn = document.getElementById('acceptCookiesBtn');
    const cookiesCheck = document.getElementById('acceptCookiesCheck');
    const termsCheck = document.getElementById('acceptTermsCheck');

    function checkConsent() {
        acceptBtn.disabled = !(cookiesCheck.checked && termsCheck.checked);
    }

    cookiesCheck.addEventListener('change', checkConsent);
    termsCheck.addEventListener('change', checkConsent);

    acceptBtn.addEventListener('click', () => {
        if (acceptBtn.disabled) return;

        localStorage.setItem('cookiesAccepted', 'true');
        const banner = document.getElementById('cookieConsentBanner');
        banner.classList.add('hiding');
        banner.addEventListener('animationend', () => {
            banner.style.display = 'none';
        }, { once: true });
    });
}

async function initShop() {
    const searchInput = document.getElementById('searchInput');
    const categorySelect = document.getElementById('categorySelect');
    const filterAll = document.getElementById('filterAll');
    const filterRecommended = document.getElementById('filterRecommended');
    const nav = document.querySelector('nav.fixed'); // Stable parent for delegation
    const closeCartButton = document.getElementById('closeCartButton');

    window.addEventListener('ruta-salvaje-categories-updated', renderShopCategoryOptions);
    window.addEventListener('storage', event => {
        if (event.key === 'rutaSalvajeCategories') renderShopCategoryOptions();
    });

    document.addEventListener('click', event => {
        if (event.target.closest('[data-close-product]') || event.target.matches('[data-product-backdrop]')) { closeProductModal(); return; }
        const detailButton = event.target.closest('[data-product-detail]');
        if (detailButton) showProductDetail(detailButton.dataset.productDetail);
        const addButton = event.target.closest('[data-add-product]');
        if (addButton) addToCart(addButton.dataset.addProduct, true);
        if (event.target.closest('[data-community-link]')) window.location.href = 'marketing.html';
    });

    if (document.body.classList.contains('home-page')) {
        initCookieConsent();
    } else if (localStorage.getItem('cookiesAccepted') !== 'true') {
        initCookieConsent();
    }

    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            state.activeQuery = event.target.value.trim().toLowerCase();
            renderProducts();
        });
    }

    if (categorySelect) {
        categorySelect.addEventListener('change', (event) => {
            state.activeCategory = event.target.value;
            renderProducts();
        });
    }

    if (filterAll) {
        filterAll.addEventListener('click', () => {
            state.activeFilter = 'all';
            renderProducts();
        });
    }

    if (filterRecommended) {
        filterRecommended.addEventListener('click', () => {
            state.activeFilter = 'recommended';
            renderProducts();
        });
    }

    if (nav) {
        nav.addEventListener('click', (event) => {
            if (event.target.closest('#openCartButton')) {
                toggleCartPanel();
            }
        });
    }

    if (closeCartButton) {
        closeCartButton.addEventListener('click', toggleCartPanel);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeProductModal();
            closeCart();
        }
    });

    window.addEventListener('commerce-cart', event => { state.cart = event.detail.items; renderCart(); renderProducts(); });
    window.addEventListener('commerce-auth', event => {
        if (event.detail) window.RutaCommerce.prepareCart().catch(error => showToast(error.message + ' Tu carrito local se conserva.', 'error'));
    });
    await window.RutaCommerce.init();
    try { await window.RutaCommerce.prepareCart(); } catch(error) { showToast(error.message + ' Tu carrito local se conserva.', 'error'); }
    try { window.rutaPromotions = await window.RutaCommerce.read('promociones'); window.rutaTax = await window.RutaCommerce.publicConfig(); } catch(error) { console.warn('Promociones no disponibles:',error); }
    await loadScmCatalog();
    renderProducts();
    renderCart();

    try {
        const [{ getApp }, { getFirestore, collection, doc, onSnapshot }, { watchChanges }] = await Promise.all([
            import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js'),
            window.RutaSalvajeLiveSync
        ]);
        const db = getFirestore(getApp());
        watchChanges({
            onSnapshot, references: [collection(db, 'scm_productos'), collection(db, 'promociones'), doc(db, 'configuracion', 'comercio')],
            refresh: async () => {
                await loadScmCatalog();
                window.rutaPromotions = await window.RutaCommerce.read('promociones');
                window.rutaTax = await window.RutaCommerce.publicConfig();
                renderCart();
                renderProducts();
                if (state.selectedProductId) {
                    if (productos.some(product => String(product.id) === String(state.selectedProductId))) showProductDetail(state.selectedProductId);
                    else closeProductModal();
                }
            },
            onError: error => console.error('Sincronización del catálogo:', error)
        });
    } catch (error) {
        console.warn('No se pudo activar la sincronización del catálogo:', error);
    }

    const shouldOpenCart = new URLSearchParams(window.location.search).get('openCart') === '1';
    if (shouldOpenCart) {
        showCartPanel();
    }
}

window.shop = {
    showProductDetail,
    closeProductModal,
    addToCart,
    changeQuantity,
    removeFromCart,
    clearCart,
    renderCart,
    toggleCartPanel,
    showCartPanel,
    openCart,
    closeCart,
    setPage,
    changePage,
};

initShop().catch(error => console.error('No se pudo iniciar la tienda:', error));
