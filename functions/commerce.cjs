'use strict';
const { createHash } = require('node:crypto');
const { fail, cents, integer, items, totals, delivery } = require('./money.cjs');
const { receiptRecords } = require('./receipt.cjs');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const text = (value, max = 2000) => {
    if (typeof value !== 'string' || !value.trim() || value.length > max) fail('invalid-argument', 'Texto requerido o demasiado largo.');
    return value.trim();
};
const key = value => {
    if (typeof value !== 'string' || !/^[\w-]{8,100}$/.test(value)) fail('invalid-argument', 'Identificador de operación inválido.');
    return value;
};
function createCommerce(db, clock = () => new Date()) {
    return async (auth, input = {}) => {
        if (!auth?.uid || auth.token?.email_verified !== true) fail('unauthenticated', 'Inicia sesión y verifica tu correo.');
        if (!auth.token.email || typeof auth.token.email !== 'string') fail('unauthenticated', 'La cuenta autenticada debe tener un correo verificado.');
        if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.action !== 'string') fail('invalid-argument', 'La solicitud debe indicar una operación de comercio válida.');
        const uid = auth.uid, email = String(auth.token.email || '').toLowerCase();
        const ref = path => db.doc(path);
        return db.runTransaction(async tx => {
            const profile = (await tx.get(ref(`usuarios/${uid}`))).data();
            if (!profile || profile.auth_uid !== uid || String(profile.email).toLowerCase() !== email) fail('permission-denied', 'Perfil de usuario no verificado.');
            const admin = profile.rol === 'admin', staff = admin || profile.rol === 'ventas';
            const stamp = clock().toISOString();
            const cartRef = ref(`carritos/${uid}`);
            const requireAdmin = () => { if (!admin) fail('permission-denied', 'Solo administración puede realizar esta operación.'); };
            async function priced(raw) {
                const normalized = items(raw, true);
                const rows = [];
                for (const item of normalized) {
                    const product = (await tx.get(ref(`scm_productos/${item.id}`))).data();
                    if (!product || product.activo === false) fail('failed-precondition', 'Un producto ya no está disponible.');
                    if (!Number.isInteger(product.stock_actual) || product.stock_actual < item.quantity) fail('failed-precondition', `Stock insuficiente para ${product.nombre}.`);
                    rows.push({ ...item, name: String(product.nombre || 'Equipo'), category: String(product.categoria || ''), priceCents: cents(product.precio_venta ?? product.precio ?? product.costo_unitario), stock: product.stock_actual });
                }
                return rows;
            }
            async function client() {
                const matches = await tx.get(db.collection('clientes').where('correo', '==', email).limit(1));
                return matches.empty ? { id: `auth_${uid}`, create: true } : { id: matches.docs[0].id, create: false, data: matches.docs[0].data() };
            }
            function recordReceipt(order, recipient) {
                const { receipt, notification } = receiptRecords(order, recipient, stamp);
                tx.set(ref(`notificaciones/${notification.id}`), notification);
                const { cuerpoTexto, ...summary } = notification;
                return { ...order, comprador_email: recipient, comprobante: receipt, correo_comprobante: summary };
            }
            async function buyerEmail(order) {
                if (order.comprador_email) return order.comprador_email;
                if (order.usuario_id === uid) return email;
                const buyer = (await tx.get(ref(`usuarios/${order.usuario_id}`))).data();
                if (!buyer || buyer.auth_uid !== order.usuario_id) fail('failed-precondition', 'El comprador no tiene un perfil vinculado para generar el comprobante.');
                return buyer.email;
            }
            async function ensureReceipt(order) {
                if (!order || order.origen !== 'checkout') return order;
                if (order.comprobante?.estado === order.estado && order.correo_comprobante?.estado === 'envio_simulado') return order;
                const recipient = await buyerEmail(order);
                const next = recordReceipt(order, recipient);
                tx.set(ref(`erp_ordenes/${order.id}`), next); return next;
            }
            const action = input.action;
            if (action === 'orderLookup') return ensureReceipt((await tx.get(ref(`erp_ordenes/web_${hash([uid, key(input.key)]).slice(0, 40)}`))).data() || null);
            if (action === 'receiptGet') {
                const id = text(input.id, 64);
                if (!/^web_[a-f0-9]{40}$/.test(id)) fail('invalid-argument', 'Pedido inválido.');
                const order = (await tx.get(ref(`erp_ordenes/${id}`))).data();
                if (!order || (!staff && order.usuario_id !== uid)) fail('permission-denied', 'No puedes consultar ese comprobante.');
                return ensureReceipt(order);
            }
            if (action === 'cartGet') return (await tx.get(cartRef)).data() || { items: [], revision: 0 };
            if (action === 'walletEnsure') {
                const walletRef = ref(`monederos/${uid}`), snapshot = await tx.get(walletRef);
                if (snapshot.exists) return snapshot.data();
                const data = { saldoCents: 0, actualizado: stamp };
                tx.set(walletRef, data); return data;
            }
            if (action === 'cartSave' || action === 'cartMerge') {
                const cart = (await tx.get(cartRef)).data() || { items: [], revision: 0 };
                let migrationRef;
                if (action === 'cartMerge') {
                    migrationRef = ref(`carritos/${uid}/migraciones/${key(input.key)}`);
                    if ((await tx.get(migrationRef)).exists) return cart;
                } else if (input.revision !== cart.revision) fail('aborted', 'El carrito cambió en otra ventana. Recárgalo antes de guardar.');
                const raw = action === 'cartMerge' ? [...cart.items.map(row => ({ id: row.id, quantity: row.quantity })), ...items(input.items, true)] : input.items;
                const rows = await priced(raw);
                const next = { items: rows, revision: cart.revision + 1, actualizado: stamp };
                tx.set(cartRef, next);
                if (migrationRef) tx.set(migrationRef, { fecha: stamp });
                return next;
            }
            if (action === 'transferConfirm') {
                if (!staff) fail('permission-denied', 'Solo administración o ventas puede confirmar transferencias.');
                const orderId = text(input.id, 64);
                if (!/^web_[a-f0-9]{40}$/.test(orderId)) fail('invalid-argument', 'Pedido inválido.');
                const orderRef = ref(`erp_ordenes/${orderId}`), order = (await tx.get(orderRef)).data();
                if (!order || order.metodo_pago !== 'transfer') fail('not-found', 'Transferencia no encontrada.');
                if (order.estado === 'procesada') return ensureReceipt(order);
                if (order.estado !== 'pendiente_pago') fail('failed-precondition', 'El pedido no está pendiente de pago.');
                const rows = [];
                for (const line of order.productos) {
                    const product = (await tx.get(ref(`scm_productos/${line.producto_id}`))).data();
                    if (!product || product.activo === false || !Number.isInteger(product.stock_actual) || product.stock_actual < line.cantidad) fail('failed-precondition', 'Stock insuficiente para confirmar la transferencia.');
                    rows.push({ id: line.producto_id, stock: product.stock_actual, quantity: line.cantidad });
                }
                const promo = order.promocion ? (await tx.get(ref(`promociones/${order.promocion}`))).data() : null;
                if (order.promocion) totals(order.productos.map(line => ({ id: line.producto_id, quantity: line.cantidad, priceCents: cents(line.precio_unitario), category: line.categoria || '' })), { ivaBps: order.ivaBps }, promo || { activa: false }, clock());
                const recipient = await buyerEmail(order);
                const customer = (await tx.get(ref(`clientes/${order.cliente_id}`))).data();
                if (!customer) fail('failed-precondition', 'El cliente CRM del pedido ya no existe.');
                const next = recordReceipt({ ...order, estado: 'procesada', fecha_procesamiento: stamp, usuario_procesa_id: uid }, recipient);
                for (const row of rows) {
                    tx.update(ref(`scm_productos/${row.id}`), { stock_actual: row.stock - row.quantity, ultimo_erp_orden_id: orderId });
                    tx.set(ref(`scm_movimientos/${orderId}_${row.id}`), { producto_id: row.id, cantidad: row.quantity, tipo: 'salida', motivo: 'venta', origen: 'checkout', erp_orden_id: orderId, fecha: stamp });
                }
                tx.set(orderRef, next);
                tx.update(ref(`clientes/${order.cliente_id}`), { ultima_compra: stamp, ultimo_pedido_id: orderId, ...(!customer.etapa_crm || customer.etapa_crm === 'Prospecto' ? { etapa_crm: 'Activo' } : {}) });
                tx.update(ref(`pagos/${orderId}`), { estado: 'aprobado_simulado', confirmado_por: uid, fecha_confirmacion: stamp });
                tx.set(ref(`erp_procesos/${orderId}`), { orden_id: orderId, usuario_id: uid, tipo: 'venta', estado: 'completado', cliente_id: order.cliente_id, fecha_inicio: stamp, fecha_fin: stamp, total: order.total,
                    unidades_vendidas: rows.reduce((n, row) => n + row.quantity, 0), movimientos: rows.map(row => ({ producto_id: row.id, cantidad: row.quantity, tipo: 'salida', motivo: 'venta' })), reposiciones_push: [] });
                tx.set(ref(`erp_reportes/${orderId}`), { orden_id: orderId, tipo: 'orden_procesada', cliente_id: order.cliente_id, fecha: stamp, ventas: order.total, unidades_vendidas: rows.reduce((n, row) => n + row.quantity, 0) });
                if (order.promocion) tx.update(ref(`promociones/${order.promocion}`), { usos: (promo.usos || 0) + 1 });
                return next;
            }
            if (action === 'quote' || action === 'checkout') {
                const orderId = action === 'checkout' ? `web_${hash([uid, key(input.key)]).slice(0, 40)}` : null;
                const fingerprint = hash([input.delivery || null, input.method || null, input.promo || '', input.quoteToken || '']);
                if (orderId) {
                    const existing = (await tx.get(ref(`erp_ordenes/${orderId}`))).data();
                    if (existing) {
                        if (existing.solicitud_hash !== fingerprint) fail('already-exists', 'Este identificador ya pertenece a otra compra.');
                        return ensureReceipt(existing);
                    }
                }
                const cart = (await tx.get(cartRef)).data() || { items: [], revision: 0 };
                if (!cart.items.length) fail('failed-precondition', 'Tu carrito está vacío.');
                const rows = await priced(cart.items);
                const config = (await tx.get(ref('configuracion/comercio'))).data() || { ivaBps: 1600 };
                const code = String(input.promo || '').trim().toUpperCase();
                if (code && !/^[A-Z0-9_-]{1,40}$/.test(code)) fail('invalid-argument', 'Código promocional inválido.');
                const promo = code ? (await tx.get(ref(`promociones/${code}`))).data() : null;
                if (code && !promo) fail('failed-precondition', 'La promoción no existe.');
                const amounts = totals(rows, config, promo, clock());
                const quoteToken = hash([cart.revision, rows.map(({ stock, ...row }) => row), amounts, code]);
                if (action === 'quote') return { ...amounts, impuestoNombre: config.nombre || 'IVA', items: rows, revision: cart.revision, quoteToken };
                if (input.quoteToken !== quoteToken) fail('aborted', 'Cambió el carrito, precio o configuración. Revisa de nuevo el total.');
                const shipping = delivery(input.delivery);
                if (!['card', 'transfer', 'ewallet'].includes(input.method)) fail('invalid-argument', 'Método de pago inválido.');
                // Card numbers and CVV are never accepted, persisted or logged.
                const allowed = ['action', 'key', 'method', 'delivery', 'promo', 'quoteToken'];
                if (Object.keys(input).some(field => !allowed.includes(field))) fail('invalid-argument', 'La solicitud contiene campos no permitidos.');
                const walletRef = ref(`monederos/${uid}`);
                const wallet = (await tx.get(walletRef)).data() || { saldoCents: 0 };
                integer(wallet.saldoCents, 0, 10000000000, 'Saldo del monedero');
                if (input.method === 'ewallet' && wallet.saldoCents < amounts.totalCents) fail('failed-precondition', 'Saldo insuficiente en el monedero.');
                const customer = await client();
                const order = { id: orderId, folio: `RS-${orderId.slice(4).toUpperCase()}`, usuario_id: uid, cliente_id: customer.id, comprador_email: email, comprador_nombre: profile.nombre || shipping.name,
                    fecha: stamp, fecha_procesamiento: stamp, usuario_procesa_id: uid, estado: 'procesada', origen: 'checkout', simulado: true,
                    ...amounts, impuestoNombre: config.nombre || 'IVA', total: amounts.totalCents / 100, entrega: shipping, metodo_pago: input.method, pago_id: orderId, promocion: code,
                    productos: rows.map(row => ({ producto_id: row.id, nombre: row.name, categoria: row.category, cantidad: row.quantity, precio_unitario: row.priceCents / 100, subtotal: row.priceCents * row.quantity / 100 })), solicitud_hash: fingerprint };
                // All reads above, all writes below: these effects commit or roll back together.
                if (customer.create) tx.set(ref(`clientes/${customer.id}`), { nombre: profile.nombre || shipping.name, correo: email, estado: 'activo', etapa_crm: input.method === 'transfer' ? 'Prospecto' : 'Activo', auth_uid: uid, fecha_registro: stamp });
                if (input.method === 'transfer') {
                    const pending = recordReceipt({ ...order, estado: 'pendiente_pago', fecha_procesamiento: null }, email);
                    tx.set(ref(`erp_ordenes/${orderId}`), pending);
                    tx.set(ref(`pagos/${orderId}`), { usuario_id: uid, orden_id: orderId, importeCents: amounts.totalCents, metodo: 'transfer', estado: 'pendiente_confirmacion', simulado: true, fecha: stamp });
                    tx.set(cartRef, { items: [], revision: cart.revision + 1, actualizado: stamp });
                    return pending;
                }
                const confirmed = recordReceipt(order, email);
                tx.set(ref(`clientes/${customer.id}`), { ultima_compra: stamp, ultimo_pedido_id: orderId, ...(!customer.data?.etapa_crm || customer.data.etapa_crm === 'Prospecto' ? { etapa_crm: 'Activo' } : {}) }, { merge: true });
                for (const row of rows) {
                    tx.update(ref(`scm_productos/${row.id}`), { stock_actual: row.stock - row.quantity, ultimo_erp_orden_id: orderId });
                    tx.set(ref(`scm_movimientos/${orderId}_${row.id}`), { producto_id: row.id, cantidad: row.quantity, tipo: 'salida', motivo: 'venta', origen: 'checkout', erp_orden_id: orderId, fecha: stamp });
                }
                if (input.method === 'ewallet') {
                    tx.set(walletRef, { saldoCents: wallet.saldoCents - amounts.totalCents, actualizado: stamp });
                    tx.set(ref(`monederos/${uid}/movimientos/${orderId}`), { importeCents: -amounts.totalCents, saldoCents: wallet.saldoCents - amounts.totalCents, tipo: 'compra', orden_id: orderId, actor_id: uid, motivo: `Compra ${order.folio}`, fecha: stamp, simulado: true });
                }
                if (code) tx.update(ref(`promociones/${code}`), { usos: (promo.usos || 0) + 1 });
                tx.set(ref(`erp_ordenes/${orderId}`), confirmed);
                tx.set(ref(`pagos/${orderId}`), { usuario_id: uid, orden_id: orderId, importeCents: amounts.totalCents, metodo: input.method, estado: 'aprobado_simulado', simulado: true, fecha: stamp });
                tx.set(ref(`erp_procesos/${orderId}`), { orden_id: orderId, usuario_id: uid, tipo: 'venta', estado: 'completado', cliente_id: customer.id, fecha_inicio: stamp, fecha_fin: stamp, total: order.total,
                    unidades_vendidas: rows.reduce((n, row) => n + row.quantity, 0), movimientos: rows.map(row => ({ producto_id: row.id, cantidad: row.quantity, tipo: 'salida', motivo: 'venta' })), reposiciones_push: [] });
                tx.set(ref(`erp_reportes/${orderId}`), { orden_id: orderId, tipo: 'orden_procesada', cliente_id: customer.id, fecha: stamp, ventas: order.total, unidades_vendidas: rows.reduce((n, row) => n + row.quantity, 0) });
                tx.set(cartRef, { items: [], revision: cart.revision + 1, actualizado: stamp });
                return confirmed;
            }
            if (action === 'walletTopup' || action === 'walletAdjust') {
                if (action === 'walletAdjust') requireAdmin();
                const target = action === 'walletAdjust' ? text(input.uid, 128) : uid;
                if (target.includes('/')) fail('invalid-argument', 'Cuenta inválida.');
                const amount = integer(input.amountCents, action === 'walletAdjust' ? -1000000 : 1, 1000000, 'Importe de recarga');
                if (!amount) fail('invalid-argument', 'El ajuste no puede ser cero.');
                const reason = text(action === 'walletAdjust' ? input.reason : (input.reason || 'Recarga simulada'), 250);
                const walletRef = ref(`monederos/${target}`), movementRef = ref(`monederos/${target}/movimientos/${hash([uid, key(input.key)])}`);
                const movement = await tx.get(movementRef);
                if (movement.exists) {
                    if (movement.data().importeCents !== amount) fail('already-exists', 'Identificador de recarga ya utilizado.');
                    return movement.data();
                }
                const targetUser = (await tx.get(ref(`usuarios/${target}`))).data();
                if (!targetUser || targetUser.auth_uid !== target) fail('not-found', 'La cuenta no existe.');
                const wallet = (await tx.get(walletRef)).data() || { saldoCents: 0 };
                const balance = integer(integer(wallet.saldoCents, 0, 10000000000, 'Saldo del monedero') + amount, 0, 10000000000, 'Saldo resultante');
                const row = { importeCents: amount, saldoCents: balance, tipo: action, motivo: reason, actor_id: uid, fecha: stamp, simulado: true };
                tx.set(walletRef, { saldoCents: balance, actualizado: stamp }); tx.set(movementRef, row);
                return row;
            }
            if (action === 'promotionSave') {
                requireAdmin();
                const code = text(input.code, 40).toUpperCase();
                if (!/^[A-Z0-9_-]+$/.test(code)) fail('invalid-argument', 'Código inválido.');
                const old = (await tx.get(ref(`promociones/${code}`))).data();
                const p = input.promotion || {};
                const from = Date.parse(p.inicio), to = Date.parse(p.fin);
                if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) fail('invalid-argument', 'Vigencia inválida.');
                const record = { nombre: text(p.nombre, 120), activa: p.activa === true, inicio: new Date(from).toISOString(), fin: new Date(to).toISOString(),
                    descuentoBps: integer(p.descuentoBps, 1, 10000, 'Descuento'), minimoCents: integer(p.minimoCents ?? 0, 0, 10000000000, 'Mínimo'),
                    maximoCents: integer(p.maximoCents ?? 0, 0, 10000000000, 'Máximo'), limiteUsos: integer(p.limiteUsos ?? 0, 0, 1000000, 'Límite de usos'),
                    categoria: String(p.categoria || '').slice(0, 80), productoId: String(p.productoId || '').slice(0, 128), usos: old?.usos || 0, actualizado_por: uid, actualizado: stamp };
                tx.set(ref(`promociones/${code}`), record); return record;
            }
            if (action === 'taxSave') {
                requireAdmin(); const ivaBps = integer(input.ivaBps, 0, 10000, 'IVA');
                const data = { ivaBps, nombre: text(input.name || 'IVA', 50), activo: input.active !== false, preciosIncluyenIva: false, actualizado: stamp, actualizado_por: uid };
                tx.set(ref('configuracion/comercio'), data); return data;
            }
            if (action === 'ticketCreate') {
                const ticketId = hash([uid, key(input.key)]), ticketRef = ref(`tickets/${ticketId}`);
                const old = await tx.get(ticketRef); if (old.exists) return old.data();
                if (input.orderId) {
                    const order = (await tx.get(ref(`erp_ordenes/${text(input.orderId, 64)}`))).data();
                    if (!order || order.usuario_id !== uid) fail('permission-denied', 'No puedes vincular ese pedido.');
                }
                const customer = await client();
                const ticket = { id: ticketId, usuario_id: uid, cliente_id: customer.id, orden_id: input.orderId || '', asunto: text(input.subject, 120), estado: 'abierto', fecha: stamp,
                    respuestas: [{ autor_id: uid, nombre: profile.nombre || email, mensaje: text(input.message), fecha: stamp }] };
                if (customer.create) tx.set(ref(`clientes/${customer.id}`), { correo: email, nombre: profile.nombre || email, auth_uid: uid, estado: 'activo', etapa_crm: 'Prospecto', fecha_registro: stamp });
                tx.set(ticketRef, ticket); return ticket;
            }
            if (action === 'ticketReply') {
                const ticketRef = ref(`tickets/${text(input.id, 64)}`), ticket = (await tx.get(ticketRef)).data();
                if (!ticket || (!staff && ticket.usuario_id !== uid)) fail('permission-denied', 'No puedes acceder a este ticket.');
                const replyKey = key(input.key);
                if (ticket.respuestas.some(row => row.key === replyKey && row.autor_id === uid)) return ticket;
                if (ticket.respuestas.length >= 100) fail('resource-exhausted', 'Este ticket alcanzó el máximo de respuestas.');
                if (input.status && (!staff || !['abierto', 'en_proceso', 'respondido', 'cerrado', 'resuelto'].includes(input.status))) fail('permission-denied', 'Estado no permitido.');
                const next = { ...ticket, estado: input.status || (staff ? 'en_proceso' : 'abierto'), actualizado: stamp,
                    respuestas: [...ticket.respuestas, { key: replyKey, autor_id: uid, nombre: profile.nombre || email, mensaje: text(input.message), fecha: stamp }] };
                tx.set(ticketRef, next); return next;
            }
            if (action === 'profileSave') {
                const data = { nombre: text(input.name, 120), telefono: String(input.phone || '').slice(0, 30), direccion: delivery(input.delivery), actualizado: stamp };
                const customer = await client();
                tx.update(ref(`usuarios/${uid}`), data);
                tx.set(ref(`clientes/${customer.id}`), { nombre: data.nombre, correo: email, telefono: data.telefono, auth_uid: uid, ...(customer.create ? { estado: 'activo', etapa_crm: 'Prospecto', fecha_registro: stamp } : {}) }, { merge: true });
                return data;
            }
            fail('invalid-argument', 'Operación de comercio desconocida.');
        });
    };
}
module.exports = { createCommerce };
