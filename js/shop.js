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

let productos = [
    { id: 1, nombre: 'Tienda Pro-Series', precio: 120, descripcion: 'Resistente al agua y viento, para 2 personas.', detalle: 'Material reforzado y costuras selladas.', esRecomendado: true, categoria: 'tiendas', descuento: 0, rating: 4.9, stock: 8 },
    { id: 2, nombre: 'Saco Térmico -5°C', precio: 85, descripcion: 'Máximo confort en noches frías de montaña.', detalle: 'Aislamiento térmico premium.', esRecomendado: false, categoria: 'sacos', descuento: 10, rating: 4.7, stock: 5 },
    { id: 3, nombre: 'Linterna Solar LED', precio: 30, descripcion: 'Recargable y duradera.', detalle: 'Tres modos de iluminación y carga solar integrada.', esRecomendado: true, categoria: 'iluminacion', descuento: 0, rating: 4.8, stock: 12 },
    { id: 4, nombre: 'Mochila Ergonómica 50L', precio: 95, descripcion: 'Espacio y comodidad para travesías largas.', detalle: 'Soporte lumbar y compartimentos.', esRecomendado: false, categoria: 'mochilas', descuento: 15, rating: 4.6, stock: 6 },
    { id: 5, nombre: 'Tienda Compact 1P', precio: 70, descripcion: 'Ligera y fácil de montar.', detalle: 'Perfecta para rutas rápidas.', esRecomendado: false, categoria: 'tiendas', descuento: 20, rating: 4.5, stock: 4 },
    { id: 6, nombre: 'Saco UltraLight 0°C', precio: 110, descripcion: 'Aislamiento alto con bajo peso.', detalle: 'Diseñado para alta montaña.', esRecomendado: true, categoria: 'sacos', descuento: 0, rating: 4.9, stock: 7 },
    { id: 7, nombre: 'Luz Frontal PRO', precio: 22, descripcion: 'Fuerte y cómoda.', detalle: 'Varios modos y larga duración.', esRecomendado: false, categoria: 'iluminacion', descuento: 25, rating: 4.4, stock: 10 },
    { id: 8, nombre: 'Organizador de Mochila', precio: 18, descripcion: 'Bolsillos y funda impermeable.', detalle: 'Mantén tus objetos ordenados.', esRecomendado: false, categoria: 'accesorios', descuento: 5, rating: 4.3, stock: 9 },
    { id: 9, nombre: 'Tienda 3 Estaciones', precio: 150, descripcion: 'Versátil y ligera para 3 estaciones.', detalle: 'Costuras reforzadas y ventilación.', esRecomendado: true, categoria: 'tiendas', descuento: 0, rating: 4.8, stock: 5 },
    { id: 10, nombre: 'Colchoneta Aislante', precio: 45, descripcion: 'Aislamiento y comodidad para acampar.', detalle: 'Inflable con funda resistente.', esRecomendado: false, categoria: 'accesorios', descuento: 0, rating: 4.5, stock: 11 },
];

function loadScmCatalog() {
    try {
        const scmProducts = JSON.parse(localStorage.getItem('scm_catalog_cache') || '[]');
        if (!scmProducts.length) return;
        productos = scmProducts.filter(item => item.origen === 'tienda').map(item => ({
            id: item.id,
            nombre: item.nombre,
            precio: Number(item.costo_unitario || 0),
            descripcion: item.descripcion || '',
            detalle: item.descripcion || '',
            categoria: item.categoria || 'accesorios',
            stock: Number(item.stock_actual || 0),
            descuento: 0,
            rating: 4.5,
            esRecomendado: item.estrategia_logistica === 'PUSH'
        }));
    } catch (error) {
        console.warn('No se pudo cargar el catálogo SCM:', error);
    }
}

