// Toast Notification Function
function showToast(message, type = 'success') {
    // Remove any existing toasts
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Trigger the animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Hide the toast after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        // Remove the element after the animation completes
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}
// Helper para obtener la clave de almacenamiento específica del usuario
function getPublicationsStorageKey() {
    const userEmail = localStorage.getItem('userEmail');
    return userEmail ? `userPublications_${userEmail}` : null;
}

async function compressProductPhoto(file) {
    if (!file || !file.type.startsWith('image/')) throw new Error('Selecciona una imagen válida del equipo.');
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const imageData = canvas.toDataURL('image/jpeg', 0.78);
    if (imageData.length > 900000) throw new Error('La imagen sigue siendo muy grande. Usa una imagen más pequeña.');
    return imageData;
}

// --- Lógica para la página "Publicar Producto" ---
function initPublishProductPage() {
    const publishProductForm = document.getElementById('publishProductForm');
    if (!publishProductForm) return;

    publishProductForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const storageKey = getPublicationsStorageKey();

        if (!storageKey) {
            showToast('Debes iniciar sesión para publicar un producto.', 'error');
            return;
        }

        const name = document.getElementById('productName').value.trim();
        const price = document.getElementById('productPrice').value;
        const description = document.getElementById('productDescription').value.trim();
        const photoFile = document.getElementById('productPhoto').files[0];

        if (!name || !price || !description || !photoFile) {
            showToast('Completa los datos y agrega una foto del equipo.', 'error');
            return;
        }

        let photo;
        try {
            photo = await compressProductPhoto(photoFile);
        } catch (error) {
            showToast(error.message || 'No se pudo cargar la imagen.', 'error');
            return;
        }

        const product = {
            id: Date.now(),
            name: name,
            price: parseFloat(price),
            description: description,
            photo,
            stock: 1,
            condition: 'used'
        };

        let publications = JSON.parse(localStorage.getItem(storageKey) || '[]');
        publications.unshift(product);
        localStorage.setItem(storageKey, JSON.stringify(publications));

        showToast('Producto publicado con éxito.', 'success');
        publishProductForm.reset();
        renderMyPublications(); // Actualiza la lista de publicaciones en segundo plano

        setTimeout(() => {
            const publicationsTab = document.querySelector('.c2c-tab[data-view="publications"]');
            if (publicationsTab) {
                publicationsTab.click();
            }
        }, 1500);
    });

    const photoInput = document.getElementById('productPhoto');
    const photoPreview = document.getElementById('productPhotoPreview');
    photoInput?.addEventListener('change', async () => {
        if (!photoInput.files[0] || !photoPreview) return;
        try {
            photoPreview.src = await compressProductPhoto(photoInput.files[0]);
            photoPreview.classList.remove('hidden');
        } catch (error) {
            photoPreview.classList.add('hidden');
            showToast(error.message || 'No se pudo leer la imagen.', 'error');
        }
    });
}

// --- Lógica para la página "Mis Publicaciones" ---
function renderMyPublications() {
    const myPublicationsList = document.getElementById('myPublicationsList');
    if (!myPublicationsList) return;

    const storageKey = getPublicationsStorageKey();
    if (!storageKey || !localStorage.getItem('isLoggedIn')) {
        myPublicationsList.innerHTML = `<p class="text-center text-gray-500">Debes <a href="login.html" class="text-naranja font-semibold">iniciar sesión</a> para ver tus publicaciones.</p>`;
        return;
    }

    const publications = JSON.parse(localStorage.getItem(storageKey) || '[]');

    if (publications.length === 0) {
        myPublicationsList.innerHTML = `<p class="text-center text-gray-500">Aún no has publicado ningún producto.</p>`;
    } else {
        myPublicationsList.innerHTML = publications.map(product => `
            <div class="publication-card" id="publication-${product.id}">
                <img src="${product.photo}" alt="${product.name}" class="publication-photo">
                <div class="publication-body">
                    <h4 class="publication-title">${product.name}</h4>
                    <p class="publication-price">$${product.price.toFixed(2)}</p>
                    <p class="publication-description">${product.description}</p>
                </div>
                <div class="publication-actions">
                    <button class="btn btn-secondary btn-small" onclick="window.c2c.editPublication(${product.id})">Editar</button>
                    <button class="btn btn-danger btn-small" onclick="window.c2c.deletePublication(${product.id})">Eliminar</button>
                </div>
            </div>
        `).join('');
    }
}

