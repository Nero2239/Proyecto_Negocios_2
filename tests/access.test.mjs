import { runInThisContext } from 'node:vm';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const source = await readFile(new URL('../js/access.js', import.meta.url), 'utf8');
runInThisContext(source);
const { normalizeRole, allowedViews, roleHome, profileLinks } = globalThis.RutaSalvajeAccess;

test('admin can open user management, CRM, SCM and ERP', () => {
    const links = profileLinks('admin');
    for (const view of ['usuarios', 'crm', 'scm-dashboard', 'erp']) assert(links.some(link => link.view === view));
    assert.equal(roleHome('admin'), 'dashboard');
});

test('sales links are limited to permitted views', () => {
    const links = profileLinks('ventas');
    assert.equal(roleHome('ventas'), 'crm');
    assert(links.some(link => link.view === 'erp'));
    assert(!allowedViews('ventas').has('usuarios'));
    assert(!allowedViews('ventas').has('scm-dashboard'));
    assert(links.every(link => allowedViews('ventas').has(new URL(link.href, 'https://example.test').searchParams.get('view'))));
});

test('logistics has SCM and ERP without CRM or user management', () => {
    assert.equal(roleHome('logistica'), 'scm-dashboard');
    assert(profileLinks('logistica').some(link => link.view === 'erp'));
    assert(!allowedViews('logistica').has('crm'));
    assert(!allowedViews('logistica').has('usuarios'));
});

test('ordinary and unrecognized roles never receive business access', () => {
    for (const role of ['usuario', 'user', '', null, 'manager', 'constructor', '__proto__']) {
        assert.equal(normalizeRole(role), 'usuario');
        assert.equal(roleHome(role), null);
        assert.equal(allowedViews(role).size, 0);
        assert.deepEqual(profileLinks(role), []);
    }
});

test('role casing is normalized without granting privileges to similar names', () => {
    assert.equal(normalizeRole(' ADMIN '), 'admin');
    assert.equal(normalizeRole('administrador'), 'usuario');
    assert.equal(normalizeRole('ventas-extra'), 'usuario');
});