const state = {
    cart: JSON.parse(localStorage.getItem('campingCart') || '[]'),
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

function getPromoDiscount(code) {
    const normalized = (code || '').trim().toUpperCase();
    const discounts = {
        RUTA10: 0.10,
        VERANO20: 0.20,
        CAMPING15: 0.15,
    };

    return discounts[normalized] || 0;
}

function formatPrice(value) {
    return `$${value.toFixed(2)}`;
}

function saveCart() {
    localStorage.setItem('campingCart', JSON.stringify(state.cart));
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
        const descuentoBadge = producto.descuento ? `<span class="product-discount">-${producto.descuento}%</span>` : '';
        return `
            <article class="product-card">
                ${recomendado}
                ${descuentoBadge}
                <div class="product-image">📸</div>
                <div class="product-body">
                    <h2 class="product-title">${producto.nombre}</h2>
                    <p class="product-description">${producto.descripcion}</p>
                    <p class="product-price">${formatPrice(producto.precio)}</p>
                    <div class="product-actions">
                        <button class="btn btn-secondary" type="button" onclick="window.shop.showProductDetail(${producto.id})">Ver Detalle</button>
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
    const producto = productos.find((item) => item.id === id);
    if (!producto) return;

    state.selectedProductId = id;
    const detail = document.getElementById('productDetail');
    if (!detail) return;

    document.body.classList.add('modal-open');
    detail.innerHTML = `
        <div class="product-modal-backdrop" onclick="window.shop.closeProductModal()">
            <div class="product-modal-card" onclick="event.stopPropagation();">
                <button class="detail-close-btn" type="button" onclick="window.shop.closeProductModal()" aria-label="Cerrar ventana">
                    <i class="bi bi-x-lg"></i>
                </button>
                <div class="modal-card-header">
                    <span class="text-sm uppercase tracking-[0.3em] text-naranja font-semibold">Detalle del producto</span>
                    <h3>${producto.nombre}</h3>
                </div>
                <div class="left">
                    <div class="detalle-imagen">📸</div>
                    <div class="rounded-2xl bg-crema p-4 text-sm text-gray-700">
                        <p class="font-semibold text-bosque">${producto.nombre}</p>
                        <p class="mt-1">${producto.detalle}</p>
                    </div>
                </div>
                <div class="right">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="text-yellow-400">★★★★★</div>
                        <div class="text-sm text-gray-500">(${producto.stock} disponibles)</div>
                    </div>
                    <p class="text-gray-700 mb-4">${producto.descripcion}</p>
                    <p class="text-3xl font-extrabold text-naranja mb-4">${formatPrice(producto.precio)}</p>
                    <ul class="text-gray-700 list-none mb-6 space-y-2">
                        <li>✓ Temperatura mínima: -5°C</li>
                        <li>✓ Peso: 1.8 kg</li>
                        <li>✓ Impermeable</li>
                        <li>✓ Ideal para montaña</li>
                    </ul>
                    <div class="flex items-center gap-3 mb-6">
                        <label class="text-sm font-semibold text-gray-700" for="quantityInput">Cantidad</label>
                        <input id="quantityInput" type="number" min="1" max="5" value="1" class="w-20 rounded-lg border border-gray-300 px-3 py-2" />
                    </div>
                    <div class="detalle-actions">
                        <button class="btn btn-welcome" type="button" onclick="window.shop.addToCart(${producto.id}, true)"><i class="bi bi-cart-check-fill"></i> Agregar al carrito</button>
                    </div>
                </div>
            </div>
            <div id="addFeedback" class="cart-feedback hidden"><i class="bi bi-cart-check-fill"></i></div>
        </div>
    `;
    detail.classList.remove('hidden');
}

function closeProductModal() {
    state.selectedProductId = null;
    const detail = document.getElementById('productDetail');
    if (detail) {
        detail.classList.add('hidden');
        detail.innerHTML = '';
    }
    document.body.classList.remove('modal-open');
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
    const producto = productos.find((item) => item.id === productId);
    const quantityInput = document.getElementById('quantityInput');
    const quantity = quantityInput ? Number(quantityInput.value) || 1 : 1;

    if (!producto) return;

    const existing = state.cart.find((item) => item.id === productId);
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
    const checkoutButton = document.getElementById('checkoutButton');
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
                    <p class="font-semibold text-bosque">${item.name}</p>
                    <p class="text-sm text-gray-500">${formatPrice(item.price)} c/u</p>
                </div>
                <div class="flex items-center gap-2">
                    <button class="rounded-full border px-2 py-1" type="button" onclick="window.shop.changeQuantity(${item.id}, -1)">-</button>
                    <span class="min-w-6 text-center">${item.quantity}</span>
                    <button class="rounded-full border px-2 py-1" type="button" onclick="window.shop.changeQuantity(${item.id}, 1)">+</button>
                    <button class="ml-2 text-sm text-red-500" type="button" onclick="window.shop.removeFromCart(${item.id})">Quitar</button>
                </div>
            </div>
        `).join('');

        const discountPercent = getPromoDiscount(state.promoCode);
        const discountAmount = subtotal * discountPercent;
        const total = subtotal - discountAmount;

        cartSummary.innerHTML = `
            <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <label class="text-sm font-semibold text-bosque" for="promoCodeInput">Código promocional</label>
                <div class="mt-2 flex gap-2">
                    <input id="promoCodeInput" type="text" value="${state.promoCode}" placeholder="RUTA10" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    <button id="applyPromoButton" type="button" class="btn btn-welcome btn-small">Aplicar</button>
                </div>
                <div class="mt-3 flex justify-end">
                    <button id="clearCartButton" type="button" class="text-sm font-semibold text-red-500">Vaciar carrito</button>
                </div>
                <div id="promoAlert" class="popout-alert hidden mt-3"></div>
                ${state.promoCode ? `<p id="promoStatus" class="mt-2 text-xs text-emerald-600">Descuento ${state.promoCode} aplicado</p>` : ''}
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
                <span>Total</span>
                <span>${formatPrice(total)}</span>
            </div>
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

    if (checkoutButton) {
        checkoutButton.addEventListener('click', () => {
            closeCart();
        });
    }

    if (recommendedProducts) {
        const recommended = productos.filter((producto) => producto.esRecomendado).slice(0, 3);
        recommendedProducts.innerHTML = recommended.map((producto) => `
            <div class="recommended-card">
                <div class="recommended-avatar"><i class="bi bi-person-circle"></i></div>
                <div class="recommended-content">
                    <h4>${producto.nombre}</h4>
                    <p class="text-sm text-gray-600">${producto.descripcion}</p>
                    <p class="text-sm font-semibold text-naranja mt-2">${formatPrice(producto.precio)}</p>
                </div>
                <button class="btn btn-welcome btn-small" type="button" onclick="window.shop.addToCart(${producto.id})">Agregar</button>
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
    const item = state.cart.find((entry) => entry.id === productId);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) {
        state.cart = state.cart.filter((entry) => entry.id !== productId);
    }
    saveCart();
    renderCart();
    renderProducts();
}

function removeFromCart(productId) {
    state.cart = state.cart.filter((item) => item.id !== productId);
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
    document.body.classList.remove('modal-open');
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

function initShop() {
    const searchInput = document.getElementById('searchInput');
    const categorySelect = document.getElementById('categorySelect');
    const filterAll = document.getElementById('filterAll');
    const filterRecommended = document.getElementById('filterRecommended');
    const nav = document.querySelector('nav.fixed'); // Stable parent for delegation
    const closeCartButton = document.getElementById('closeCartButton');

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

    loadScmCatalog();
    renderProducts();
    renderCart();

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

initShop();
