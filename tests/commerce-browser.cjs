// Real HTML/JS in Chrome, with local test-only Auth/SDK transport and the actual backend service.
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), os = require('node:os');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { memoryDb } = require('./support/memory-db.cjs');
const { createCommerce } = require('../functions/commerce.cjs');
const db = memoryDb(), execute = createCommerce(db);
for (const uid of ['ana', 'admin', 'ventas', 'logistica']) db.records.set(`usuarios/${uid}`, { uid, auth_uid: uid, email: `${uid}@test.test`, nombre: uid, rol: uid === 'ana' ? 'usuario' : uid });
for (const [id, name, category, stock] of [['p1', 'Tienda real', 'tiendas', 5], ['p2', 'Linterna real', 'iluminacion', 3], ['p0', 'Agotado real', 'tiendas', 0]]) db.records.set(`scm_productos/${id}`, { nombre: name, categoria: category, stock_actual: stock, stock_minimo: 0, precio_venta: 100, costo_unitario: 50, origen: 'tienda', estrategia_logistica: 'PULL', imagen_url: '' });
db.records.set('monederos/ana', { saldoCents: 50000 });
const sdk = `
const uid=new URLSearchParams(location.search).get('role')||'ana';
const user={uid,email:uid+'@test.test',emailVerified:true};const auth={currentUser:user};
async function request(route,data){const response=await fetch(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid,...data})});const result=await response.json();if(result.error)throw new Error(result.error);return result;}
export const initializeApp=()=>({}),getApp=()=>({}),getApps=()=>[{}],getAuth=()=>auth,getFirestore=()=>({}),getFunctions=()=>({});
export const onAuthStateChanged=(a,next)=>{const t=setTimeout(()=>next(user),0);return ()=>clearTimeout(t);};
export const collection=(db,...parts)=>({path:parts.join('/'),kind:'collection'}),doc=(db,...parts)=>({path:parts.join('/'),kind:'doc'});
export const where=(field,op,value)=>({field,value}),query=(ref,...filters)=>({...ref,filters}),orderBy=()=>({}),Timestamp={};
function snapshot(ref,data){return ref.kind==='doc'?{id:ref.path.split('/').at(-1),exists:()=>data.exists,data:()=>data.value}:{empty:!data.rows.length,size:data.rows.length,docs:data.rows.map(row=>({id:row.id,data:()=>row.value}))};}
export const getDoc=async ref=>snapshot(ref,await request('/__read',{ref})),getDocs=async ref=>snapshot(ref,await request('/__read',{ref}));
export const onSnapshot=(ref,next,error)=>{let previous='',stopped=false,busy=false;const poll=async()=>{if(stopped||busy)return;busy=true;try{const data=await request('/__read',{ref}),json=JSON.stringify(data);if(json!==previous){previous=json;if(!stopped)next(snapshot(ref,data));}}catch(e){error?.(e);}finally{busy=false;}};poll();const timer=setInterval(poll,150);return ()=>{stopped=true;clearInterval(timer);};};
export const httpsCallable=()=>async data=>({data:await request('/__call',{data})});
export const updateDoc=async(ref,data)=>request('/__write',{ref,data}),setDoc=updateDoc,deleteDoc=async()=>{},addDoc=async()=>({id:'test-id'}),runTransaction=async()=>{};
`;
const scenario = `<!doctype html><html><body><pre id="result">pending</pre><script>
const results=[],errors=[],windows=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function check(value,label){if(!value)throw Error(label);results.push(label);}
async function wait(fn,label){for(let i=0;i<250;i++){if(fn())return;await sleep(30);}throw Error('Timeout: '+label);}
async function frame(page){const f=document.createElement('iframe');f.src=page;document.body.append(f);await new Promise(r=>f.onload=r);const w=f.contentWindow;windows.push(w);return w;}
async function state(){return (await fetch('/__state')).json();}
(async()=>{
localStorage.clear();localStorage.setItem('cookiesAccepted','true');localStorage.setItem('campingCart',JSON.stringify([{id:'p1',quantity:1,name:'Tienda real',price:100}]));
const shop=await frame('/equipo.html');await wait(()=>shop.shop&&shop.document.getElementById('productGrid').textContent.includes('Tienda real'),'catalog');
await shop.RutaCommerce.prepareCart();check((await state()).cart.items[0].quantity===1,'Visitor cart migrates into the authenticated Firestore cart');
const search=shop.document.getElementById('searchInput');search.value='Linterna';search.dispatchEvent(new shop.Event('input'));check(!shop.document.getElementById('productGrid').textContent.includes('Tienda real'),'Catalog search keeps working');search.value='';search.dispatchEvent(new shop.Event('input'));
const category=shop.document.getElementById('categorySelect');category.value='iluminacion';category.dispatchEvent(new shop.Event('change'));check(shop.document.getElementById('productGrid').textContent.includes('Linterna real')&&!shop.document.getElementById('productGrid').textContent.includes('Tienda real'),'Category filters keep working');category.value='all';category.dispatchEvent(new shop.Event('change'));
shop.shop.addToCart('p1');await shop.RutaCommerce.flushCart();check((await state()).cart.items[0].quantity===2,'Adding to cart persists quantity');
shop.shop.changeQuantity('p1',99);await sleep(50);check((await state()).cart.items[0].quantity===2,'Excess stock is rejected in the cart UI');
shop.shop.addToCart('p2');await shop.RutaCommerce.flushCart();shop.shop.removeFromCart('p2');await shop.RutaCommerce.flushCart();check((await state()).cart.items.length===1,'Removing a product persists');
shop.shop.clearCart();await shop.RutaCommerce.flushCart();check((await state()).cart.items.length===0,'Clearing the cart persists');shop.shop.addToCart('p1');shop.shop.addToCart('p1');await shop.RutaCommerce.flushCart();
const reloadedShop=await frame('/equipo.html');await reloadedShop.RutaCommerce.prepareCart();check((await state()).cart.items[0].quantity===2,'Reloading the store restores the cart without duplicating migration');
const checkout=await frame('/checkout.html');await wait(()=>!checkout.document.getElementById('nextStepBtn').disabled,'checkout quote');
checkout.document.getElementById('nextStepBtn').click();check(!checkout.document.getElementById('step-1').classList.contains('hidden'),'Checkout rejects incomplete delivery data');
for(const [id,value] of Object.entries({fullName:'Ana Ejemplo',address:'Bosque 123',city:'Puebla',zipCode:'72000'}))checkout.document.getElementById(id).value=value;
checkout.document.getElementById('nextStepBtn').click();const radio=checkout.document.querySelector('[name="payment"][value="ewallet"]');radio.checked=true;radio.dispatchEvent(new checkout.Event('change'));checkout.document.getElementById('nextStepBtn').click();
check(checkout.document.getElementById('checkoutSummary').textContent.includes('IVA (16%)'),'Checkout shows server-calculated IVA');
check(!checkout.document.getElementById('cardNumber')&&!checkout.document.getElementById('cardCvv'),'Checkout does not collect sensitive card fields');
checkout.document.getElementById('payBtn').click();checkout.document.getElementById('payBtn').click();
await wait(()=>!checkout.document.getElementById('orderConfirmation').classList.contains('hidden'),'purchase confirmation');let saved=await state();
check(saved.orders.length===1&&saved.wallet.saldoCents===26800&&saved.product.stock_actual===3,'Complete wallet purchase updates order, balance and inventory');
check(checkout.document.getElementById('receiptTotal').textContent.includes('232.00'),'Receipt shows the persisted total');
const replay=await frame('/checkout.html');await wait(()=>!replay.document.getElementById('orderConfirmation').classList.contains('hidden'),'reload receipt');check((await state()).orders.length===1,'Reloading checkout restores the receipt without another charge');
const profile=await frame('/profile.html');await wait(()=>profile.document.getElementById('purchaseHistory').textContent.includes('RS-')&&profile.document.getElementById('walletBalance'),'profile data');
check(profile.document.getElementById('profileBusinessAccess').hidden,'Regular users receive no business permissions');
check(profile.document.getElementById('purchaseHistory').textContent.includes('procesada'),'Profile shows cloud order history');
const topup=profile.document.getElementById('walletTopupForm');topup.elements.amount.value='10';topup.dispatchEvent(new profile.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>!topup.dataset.busy,'topup');check((await state()).wallet.saldoCents===27800,'Profile topups persist a wallet movement');
const ticket=profile.document.getElementById('commerceTicketForm');ticket.elements.subject.value='Ayuda con mi pedido';ticket.elements.message.value='Necesito seguimiento';ticket.dispatchEvent(new profile.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>profile.document.getElementById('personalTickets').textContent.includes('Ayuda con mi pedido'),'ticket');
const sales=await frame('/admin.html?role=ventas&view=tickets');await wait(()=>sales.document.getElementById('staffTickets').textContent.includes('Ayuda con mi pedido'),'sales tickets');
const reply=sales.document.querySelector('#staffTickets form');reply.elements.message.value='Tu pedido está confirmado';reply.elements.status.value='respondido';reply.dispatchEvent(new sales.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>profile.document.getElementById('personalTickets').textContent.includes('Tu pedido está confirmado'),'ticket reply');check(true,'Sales replies reach the customer ticket history');

const admin=await frame('/admin.html?role=admin&view=comercio');await wait(()=>admin.document.getElementById('commercePromoList')?.textContent.includes('No hay promociones'),'admin commerce');
const promo=admin.document.getElementById('commercePromoForm');for(const [key,value] of Object.entries({code:'CAMPING',nombre:'Promoción administrada',percent:'10',inicio:new Date(Date.now()-3600000-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16),fin:new Date(Date.now()+86400000-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)}))promo.elements[key].value=value;promo.dispatchEvent(new admin.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>admin.document.getElementById('commercePromoList').textContent.includes('CAMPING'),'promotion administration');check(true,'Admin promotion form persists a real promotion');
const tax=admin.document.getElementById('commerceTaxForm');tax.elements.percent.value='8';tax.dispatchEvent(new admin.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>!tax.dataset.busy,'tax saved');check((await state()).config.ivaBps===800,'Admin IVA form persists tax configuration');
const adjustment=admin.document.getElementById('commerceWalletAdjust');adjustment.elements.uid.value='ana';adjustment.elements.amount.value='10';adjustment.elements.reason.value='Ajuste de prueba';adjustment.dispatchEvent(new admin.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>!adjustment.dataset.busy,'wallet adjustment');check((await state()).wallet.saldoCents===28800,'Authorized wallet adjustment is persisted');
const profileForm=profile.document.getElementById('commerceProfileForm');for(const [key,value] of Object.entries({name:'Ana editada',address:'Bosque 456',city:'Puebla',zipCode:'72000',phone:'2221234567'}))profileForm.elements[key].value=value;profileForm.dispatchEvent(new profile.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>!profileForm.dataset.busy,'profile edit');check((await state()).profile.nombre==='Ana editada','Profile form persists personal data');
await profile.RutaCommerce.saveCart([{id:'p1',quantity:1}]);const tq=await profile.RutaCommerce.call('quote',{promo:'CAMPING'});const pending=await profile.RutaCommerce.call('checkout',{method:'transfer',key:'browser-transfer',promo:'CAMPING',quoteToken:tq.quoteToken,delivery:{name:'Ana editada',address:'Bosque 456',city:'Puebla',zipCode:'72000'}});check(pending.estado==='pendiente_pago'&&(await state()).product.stock_actual===3,'Transfer creates a pending payment without consuming stock');
sales.document.querySelector('[data-view="transferencias"]').click();await wait(()=>sales.document.querySelector('[data-transfer]'),'transfer confirmation UI');sales.document.querySelector('[data-transfer]').click();await wait(()=>!sales.document.querySelector('[data-transfer]'),'transfer confirmed');const transferred=(await state()).orders.find(row=>row.id===pending.id);check(transferred.estado==='procesada'&&transferred.totalCents===9720&&(await state()).product.stock_actual===2,'Sales confirms a transfer with the configured promotion and IVA once');
const promotionPage=await frame('/promociones.html');await wait(()=>promotionPage.document.getElementById('promotionCatalogue').textContent.includes('Promoción administrada'),'public promotion');check(true,'Public promotions display the administrative Firestore record');
// Exercise every administrative route, including aliases to the existing real-data editors.
await wait(()=>admin.erpApi&&admin.document.getElementById('erpOrdersProcessed').textContent==='2','ERP reflects both purchases');
const aliases={promociones:'comercio',productos:'scm-productos',clientes:'crm',pedidos:'erp',reportes:'erp'};
async function checkViews(w,role){
const allowed=w.RutaSalvajeAccess.allowedViews(role);
for(const view of allowed){const link=w.document.querySelector('.nav-link[data-view="'+view+'"]');check(link&&!link.classList.contains('hidden'),role+' can access '+view);link.click();await sleep(40);check(w.document.querySelector('.view-section.active')?.id==='view-'+(aliases[view]||view),role+' opens '+view);}
for(const link of w.document.querySelectorAll('.nav-link[data-view]'))if(!allowed.has(link.dataset.view))check(link.classList.contains('hidden'),role+' hides unauthorized '+link.dataset.view);
w.document.querySelector('.nav-link[data-view="erp"]').click();
for(const tab of w.document.querySelectorAll('[data-erp-tab]:not(.hidden)')){tab.click();check(w.document.querySelector('[data-erp-panel].active')?.dataset.erpPanel===tab.dataset.erpTab,role+' ERP opens '+tab.dataset.erpTab);}
}
await checkViews(admin,'admin');await checkViews(sales,'ventas');
const logistics=await frame('/admin.html?role=logistica&view=erp');await wait(()=>logistics.erpApi&&logistics.document.getElementById('erpOrdersProcessed').textContent==='2','logistics ERP');await checkViews(logistics,'logistica');
// The existing CRM, SCM and ERP screens must display the records created by checkout.
admin.document.querySelector('.nav-link[data-view="crm"]').click();await wait(()=>admin.document.getElementById('crmClientsTableBody').textContent.includes('Ana editada'),'CRM linkage');check(true,'CRM displays the same customer updated by the profile and checkout');
admin.document.querySelector('.nav-link[data-view="scm-inventario"]').click();await wait(()=>admin.document.getElementById('scmInventoryBody').textContent.includes('Tienda real'),'SCM inventory');const inventoryRow=[...admin.document.querySelectorAll('#scmInventoryBody tr')].find(row=>row.textContent.includes('Tienda real'));check(inventoryRow.cells[1].textContent==='2','SCM inventory displays stock after both purchases');inventoryRow.querySelector('.scm-history').click();check(admin.document.getElementById('scmHistoryList').textContent.includes('SALIDA'),'SCM history displays checkout inventory movements');admin.document.getElementById('scmHistoryClose').click();
admin.document.querySelector('.nav-link[data-view="erp"]').click();check(admin.document.getElementById('erpOrdersTable').textContent.includes('Ana editada')&&admin.document.getElementById('erpOrdersProcessed').textContent==='2','ERP orders and metrics include the same checkout sales');check(admin.document.getElementById('erpReportsTable').textContent.includes('232.00')&&admin.document.getElementById('erpProcessesTable').textContent.includes('Ana editada'),'ERP report and process screens include persisted checkout records');
const lookup=admin.document.getElementById('commerceWalletLookup');lookup.elements.uid.value='ana';lookup.dispatchEvent(new admin.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>!lookup.dataset.busy,'admin wallet lookup');check(admin.document.getElementById('adminWalletDetails').textContent.includes('Ajuste de prueba')&&admin.document.getElementById('adminWalletDetails').textContent.includes('walletTopup'),'Admin wallet lookup shows persisted balance and audit movements');
admin.document.querySelector('[data-edit-promo="CAMPING"]').click();promo.elements.activa.checked=false;promo.dispatchEvent(new admin.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>!promo.dataset.busy,'disable promotion');await wait(()=>!promotionPage.document.getElementById('promotionCatalogue').textContent.includes('Promoción administrada'),'promotion removed');check(admin.document.getElementById('commercePromoList').textContent.includes('Inactiva'),'Editing and disabling a promotion updates public and admin views');
const contact=await frame('/contacto.html');await wait(()=>contact.document.getElementById('correo').value==='ana@test.test','contact authenticated');const contactForm=contact.document.getElementById('contactForm');contactForm.elements.subject.value='Consulta desde contacto';contactForm.elements.mensaje.value='Seguimiento por contacto';contactForm.dispatchEvent(new contact.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>profile.document.getElementById('personalTickets').textContent.includes('Consulta desde contacto'),'contact ticket');check(true,'Contact form creates a persistent ticket visible in the profile');
for(const w of windows)errors.push(...(w.__rutaErrors||[]));
check(errors.length===0,'No uncaught browser errors: '+JSON.stringify(errors));document.getElementById('result').textContent=JSON.stringify({passed:results.length,results});
})().catch(error=>document.getElementById('result').textContent=JSON.stringify({error:error.stack,errors,results}));
</script></body></html>`;
const root = path.resolve('.');
async function body(req) { let data = ''; for await (const chunk of req) data += chunk; return JSON.parse(data); }
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
        if (url.pathname === '/mock-sdk.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(sdk); }
        if (url.pathname === '/scenario') { res.setHeader('Content-Type', 'text/html;charset=utf-8'); return res.end(scenario); }
        if (url.pathname.startsWith('/__')) {
            res.setHeader('Content-Type', 'application/json');
            if (url.pathname === '/__state') return res.end(JSON.stringify({ cart: db.records.get('carritos/ana'), wallet: db.records.get('monederos/ana'), product: db.records.get('scm_productos/p1'), config:db.records.get('configuracion/comercio'), profile:db.records.get('usuarios/ana'), orders: [...db.records].filter(([key]) => key.startsWith('erp_ordenes/')).map(([, value]) => value) }));
            const input = await body(req);
            if (url.pathname === '/__call') return res.end(JSON.stringify(await execute({ uid: input.uid, token: { email: `${input.uid}@test.test`, email_verified: true } }, input.data)));
            if (url.pathname === '/__write') { db.records.set(input.ref.path, { ...db.records.get(input.ref.path), ...input.data }); return res.end('{}'); }
            const ref = input.ref;
            if (ref.kind === 'doc') return res.end(JSON.stringify({ exists: db.records.has(ref.path), value: db.records.get(ref.path) }));
            const rows = [...db.records].filter(([key, value]) => key.startsWith(ref.path + '/') && key.split('/').length === ref.path.split('/').length + 1 && (ref.filters || []).every(filter => !filter.field || value[filter.field] === filter.value)).map(([key, value]) => ({ id: key.split('/').at(-1), value }));
            return res.end(JSON.stringify({ rows }));
        }
        const file = path.resolve(root, '.' + url.pathname);
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
        let source = fs.readFileSync(file, 'utf8');
        if (file.endsWith('.html')) source = source.replace(/<script\b[^>]*src="https:[^"]*"[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*href="https:[^>]*>/gi, '').replace(/<head>/i, `<head><script>window.tailwind={};window.__rutaErrors=[];addEventListener('error',e=>{if(e.message)__rutaErrors.push(location.pathname+': '+e.message);});addEventListener('unhandledrejection',e=>__rutaErrors.push(location.pathname+': '+String(e.reason?.stack||e.reason)));const logError=console.error;console.error=(...args)=>{__rutaErrors.push(location.pathname+': '+args.map(String).join(' '));logError(...args);};</script>`);
        source = source.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/12\.18\.0\/firebase-[a-z-]+\.js/g, '/mock-sdk.js').replace('import(`https://www.gstatic.com/firebasejs/${version}/firebase-${name}.js`)', "import('/mock-sdk.js')");
        res.setHeader('Content-Type', (file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html') + ';charset=utf-8'); res.end(source);
    } catch (error) { res.end(JSON.stringify({ error: error.message })); }
});
server.listen(0, '127.0.0.1', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ruta-commerce-browser-'));
    const browser = spawn(process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless', '--no-sandbox', '--disable-gpu', '--in-process-gpu', '--disable-software-rasterizer', '--no-first-run', '--disable-background-networking', '--user-data-dir=' + path.join(temp, 'profile'), '--dump-dom', '--virtual-time-budget=40000', `http://127.0.0.1:${server.address().port}/scenario`], { windowsHide: true });
    let output = '', error = ''; browser.stdout.on('data', chunk => output += chunk); browser.stderr.on('data', chunk => error = (error + chunk).slice(-2000));
    const deadline = setTimeout(() => browser.kill(), 90000);
    browser.once('exit', () => {
        clearTimeout(deadline); server.close();
        const raw = output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
        try { const result = JSON.parse(raw); console.log(JSON.stringify(result, null, 2)); assert(result.passed, raw); }
        catch (failure) { console.error(raw || error || failure); process.exitCode = 1; }
    });
});
