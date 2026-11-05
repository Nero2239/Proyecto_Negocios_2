import { runInThisContext } from 'node:vm';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const source = await readFile(new URL('../js/live-sync.js', import.meta.url), 'utf8');
runInThisContext(source);
const { createRefreshQueue, watchChanges } = globalThis.RutaSalvajeLiveSync;
const tick = () => new Promise(resolve => setTimeout(resolve, 15));

function mockFirestore() {
    const subscriptions = new Set();
    return {
        subscriptions,
        onSnapshot(reference, next, error) {
            const subscription = { reference, next, error };
            subscriptions.add(subscription);
            return () => subscriptions.delete(subscription);
        },
        change(reference) {
            for (const subscription of subscriptions) {
                if (subscription.reference === reference) subscription.next();
            }
        }
    };
}

test('a change during a refresh waits for a fresh read without overlapping requests', async () => {
    let release;
    let calls = 0;
    let active = 0;
    const refresh = createRefreshQueue(async () => {
        assert.equal(++active, 1);
        if (++calls === 1) await new Promise(resolve => { release = resolve; });
        active--;
    });
    const first = refresh();
    await Promise.resolve();
    const second = refresh();
    assert.equal(first, second);
    release();
    await first;
    assert.equal(calls, 2);
});

test('a failed read can be retried after the connection recovers', async () => {
    let failed = false;
    const refresh = createRefreshQueue(async () => {
        if (!failed) { failed = true; throw new Error('offline'); }
    });
    await assert.rejects(refresh(), /offline/);
    await refresh();
});

test('a transaction refreshes all subscribed windows and coalesces its collection events', async () => {
    const backend = mockFirestore();
    const calls = { admin: 0, ventas: 0, logistica: 0, usuario: 0 };
    const stops = Object.keys(calls).map(role => watchChanges({
        onSnapshot: backend.onSnapshot,
        references: role === 'usuario' ? ['usuarios/own'] : ['scm_productos', 'erp_ordenes', 'scm_movimientos'],
        refresh: async () => { calls[role]++; },
        delay: 0
    }));
    backend.change('scm_productos');
    backend.change('erp_ordenes');
    backend.change('scm_movimientos');
    await tick();
    assert.deepEqual(calls, { admin: 1, ventas: 1, logistica: 1, usuario: 0 });
    backend.change('usuarios/own');
    await tick();
    assert.equal(calls.usuario, 1);
    stops.forEach(stop => stop());
    assert.equal(backend.subscriptions.size, 0);
});

test('closing a window cancels scheduled work and detaches its listeners', async () => {
    const backend = mockFirestore();
    let calls = 0;
    const stop = watchChanges({ onSnapshot: backend.onSnapshot, references: ['clientes'], refresh: async () => { calls++; }, delay: 0 });
    backend.change('clientes');
    stop();
    await tick();
    assert.equal(calls, 0);
    assert.equal(backend.subscriptions.size, 0);
});

test('permission failures and refresh failures reach the error handler', async () => {
    const backend = mockFirestore();
    const errors = [];
    const stop = watchChanges({
        onSnapshot: backend.onSnapshot, references: ['usuarios'], delay: 0,
        refresh: async () => { throw new Error('read failed'); },
        onError: error => errors.push(error.message)
    });
    [...backend.subscriptions][0].error(new Error('permission denied'));
    backend.change('usuarios');
    await tick();
    assert.deepEqual(errors, ['permission denied', 'read failed']);
    stop();
});

test('returning through browser history reattaches listeners once', async () => {
    const events = new EventTarget();
    globalThis.addEventListener = events.addEventListener.bind(events);
    globalThis.removeEventListener = events.removeEventListener.bind(events);
    const backend = mockFirestore();
    const stop = watchChanges({ onSnapshot: backend.onSnapshot, references: ['clientes'], refresh: async () => {}, delay: 0 });
    events.dispatchEvent(new Event('pagehide'));
    assert.equal(backend.subscriptions.size, 0);
    const restored = new Event('pageshow');
    restored.persisted = true;
    events.dispatchEvent(restored);
    events.dispatchEvent(restored);
    assert.equal(backend.subscriptions.size, 1);
    stop();
    delete globalThis.addEventListener;
    delete globalThis.removeEventListener;
});
