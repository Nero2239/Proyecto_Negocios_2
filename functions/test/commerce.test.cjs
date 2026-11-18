const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCommerce } = require('../commerce.cjs');
const { cents, totals } = require('../money.cjs');
const { memoryDb } = require('../../tests/support/memory-db.cjs');
function fixture() {
    const db = memoryDb(), now = new Date('2026-11-16T12:00:00Z');
    for (const role of ['usuario', 'admin', 'ventas', 'logistica']) db.records.set(`usuarios/${role}`, { auth_uid: role, email: `${role}@test.test`, rol: role, nombre: role });
    db.records.set('scm_productos/p1', { nombre: 'Tienda', precio_venta: 100.05, stock_actual: 10, categoria: 'tiendas' });
    const exec = createCommerce(db, () => now);
    const auth = role => ({ uid: role, token: { email: `${role}@test.test`, email_verified: true } });
    return { db, call: (action, data = {}, role = 'usuario') => exec(auth(role), { action, ...data }), exec, auth, now };
}
async function cart(f) { await f.call('cartSave', { items: [{ id: 'p1', quantity: 2 }], revision: 0 }); return f.call('quote'); }
const shipping = { name: 'Ana Ejemplo', address: 'Bosque 123', city: 'Puebla', zipCode: '72000' };
test('money uses integer cents and rounds discount and IVA independently', () => {
    assert.equal(cents('1.005'), 101);
    assert.deepEqual(totals([{ priceCents: 10005, quantity: 2 }]), { subtotalCents: 20010, descuentoCents: 0, ivaBps: 1600, ivaCents: 3202, totalCents: 23212 });
});
test('cart is persisted, guest merge is idempotent, stale revisions cannot overwrite it', async () => {
    const f = fixture(); const input = { items: [{ id: 'p1', quantity: 1 }], key: 'migration-0001' };
    await f.call('cartMerge', input); await f.call('cartMerge', input);
    assert.equal((await f.call('cartGet')).items[0].quantity, 1);
    await assert.rejects(f.call('cartSave', { items: [], revision: 0 }), { code: 'aborted' });
});
test('complete wallet purchase commits order, payment, CRM, SCM, ERP and balance exactly once', async () => {
    const f = fixture(), quote = await cart(f);
    await f.call('walletTopup', { amountCents: 50000, key: 'topup-0001' });
    const request = { quoteToken: quote.quoteToken, key: 'checkout-0001', method: 'ewallet', delivery: shipping };
    const [a, b] = await Promise.all([f.call('checkout', request), f.call('checkout', request)]);
    assert.equal(a.id, b.id); assert.equal(a.totalCents, 23212);
    assert.equal(f.db.records.get('scm_productos/p1').stock_actual, 8);
    assert.equal(f.db.records.get('monederos/usuario').saldoCents, 26788);
    for (const name of ['erp_ordenes', 'pagos', 'erp_reportes', 'erp_procesos']) assert(f.db.records.has(`${name}/${a.id}`));
    assert.equal((await f.call('cartGet')).items.length, 0);
});
test('insufficient funds or stock preserve the cart and create no order', async () => {
    const f = fixture(), quote = await cart(f), request = { quoteToken: quote.quoteToken, key: 'checkout-0002', method: 'ewallet', delivery: shipping };
    await assert.rejects(f.call('checkout', request), /Saldo insuficiente/);
    f.db.records.get('scm_productos/p1').stock_actual = 1;
    await assert.rejects(f.call('checkout', { ...request, method: 'card' }), /Stock insuficiente/);
    assert.equal((await f.call('cartGet')).items[0].quantity, 2);
    assert.equal([...f.db.records.keys()].filter(key => key.startsWith('erp_ordenes/')).length, 0);
});
test('new price or IVA invalidates an already displayed quote', async () => {
    const f = fixture(), quote = await cart(f);
    await f.call('taxSave', { ivaBps: 800 }, 'admin');
    await assert.rejects(f.call('checkout', { key: 'checkout-0003', method: 'transfer', delivery: shipping, quoteToken: quote.quoteToken }), { code: 'aborted' });
    assert.equal((await f.call('quote')).ivaBps, 800);
});
test('promotions enforce validity, category, minimum, limits and rounded totals', async () => {
    const f = fixture(); await cart(f);
    const p = { nombre: 'Oferta real', inicio: '2026-11-01', fin: '2026-12-01', activa: true, descuentoBps: 1000, minimoCents: 10000, categoria: 'tiendas', limiteUsos: 1 };
    await f.call('promotionSave', { code: 'CAMPING', promotion: p }, 'admin');
    const quote = await f.call('quote', { promo: 'CAMPING' });
    assert.equal(quote.descuentoCents, 2001); assert.equal(quote.ivaCents, 2881); assert.equal(quote.totalCents, 20890);
    await f.call('checkout', { key: 'promo-checkout', method: 'card', delivery: shipping, promo: 'CAMPING', quoteToken: quote.quoteToken });
    await f.call('cartSave', { items: [{ id: 'p1', quantity: 2 }], revision: 2 });
    await assert.rejects(f.call('quote', { promo: 'CAMPING' }), /agotó/);
    await f.call('promotionSave', { code: 'CAMPING', promotion: { ...p, fin: '2026-11-02' } }, 'admin');
    await assert.rejects(f.call('quote', { promo: 'CAMPING' }), /vigente/);
});
test('admin wallet adjustments and repeated topups are audited and role protected', async () => {
    const f = fixture(); await f.call('walletTopup', { amountCents: 10000, key: 'topup-repeat' });
    await f.call('walletTopup', { amountCents: 10000, key: 'topup-repeat' });
    assert.equal(f.db.records.get('monederos/usuario').saldoCents, 10000);
    for (const role of ['usuario', 'ventas', 'logistica']) {
        await assert.rejects(f.call('walletAdjust', { uid: 'usuario', amountCents: 1, key: 'admin-adjust' }, role), { code: 'permission-denied' });
        await assert.rejects(f.call('taxSave', { ivaBps: 0 }, role), { code: 'permission-denied' });
    }
    await f.call('walletAdjust', { uid: 'usuario', amountCents: -100, key: 'admin-adjust', reason: 'Corrección de prueba' }, 'admin');
    assert.equal(f.db.records.get('monederos/usuario').saldoCents, 9900);
});
test('tickets reuse the CRM client, preserve responses and allow only owner/admin/sales', async () => {
    const f = fixture(); f.db.records.set('clientes/existing', { correo: 'usuario@test.test', nombre: 'Ana' });
    const ticket = await f.call('ticketCreate', { key: 'ticket-0001', subject: 'Mi pedido', message: '¿Cuál es su estado?' });
    assert.equal(ticket.cliente_id, 'existing');
    const request = { id: ticket.id, key: 'reply-0001', message: 'Estamos revisando.', status: 'resuelto' };
    await assert.rejects(f.call('ticketReply', request, 'logistica'), { code: 'permission-denied' });
    await assert.rejects(f.call('ticketReply', request), { code: 'permission-denied' });
    const reply = await f.call('ticketReply', request, 'ventas');
    assert.equal(reply.estado, 'resuelto'); assert.equal(reply.respuestas.length, 2);
    assert.equal((await f.call('ticketReply', request, 'ventas')).respuestas.length, 2);
});
test('verified identity, shipping and sensitive card fields are validated on backend', async () => {
    const f = fixture(), quote = await cart(f);
    await assert.rejects(f.exec({ uid: 'usuario', token: { email_verified: false } }, { action: 'cartGet' }), { code: 'unauthenticated' });
    const request = { quoteToken: quote.quoteToken, key: 'bad-shipping-1', method: 'card', delivery: { ...shipping, zipCode: 'x' } };
    await assert.rejects(f.call('checkout', request), { code: 'invalid-argument' });
    await assert.rejects(f.call('checkout', { ...request, delivery: shipping, cardNumber: 'sensitive' }), { code: 'invalid-argument' });
    assert.equal((await f.call('cartGet')).items.length, 1);
});
test('personal details update existing CRM without changing role', async () => {
    const f = fixture(); f.db.records.set('clientes/existing', { correo: 'usuario@test.test', empresa: 'Camping' });
    await f.call('profileSave', { name: 'Ana Ejemplo', phone: '2221234567', delivery: shipping, rol: 'admin' });
    assert.equal(f.db.records.get('usuarios/usuario').rol, 'usuario');
    assert.equal(f.db.records.get('clientes/existing').nombre, 'Ana Ejemplo');
    assert.equal(f.db.records.get('clientes/existing').empresa, 'Camping');
});
