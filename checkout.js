document.addEventListener('DOMContentLoaded', () => {
    const checkoutContainer = document.getElementById('checkoutContainer');
    if (!checkoutContainer) return;

    // State
    let currentStep = 1;
    const totalSteps = 3;

    // DOM Elements
    const steps = document.querySelectorAll('.step');
    const stepContents = document.querySelectorAll('.step-content');
    const prevStepBtn = document.getElementById('prevStepBtn');
    const nextStepBtn = document.getElementById('nextStepBtn');
    const payBtn = document.getElementById('payBtn');
    const paymentMethodRadios = document.querySelectorAll('input[name="payment"]');
    const checkoutProcess = document.getElementById('checkoutProcess');
    const orderConfirmation = document.getElementById('orderConfirmation');
    const downloadReceiptBtn = document.getElementById('downloadReceiptBtn');
    const requestInvoiceBtn = document.getElementById('requestInvoiceBtn');
    const invoiceModal = document.getElementById('invoiceModal');
    const closeInvoiceBtn = document.getElementById('closeInvoiceBtn');
    const invoiceForm = document.getElementById('invoiceForm');
    const invoiceFormView = document.getElementById('invoiceFormView');
    const invoiceResultView = document.getElementById('invoiceResultView');
    const invoiceDownloadBtn = document.getElementById('invoiceDownloadBtn');
    let latestOrder = null;

    function formatPrice(value) {
        return `$${Number(value).toFixed(2)}`;
    }

    function getCartData() {
        const cart = JSON.parse(localStorage.getItem('campingCart') || '[]');
        const promoCode = localStorage.getItem('campingPromo') || '';
        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        
        const discounts = { RUTA10: 0.10, VERANO20: 0.20, CAMPING15: 0.15 };
        const discountPercent = discounts[promoCode] || 0;
        const discountAmount = subtotal * discountPercent;
        const total = subtotal - discountAmount;

        return { cart, subtotal, discountAmount, total, promoCode };
    }

    function renderSummary() {
        const summaryContainer = document.getElementById('checkoutSummary');
        const { cart, subtotal, discountAmount, total } = getCartData();

        if (cart.length === 0) {
            summaryContainer.innerHTML = '<div class="empty-summary"><i class="bi bi-bag-x"></i><p>Tu carrito está vacío.</p><a href="equipo.html" class="btn btn-secondary">Volver a la tienda</a></div>';
            // Disable checkout if cart is empty
            nextStepBtn.disabled = true;
            return;
        }

        summaryContainer.innerHTML = `
            <h3>Resumen del Pedido</h3>
            <div class="space-y-3">
                ${cart.map(item => `
                    <div class="summary-item">
                        <div class="summary-item-details">
                            <p class="font-semibold">${item.name}</p>
                            <p class="text-sm text-gray-500">Cantidad: ${item.quantity}</p>
                        </div>
                        <p class="font-semibold">${formatPrice(item.price * item.quantity)}</p>
                    </div>
                `).join('')}
            </div>
            <div class="summary-totals">
                <div>
                    <span>Subtotal</span>
                    <span>${formatPrice(subtotal)}</span>
                </div>
                ${discountAmount > 0 ? `
                <div class="text-emerald-600">
                    <span>Descuento</span>
                    <span>- ${formatPrice(discountAmount)}</span>
                </div>` : ''}
                <div class="total">
                    <span>Total</span>
                    <span>${formatPrice(total)}</span>
                </div>
            </div>
        `;
    }

    function updateStepView() {
        steps.forEach(step => {
            const stepNum = parseInt(step.dataset.step, 10);
            step.classList.toggle('active', stepNum === currentStep);
            step.classList.toggle('completed', stepNum < currentStep);
            step.setAttribute('aria-current', stepNum === currentStep ? 'step' : 'false');
        });

        stepContents.forEach(content => {
            content.classList.toggle('hidden', parseInt(content.id.split('-')[1], 10) !== currentStep);
        });

        prevStepBtn.classList.toggle('hidden', currentStep === 1);
        nextStepBtn.classList.toggle('hidden', currentStep === totalSteps);
        payBtn.classList.toggle('hidden', currentStep !== totalSteps);
    }

    function handleNextStep() {
        if (currentStep < totalSteps) {
            currentStep++;
            if (currentStep === 3) {
                // Populate confirmation details
                const address = document.getElementById('address').value;
                const city = document.getElementById('city').value;
                const zipCode = document.getElementById('zipCode').value;
                const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
                const paymentLabels = { card: 'Tarjeta', transfer: 'Transferencia bancaria', ewallet: 'E-wallet (saldo simulado)' };
                document.getElementById('confirmAddress').textContent = `${address}, ${city}, C.P. ${zipCode}`;
                document.getElementById('confirmPaymentMethod').textContent = paymentLabels[paymentMethod];
            }
            updateStepView();
        }
    }

    function handlePrevStep() {
        if (currentStep > 1) {
            currentStep--;
            updateStepView();
        }
    }

    function handlePaymentSelection() {
        const selected = document.querySelector('input[name="payment"]:checked').value;
        document.getElementById('card-details').classList.toggle('hidden', selected !== 'card');
        document.getElementById('transfer-details').classList.toggle('hidden', selected !== 'transfer');
        document.getElementById('ewallet-details').classList.toggle('hidden', selected !== 'ewallet');
    }

    function getCustomerData() {
        const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
        const paymentLabels = { card: 'Tarjeta', transfer: 'Transferencia bancaria', ewallet: 'E-wallet (saldo simulado)' };

        return {
            name: document.getElementById('fullName').value.trim() || 'Cliente de Ruta Salvaje',
            address: document.getElementById('address').value.trim() || 'Dirección no especificada',
            city: document.getElementById('city').value.trim() || 'Ciudad no especificada',
            zipCode: document.getElementById('zipCode').value.trim() || 'Sin C.P.',
            paymentMethod: paymentLabels[paymentMethod],
        };
    }

    function getPurchaseStorageKey() {
        const userEmail = localStorage.getItem('userEmail') || 'guest';
        return `rutaSalvajePurchases_${userEmail.toLowerCase()}`;
    }

    function savePurchase(purchase) {
        const storageKey = getPurchaseStorageKey();
        const savedPurchases = JSON.parse(localStorage.getItem(storageKey) || '[]');
        savedPurchases.unshift(purchase);
        localStorage.setItem(storageKey, JSON.stringify(savedPurchases));
    }

    function showDownloadMessage() {
        showToast('Descarga simulada lista: tu comprobante está preparado.', 'success');
    }

    function openInvoiceModal() {
        invoiceModal.classList.remove('hidden');
        document.body.classList.add('invoice-open');
        invoiceFormView.classList.remove('hidden');
        invoiceResultView.classList.add('hidden');
        document.getElementById('invoiceName').focus();
    }

    function closeInvoiceModal() {
        invoiceModal.classList.add('hidden');
        document.body.classList.remove('invoice-open');
    }

    function generateInvoice(event) {
        event.preventDefault();
        const invoiceName = document.getElementById('invoiceName').value.trim() || 'Cliente sin datos fiscales';
        const invoiceTaxId = document.getElementById('invoiceTaxId').value.trim() || 'SIN RFC';
        const invoiceTaxRegime = document.getElementById('invoiceTaxRegime').value.trim() || 'Régimen no especificado';
        const invoiceEmail = document.getElementById('invoiceEmail').value.trim() || 'Correo no especificado';
        const invoiceUse = document.getElementById('invoiceUse').value;
        const order = latestOrder || { orderNumber: 'Folio no disponible', orderDate: new Date().toLocaleString('es-MX'), cart: [], subtotal: 0, discountAmount: 0, total: 0 };
        const { cart, subtotal, discountAmount, total } = order;

        document.getElementById('generatedInvoice').innerHTML = `
            <div class="generated-invoice-head">
                <div><strong>Ruta Salvaje</strong><span>Factura simulada</span></div>
                <div><span>Folio fiscal</span><strong>${order.orderNumber}</strong></div>
            </div>
            <div class="generated-invoice-meta">
                <p><strong>Fecha:</strong> ${order.orderDate}</p>
                <p><strong>Cliente:</strong> ${invoiceName}</p>
                <p><strong>RFC:</strong> ${invoiceTaxId}</p>
                <p><strong>Régimen fiscal:</strong> ${invoiceTaxRegime}</p>
                <p><strong>Correo:</strong> ${invoiceEmail}</p>
                <p><strong>Uso de factura:</strong> ${invoiceUse}</p>
            </div>
            <div class="generated-invoice-items">
                ${cart.map(item => `<div><span>${item.name} <small>x${item.quantity}</small></span><strong>${formatPrice(item.price * item.quantity)}</strong></div>`).join('')}
            </div>
            <div class="generated-invoice-totals">
                <p><span>Subtotal</span><strong>${formatPrice(subtotal)}</strong></p>
                <p><span>Descuento</span><strong>- ${formatPrice(discountAmount)}</strong></p>
                <p class="invoice-grand-total"><span>Total</span><strong>${formatPrice(total)}</strong></p>
            </div>
        `;
        invoiceFormView.classList.add('hidden');
        invoiceResultView.classList.remove('hidden');
    }

    function simulatePayment() {
        const payText = payBtn.querySelector('.pay-text');
        const spinner = payBtn.querySelector('.spinner');

        payText.classList.add('hidden');
        spinner.classList.remove('hidden');
        payBtn.disabled = true;

        setTimeout(() => {
            const { cart, total } = getCartData();
            const customer = getCustomerData();
            const orderNumber = `#RS${Date.now().toString().slice(-6)}`;
            const orderDate = new Intl.DateTimeFormat('es-MX', {
                dateStyle: 'long',
                timeStyle: 'short',
            }).format(new Date());
            latestOrder = { orderNumber, orderDate, cart, subtotal: getCartData().subtotal, discountAmount: getCartData().discountAmount, total };
            savePurchase({
                id: orderNumber,
                date: orderDate,
                status: 'Procesando',
                customer: customer.name,
                address: `${customer.address}, ${customer.city}, C.P. ${customer.zipCode}`,
                payment: customer.paymentMethod,
                total,
                products: cart.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                })),
            });
            
            // Show confirmation
            checkoutProcess.classList.add('hidden');
            orderConfirmation.classList.remove('hidden');

            // Populate the visual receipt with the checkout data.
            document.getElementById('orderNumber').textContent = orderNumber;
            document.getElementById('orderDate').textContent = orderDate;
            document.getElementById('receiptCustomerName').textContent = customer.name;
            document.getElementById('receiptCustomerAddress').textContent = `${customer.address}, ${customer.city}, C.P. ${customer.zipCode}`;
            document.getElementById('receiptPaymentMethod').textContent = customer.paymentMethod;
            document.getElementById('receiptTotal').textContent = formatPrice(total);
            const confirmationSummary = document.getElementById('confirmationSummary');
            confirmationSummary.innerHTML = `
                ${cart.map(item => `<div class="receipt-product"><span>${item.name} <small>x${item.quantity}</small></span><strong>${formatPrice(item.price * item.quantity)}</strong></div>`).join('')}
            `;

            // Clear cart after the simulated payment is approved.
            localStorage.removeItem('campingCart');
            localStorage.removeItem('campingPromo');

        }, 2000);
    }

    // Event Listeners
    nextStepBtn.addEventListener('click', handleNextStep);
    prevStepBtn.addEventListener('click', handlePrevStep);
    payBtn.addEventListener('click', simulatePayment);
    paymentMethodRadios.forEach(radio => radio.addEventListener('change', handlePaymentSelection));
    downloadReceiptBtn.addEventListener('click', showDownloadMessage);
    requestInvoiceBtn.addEventListener('click', openInvoiceModal);
    closeInvoiceBtn.addEventListener('click', closeInvoiceModal);
    invoiceForm.addEventListener('submit', generateInvoice);
    invoiceDownloadBtn.addEventListener('click', () => showToast('Factura simulada lista para descargar.', 'success'));
    invoiceModal.querySelector('[data-close-invoice]').addEventListener('click', closeInvoiceModal);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !invoiceModal.classList.contains('hidden')) closeInvoiceModal();
    });

    // Initial render
    renderSummary();
    updateStepView();
    handlePaymentSelection();
});

// Toast function needed for validation messages
function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}