// Shared receipt presentation; amounts and email status come from the persisted order.
(() => {
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const money = cents => (Number(cents) / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    const date = iso => new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
    const receipt = order => {
        if (!order?.comprobante) throw new Error('El comprobante persistente todavía no está disponible.');
        return order.comprobante;
    };
    function products(order, className = 'receipt-product') {
        return receipt(order).productos.map(line => `<div class="${className}"><span>${esc(line.nombre)} <small>x${line.cantidad} · Precio unitario: ${money(line.precioUnitarioCents)}</small></span><strong>${money(line.importeCents)}</strong></div>`).join('');
    }
    function totals(order) {
        const r = receipt(order);
        return `<p>Subtotal: <strong>${money(r.subtotalCents)}</strong></p><p>Descuentos: <strong>− ${money(r.descuentoCents)}</strong></p><p>Base gravable: <strong>${money(r.subtotalCents - r.descuentoCents)}</strong></p><p>${esc(r.impuestoNombre)} (${r.ivaBps / 100}%): <strong>${money(r.ivaCents)}</strong></p>`;
    }
    function mailMessage(order) {
        const mail = order.correo_comprobante;
        if (!mail || mail.estado !== 'envio_simulado') return 'Comprobante disponible. No hay un envío de correo registrado para este pedido.';
        return (order.estado === 'pendiente_pago' ? 'Pedido registrado como pendiente de pago.' : 'Compra registrada correctamente.') + ' Hemos generado tu comprobante y simulado su envío a tu correo: ' + mail.destinatario + '. No se envió un correo real.';
    }
    function mailMarkup(order) {
        const mail = order.correo_comprobante;
        if (!mail) return '';
        return `<details class="receipt-mail"><summary>Ver correo simulado registrado</summary><p>Destinatario: ${esc(mail.destinatario)}</p><p>Asunto: ${esc(mail.asunto)}</p><p>Fecha: ${esc(date(mail.fecha))} (Ciudad de México)</p><p>Estado: ${esc(mail.estado)} · Registro: ${esc(mail.id)}</p><pre>${esc(receipt(order).texto)}</pre></details>`;
    }
    function markup(order) {
        const r = receipt(order);
        return `<p class="purchase-ticket-kicker">${order.estado === 'pendiente_pago' ? 'Comprobante de pedido pendiente' : 'Ticket de compra'}</p>
            <div class="purchase-ticket-heading"><div><h2 id="purchaseDetailTitle">${esc(r.tienda)}</h2><p>Folio ${esc(r.folio)}</p></div><i class="bi bi-tree-fill" aria-hidden="true"></i></div>
            <div class="purchase-ticket-meta"><div><span>Fecha y hora (Ciudad de México)</span><strong>${esc(date(r.fecha))}</strong></div><div><span>Estado</span><strong>${esc(r.estadoTexto)}</strong></div></div>
            ${r.fecha_pago ? `<p>Pago simulado confirmado: ${esc(date(r.fecha_pago))} (Ciudad de México)</p>` : ''}
            <div class="purchase-ticket-customer"><p class="purchase-ticket-section">Datos del comprador</p><strong>${esc(r.comprador.nombre)}</strong><span>${esc(r.comprador.correo)}</span><span>${esc(r.entrega.address)}, ${esc(r.entrega.city)}, C.P. ${esc(r.entrega.zipCode)}</span><span>Método de pago: ${esc(r.metodoTexto)}</span></div>
            <div class="purchase-ticket-products"><p class="purchase-ticket-section">Productos</p>${products(order, 'receipt-product')}</div>
            <div class="receipt-breakdown">${totals(order)}</div><div class="purchase-ticket-total"><span>Total del pedido</span><strong>${money(r.totalCents)}</strong></div>
            <p class="receipt-note">${esc(mailMessage(order))}</p>${mailMarkup(order)}
            <button type="button" class="btn btn-secondary" data-download-cloud-receipt>Descargar comprobante</button>`;
    }
    function download(order) {
        const r = receipt(order);
        const url = URL.createObjectURL(new Blob([r.texto], { type: 'text/plain;charset=utf-8' }));
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = r.folio + '.txt';
        document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    window.RutaReceipts = Object.freeze({ products, totals, markup, mailMessage, mailMarkup, download, date });
})();
