// marketing.js - agrega publicaciones comunitarias y subastas a marketing.html

function getAllUserPublications() {
    // Busca claves en localStorage que sigan el patrón userPublications_<email>
    const publications = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith('userPublications_')) {
            try {
                const list = JSON.parse(localStorage.getItem(key) || '[]');
                list.forEach(item => publications.push(Object.assign({}, item)));
            } catch (e) {
                // Ignorar entradas inválidas
            }
        }
    }
    return publications;
}

const marketingState = {
    filter: 'all',
    query: '',
    page: 1,
    pageSize: 5,
};

const marketingFallbackImage = 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=500&h=350&fit=crop&auto=format&q=80';

function getFilteredPublications() {
    const all = getAllUserPublications();
    let filtered = all;

    if (marketingState.filter === 'used') {
        filtered = filtered.filter(p => (p.used === true || p.condition === 'used') && !(p.auction === true || p.isAuction === true));
    } else if (marketingState.filter === 'auctions') {
        filtered = filtered.filter(p => p.auction === true || p.isAuction === true);
    } else {
        filtered = filtered.filter(p => !(p.auction === true || p.isAuction === true));
    }

    if (marketingState.query) {
        const q = marketingState.query.toLowerCase();
        filtered = filtered.filter(p => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    }

    return filtered;
}

function renderCommunityPublications(page = 1) {
    const publications = getFilteredPublications();
    const pageSize = marketingState.pageSize;
    const grid = document.getElementById('publicationsGrid');
    const count = document.getElementById('publicationsCount');
    const pagination = document.getElementById('publicationsPagination');
    if (!grid) return;

    marketingState.page = page;

    count.textContent = `${publications.length} publicaciones`;

    if (publications.length === 0) {
        grid.innerHTML = '<p class="text-gray-500">Aún no hay publicaciones disponibles.</p>';
        if (pagination) pagination.innerHTML = '';
        return;
    }

    const totalPages = Math.max(1, Math.ceil(publications.length / pageSize));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * pageSize;
    const pageItems = publications.slice(start, start + pageSize);

    grid.innerHTML = pageItems.map(p => `
        <div class="publication-card">
            <img src="${p.photo || marketingFallbackImage}" onerror="this.onerror=null;this.src='${marketingFallbackImage}'" class="publication-photo" alt="${p.name}">
            <div class="publication-body">
                <h4 class="publication-title">${p.name}</h4>
                <p class="publication-price">$${(p.price||0).toFixed(2)}</p>
                <p class="publication-description">${p.description || ''}</p>
                <p class="text-xs text-gray-500 mt-2">Publicado por ${p.owner || 'otro usuario'}${p.auction ? ' · Subasta activa' : ''}</p>
            </div>
            <div class="publication-actions">
                <button class="btn btn-secondary btn-small" onclick="window.marketing.showDetail(${p.id})">Ver</button>
            </div>
        </div>
    `).join('');

    if (pagination) {
        pagination.innerHTML = Array.from({ length: totalPages }, (_, idx) => `
            <button class="btn btn-secondary btn-small ${idx + 1 === page ? 'btn-primary' : ''}" onclick="window.marketing.renderCommunityPublications(${idx + 1})">${idx + 1}</button>
        `).join('');
    }
}

function getPublicationImages(item) {
    const images = normalizeGalleryImages(item?.images || item?.imagenes || item?.photo || item?.image || item?.photos);
    return images.length ? images : [item?.photo || marketingFallbackImage];
}

function normalizeGalleryImages(value) {
    const items = Array.isArray(value) ? value : (value ? [value] : []);
    return [...new Set(items.filter(Boolean).map(item => String(item).trim()).filter(Boolean))];
}

function isUserLoggedIn() {
    return localStorage.getItem('isLoggedIn') === '1' || Boolean(localStorage.getItem('userEmail'));
}

function findActiveAuctionsFromPublications() {
    // Para el prototipo, consideramos que cualquier publicación puede tener subasta si contiene auction:true
    const pubs = getAllUserPublications();
    return pubs.filter(p => p.auction === true || p.isAuction === true);
}

function goToAuction() {
    if (isUserLoggedIn()) {
        window.location.href = 'profile.html#c2c-auction-view';
    } else {
        window.location.href = 'login.html';
    }
}

function renderActiveAuctions() {
    const auctions = findActiveAuctionsFromPublications();
    const count = document.getElementById('auctionsCount');
    const carouselInner = document.getElementById('auctionsCarouselInner');
    if (!carouselInner) return;

    count.textContent = `${auctions.length} subastas`;

    if (auctions.length === 0) {
        carouselInner.innerHTML = '<p class="text-gray-500">No hay subastas activas en este momento.</p>';
        return;
    }

    const visibleAuctions = auctions.slice(0, 2);
    if (visibleAuctions.length === 0) {
        carouselInner.innerHTML = '<p class="text-gray-500">No hay subastas activas en este momento.</p>';
    } else {
        carouselInner.innerHTML = visibleAuctions.map(a => `
            <div class="auction-summary-card bg-white p-4 rounded-xl border shadow-sm min-w-[320px]">
                <div class="flex items-center gap-4">
                    <img src="${a.photo || marketingFallbackImage}" onerror="this.onerror=null;this.src='${marketingFallbackImage}'" class="w-28 h-20 object-cover rounded-md">
                    <div class="flex-1">
                        <h4 class="font-bold text-bosque">${a.name}</h4>
                        <p class="text-sm text-gray-600">Oferta actual: <strong class="text-naranja">$${(a.currentBid||a.price||0).toFixed(2)}</strong></p>
                    </div>
                    <div>
                        <button type="button" class="btn btn-primary btn-small" onclick="window.marketing.goToAuction()">Ir a subasta</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Hook carousel controls
    const prev = document.getElementById('auctionsPrev');
    const next = document.getElementById('auctionsNext');
    const viewport = document.getElementById('auctionsCarousel');
    if (prev && next && viewport) {
        prev.addEventListener('click', () => { viewport.scrollBy({ left: -340, behavior: 'smooth' }); });
        next.addEventListener('click', () => { viewport.scrollBy({ left: 340, behavior: 'smooth' }); });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderCommunityPublications();
    renderActiveAuctions();
    // Filters and search
    const btnAll = document.getElementById('filterAll');
    const btnUsed = document.getElementById('filterUsed');
    const search = document.getElementById('pubSearch');

    function refreshPublications() {
        if (search) {
            marketingState.query = search.value.trim();
        }
        renderCommunityPublications(1);
    }

    btnAll?.addEventListener('click', () => { marketingState.filter = 'all'; refreshPublications(); });
    btnUsed?.addEventListener('click', () => { marketingState.filter = 'used'; refreshPublications(); });
    search?.addEventListener('input', () => { marketingState.query = search.value.trim(); refreshPublications(); });
    // initial apply
    renderCommunityPublications(1);
    // expose functions for pagination and detail actions
    window.marketing = window.marketing || {};
    window.marketing.goToAuction = goToAuction;
    window.marketing.renderCommunityPublications = renderCommunityPublications;
    window.marketing.showDetail = function (id) {
        const all = getAllUserPublications();
        const item = all.find(x => x.id === id);
        if (!item) return alert('Detalle no disponible');
        const container = document.getElementById('marketingDetail');
        if (!container) return;
        document.body.classList.add('modal-open');
        container.innerHTML = `
            <div class="product-modal-backdrop" onclick="window.marketing.closeDetail()">
                <div class="product-modal-card compact-modal" onclick="event.stopPropagation();">
                    <button class="detail-close-btn" type="button" onclick="window.marketing.closeDetail()" aria-label="Cerrar ventana"><i class="bi bi-x-lg"></i></button>
                    <div class="modal-card-header">
                        <span class="text-sm uppercase tracking-[0.3em] text-naranja font-semibold">Detalle del producto</span>
                        <h3>${item.name}</h3>
                    </div>
                    <div class="left">
                        ${buildCommunityGallery(item)}
                        <div class="rounded-2xl bg-crema p-4 text-sm text-gray-700">
                            <p class="font-semibold text-bosque">Publicado por</p>
                            <p class="mt-1">${item.owner || 'Usuario'}</p>
                        </div>
                    </div>
                    <div class="right">
                        <p class="text-sm text-gray-600 mb-3">${item.description || 'Sin descripción detallada disponible.'}</p>
                        <p class="text-gray-700 text-xl font-bold mb-4">$${(item.price||0).toFixed(2)}</p>
                        <ul class="detail-meta-list">
                            <li>Condición: <strong>${item.used ? 'Usado' : 'Nuevo'}</strong></li>
                            ${item.auction ? `<li>Oferta actual: <strong class="text-naranja">$${(item.currentBid||item.price||0).toFixed(2)}</strong></li>` : ''}
                            <li>Disponible: <strong>1 unidad</strong></li>
                        </ul>
                        ${item.auction ? `<div class="mb-3">
                            <label class="text-sm text-gray-600">Tu oferta</label>
                            <input id="bidInput" type="number" min="1" value="${(item.currentBid||item.price||0)}" class="mt-2 px-3 py-2 rounded-lg border w-full" />
                        </div>` : ''}
                        <div class="detalle-actions">
                            ${item.auction ? `<button id="makeBidBtn" class="btn btn-primary">Ofertar</button>` : ''}
                            <button class="btn btn-welcome" type="button" onclick="window.marketing.addToCart(${item.id})"><i class="bi bi-cart-plus-fill"></i> Agregar al carrito</button>
                        </div>
                    </div>
                </div>
            </div>
            <div id="marketingCartFeedback" class="marketing-cart-feedback hidden"><i class="bi bi-cart-check-fill"></i> Agregado al carrito</div>
        `;

        const galleryButtons = container.querySelectorAll('[data-community-gallery-image]');
        galleryButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const mainImage = container.querySelector('.product-gallery-main img');
                if (!mainImage) return;
                mainImage.src = button.dataset.communityGalleryImage;
                galleryButtons.forEach((item) => item.classList.toggle('active', item === button));
            });
        });
        // attach bid handler if auction
        if (item.auction) {
            setTimeout(() => {
                const btn = document.getElementById('makeBidBtn');
                const input = document.getElementById('bidInput');
                if (!btn || !input) return;
                btn.addEventListener('click', () => {
                    const val = parseFloat(input.value || '0');
                    if (isNaN(val) || val <= 0) return alert('Ingresa un monto válido');
                    if (val <= (item.currentBid || item.price || 0)) return alert('La oferta debe ser mayor a la actual');
                    // persist bid to the publication in localStorage
                    // find the owner key and update the item
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        if (!k || !k.startsWith('userPublications_')) continue;
                        try {
                            const arr = JSON.parse(localStorage.getItem(k) || '[]');
                            const idx = arr.findIndex(x => x.id === item.id);
                            if (idx !== -1) {
                                arr[idx].currentBid = val;
                                localStorage.setItem(k, JSON.stringify(arr));
                                alert('Oferta registrada: $' + val.toFixed(2));
                                window.marketing.closeDetail();
                                renderCommunityPublications();
                                renderActiveAuctions();
                                return;
                            }
                        } catch (e) { /* ignore parse errors */ }
                    }
                    alert('No se pudo guardar la oferta');
                });
            }, 100);
        }
        container.classList.remove('hidden');
    };

    function getMarketingCart() {
        try {
            return JSON.parse(localStorage.getItem('campingCart') || '[]');
        } catch (e) {
            return [];
        }
    }

    function buildCommunityGallery(item) {
        const images = getPublicationImages(item);
        const first = images[0] || marketingFallbackImage;
        return `
            <div class="product-gallery">
                <div class="product-gallery-main">
                    <img src="${first}" alt="${item.name}" onerror="this.onerror=null;this.src='${marketingFallbackImage}'" />
                </div>
                <div class="product-gallery-thumbs">
                    ${images.map((image, index) => `
                        <button type="button" class="product-gallery-thumb ${image === first ? 'active' : ''}" data-community-gallery-image="${image}" aria-label="Ver imagen ${index + 1}">
                            <img src="${image}" alt="${item.name} ${index + 1}" onerror="this.onerror=null;this.src='${marketingFallbackImage}'" />
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function saveMarketingCart(cart) {
        localStorage.setItem('campingCart', JSON.stringify(cart));
    }

    function updateCartCount() {
        const cartCount = document.getElementById('cartCount');
        if (!cartCount) return;
        const count = getMarketingCart().reduce((sum, item) => sum + (item.quantity || 1), 0);
        cartCount.textContent = count;
    }

    window.marketing.addToCart = function (itemId) {
        const all = getAllUserPublications();
        const item = all.find(x => x.id === itemId);
        if (!item) return;

        const cart = getMarketingCart();
        const existing = cart.find(entry => entry.id === item.id && entry.source === 'publication');
        if (existing) {
            existing.quantity = (existing.quantity || 1) + 1;
        } else {
            cart.push({
                id: item.id,
                source: 'publication',
                name: item.name,
                price: item.price || 0,
                quantity: 1,
            });
        }
        saveMarketingCart(cart);
        updateCartCount();
        window.marketing.showAddFeedback(`Agregado al carrito: ${item.name}`);
    };

    window.marketing.showAddFeedback = function (message) {
        const feedback = document.getElementById('marketingCartFeedback');
        if (!feedback) return;
        feedback.textContent = '';
        const icon = document.createElement('i');
        icon.className = 'bi bi-cart-check-fill';
        feedback.appendChild(icon);
        feedback.append(` ${message}`);
        feedback.classList.remove('hidden');
        clearTimeout(feedback.hideTimer);
        feedback.hideTimer = setTimeout(() => {
            feedback.classList.add('hidden');
        }, 1800);
    };

    window.marketing.closeDetail = function () {
        const container = document.getElementById('marketingDetail');
        if (!container) return;
        container.classList.add('hidden');
        container.innerHTML = '';
        document.body.classList.remove('modal-open');
    };
});
