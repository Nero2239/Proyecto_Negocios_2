function addComment(event) {
    event.preventDefault();

    const nameInput = document.getElementById('commentName');
    const commentInput = document.getElementById('commentText');
    const feedback = document.getElementById('commentFeedback');
    const list = document.getElementById('commentsList');

    if (!nameInput || !commentInput || !list || !feedback) return;

    const name = nameInput.value.trim();
    const text = commentInput.value.trim();
    const ratingSelect = document.getElementById('commentRating');
    const rating = ratingSelect ? Number(ratingSelect.value) : 5;
    if (!name || !text) return;

    const stars = '★★★★★'.slice(0, rating) + '☆☆☆☆☆'.slice(0, 5 - rating);
    const newComment = document.createElement('article');
    newComment.className = 'comment-card';
    newComment.innerHTML = `
        <div class="flex items-center justify-between gap-4">
            <div>
                <p class="font-semibold text-bosque">${name}</p>
                <p class="text-sm text-gray-500">Ahora</p>
            </div>
            <span class="text-sm text-amber-600 font-semibold">${stars}</span>
        </div>
        <p class="mt-3 text-gray-700">${text}</p>
    `;

    list.prepend(newComment);
    nameInput.value = '';
    commentInput.value = '';

    feedback.classList.remove('hidden');
    setTimeout(() => feedback.classList.add('hidden'), 2800);
}


document.addEventListener('DOMContentLoaded', async () => {
 const api=window.RutaCommerce, esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 document.getElementById('commentForm')?.addEventListener('submit',addComment);
 async function refresh(){
  const promos=await api.read('promociones');window.rutaPromotions=promos;
  const active=promos.filter(row=>row.activa&&Date.parse(row.inicio)<=Date.now()&&Date.parse(row.fin)>=Date.now()&&(!row.limiteUsos||row.usos<row.limiteUsos));
  document.getElementById('promotionCatalogue').innerHTML=active.map(row=>'<article class="promo-card"><h3>'+esc(row.nombre)+'</h3><p>'+row.descuentoBps/100+'% · Código '+esc(row.id)+'</p><p>Compra mínima: '+api.money(row.minimoCents)+' · Vigente hasta '+esc(new Date(row.fin).toLocaleString('es-MX'))+'</p><p>'+esc(row.categoria||'Todas las categorías')+' '+esc(row.productoId||'')+'</p><button class="btn btn-primary" data-promo="'+esc(row.id)+'" type="button">Usar en el carrito</button></article>').join('')||'<p>No hay promociones vigentes.</p>';
  for(const button of document.querySelectorAll('[data-promo]'))button.onclick=()=>{localStorage.setItem('campingPromo',button.dataset.promo);location.href='equipo.html?openCart=1';};
  document.getElementById('totalValue').textContent=api.money(JSON.parse(localStorage.getItem('campingCart')||'[]').reduce((n,row)=>n+Math.round(Number(row.price||0)*100)*row.quantity,0));
  const product=(await api.read('scm_productos')).find(row=>row.activo!==false&&row.stock_actual>0);
  document.getElementById('promotionFeatured').innerHTML=product?'<h3>'+esc(product.nombre)+'</h3><p>'+esc(product.descripcion)+'</p><p>'+api.money(Math.round(Number(product.precio_venta??product.precio??product.costo_unitario)*100))+' antes de IVA</p><a class="btn btn-secondary" href="equipo.html">Ver en el catálogo</a>':'<p>Consulta las existencias en el catálogo.</p>';
 }
 try {const ctx=await api.init();await refresh();window.RutaSalvajeLiveSync.watchChanges({onSnapshot:ctx.dbSdk.onSnapshot,references:[ctx.dbSdk.collection(ctx.db,'promociones'),ctx.dbSdk.collection(ctx.db,'scm_productos')],refresh,onError:error=>{document.getElementById('promotionCatalogue').textContent=error.message;}});}
 catch(error){document.getElementById('promotionCatalogue').textContent='No se pudieron cargar las promociones: '+error.message;}
});
