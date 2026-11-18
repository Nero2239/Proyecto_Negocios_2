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
    let latestOrder = null, latestPersistedOrder = null, quote = null, paying = false;
    let stopOrder, watchedOrderId = null, orderWatchVersion = 0, checkoutUid = null;
    const commerce = window.RutaCommerce;
    const receipts = window.RutaReceipts;
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
    const status = text => { document.getElementById('checkoutMessage').textContent = text; };
    async function refreshQuote() {
        await commerce.flushCart();
        const owner = commerce.user?.uid;
        const nextQuote = await commerce.call('quote', { promo: localStorage.getItem('campingPromo') || '' });
        if (!owner || commerce.user?.uid !== owner || checkoutUid !== owner) throw new Error('La sesión cambió. Vuelve a abrir el checkout desde tu carrito.');
        quote = nextQuote;
        renderSummary(); nextStepBtn.disabled = false; payBtn.disabled = paying;
        try {
            const wallet = await commerce.wallet();
            if (commerce.user?.uid !== owner || checkoutUid !== owner) return;
            document.getElementById('ewallet-details').textContent = 'Saldo simulado: ' + commerce.money(wallet.saldoCents) + '. Después del pago: ' + commerce.money(wallet.saldoCents - quote.totalCents) + '.';
        } catch (error) {
            if (commerce.user?.uid !== owner || checkoutUid !== owner) return;
            // A balance preview must not prevent paying by card or transfer.
            document.getElementById('ewallet-details').textContent = 'No se pudo consultar el saldo: ' + error.message + ' El servidor validará el saldo antes de aprobar cualquier compra con monedero.';
        }
        status('Los importes incluyen el IVA calculado sobre el precio antes de impuestos. Todos los pagos son simulados.');
    }

    function formatPrice(value) {
        return `$${Number(value).toFixed(2)}`;
    }

    function getCartData() {
        const cart = quote ? quote.items.map(row => ({ id: row.id, name: row.name, price: row.priceCents / 100, quantity: row.quantity })) : [];
        return { cart, subtotal: (quote?.subtotalCents || 0) / 100, discountAmount: (quote?.descuentoCents || 0) / 100, tax: (quote?.ivaCents || 0) / 100, total: (quote?.totalCents || 0) / 100 };
    }

    function renderSummary() {
        const summaryContainer = document.getElementById('checkoutSummary');
        const { cart, subtotal, discountAmount, tax, total } = getCartData();

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
                            <p class="font-semibold">${escape(item.name)}</p>
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
                <div><span>Base gravable</span><span>${formatPrice(subtotal - discountAmount)}</span></div>
                <div><span>${escape(quote?.impuestoNombre || 'IVA')} (${(quote?.ivaBps || 0) / 100}%)</span><span>${formatPrice(tax)}</span></div>
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
        if (currentStep === 1 && !document.getElementById('addressForm').reportValidity()) return;
        if (!quote) return status('Inicia sesión para verificar el carrito y los importes.');
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
            name: document.getElementById('fullName').value.trim(),
            address: document.getElementById('address').value.trim(),
            city: document.getElementById('city').value.trim(),
            zipCode: document.getElementById('zipCode').value.trim(),
            paymentMethod: paymentLabels[paymentMethod],
        };
    }

    function showDownloadMessage() {
        if (latestPersistedOrder) receipts.download(latestPersistedOrder);
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
        if (!latestOrder || latestPersistedOrder?.estado !== 'procesada') return status('Primero confirma el pago de un pedido.');
        const order = latestOrder;
        const { cart, subtotal, discountAmount, total } = order;

        document.getElementById('generatedInvoice').innerHTML = `
            <div class="generated-invoice-head">
                <div><strong>Ruta Salvaje</strong><span>Factura simulada</span></div>
                <div><span>Folio fiscal</span><strong>${order.orderNumber}</strong></div>
            </div>
            <div class="generated-invoice-meta">
                <p><strong>Fecha:</strong> ${order.orderDate}</p>
                <p><strong>Cliente:</strong> ${escape(invoiceName)}</p>
                <p><strong>RFC:</strong> ${escape(invoiceTaxId)}</p>
                <p><strong>Régimen fiscal:</strong> ${escape(invoiceTaxRegime)}</p>
                <p><strong>Correo:</strong> ${escape(invoiceEmail)}</p>
                <p><strong>Uso de factura:</strong> ${escape(invoiceUse)}</p>
            </div>
            <div class="generated-invoice-items">
                ${cart.map(item => `<div><span>${escape(item.name)} <small>x${item.quantity}</small></span><strong>${formatPrice(item.price * item.quantity)}</strong></div>`).join('')}
            </div>
            <div class="generated-invoice-totals">
                <p><span>Subtotal</span><strong>${formatPrice(subtotal)}</strong></p>
                <p><span>Descuento</span><strong>- ${formatPrice(discountAmount)}</strong></p>
                <p><span>IVA</span><strong>${formatPrice(latestOrder.tax)}</strong></p><p class="invoice-grand-total"><span>Total</span><strong>${formatPrice(total)}</strong></p>
            </div>
        `;
        invoiceFormView.classList.add('hidden');
        invoiceResultView.classList.remove('hidden');
    }

    function confirmOrder(order) {
        commerce.assertOrder(order);
        if (commerce.user?.uid !== order.usuario_id) return status('El pedido está registrado. Inicia sesión con la cuenta compradora para consultar su comprobante.');
        if (!order.comprobante) return status('El pedido está registrado. Abre su detalle en tu perfil para recuperar el comprobante persistente.');
        const receipt = order.comprobante;
        if (receipt.orden_id !== order.id || receipt.estado !== order.estado || receipt.totalCents !== order.totalCents) {
            status('El comprobante recibido no corresponde al pedido confirmado. Consulta el historial; se conserva la clave de compra.');
            return false;
        }
        latestPersistedOrder = order;
        const cart = order.productos.map(row => ({ name: row.nombre || row.producto_id, quantity: row.cantidad, price: row.precio_unitario }));
        latestOrder = { orderNumber: receipt.folio, orderDate: receipts.date(receipt.fecha) + ' (Ciudad de México)', cart, subtotal: receipt.subtotalCents / 100, discountAmount: receipt.descuentoCents / 100, tax: receipt.ivaCents / 100, total: receipt.totalCents / 100 };
        checkoutProcess.classList.add('hidden'); orderConfirmation.classList.remove('hidden');
        document.getElementById('orderNumber').textContent = latestOrder.orderNumber;
        document.getElementById('orderDate').textContent = latestOrder.orderDate;
        document.getElementById('receiptCustomerName').textContent = receipt.comprador.nombre;
        document.getElementById('receiptCustomerEmail').textContent = receipt.comprador.correo;
        document.getElementById('receiptCustomerAddress').textContent = order.entrega.address + ', ' + order.entrega.city + ', C.P. ' + order.entrega.zipCode;
        document.getElementById('receiptPaymentMethod').textContent = receipt.metodoTexto;
        document.getElementById('receiptOrderStatus').textContent = receipt.estadoTexto;
        document.getElementById('receiptTotal').textContent = formatPrice(latestOrder.total);
        document.getElementById('confirmationSummary').innerHTML = receipts.products(order) + receipts.totals(order);
        const pending = order.estado === 'pendiente_pago';
        document.getElementById('confirmationTitle').textContent = pending ? 'Transferencia pendiente de pago' : 'Compra confirmada';
        document.getElementById('receiptKind').textContent = pending ? 'Comprobante de pedido pendiente' : 'Ticket de compra';
        document.getElementById('confirmationMessage').textContent = receipts.mailMessage(order);
        document.getElementById('receiptEmailPreview').innerHTML = receipts.mailMarkup(order);
        requestInvoiceBtn.disabled = pending;
        requestInvoiceBtn.title = pending ? 'Disponible después de confirmar el pago simulado.' : '';
        status(pending ? 'Pedido persistido. Administración o ventas deberá confirmar el pago simulado; todavía no se descuenta inventario.' : 'Pedido, pago, comprobante e inventario registrados correctamente.');
        if (watchedOrderId !== order.id) {
            stopOrder?.(); watchedOrderId = order.id;
            const version = ++orderWatchVersion;
            commerce.watchOrder(order.id, updated => {
                if (version === orderWatchVersion && commerce.user?.uid === order.usuario_id) {
                    try { confirmOrder(updated); } catch (error) { status(error.message); }
                }
            }, error => status('El pedido ya está registrado. No se pudo actualizar su estado: ' + error.message))
                .then(unsubscribe => { if (version === orderWatchVersion) stopOrder = unsubscribe; else unsubscribe(); })
                .catch(error => status('El pedido ya está registrado. No se pudo activar su seguimiento: ' + error.message));
        }
        return true;
    }
    async function simulatePayment() {
        if (payBtn.disabled || paying) return;
        if (!document.getElementById('addressForm').reportValidity()) return;
        paying = true; payBtn.disabled = true;
        payBtn.querySelector('.spinner').classList.remove('hidden');
        let submittedAttempt = null;
        try {
            await commerce.flushCart();
            const user = commerce.user;
            const storageKey = 'rutaCheckoutAttempt_' + user.uid;
            const saved = sessionStorage.getItem(storageKey);
            const previous = saved ? JSON.parse(saved) : null;
            if (previous) {
                const completed = await commerce.call('orderLookup', {key: previous.key});
                if (completed) { if (confirmOrder(completed)) await commerce.completed(completed).catch(() => status('El pedido ya está registrado. Recarga el carrito para sincronizarlo.')); return; }
            }
            const oldQuote = quote;
            await refreshQuote();
            if (oldQuote && oldQuote.totalCents !== quote.totalCents) return status('El total cambió. Revisa los importes y confirma de nuevo.');
            const customer = getCustomerData();
            const payload = { method: document.querySelector('input[name="payment"]:checked').value, delivery: {name:customer.name,address:customer.address,city:customer.city,zipCode:customer.zipCode}, promo:localStorage.getItem('campingPromo') || '', quoteToken:quote.quoteToken };
            const matches = previous && JSON.stringify(previous.payload) === JSON.stringify(payload);
            const attempt = matches ? previous : {key:commerce.key(),payload};
            sessionStorage.setItem(storageKey, JSON.stringify(attempt));
            submittedAttempt = { key: attempt.key, uid: user.uid };
            const order = await commerce.call('checkout', {key:attempt.key,...attempt.payload});
            if (confirmOrder(order)) await commerce.completed(order).catch(() => status('El pedido ya está registrado. Recarga el carrito para sincronizarlo.'));
        } catch (error) {
            // The server may have committed even if its response was lost. Only look up
            // the same attempt; never send another charge or generate a new key here.
            if (submittedAttempt && commerce.user?.uid === submittedAttempt.uid && ['functions/internal', 'functions/unavailable', 'functions/deadline-exceeded', 'functions/unknown', 'functions/data-loss'].includes(error.code)) {
                status('No llegó la confirmación del pago. Consultando el pedido antes de reintentar…');
                try {
                    const recovered = await commerce.call('orderLookup', { key: submittedAttempt.key });
                    if (recovered) {
                        if (confirmOrder(recovered)) await commerce.completed(recovered).catch(() => status('El pedido ya está registrado. Recarga el carrito para sincronizarlo.'));
                        return;
                    }
                } catch { /* Keep the original connection error and the saved attempt. */ }
                status(error.message + ' La clave de compra se conserva. Consulta tus pedidos o reintenta la misma operación.');
            } else status(error.message + ' Tu carrito se conserva. Puedes volver a intentarlo.');
        }
        finally { paying = false; payBtn.disabled = !quote || commerce.user?.uid !== checkoutUid; payBtn.querySelector('.spinner').classList.add('hidden'); }
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
    invoiceDownloadBtn.addEventListener('click', () => { const url=URL.createObjectURL(new Blob([document.getElementById('generatedInvoice').innerText],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='factura-simulada-'+latestOrder.orderNumber+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000); });
    invoiceModal.querySelector('[data-close-invoice]').addEventListener('click', closeInvoiceModal);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !invoiceModal.classList.contains('hidden')) closeInvoiceModal();
    });
    window.addEventListener('pagehide', () => { stopOrder?.(); watchedOrderId = null; orderWatchVersion++; });
    window.addEventListener('pageshow', event => { if (event.persisted && latestPersistedOrder && commerce.user?.uid === latestPersistedOrder.usuario_id) confirmOrder(latestPersistedOrder); });
    window.addEventListener('commerce-auth', event => {
        if (checkoutUid && event.detail?.uid !== checkoutUid) {
            stopOrder?.(); watchedOrderId = null; orderWatchVersion++;
            latestPersistedOrder = null; latestOrder = null; quote = null; checkoutUid = null;
            closeInvoiceModal(); document.getElementById('generatedInvoice').replaceChildren();
            orderConfirmation.classList.add('hidden'); checkoutProcess.classList.remove('hidden');
            nextStepBtn.disabled = true; payBtn.disabled = true;
            status('La sesión cambió. Vuelve a abrir el checkout desde tu carrito.');
        }
    });

    // Restore an acknowledged order after reload without creating another charge.
    nextStepBtn.disabled = true; payBtn.disabled = true;
    (async () => {
        await commerce.init();
        if (!commerce.user) return status('Inicia sesión con correo verificado para comprar. Tu carrito de visitante se conserva.');
        checkoutUid = commerce.user.uid;
        const activeCart = await commerce.prepareCart();
        if (commerce.user?.uid !== checkoutUid || !activeCart) return;
        const stored = sessionStorage.getItem('rutaCheckoutAttempt_' + commerce.user.uid);
        if (stored) { const order = await commerce.call('orderLookup', {key:JSON.parse(stored).key}); if (order && !activeCart.items.length) { confirmOrder(order); return; } else if (order) sessionStorage.removeItem('rutaCheckoutAttempt_' + commerce.user.uid); }
        await refreshQuote();
    })().catch(error => status(error.message + ' Tu carrito se conserva.'));
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
