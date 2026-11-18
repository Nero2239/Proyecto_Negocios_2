const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const sdk = require('firebase/firestore');
const functionsRequire = require('node:module').createRequire(require('node:path').resolve('functions/package.json'));
const { initializeApp, deleteApp } = functionsRequire('firebase-admin/app');
const { getFirestore } = functionsRequire('firebase-admin/firestore');
const { createCommerce } = require('../functions/commerce.cjs');
if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw new Error('Solo se permiten pruebas en el emulador local.');
let env, app, db, execute;
const projectId = 'demo-ruta-etapa4';
const auth = uid => ({ uid, token: { email: `${uid}@test.test`, email_verified: true } });
const call = (uid, action, data = {}) => execute(auth(uid), { action, ...data });
const shipping = { name: 'Ana Ejemplo', address: 'Bosque 123', city: 'Puebla', zipCode: '72000' };
before(async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
    env = await initializeTestEnvironment({ projectId, firestore: { host, port: Number(port), rules: fs.readFileSync('firestore.rules', 'utf8') } });
    app = initializeApp({ projectId }, 'etapa4-test'); db = getFirestore(app); execute = createCommerce(db);
});
beforeEach(async () => {
    await env.clearFirestore();
    await Promise.all(['ana', 'bea', 'admin', 'ventas', 'logistica'].map(uid => db.doc(`usuarios/${uid}`).set({ uid, auth_uid: uid, email: `${uid}@test.test`, rol: ['ana', 'bea'].includes(uid) ? 'usuario' : uid })));
    await db.doc('scm_productos/p1').set({ nombre: 'Tienda', stock_actual: 5, precio_venta: 100, categoria: 'tiendas' });
});
after(async () => { await env.cleanup(); await db.terminate(); await deleteApp(app); });
async function quote(uid, quantity = 1, promo = '') {
    await call(uid, 'cartSave', { revision: 0, items: [{ id: 'p1', quantity }] });
    return call(uid, 'quote', { promo });
}
test('Firestore transaction completes a wallet order and persists every integration', async () => {
    await db.doc('clientes/actual').set({ correo: 'ana@test.test', nombre: 'Ana CRM' });
    await call('ana', 'walletTopup', { amountCents: 20000, key: 'topup-emulator' });
    const q = await quote('ana');
    const payload = { method: 'ewallet', quoteToken: q.quoteToken, key: 'purchase-emulator', delivery: shipping };
    const [a, b] = await Promise.all([call('ana', 'checkout', payload), call('ana', 'checkout', payload)]);
    assert.equal(a.id, b.id); assert.equal(a.cliente_id, 'actual'); assert.equal(a.ivaCents, 1600);
    assert.equal((await db.doc('monederos/ana').get()).data().saldoCents, 8400);
    assert.equal((await db.doc('scm_productos/p1').get()).data().stock_actual, 4);
    assert.equal((await db.collection('pagos').get()).size, 1);
    assert.equal((await db.collection('erp_reportes').get()).size, 1);
    assert.equal((await db.collection('scm_movimientos').get()).size, 1);
    assert.equal((await call('ana', 'orderLookup', { key: payload.key })).folio, a.folio);
});
test('two simultaneous buyers cannot sell the last unit twice', async () => {
    await db.doc('scm_productos/p1').update({ stock_actual: 1 });
    const a = await quote('ana'), b = await quote('bea');
    const results = await Promise.allSettled([
        call('ana', 'checkout', { method: 'card', quoteToken: a.quoteToken, key: 'ana-purchase', delivery: shipping }),
        call('bea', 'checkout', { method: 'card', quoteToken: b.quoteToken, key: 'bea-purchase', delivery: shipping })
    ]);
    assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
    assert.equal((await db.doc('scm_productos/p1').get()).data().stock_actual, 0);
    assert.equal((await db.collection('pagos').get()).size, 1);
});
test('transfer stays pending without stock or ERP report until authorized confirmation', async () => {
    const q = await quote('ana');
    const order = await call('ana', 'checkout', { method: 'transfer', quoteToken: q.quoteToken, key: 'transfer-purchase', delivery: shipping });
    assert.equal(order.estado, 'pendiente_pago');
    assert.equal((await db.doc('scm_productos/p1').get()).data().stock_actual, 5);
    assert.equal((await db.collection('erp_reportes').get()).size, 0);
    await assert.rejects(call('logistica', 'transferConfirm', { id: order.id }), { code: 'permission-denied' });
    await Promise.all([call('ventas', 'transferConfirm', { id: order.id }), call('admin', 'transferConfirm', { id: order.id })]);
    assert.equal((await db.doc('scm_productos/p1').get()).data().stock_actual, 4);
    assert.equal((await db.collection('erp_reportes').get()).size, 1);
    assert.equal((await db.doc(`pagos/${order.id}`).get()).data().estado, 'aprobado_simulado');
});
test('failed wallet purchase preserves cart, balance, inventory and absence of payment', async () => {
    const q = await quote('ana');
    await assert.rejects(call('ana', 'checkout', { method: 'ewallet', quoteToken: q.quoteToken, key: 'failed-purchase', delivery: shipping }), /Saldo insuficiente/);
    assert.equal((await call('ana', 'cartGet')).items.length, 1);
    assert.equal((await db.collection('pagos').get()).size, 0);
    assert.equal((await db.doc('scm_productos/p1').get()).data().stock_actual, 5);
});
test('expired promotion fails on the actual transaction backend', async () => {
    await call('admin', 'promotionSave', { code: 'VENCIDA', promotion: { nombre: 'Vencida', activa: true, inicio: '2020-01-01', fin: '2020-02-01', descuentoBps: 1000 } });
    await quote('ana');
    await assert.rejects(call('ana', 'quote', { promo: 'VENCIDA' }), /vigente/);
});
test('security rules isolate wallets, orders, carts, payments and tickets by account', async () => {
    const q = await quote('ana');
    const order = await call('ana', 'checkout', { method: 'card', quoteToken: q.quoteToken, key: 'rules-purchase', delivery: shipping });
    await call('ana', 'walletTopup', { amountCents: 100, key: 'rules-topup' });
    const ticket = await call('ana', 'ticketCreate', { key: 'rules-ticket', subject: 'Consulta', message: 'Mi pedido', orderId: order.id });
    const own = env.authenticatedContext('ana', auth('ana').token).firestore();
    const other = env.authenticatedContext('bea', auth('bea').token).firestore();
    for (const path of ['monederos/ana', 'carritos/ana', `pagos/${order.id}`, `erp_ordenes/${order.id}`, `tickets/${ticket.id}`]) {
        await assertSucceeds(sdk.getDoc(sdk.doc(own, path)));
        await assertFails(sdk.getDoc(sdk.doc(other, path)));
        if (!path.startsWith('erp_ordenes/')) await assertFails(sdk.setDoc(sdk.doc(own, path), { saldoCents: 9999999 }));
    }
    await assertSucceeds(sdk.getDocs(sdk.query(sdk.collection(own, 'erp_ordenes'), sdk.where('usuario_id', '==', 'ana'))));
    await assertFails(sdk.getDocs(sdk.collection(own, 'erp_ordenes')));
    await assertFails(sdk.updateDoc(sdk.doc(own, 'usuarios/ana'), { rol: 'admin' }));
    const admin = env.authenticatedContext('admin', auth('admin').token).firestore();
    await assertFails(sdk.updateDoc(sdk.doc(admin, 'monederos/ana'), { saldoCents: 99 }));
    await assertFails(sdk.updateDoc(sdk.doc(admin, `erp_ordenes/${order.id}`), { total: 0 }));
    const sales = env.authenticatedContext('ventas', auth('ventas').token).firestore();
    const logistics = env.authenticatedContext('logistica', auth('logistica').token).firestore();
    await assertSucceeds(sdk.getDoc(sdk.doc(sales, `tickets/${ticket.id}`)));
    await assertFails(sdk.getDoc(sdk.doc(logistics, `tickets/${ticket.id}`)));
});
test('ticket responses and profile edits persist and retain CRM linkage', async () => {
    const ticket = await call('ana', 'ticketCreate', { key: 'ticket-followup', subject: 'Consulta', message: 'Ayuda' });
    await call('ventas', 'ticketReply', { id: ticket.id, key: 'ticket-response', message: 'Respondido', status: 'respondido' });
    const saved = (await db.doc(`tickets/${ticket.id}`).get()).data();
    assert.equal(saved.respuestas.length, 2); assert.equal(saved.estado, 'respondido');
    await call('ana', 'profileSave', { name: 'Ana editada', phone: '2220000000', delivery: shipping });
    assert.equal((await db.doc(`clientes/${ticket.cliente_id}`).get()).data().nombre, 'Ana editada');
});
