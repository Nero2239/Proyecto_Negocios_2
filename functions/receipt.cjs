'use strict';
const { cents, fail } = require('./money.cjs');
const money = value => (value / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const date = value => new Date(value).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

function receiptRecords(order, recipient, stamp) {
    if (typeof recipient !== 'string' || !recipient.includes('@') || recipient.length > 320) fail('failed-precondition', 'No se pudo verificar el correo del comprador para generar su comprobante.');
    const pending = order.estado === 'pendiente_pago';
    const method = ({ card: 'Tarjeta simulada', ewallet: 'Monedero simulado', transfer: 'Transferencia simulada' })[order.metodo_pago];
    const receipt = {
        version: 1, tienda: 'Ruta Salvaje', orden_id: order.id, folio: order.folio,
        fecha: order.fecha, actualizado: stamp, fecha_pago: order.fecha_procesamiento || null,
        comprador: { nombre: order.comprador_nombre || order.entrega.name, correo: recipient },
        entrega: order.entrega, estado: order.estado, estadoTexto: pending ? 'Pendiente de pago' : 'Compra confirmada (pago simulado)',
        metodoPago: order.metodo_pago, metodoTexto: method, simulado: true,
        productos: order.productos.map(line => ({ producto_id: line.producto_id, nombre: line.nombre || line.producto_id, cantidad: line.cantidad,
            precioUnitarioCents: cents(line.precio_unitario), importeCents: cents(line.precio_unitario) * line.cantidad })),
        subtotalCents: order.subtotalCents, descuentoCents: order.descuentoCents, ivaCents: order.ivaCents,
        ivaBps: order.ivaBps, impuestoNombre: order.impuestoNombre || 'IVA', totalCents: order.totalCents
    };
    receipt.texto = [
        'Ruta Salvaje — ' + (pending ? 'Comprobante de pedido pendiente' : 'Ticket de compra'),
        'Folio: ' + receipt.folio, 'Fecha y hora: ' + date(receipt.fecha) + ' (Ciudad de México)',
        ...(receipt.fecha_pago ? ['Fecha de pago simulado: ' + date(receipt.fecha_pago) + ' (Ciudad de México)'] : []),
        'Comprador: ' + receipt.comprador.nombre, 'Correo: ' + recipient,
        'Entrega: ' + order.entrega.address + ', ' + order.entrega.city + ', C.P. ' + order.entrega.zipCode, '',
        ...receipt.productos.map(line => `${line.nombre} | Cantidad: ${line.cantidad} | Precio unitario: ${money(line.precioUnitarioCents)} | Importe: ${money(line.importeCents)}`), '',
        'Subtotal: ' + money(receipt.subtotalCents), 'Descuentos: ' + money(receipt.descuentoCents),
        'Base gravable: ' + money(receipt.subtotalCents - receipt.descuentoCents),
        `${receipt.impuestoNombre} (${receipt.ivaBps / 100}%): ${money(receipt.ivaCents)}`,
        'Total: ' + money(receipt.totalCents), 'Método de pago: ' + method, 'Estado del pedido: ' + receipt.estadoTexto,
        pending ? 'El pago debe ser confirmado por administración o ventas. Aún no se descuentan existencias.' : 'Pago aprobado de forma simulada. No se cobró dinero real.',
        'Este correo es una simulación registrada en Firestore; no se ha enviado un correo real.'
    ].join('\n');
    const notification = {
        id: `${order.id}_${pending ? 'pendiente' : 'confirmado'}`, usuario_id: order.usuario_id, orden_id: order.id, folio: order.folio,
        canal: 'correo_simulado', tipo: pending ? 'pedido_pendiente' : 'compra_confirmada', destinatario: recipient,
        asunto: `Ruta Salvaje — ${pending ? 'Pedido pendiente de pago' : 'Compra confirmada'} ${order.folio}`,
        cuerpoTexto: receipt.texto, fecha: stamp, estado: 'envio_simulado', simulado: true, envio_real: false
    };
    return { receipt, notification };
}
module.exports = { receiptRecords };
