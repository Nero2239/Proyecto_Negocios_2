document.addEventListener('DOMContentLoaded', () => {
    const purchaseHistory = document.getElementById('purchaseHistory');
    const purchaseCount = document.getElementById('purchaseCount');
    const detailModal = document.getElementById('purchaseDetailModal');
    const detailContent = document.getElementById('purchaseDetailContent');
    const closeDetailButton = document.getElementById('closePurchaseDetail');

    if (!purchaseHistory || !detailModal || !detailContent) return;

    const simulatedPurchases = [
        {
            id: 'RS-240618',
            date: '18 de junio de 2026',
            status: 'Entregado',
            customer: 'Alex Rivera',
            address: 'Bosque Norte 245, Valle Verde',
            payment: 'Tarjeta',
            total: 205,
            products: [
                { name: 'Tienda Pro-Series', quantity: 1, price: 120 },
                { name: 'Linterna Solar LED', quantity: 1, price: 30 },
                { name: 'Mochila Ergonómica 50L', quantity: 1, price: 55 },
            ],
        },
        {
            id: 'RS-240527',
            date: '27 de mayo de 2026',
            status: 'En camino',
            customer: 'Alex Rivera',
            address: 'Bosque Norte 245, Valle Verde',
            payment: 'E-wallet (saldo simulado)',
            total: 155,
            products: [
                { name: 'Saco Térmico -5°C', quantity: 1, price: 85 },
                { name: 'Colchoneta Aislante', quantity: 1, price: 45 },
                { name: 'Organizador de Mochila', quantity: 1, price: 25 },
            ],
        },
    ];

    function getPurchaseStorageKey() {
        const userEmail = localStorage.getItem('userEmail') || 'guest';
        return `rutaSalvajePurchases_${userEmail.toLowerCase()}`;
    }

    function getSavedPurchases() {
        try {
            return JSON.parse(localStorage.getItem(getPurchaseStorageKey()) || '[]');
        } catch (error) {
            return [];
        }
    }

    const purchases = [...getSavedPurchases(), ...simulatedPurchases];

    function formatPrice(value) {
        return `$${Number(value).toFixed(2)}`;
    }

    function renderPurchases() {
        purchaseCount.textContent = `${purchases.length} pedidos`;
        purchaseHistory.innerHTML = purchases.map((purchase) => `
            <article class="purchase-card">
                <div class="purchase-card-icon"><i class="bi bi-bag-check-fill" aria-hidden="true"></i></div>
                <div class="purchase-card-main">
                    <div class="purchase-card-heading">
                        <div>
                            <p class="purchase-order-label">Pedido ${purchase.id}</p>
                            <h3>${purchase.products[0].name}${purchase.products.length > 1 ? ` <span>+ ${purchase.products.length - 1} productos</span>` : ''}</h3>
                        </div>
                        <span class="purchase-status ${purchase.status === 'En camino' ? 'is-shipping' : ''}">${purchase.status}</span>
                    </div>
                    <div class="purchase-card-meta">
                        <span><i class="bi bi-calendar3"></i>${purchase.date}</span>
                        <strong>${formatPrice(purchase.total)}</strong>
                    </div>
                </div>
                <button class="btn btn-secondary purchase-detail-button" type="button" data-purchase-id="${purchase.id}">
                    <i class="bi bi-receipt"></i> Ver detalle
                </button>
            </article>
        `).join('');
    }

    function showPurchaseDetail(purchaseId) {
        const purchase = purchases.find((item) => item.id === purchaseId);
        if (!purchase) return;

        detailContent.innerHTML = `
            <p class="purchase-ticket-kicker">Ticket de compra</p>
            <div class="purchase-ticket-heading">
                <div>
                    <h2 id="purchaseDetailTitle">Ruta Salvaje</h2>
                    <p>Resumen de pedido ${purchase.id}</p>
                </div>
                <i class="bi bi-tree-fill" aria-hidden="true"></i>
            </div>
            <div class="purchase-ticket-meta">
                <div><span>Fecha</span><strong>${purchase.date}</strong></div>
                <div><span>Estado</span><strong>${purchase.status}</strong></div>
            </div>
            <div class="purchase-ticket-customer">
                <p class="purchase-ticket-section">Datos del cliente</p>
                <strong>${purchase.customer}</strong>
                <span>${purchase.address}</span>
                <span>Método de pago: ${purchase.payment}</span>
            </div>
            <div class="purchase-ticket-products">
                <p class="purchase-ticket-section">Productos</p>
                ${purchase.products.map((product) => `
                    <div><span>${product.name} <small>x${product.quantity}</small></span><strong>${formatPrice(product.price * product.quantity)}</strong></div>
                `).join('')}
            </div>
            <div class="purchase-ticket-total"><span>Total pagado</span><strong>${formatPrice(purchase.total)}</strong></div>
        `;
        detailModal.classList.remove('hidden');
        document.body.classList.add('purchase-detail-open');
        closeDetailButton.focus();
    }

    function closePurchaseDetail() {
        detailModal.classList.add('hidden');
        document.body.classList.remove('purchase-detail-open');
    }

    purchaseHistory.addEventListener('click', (event) => {
        const detailButton = event.target.closest('[data-purchase-id]');
        if (detailButton) showPurchaseDetail(detailButton.dataset.purchaseId);
    });
    closeDetailButton.addEventListener('click', closePurchaseDetail);
    detailModal.querySelector('[data-close-purchase]').addEventListener('click', closePurchaseDetail);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !detailModal.classList.contains('hidden')) closePurchaseDetail();
    });

    renderPurchases();
});
