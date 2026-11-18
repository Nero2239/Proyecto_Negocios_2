document.addEventListener('DOMContentLoaded', () => {
    const api = window.RutaCommerce, $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const money = api.money;
    const field = (name, label, type = 'text', extra = '') => `<label class="erp-field">${label}<input class="form-input" name="${name}" type="${type}" ${extra}></label>`;
    const deliveryFields = () => field('name', 'Nombre', 'text', 'required minlength="3" maxlength="120"') + field('address', 'Dirección', 'text', 'required minlength="5" maxlength="250"') + field('city', 'Ciudad', 'text', 'required minlength="2" maxlength="100"') + field('zipCode', 'Código postal', 'text', 'required pattern="[0-9]{5}" maxlength="5"');
    const notice = message => { const target = $('commerceNotice'); if (target) target.textContent = message; else if (window.showToast) window.showToast(message); };
    function bind(form, submit) {
        form?.addEventListener('submit', async event => {
            event.preventDefault(); if (form.dataset.busy) return;
            form.dataset.busy = '1'; const button = form.querySelector('[type="submit"]'); if (button) button.disabled = true;
            try { await submit(Object.fromEntries(new FormData(form)), form); notice('Operación guardada correctamente.'); }
            catch (error) { notice(error.message); }
            finally { delete form.dataset.busy; if (button) button.disabled = false; }
        });
    }
    const withKey = form => form.dataset.operationKey || (form.dataset.operationKey = api.key());
    let activeUid, stop, stopAdminWallet, walletTarget;
    $('contactForm')?.addEventListener('submit', event => {
        event.preventDefault();
        if (!api.user) notice('Inicia sesión con correo verificado para crear un ticket.');
    });
    async function start() {
        const { db, dbSdk: sdk } = await api.init();
        const user = api.user;
        if (!user) {
            activeUid = null; stop?.(); stopAdminWallet?.(); walletTarget = null;
            if ($('commerceProfile')) { $('commerceProfile').hidden = true; $('commerceProfile').replaceChildren(); }
            if ($('commerceAdmin')) $('commerceAdmin').replaceChildren();
            $('staffTickets')?.replaceChildren(); $('transferList')?.replaceChildren();
            window.rutaCloudOrders = null;
            return;
        }
        if (user.uid === activeUid) return;
        activeUid = user.uid; stop?.(); stopAdminWallet?.(); walletTarget = null;
        $('commerceAdmin')?.replaceChildren(); $('staffTickets')?.replaceChildren(); $('transferList')?.replaceChildren();
        if ($('commerceProfile')) { $('commerceProfile').hidden = true; $('commerceProfile').replaceChildren(); }
        let profile;
        try { profile = (await sdk.getDoc(sdk.doc(db, 'usuarios', user.uid))).data() || {}; }
        catch (error) { if (activeUid === user.uid) activeUid = null; throw error; }
        if (api.user?.uid !== user.uid) return;
        const admin = profile.rol === 'admin', staff = admin || profile.rol === 'ventas';
        const currentSession = () => api.user?.uid === user.uid && activeUid === user.uid;
        const personal = $('commerceProfile');
        if (personal) {
            personal.hidden = false;
            personal.innerHTML = `<section class="profile-section-card"><h2>Editar mis datos</h2><form id="commerceProfileForm" class="c2c-form">${deliveryFields()}${field('phone', 'Teléfono', 'tel', 'maxlength="30"')}<button class="btn btn-primary" type="submit">Guardar mis datos</button></form></section>
                <section class="profile-section-card"><h2>Mi monedero</h2><p>Saldo y recargas de simulación, sin dinero real.</p><strong id="walletBalance"></strong><form id="walletTopupForm" class="c2c-form">${field('amount', 'Recarga simulada (MXN)', 'number', 'min="0.01" max="10000" step="0.01" required')}<button class="btn btn-primary" type="submit">Recargar saldo simulado</button></form><div id="walletMovements"></div></section>
                <section class="profile-section-card"><h2>Mis tickets</h2><form id="commerceTicketForm" class="c2c-form">${field('subject', 'Asunto', 'text', 'required maxlength="120"')}${field('orderId', 'Folio de pedido relacionado (opcional)')}<label>Consulta<textarea class="form-textarea" name="message" required maxlength="2000"></textarea></label><button class="btn btn-primary" type="submit">Crear ticket</button></form><div id="personalTickets"></div></section>`;
            const form = $('commerceProfileForm');
            for (const [name, value] of Object.entries({ ...profile.direccion, name: profile.nombre, phone: profile.telefono })) if (form.elements[name]) form.elements[name].value = value || '';
            bind(form, async data => { await api.call('profileSave', { name: data.name, phone: data.phone, delivery: data }); window.dispatchEvent(new CustomEvent('profile-updated')); });
            bind($('walletTopupForm'), async (data, form) => {
                await api.call('walletTopup', { amountCents: Math.round(Number(data.amount) * 100), key: withKey(form) });
                delete form.dataset.operationKey; form.reset(); await refreshWallet();
            });
            bind($('commerceTicketForm'), async (data, form) => {
                let orderId = data.orderId.trim();
                if (orderId.startsWith('RS-')) { const orders = await api.read('erp_ordenes', 'usuario_id'); orderId = orders.find(row => row.folio === orderId)?.id || orderId; }
                await api.call('ticketCreate', { ...data, orderId, key: withKey(form) }); delete form.dataset.operationKey; form.reset(); await refreshTickets();
            });
        }
        if ($('commerceAdmin') && admin) {
            $('commerceAdmin').innerHTML = `<article class="panel-card"><h3>Promociones</h3><form id="commercePromoForm" class="commerce-form">${field('code', 'Código (mismo código para editar)', 'text', 'required pattern="[A-Za-z0-9_-]{1,40}"')}${field('nombre', 'Nombre', 'text', 'required maxlength="120"')}${field('percent', 'Descuento (%)', 'number', 'required min="0.01" max="100" step="0.01"')}${field('inicio', 'Inicio', 'datetime-local', 'required')}${field('fin', 'Fin', 'datetime-local', 'required')}${field('minimum', 'Compra mínima MXN', 'number', 'min="0" step="0.01" value="0"')}${field('maximum', 'Descuento máximo MXN (0 sin límite)', 'number', 'min="0" step="0.01" value="0"')}${field('limit', 'Límite de usos (0 sin límite)', 'number', 'min="0" step="1" value="0"')}${field('categoria', 'Categoría aplicable (opcional)')}${field('productoId', 'ID de producto SCM (opcional)')}<label><input type="checkbox" name="activa" checked> Activa</label><button class="btn btn-primary" type="submit">Guardar promoción</button></form><div id="commercePromoList"></div></article>
                <article class="panel-card"><h3>Impuestos</h3><p>Precios de catálogo antes de IVA. Se aplica una sola vez, después del descuento.</p><form id="commerceTaxForm" class="commerce-form">${field('name', 'Nombre', 'text', 'required value="IVA"')}${field('percent', 'Porcentaje (%)', 'number', 'required min="0" max="100" step="0.01" value="16"')}<label><input type="checkbox" name="active" checked> Activo</label><button class="btn btn-primary" type="submit">Guardar impuesto</button></form></article>
                <article class="panel-card"><h3>Administración de monederos</h3><form id="commerceWalletLookup" class="commerce-form">${field('uid', 'UID del usuario', 'text', 'required')}<button type="submit" class="btn btn-outline">Consultar saldo y movimientos</button></form><div id="adminWalletDetails"></div><form id="commerceWalletAdjust" class="commerce-form">${field('uid', 'UID de la cuenta', 'text', 'required')}${field('amount', 'Ajuste MXN (negativo para descontar)', 'number', 'required step="0.01" min="-10000" max="10000"')}${field('reason', 'Motivo obligatorio de auditoría', 'text', 'required maxlength="250"')}<button type="submit" class="btn btn-primary">Registrar ajuste simulado</button></form></article>`;
            await refreshTax();
            $('commerceTaxForm').addEventListener('input', event => { event.currentTarget.dataset.dirty = '1'; });
            bind($('commerceTaxForm'), async (data, form) => {
                await api.call('taxSave', { name: data.name, ivaBps: Math.round(Number(data.percent) * 100), active: data.active === 'on' });
                delete form.dataset.dirty; await refreshTax();
            });
            bind($('commercePromoForm'), async data => {
                await api.call('promotionSave', { code: data.code.toUpperCase(), promotion: { ...data, activa: data.activa === 'on', inicio: new Date(data.inicio).toISOString(), fin: new Date(data.fin).toISOString(), descuentoBps: Math.round(Number(data.percent) * 100), minimoCents: Math.round(Number(data.minimum) * 100), maximoCents: Math.round(Number(data.maximum) * 100), limiteUsos: Number(data.limit) } });
                await refreshPromos();
            });
            bind($('commerceWalletLookup'), async data => showAdminWallet(data.uid.trim()));
            bind($('commerceWalletAdjust'), async (data, form) => { await api.call('walletAdjust', { uid: data.uid.trim(), amountCents: Math.round(Number(data.amount) * 100), reason: data.reason, key: withKey(form) }); delete form.dataset.operationKey; await showAdminWallet(data.uid.trim()); });
        }
        if ($('contactForm')) {
            $('correo').value = user.email; $('nombre').value = profile.nombre || '';
            bind($('contactForm'), async (data, form) => { await api.call('ticketCreate', { subject: data.subject || 'Consulta de contacto', message: data.mensaje, key: withKey(form) }); delete form.dataset.operationKey; form.reset(); });
        }
        async function refreshWallet() {
            if (!$('walletBalance')) return;
            const wallet = await api.wallet(); if (!currentSession()) return;
            $('walletBalance').textContent = money(wallet.saldoCents);
            $('walletMovements').innerHTML = walletMarkup(wallet);
        }
        async function refreshTax() {
            const form = $('commerceTaxForm'); if (!admin || !form || form.dataset.dirty) return;
            const config = await api.publicConfig(); if (!currentSession() || form.dataset.dirty) return;
            form.elements.percent.value = (config.ivaBps ?? 1600) / 100;
            form.elements.active.checked = config.activo !== false;
            form.elements.name.value = config.nombre || 'IVA';
        }
        async function showAdminWallet(target) {
            if (!admin || !target || target.includes('/')) throw new Error('Indica un UID de usuario válido.');
            stopAdminWallet?.(); walletTarget = target;
            const refreshBalance = async () => {
                const wallet = await api.wallet(target);
                if (currentSession() && walletTarget === target) $('adminWalletDetails').innerHTML = walletMarkup(wallet);
            };
            await refreshBalance(); if (!currentSession() || walletTarget !== target) return;
            stopAdminWallet = window.RutaSalvajeLiveSync.watchChanges({ onSnapshot: sdk.onSnapshot, references: [sdk.doc(db, 'monederos', target), sdk.collection(db, 'monederos', target, 'movimientos')], refresh: refreshBalance, onError: error => notice(error.message) });
        }
        async function refreshOrders() {
            if (!personal) return;
            const orders = await api.read('erp_ordenes', 'usuario_id');
            if (!currentSession()) return;
            window.rutaCloudOrders = { uid: user.uid, orders: orders.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).map(order => ({ id: order.folio || order.id, date: new Date(order.fecha).toLocaleString('es-MX'), status: order.estado, customer: order.comprador_nombre || order.entrega?.name || profile.nombre, address: order.entrega?.address || '', payment: order.metodo_pago || 'Operación ERP', total: order.total, order, products: (order.productos || []).map(row => ({ name: row.nombre || row.producto_id, quantity: row.cantidad, price: row.precio_unitario })) })) };
            window.dispatchEvent(new CustomEvent('commerce-orders'));
        }
        async function refreshPromos() {
            const target = $('commercePromoList'); if (!target || !admin) return;
            const promos = await api.read('promociones');
            if (!currentSession()) return;
            target.innerHTML = promos.map(row => `<p><strong>${esc(row.id)}</strong> · ${esc(row.nombre)} · ${row.descuentoBps / 100}% · ${row.activa ? 'Activa' : 'Inactiva'} <button class="btn btn-outline" type="button" data-edit-promo="${esc(row.id)}">Editar</button></p>`).join('') || '<p>No hay promociones registradas.</p>';
            target.querySelectorAll('[data-edit-promo]').forEach(button => button.onclick = () => {
                const row = promos.find(p => p.id === button.dataset.editPromo), form = $('commercePromoForm');
                const localDate = iso => { const date = new Date(iso); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
                const values = { ...row, code: row.id, percent: row.descuentoBps / 100, inicio: localDate(row.inicio), fin: localDate(row.fin), minimum: row.minimoCents / 100, maximum: row.maximoCents / 100, limit: row.limiteUsos };
                for (const [name, value] of Object.entries(values)) if (form.elements[name]) { if (name === 'activa') form.elements[name].checked = value; else form.elements[name].value = value; }
                form.scrollIntoView({ block: 'center', behavior: 'smooth' });
            });
        }
        async function refreshTickets() {
            const personalTarget = $('personalTickets'), staffTarget = $('staffTickets');
            if (!personalTarget && !(staff && staffTarget)) return;
            const tickets = await api.read('tickets', staff && staffTarget ? null : 'usuario_id');
            if (!currentSession()) return;
            const target = staff && staffTarget ? staffTarget : personalTarget;
            const drafts = new Map([...target.querySelectorAll('form')].map(form => [form.dataset.ticket, form.elements.message.value]));
            target.innerHTML = tickets.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).map(ticket => `<article class="panel-card profile-section-card"><h3>${esc(ticket.asunto)}</h3><p>Folio ${esc(ticket.id)} · ${esc(ticket.estado)} · Pedido ${esc(ticket.orden_id || 'Sin pedido')}</p>${ticket.respuestas.map(row => `<p><strong>${esc(row.nombre)}</strong> · ${esc(row.fecha)}<br>${esc(row.mensaje)}</p>`).join('')}<form class="c2c-form" data-ticket="${esc(ticket.id)}"><label>Respuesta<textarea name="message" class="form-textarea" required maxlength="2000"></textarea></label>${staff && staffTarget ? '<label>Estado<select name="status"><option value="en_proceso">En proceso</option><option value="respondido">Respondido</option><option value="cerrado">Cerrado</option><option value="abierto">Abierto</option></select></label>' : ''}<button type="submit" class="btn btn-primary">Enviar respuesta</button></form></article>`).join('') || '<p>No hay tickets registrados.</p>';
            for (const form of target.querySelectorAll('form')) {
                form.elements.message.value = drafts.get(form.dataset.ticket) || '';
                bind(form, async (data, form) => { await api.call('ticketReply', { id: form.dataset.ticket, ...data, key: withKey(form) }); delete form.dataset.operationKey; form.reset(); await refreshTickets(); });
            }
        }
        async function refreshTransfers() {
            const target = $('transferList'); if (!staff || !target) return;
            const orders = (await api.read('erp_ordenes')).filter(row => row.metodo_pago === 'transfer' && row.estado === 'pendiente_pago');
            if (!currentSession()) return;
            target.innerHTML = orders.map(row => `<article class="panel-card"><p>${esc(row.folio)} · ${money(row.totalCents)} · Pago simulado pendiente</p><button class="btn btn-primary" type="button" data-transfer="${esc(row.id)}">Confirmar transferencia simulada</button></article>`).join('') || '<p>No hay transferencias pendientes.</p>';
            for (const button of target.querySelectorAll('[data-transfer]')) button.onclick = async () => {
                button.disabled = true;
                try { await api.call('transferConfirm', { id: button.dataset.transfer }); notice('Transferencia confirmada. Inventario y ERP actualizados.'); await refreshTransfers(); }
                catch (error) { notice(error.message); button.disabled = false; }
            };
        }
        const refresh = async () => { if (currentSession()) await Promise.all([refreshOrders(), refreshWallet(), refreshTickets(), refreshPromos(), refreshTransfers(), refreshTax()]); };
        const refs = [];
        if (personal) refs.push(sdk.query(sdk.collection(db, 'erp_ordenes'), sdk.where('usuario_id', '==', user.uid)), sdk.doc(db, 'monederos', user.uid), sdk.collection(db, 'monederos', user.uid, 'movimientos'), sdk.query(sdk.collection(db, 'tickets'), sdk.where('usuario_id', '==', user.uid)));
        if (staff && $('staffTickets')) refs.push(sdk.collection(db, 'tickets'), sdk.collection(db, 'erp_ordenes'));
        if (admin && $('commerceAdmin')) refs.push(sdk.collection(db, 'promociones'), sdk.doc(db, 'configuracion', 'comercio'));
        await refresh();
        if (currentSession() && refs.length) stop = window.RutaSalvajeLiveSync.watchChanges({ onSnapshot: sdk.onSnapshot, references: refs, refresh, onError: error => notice(error.message) });
    }
    function walletMarkup(wallet) {
        return `<p>Saldo simulado: <strong>${money(wallet.saldoCents)}</strong></p>${wallet.movimientos.map(row => `<p>${esc(row.fecha)} · ${esc(row.tipo)} · ${money(row.importeCents)} · ${esc(row.motivo || row.orden_id || '')}${row.saldoCents != null ? ` · Saldo posterior: ${money(row.saldoCents)}` : ''}${row.actor_id ? ` · Usuario: ${esc(row.actor_id)}` : ''}</p>`).join('') || '<p>Sin movimientos.</p>'}`;
    }
    window.addEventListener('profile-updated', () => start().catch(error => notice(error.message)));
    window.addEventListener('admin-auth-ready', () => start().catch(error => notice(error.message)));
    window.addEventListener('commerce-auth', () => start().catch(error => notice(error.message)));
    start().catch(error => notice(error.message));
});
