// Classic script: compatible with local HTML files as well as Firebase Hosting.
(() => {
    const version = '12.18.0';
    let context, user, cart = { items: [], revision: 0 }, preparedUid = null, preparing, queue = Promise.resolve(), stopCart, pendingSaves = 0;
    const config = { apiKey: 'AIzaSyAZCztGChAZ9k81WWBkp9TZBx9XphWqcmc', authDomain: 'camping-3a6a4.firebaseapp.com', projectId: 'camping-3a6a4', storageBucket: 'camping-3a6a4.firebasestorage.app', messagingSenderId: '181839243079', appId: '1:181839243079:web:df39441f32098fc7ca4e62' };
    const service = Object.freeze({ projectId: config.projectId, region: 'us-central1', name: 'commerce', url: `https://us-central1-${config.projectId}.cloudfunctions.net/commerce` });
    const parse = key => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
    const compact = rows => rows.map(row => ({ id: String(row.id), quantity: Number(row.quantity) }));
    const notify = () => window.dispatchEvent(new CustomEvent('commerce-cart', { detail: { ...cart, items: cart.items.map(row => ({ ...row, price: row.priceCents / 100 })) } }));
    function operationError(error, action) {
        if (error?.isCommerceError) return error;
        const code = error?.code || 'functions/internal';
        let message = String(error?.message || 'No se pudo completar la operación.');
        const statusMatch = message.match(/(?:\[(\d{1,3})\]|\((\d{1,3})\))\.?$/);
        const httpStatus = statusMatch ? Number(statusMatch[1] ?? statusMatch[2]) : null;
        const generic = /^(?:firebaseerror:\s*)?(?:internal|unavailable|not[ _-]?found|permission[ _-]?denied|unauthenticated|unknown|forbidden)(?:\s*(?:\(\d+\)|\[\d+\]))?\.?$/i.test(message);
        let category = error?.details?.category || error?.category || 'operation';
        if (code === 'functions/unauthenticated' || code === 'auth/user-token-expired' || code === 'auth/invalid-user-token') {
            category = 'authentication';
            if (generic) message = 'La sesión no es válida o expiró. Inicia sesión de nuevo con un correo verificado.';
        } else if (code === 'functions/not-found' && generic) {
            category = 'not-deployed';
            message = `La función commerce no está disponible en ${service.projectId}, región ${service.region} (HTTP 404). Publica el backend o corrige la región si se desplegó en otra ubicación.`;
        } else if (code === 'functions/permission-denied' && generic && httpStatus === 403 && category !== 'authorization') {
            category = 'invocation-permissions';
            message = 'La infraestructura de Firebase rechazó la invocación (HTTP 403). Revisa el acceso público de commerce en Cloud Run/IAM; la validación de Firebase Authentication debe permanecer activa dentro de la función.';
        } else if (code === 'functions/permission-denied') {
            category = 'authorization';
            message = 'Permiso de la cuenta: ' + message;
        } else if (/\bCORS\b|cross[- ]origin|Access-Control-Allow-Origin/i.test(message)) {
            category = 'cors';
            message = 'El navegador bloqueó el acceso por CORS. Publica commerce con cors: true y revisa el origen permitido; los dominios autorizados de Authentication se configuran por separado.';
        } else if ((generic && (httpStatus === 0 || httpStatus === null) && ['functions/internal', 'functions/unknown', 'functions/unavailable'].includes(code)) || code === 'auth/network-request-failed' || /failed to fetch|networkerror|dynamically imported module/i.test(message)) {
            category = 'connection';
            message = window.navigator?.onLine === false
                ? 'No hay conexión a Internet. Reconéctate para sincronizar el carrito y pagar.'
                : `El navegador no recibió respuesta de commerce en ${service.projectId} (${service.region}). Un 404 sin encabezados CORS, un bloqueo IAM/CORS o un fallo de red pueden producir este error. Comprueba el despliegue y sus registros; no se puede distinguir la causa exacta desde esta respuesta.`;
            if (location.protocol === 'file:') message += ' Utiliza http://localhost para evitar las restricciones del origen file:///.';
        } else if (code === 'functions/deadline-exceeded' || code === 'functions/unavailable') {
            category = 'server';
            message = 'El servidor de compras no respondió a tiempo. Reintenta la misma operación: se conserva su identificador para evitar cobros duplicados.';
        } else if (code === 'functions/internal' || code === 'functions/unknown') {
            category = 'server';
            if (generic) message = 'El servidor de compras devolvió un error interno. Revisa los registros de commerce; no hay confirmación de compra en esta respuesta.';
        }
        const reference = error?.details?.reference;
        if (typeof reference === 'string' && /^[a-f0-9-]{36}$/i.test(reference)) message += ' Referencia del error: ' + reference + '.';
        const result = new Error(message, { cause: error });
        Object.assign(result, { code, category, httpStatus, action, details: error?.details, service, isCommerceError: true });
        return result;
    }
    function assertOrder(order) {
        if (!order || !/^web_[a-f0-9]{40}$/.test(order.id || '') || order.origen !== 'checkout' || !['pendiente_pago', 'procesada'].includes(order.estado) || !order.usuario_id || !Number.isSafeInteger(order.totalCents) || order.totalCents < 0 || !Array.isArray(order.productos) || !order.productos.length) {
            const error = new Error('El backend no devolvió un pedido válido. No se mostrará la compra como confirmada; conserva el identificador y consulta tus pedidos.');
            error.code = 'functions/data-loss'; error.category = 'server'; throw error;
        }
        return order;
    }
    async function init() {
        if (!context) context = (async () => {
            const [appSdk, authSdk, dbSdk, fnSdk] = await Promise.all(['app', 'auth', 'firestore', 'functions'].map(name => import(`https://www.gstatic.com/firebasejs/${version}/firebase-${name}.js`)));
            const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(config);
            if (app.options.projectId !== service.projectId) {
                const error = new Error('La aplicación Firebase activa pertenece a otro proyecto. Ruta Salvaje debe utilizar camping-3a6a4.');
                error.code = 'commerce/project-mismatch'; error.category = 'configuration'; throw error;
            }
            const auth = authSdk.getAuth(app), db = dbSdk.getFirestore(app), functions = fnSdk.getFunctions(app, service.region);
            if (window.RUTA_EMULATORS && ['localhost', '127.0.0.1'].includes(location.hostname)) {
                authSdk.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
                dbSdk.connectFirestoreEmulator(db, '127.0.0.1', 8080);
                fnSdk.connectFunctionsEmulator(functions, '127.0.0.1', 5001);
            }
            await new Promise(resolve => {
                let first = true;
                authSdk.onAuthStateChanged(auth, account => {
                    const previous = user?.uid; user = account?.emailVerified ? account : null;
                    if (previous !== user?.uid) { preparedUid = null; preparing = null; stopCart?.(); }
                    if (!user && localStorage.getItem('campingCartOwner')) {
                        localStorage.removeItem('campingCartOwner');
                        localStorage.setItem('campingCart', localStorage.getItem('campingGuestCart') || '[]');
                        cart = { items: [], revision: 0 }; notify();
                    }
                    if (first) { first = false; resolve(); }
                    window.dispatchEvent(new CustomEvent('commerce-auth', { detail: user }));
                }, () => resolve());
            });
            return { auth, db, dbSdk, callable: fnSdk.httpsCallable(functions, service.name) };
        })().catch(error => { context = null; throw operationError(error, 'initialize'); });
        return context;
    }
    async function call(action, data = {}) {
        try {
            const ctx = await init();
            user = ctx.auth.currentUser?.emailVerified ? ctx.auth.currentUser : null;
            if (!user) {
                const error = new Error('Inicia sesión con un correo verificado para realizar esta operación.');
                error.code = 'functions/unauthenticated'; throw error;
            }
            const owner = user.uid;
            const response = await ctx.callable({ ...data, action });
            if (ctx.auth.currentUser?.uid !== owner) {
                const error = new Error('La sesión cambió durante la operación. Inicia sesión con la cuenta compradora para consultar el pedido.');
                error.code = 'functions/unauthenticated'; throw error;
            }
            if (['checkout', 'transferConfirm', 'receiptGet'].includes(action) || (action === 'orderLookup' && response.data !== null)) assertOrder(response.data);
            return response.data;
        } catch (error) { throw operationError(error, action); }
    }
    async function prepareCart() {
        const ctx = await init();
        user = ctx.auth.currentUser?.emailVerified ? ctx.auth.currentUser : null;
        if (!user) return null;
        if (preparedUid === user.uid) return cart;
        if (preparing) return preparing;
        const uid = user.uid;
        preparing = (async () => {
            const owner = localStorage.getItem('campingCartOwner');
            let guest = parse('campingGuestCart');
            if (!owner && !guest.length) guest = parse('campingCart');
            if (guest.length) {
                let key = localStorage.getItem('campingMigrationKey');
                if (!key) { key = crypto.randomUUID(); localStorage.setItem('campingMigrationKey', key); }
                // Guest data is removed only after the backend acknowledges its migration.
                cart = await call('cartMerge', { items: compact(guest), key });
                localStorage.removeItem('campingGuestCart'); localStorage.removeItem('campingMigrationKey');
            } else cart = await call('cartGet');
            if (user?.uid !== uid) return null;
            preparedUid = uid;
            localStorage.setItem('campingCartOwner', uid);
            localStorage.setItem('campingCart', JSON.stringify(cart.items.map(row => ({ ...row, price: row.priceCents / 100 }))));
            stopCart?.();
            stopCart = ctx.dbSdk.onSnapshot(ctx.dbSdk.doc(ctx.db, 'carritos', uid), snapshot => {
                if (user?.uid !== uid || pendingSaves || !snapshot.exists()) return;
                cart = snapshot.data();
                localStorage.setItem('campingCart', JSON.stringify(cart.items.map(row => ({ ...row, price: row.priceCents / 100 }))));
                notify();
            }, error => window.dispatchEvent(new CustomEvent('commerce-sync-error', { detail: error })));
            notify(); return cart;
        })().finally(() => { preparing = null; });
        return preparing;
    }
    async function saveCart(rows) {
        const snapshot = compact(rows);
        await init();
        if (!user) {
            localStorage.setItem('campingGuestCart', JSON.stringify(rows));
            localStorage.setItem('campingCart', JSON.stringify(rows)); return;
        }
        const uid = user.uid;
        const editingGuest = preparedUid !== uid && !localStorage.getItem('campingCartOwner');
        // A guest can correct stale quantities after a rejected migration, without overwriting
        // a cloud cart that has not yet been loaded into this window.
        if (editingGuest) localStorage.setItem('campingGuestCart', JSON.stringify(rows));
        const task = queue.catch(() => {}).then(async () => {
            await prepareCart();
            if (uid !== user?.uid) throw new Error('La sesión cambió. Revisa tu carrito.');
            if (editingGuest) return;
            try {
                cart = await call('cartSave', { items: snapshot, revision: cart.revision });
                localStorage.setItem('campingCart', JSON.stringify(cart.items.map(row => ({ ...row, price: row.priceCents / 100 })))); notify();
            } catch (error) {
                // Keep the user's local draft. Refresh only the concurrency revision for a retry.
                try { const current = await call('cartGet'); cart.revision = current.revision; } catch { /* Network can still be unavailable. */ }
                throw error;
            }
        });
        pendingSaves++;
        queue = task.finally(() => { pendingSaves--; }); return queue;
    }
    async function flushCart() { await prepareCart(); await queue; }
    async function read(name, ownerField = null) {
        const { db, dbSdk: sdk } = await init();
        if (ownerField && !user) return [];
        const reference = ownerField ? sdk.query(sdk.collection(db, name), sdk.where(ownerField, '==', user.uid)) : sdk.collection(db, name);
        return (await sdk.getDocs(reference)).docs.map(doc => ({ ...doc.data(), id: doc.id }));
    }
    async function wallet(uid = null) {
        const { db, dbSdk: sdk } = await init();
        if (!user) throw new Error('Inicia sesión para consultar tu monedero.');
        const target = uid || user.uid;
        if (!uid) await call('walletEnsure');
        const [balance, movements] = await Promise.all([sdk.getDoc(sdk.doc(db, 'monederos', target)), sdk.getDocs(sdk.collection(db, 'monederos', target, 'movimientos'))]);
        return { ...(balance.exists() ? balance.data() : { saldoCents: 0 }), movimientos: movements.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))) };
    }
    async function publicConfig() {
        const { db, dbSdk: sdk } = await init();
        const data = await sdk.getDoc(sdk.doc(db, 'configuracion', 'comercio'));
        return data.exists() ? data.data() : { nombre: 'IVA', ivaBps: 1600, activo: true, preciosIncluyenIva: false };
    }
    async function completed(order) {
        assertOrder(order);
        if (order.usuario_id !== user?.uid) throw new Error('No se puede sincronizar una compra sin confirmar la cuenta propietaria.');
        cart = await call('cartGet'); localStorage.setItem('campingCart', JSON.stringify(cart.items.map(row => ({ ...row, price: row.priceCents / 100 })))); localStorage.removeItem('campingPromo'); notify();
    }
    async function watchOrder(id, next, onError) {
        const { db, dbSdk: sdk } = await init();
        if (!user) throw new Error('Inicia sesión para consultar tu pedido.');
        const owner = user.uid;
        return sdk.onSnapshot(sdk.doc(db, 'erp_ordenes', id), snapshot => {
            if (user?.uid === owner && snapshot.exists()) next({ ...snapshot.data(), id: snapshot.id });
        }, onError);
    }
    window.RutaCommerce = { init, call, prepareCart, saveCart, flushCart, read, wallet, publicConfig, completed, watchOrder, assertOrder, service,
        get user() { return user; }, key: () => crypto.randomUUID(), money: value => (Number(value || 0) / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) };
})();