function editPublication(productId) {
    const storageKey = getPublicationsStorageKey();
    if (!storageKey) return;

    const publications = JSON.parse(localStorage.getItem(storageKey) || '[]');
    // const product = publications.find(item => item.id === productId);
    // if (!product) return;

    // La edición con prompts fue eliminada. Se requiere un modal para una mejor UX.
    showToast('La función de edición no está disponible.', 'error');
}

function deletePublication(productId) {
    const storageKey = getPublicationsStorageKey();
    if (!storageKey) return;

    let publications = JSON.parse(localStorage.getItem(storageKey) || '[]');
    publications = publications.filter(p => p.id !== productId);
    localStorage.setItem(storageKey, JSON.stringify(publications));

    const cardToRemove = document.getElementById(`publication-${productId}`);
    if (cardToRemove) {
        cardToRemove.style.animation = 'fadeOut 0.5s ease forwards';
        cardToRemove.addEventListener('animationend', renderMyPublications, { once: true });
    } else {
        renderMyPublications();
    }
    showToast('Publicación eliminada.', 'success');
}

function initMyPublicationsPage() {
    renderMyPublications();
}

// --- Lógica para la página de Subasta ---
function initAuctionPage() {
    const auctionTimerEl = document.getElementById('auctionTimer');
    const bidForm = document.getElementById('bidForm');
    if (!auctionTimerEl || !bidForm) return;

    // Evitar duplicar el temporizador si se cambia de pestaña
    if (auctionTimerEl.dataset.initialized) return;
    auctionTimerEl.dataset.initialized = 'true';

    let timeLeft = 300; // 5 minutos
    let botInterval;

    const updateTimer = () => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const seconds = (timeLeft % 60).toString().padStart(2, '0');
        auctionTimerEl.textContent = `${minutes}:${seconds}`;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            clearInterval(botInterval);
            auctionTimerEl.textContent = "Finalizada";
            auctionTimerEl.closest('.auction-timer-card').classList.add('finished');
            bidForm.style.display = 'none';
        }
    };

    const timerInterval = setInterval(updateTimer, 1000);

    const botNames = ['AventureroX', 'MontañistaPro', 'Explorador_7', 'Ruta_Adicto'];
    const simulateBotBid = () => {
        if (timeLeft <= 10) return;

        const currentBidEl = document.getElementById('currentBid');
        const bidsList = document.getElementById('bidsList');
        const currentBid = parseFloat(currentBidEl.textContent.replace('$', ''));
        
        const newBid = currentBid + Math.random() * 5 + 1;
        currentBidEl.textContent = `$${newBid.toFixed(2)}`;
        
        const botName = botNames[Math.floor(Math.random() * botNames.length)];
        const newBidLi = document.createElement('li');
        newBidLi.innerHTML = `<span class="font-semibold text-bosque">${botName}</span> ofertó <span class="text-naranja font-bold">$${newBid.toFixed(2)}</span>`;
        newBidLi.style.animation = 'slideIn 0.5s ease forwards';
        bidsList.prepend(newBidLi);

        const bidAmountInput = document.getElementById('bidAmount');
        if(bidAmountInput) {
            bidAmountInput.min = Math.ceil(newBid + 1);
            bidAmountInput.placeholder = `> $${Math.ceil(newBid)}`;
        }
    };
    botInterval = setInterval(simulateBotBid, Math.random() * 8000 + 7000);

    bidForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const bidAmountInput = document.getElementById('bidAmount');
        const bidAmount = parseFloat(bidAmountInput.value);
        const currentBidEl = document.getElementById('currentBid');
        const bidsList = document.getElementById('bidsList');
        const currentBid = parseFloat(currentBidEl.textContent.replace('$', ''));

        if (!bidAmount) {
            showToast('Ingresa un monto para ofertar.', 'error');
            return;
        }

        if (bidAmount > currentBid) {
            currentBidEl.textContent = `$${bidAmount.toFixed(2)}`;
            const userName = localStorage.getItem('userName') || 'Tú';
            const newBidLi = document.createElement('li');
            newBidLi.innerHTML = `<span class="font-semibold text-bosque">${userName}</span> ofertó <span class="text-naranja font-bold">$${bidAmount.toFixed(2)}</span>`;
            newBidLi.style.animation = 'slideIn 0.5s ease forwards';
            bidsList.prepend(newBidLi);

            showToast('¡Oferta registrada con éxito!', 'success');
            bidAmountInput.value = '';
            bidAmountInput.min = bidAmount + 1;
            bidAmountInput.placeholder = `> $${bidAmount}`;
        } else {
            showToast('Tu oferta debe ser mayor a la actual.', 'error');
        }
    });
}

