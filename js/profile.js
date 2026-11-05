document.addEventListener('DOMContentLoaded', async () => {
    const $ = id => document.getElementById(id);
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    const money = value => Number(value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    let user = null;
    let purchases = [];
    let stopProfileSync;
    let revision = 0;
    let previousFocus;

    function message(text = '') {
        $('profileMessage').textContent = text;
        $('profileMessage').hidden = !text;
    }

    function clearBusinessAccess() {
        $('profileBusinessAccess').hidden = true;
        $('profileBusinessLinks').replaceChildren();
    }

    function closePurchase() {
        $('purchaseDetailModal').classList.add('hidden');
        document.body.classList.remove('purchase-detail-open');
        previousFocus?.focus();
    }

    function renderPurchases() {
        purchases = [];
        if (user) {
            try {
                const saved = JSON.parse(localStorage.getItem(`rutaSalvajePurchases_${user.email.toLowerCase()}`) || '[]');
                if (Array.isArray(saved)) purchases = saved.filter(purchase => purchase && typeof purchase === 'object');
            } catch (error) {
                console.warn('No se pudo leer el historial guardado:', error);
            }
        }
        $('purchaseCount').textContent = `${purchases.length} ${purchases.length === 1 ? 'pedido' : 'pedidos'}`;
        $('purchaseHistory').innerHTML = purchases.length ? purchases.map((purchase, index) => {
            const products = Array.isArray(purchase.products) ? purchase.products : [];
            return `<article class="purchase-card">
                <div class="purchase-card-icon"><i class="bi bi-bag-check-fill" aria-hidden="true"></i></div>
                <div class="purchase-card-main">
                    <div class="purchase-card-heading"><div><p class="purchase-order-label">Pedido ${escapeHtml(purchase.id)}</p><h3>${escapeHtml(products[0]?.name || 'Compra de equipo')}${products.length > 1 ? ` <span>+ ${products.length - 1} productos</span>` : ''}</h3></div><span class="purchase-status">${escapeHtml(purchase.status || 'Confirmado')}</span></div>
                    <div class="purchase-card-meta"><span>${escapeHtml(purchase.date)}</span><strong>${money(purchase.total)}</strong></div>
                </div>
                <button class="btn btn-secondary purchase-detail-button" type="button" data-purchase-index="${index}"><i class="bi bi-receipt"></i> Ver detalle</button>
            </article>`;
        }).join('') : `<div class="profile-empty-state">${user ? 'Aún no tienes compras guardadas en este navegador.' : 'Inicia sesión para consultar tus compras.'}</div>`;
    }

    $('purchaseHistory').addEventListener('click', event => {
        const button = event.target.closest('[data-purchase-index]');
        const purchase = button && purchases[Number(button.dataset.purchaseIndex)];
        if (!purchase) return;
        previousFocus = button;
        const products = Array.isArray(purchase.products) ? purchase.products : [];
        $('purchaseDetailContent').innerHTML = `<p class="purchase-ticket-kicker">Ticket de compra</p>
            <div class="purchase-ticket-heading"><div><h2 id="purchaseDetailTitle">Ruta Salvaje</h2><p>Resumen de pedido ${escapeHtml(purchase.id)}</p></div><i class="bi bi-tree-fill" aria-hidden="true"></i></div>
            <div class="purchase-ticket-meta"><div><span>Fecha</span><strong>${escapeHtml(purchase.date)}</strong></div><div><span>Estado</span><strong>${escapeHtml(purchase.status || 'Confirmado')}</strong></div></div>
            <div class="purchase-ticket-customer"><p class="purchase-ticket-section">Datos del cliente</p><strong>${escapeHtml(purchase.customer)}</strong><span>${escapeHtml(purchase.address)}</span><span>Método de pago: ${escapeHtml(purchase.payment)}</span></div>
            <div class="purchase-ticket-products"><p class="purchase-ticket-section">Productos</p>${products.map(product => `<div><span>${escapeHtml(product.name)} <small>x${Number(product.quantity || 0)}</small></span><strong>${money(Number(product.price || 0) * Number(product.quantity || 0))}</strong></div>`).join('')}</div>
            <div class="purchase-ticket-total"><span>Total pagado</span><strong>${money(purchase.total)}</strong></div>`;
        $('purchaseDetailModal').classList.remove('hidden');
        document.body.classList.add('purchase-detail-open');
        $('closePurchaseDetail').focus();
    });
    $('closePurchaseDetail').addEventListener('click', closePurchase);
    document.querySelector('[data-close-purchase]').addEventListener('click', closePurchase);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !$('purchaseDetailModal').classList.contains('hidden')) closePurchase();
    });
    window.addEventListener('storage', event => {
        if (user && (event.key === null || event.key === `rutaSalvajePurchases_${user.email.toLowerCase()}`)) {
            closePurchase();
            renderPurchases();
        }
    });

    try {
        const [{ initializeApp, getApps, getApp }, { getAuth, onAuthStateChanged }, { getFirestore, doc, getDoc, onSnapshot }, { watchChanges }, { normalizeRole, profileLinks }] = await Promise.all([
            import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'),
            import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js'),
            window.RutaSalvajeLiveSync,
            window.RutaSalvajeAccess
        ]);
        const app = getApps().length ? getApp() : initializeApp({
            apiKey: 'AIzaSyAZCztGChAZ9k81WWBkp9TZBx9XphWqcmc', authDomain: 'camping-3a6a4.firebaseapp.com',
            projectId: 'camping-3a6a4', storageBucket: 'camping-3a6a4.firebasestorage.app',
            messagingSenderId: '181839243079', appId: '1:181839243079:web:df39441f32098fc7ca4e62'
        });
        const auth = getAuth(app);
        const db = getFirestore(app);
        onAuthStateChanged(auth, async account => {
            const currentRevision = ++revision;
            stopProfileSync?.();
            clearBusinessAccess();
            closePurchase();
            user = account?.emailVerified && account.email ? account : null;
            window.profileContext = null;
            $('sellerDashboard').hidden = !user;
            $('sellerDashboard').classList.toggle('hidden', !user);
            if (!user) {
                ['userEmail', 'userName', 'userUid', 'userRole', 'isLoggedIn'].forEach(key => localStorage.removeItem(key));
                $('profileEmail').textContent = 'Sin sesión verificada';
                $('profileName').textContent = '—';
                $('profileRole').textContent = 'Sin sesión';
                $('profileLastAccess').textContent = '—';
                message('Inicia sesión con un correo verificado para consultar tu perfil.');
                renderPurchases();
                window.dispatchEvent(new CustomEvent('profile-updated'));
                return;
            }
            const email = user.email.toLowerCase();
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userUid', user.uid);
            localStorage.setItem('userName', user.displayName || email.split('@')[0]);
            localStorage.setItem('userRole', 'usuario');
            localStorage.setItem('isLoggedIn', '1');
            $('profileEmail').textContent = email;
            $('profileName').textContent = user.displayName || email.split('@')[0];
            $('profileRole').textContent = 'Usuario';
            window.profileContext = { uid: user.uid, email, role: 'usuario' };
            renderPurchases();
            window.dispatchEvent(new CustomEvent('profile-updated'));
            const profileRef = doc(db, 'usuarios', user.uid);
            const refreshProfile = async () => {
                const snapshot = await getDoc(profileRef);
                if (revision !== currentRevision) return;
                clearBusinessAccess();
                if (!snapshot.exists()) throw new Error('No existe un perfil vinculado a tu cuenta.');
                const profile = snapshot.data();
                if (profile.auth_uid !== account.uid || String(profile.email || '').toLowerCase() !== email) throw new Error('No se pudo verificar el perfil de acceso.');
                const role = normalizeRole(profile.rol);
                window.profileContext = { uid: account.uid, email, role };
                localStorage.setItem('userRole', role);
                localStorage.setItem('userName', profile.nombre || account.displayName || email.split('@')[0]);
                $('profileName').textContent = localStorage.getItem('userName');
                $('profileRole').textContent = ({ admin: 'Administrador', ventas: 'Ventas', logistica: 'Logística', usuario: 'Usuario' })[role];
                const lastAccess = profile.ultimo_acceso?.toDate?.() || (profile.ultimo_acceso ? new Date(profile.ultimo_acceso) : null);
                $('profileLastAccess').textContent = lastAccess && !Number.isNaN(lastAccess.getTime()) ? lastAccess.toLocaleString('es-MX') : 'Sin registro';
                const links = profileLinks(role);
                for (const link of links) {
                    const anchor = document.createElement('a');
                    anchor.className = 'btn btn-primary';
                    anchor.href = link.href;
                    if (link.id) anchor.id = link.id;
                    anchor.textContent = link.label;
                    $('profileBusinessLinks').append(anchor);
                }
                $('profileBusinessAccess').hidden = links.length === 0;
                message();
                window.dispatchEvent(new CustomEvent('profile-updated'));
            };
            const profileError = error => {
                if (revision !== currentRevision) return;
                console.warn('No se pudo actualizar el perfil:', error);
                clearBusinessAccess();
                localStorage.setItem('userRole', 'usuario');
                window.profileContext = { uid: account.uid, email, role: 'usuario' };
                $('profileRole').textContent = 'Usuario';
                message('No se pudieron verificar los permisos de tu cuenta. Tus compras y publicaciones siguen disponibles.');
            };
            await refreshProfile().catch(profileError);
            if (revision === currentRevision) stopProfileSync = watchChanges({ onSnapshot, references: [profileRef], refresh: refreshProfile, onError: profileError });
        }, () => {
            clearBusinessAccess();
            message('No se pudo verificar la sesión. Vuelve a iniciar sesión.');
        });
    } catch (error) {
        console.error('No se pudo iniciar el perfil:', error);
        clearBusinessAccess();
        message('No se pudo cargar tu cuenta. Revisa la conexión y vuelve a intentarlo.');
    }
});
