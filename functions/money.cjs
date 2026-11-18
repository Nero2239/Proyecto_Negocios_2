'use strict';
class CommerceError extends Error {
    constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, message) => { throw new CommerceError(code, message); };
function cents(value) {
    const match = /^(\d{1,8})(?:\.(\d{1,4}))?$/.exec(String(value));
    if (!match) fail('invalid-argument', 'Importe monetario inválido.');
    const fraction = (match[2] || '').padEnd(3, '0');
    return Number(match[1]) * 100 + Number(fraction.slice(0, 2)) + (Number(fraction[2]) >= 5 ? 1 : 0);
}
function integer(value, min, max, label) {
    if (!Number.isSafeInteger(value) || value < min || value > max) fail('invalid-argument', `${label} inválido.`);
    return value;
}
function items(value, allowEmpty = false) {
    if (!Array.isArray(value) || value.length > 50 || (!allowEmpty && !value.length)) fail('invalid-argument', 'El carrito debe contener entre 1 y 50 productos.');
    const map = new Map();
    for (const row of value) {
        const id = String(row?.id || '');
        if (!/^[\w-]{1,128}$/.test(id)) fail('invalid-argument', 'Producto inválido.');
        const quantity = integer(row.quantity, 1, 99, 'Cantidad');
        map.set(id, integer((map.get(id) || 0) + quantity, 1, 99, 'Cantidad'));
    }
    return [...map].sort(([a], [b]) => a.localeCompare(b)).map(([id, quantity]) => ({ id, quantity }));
}
function totals(lines, config = {}, promo = null, now = new Date()) {
    const subtotal = lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0);
    integer(subtotal, 0, 10000000000, 'Subtotal');
    const ivaBps = integer(config.activo === false ? 0 : config.ivaBps ?? 1600, 0, 10000, 'IVA');
    let discount = 0;
    if (promo) {
        const from = Date.parse(promo.inicio), to = Date.parse(promo.fin);
        if (!promo.activa || !Number.isFinite(from) || !Number.isFinite(to) || now.getTime() < from || now.getTime() > to) fail('failed-precondition', 'La promoción no está vigente.');
        if (subtotal < integer(promo.minimoCents ?? 0, 0, 10000000000, 'Compra mínima')) fail('failed-precondition', 'No se cumple la compra mínima de la promoción.');
        if (promo.limiteUsos && (promo.usos || 0) >= promo.limiteUsos) fail('failed-precondition', 'La promoción agotó sus usos.');
        const eligible = lines.filter(line => (!promo.categoria || line.category === promo.categoria) && (!promo.productoId || line.id === promo.productoId));
        const base = eligible.reduce((sum, line) => sum + line.priceCents * line.quantity, 0);
        if (!base) fail('failed-precondition', 'La promoción no aplica a estos productos.');
        discount = Math.floor((base * integer(promo.descuentoBps, 1, 10000, 'Descuento') + 5000) / 10000);
        if (promo.maximoCents) discount = Math.min(discount, integer(promo.maximoCents, 1, 10000000000, 'Descuento máximo'));
    }
    const tax = Math.floor(((subtotal - discount) * ivaBps + 5000) / 10000);
    return { subtotalCents: subtotal, descuentoCents: discount, ivaBps, ivaCents: tax, totalCents: subtotal - discount + tax };
}
function delivery(input) {
    const result = {};
    for (const [key, min, max] of [['name', 3, 120], ['address', 5, 250], ['city', 2, 100], ['zipCode', 5, 5]]) {
        const value = String(input?.[key] || '').trim();
        if (value.length < min || value.length > max || (key === 'zipCode' && !/^\d{5}$/.test(value))) fail('invalid-argument', 'Revisa nombre, dirección, ciudad y código postal de 5 dígitos.');
        result[key] = value;
    }
    return result;
}
module.exports = { CommerceError, fail, cents, integer, items, totals, delivery };