// --- Lógica de Pestañas y Inicialización ---
function setupC2CTabs() {
    const tabsContainer = document.getElementById('c2c-tabs');
    const viewsContainer = document.getElementById('c2c-views-container');
    if (!tabsContainer || !viewsContainer) return;

    const tabs = tabsContainer.querySelectorAll('.c2c-tab');
    const views = viewsContainer.querySelectorAll('.c2c-view');

    tabsContainer.addEventListener('click', (event) => {
        const clickedTab = event.target.closest('.c2c-tab');
        if (!clickedTab) return;

        const viewName = clickedTab.dataset.view;

        tabs.forEach(tab => tab.classList.remove('active'));
        clickedTab.classList.add('active');

        views.forEach(view => {
            view.classList.toggle('hidden', view.id !== `c2c-${viewName}-view`);
        });

        // Inicializar la subasta solo cuando se ve por primera vez
        if (viewName === 'auction') {
            initAuctionPage();
        }
    });
}

// --- Lógica para Comentarios desde el Perfil ---
function initProfileComments() {
    const profileCommentForm = document.getElementById('profileCommentForm');
    const COMMENTS_KEY = 'userCampaignComments'; // Use the same key as campana.js

    if (!profileCommentForm) return;

    profileCommentForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const commentInput = document.getElementById('profileCommentText');
        const commentText = commentInput.value.trim() || '...';

        const userName = localStorage.getItem('userName') || 'Anónimo';
        const newComment = {
            name: userName,
            text: commentText,
            date: 'Ahora mismo'
        };

        const comments = JSON.parse(localStorage.getItem('campaignComments') || '[]');
        comments.unshift(newComment);
        localStorage.setItem('campaignComments', JSON.stringify(comments));
        localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));

        showToast('Tu comentario ha sido publicado en la página de campaña.', 'success');
        commentInput.value = '';
    });
}

// --- Inicialización General ---
document.addEventListener('DOMContentLoaded', () => {
    // Si estamos en la página de perfil y el panel de vendedor existe
    if (document.getElementById('sellerDashboard')) {
        setupC2CTabs(); // Configura los listeners de las pestañas
        initPublishProductPage(); // Configura el formulario de publicación
        initMyPublicationsPage(); // Carga las publicaciones iniciales
        initProfileComments(); // Configura el formulario de comentarios del perfil
    }
});

// Exponer funciones al objeto window para poder llamarlas desde el HTML (onclick)
window.c2c = {
    editPublication,
    deletePublication
};