document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginView = document.getElementById('loginView');
    const registerView = document.getElementById('registerView');
    const recoverPasswordView = document.getElementById('recoverPasswordView');
    const recoveryStep1 = document.getElementById('recoveryStep1');
    const recoveryStep2 = document.getElementById('recoveryStep2');
    const sendCodeBtn = document.getElementById('sendCodeBtn');
    const continueRecoveryBtn = document.getElementById('continueRecoveryBtn');
    const submitRecoveryBtn = document.getElementById('submitRecoveryBtn');
    const messageBox = document.getElementById('messageBox');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const backToLoginBtn = document.getElementById('backToLoginBtn');
    const backToLoginFromRecoveryBtn = document.getElementById('backToLoginFromRecoveryBtn');
    const firebaseConfig = {
        apiKey: 'AIzaSyAZCztGChAZ9k81WWBkp9TZBx9XphWqcmc',
        authDomain: 'camping-3a6a4.firebaseapp.com',
        projectId: 'camping-3a6a4',
        storageBucket: 'camping-3a6a4.firebasestorage.app',
        messagingSenderId: '181839243079',
        appId: '1:181839243079:web:df39441f32098fc7ca4e62'
    };
    let firebaseContextPromise;

    function getFirebaseContext() {
        if (!firebaseContextPromise) {
            firebaseContextPromise = Promise.all([
                import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'),
                import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js'),
                import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js')
            ]).then(([authSdk, firestoreSdk, appSdk]) => {
                const app = appSdk.initializeApp(firebaseConfig);
                return { auth: authSdk.getAuth(app), authSdk, db: firestoreSdk.getFirestore(app), firestoreSdk };
            });
        }
        return firebaseContextPromise;
    }

    function clearMessageBox() {
        if (messageBox) {
            messageBox.innerHTML = '';
        }
    }

    function showMessage(text, type = 'success', showClose = false) {
        if (!messageBox) return;
        const className = type === 'error' ? 'message-error' : 'message-success';
        const wrapper = document.createElement('div');
        wrapper.className = `${className} flex items-center justify-between gap-4`;
        const message = document.createElement('span');
        message.textContent = text;
        wrapper.appendChild(message);
        if (showClose) {
            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.id = 'messageCloseBtn';
            closeButton.className = 'rounded-full bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20';
            closeButton.textContent = 'Cerrar';
            closeButton.addEventListener('click', () => { clearMessageBox(); showLoginForm(); });
            wrapper.appendChild(closeButton);
        }
        messageBox.replaceChildren(wrapper);

        if (!showClose) {
            setTimeout(() => {
                clearMessageBox();
            }, 5000);
        }
    }

    function showRegisterForm() {
        loginView?.classList.add('hidden');
        recoverPasswordView?.classList.add('hidden');
        registerView?.classList.remove('hidden');
        clearMessageBox();
    }

    function showLoginForm() {
        registerView?.classList.add('hidden');
        recoverPasswordView?.classList.add('hidden');
        loginView?.classList.remove('hidden');
        clearMessageBox();
    }

    function showRecoverPasswordForm() {
        loginView?.classList.add('hidden');
        registerView?.classList.add('hidden');
        recoverPasswordView?.classList.remove('hidden');
        recoveryStep1?.classList.remove('hidden');
        recoveryStep2?.classList.add('hidden');
        clearMessageBox();
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async function (event) {
            event.preventDefault();
            const email = document.getElementById('loginEmail').value.trim().toLowerCase();
            const password = document.getElementById('loginPassword').value;
            const remember = document.getElementById('rememberCheck').checked;
            try {
                const { auth, authSdk, db, firestoreSdk } = await getFirebaseContext();
                await authSdk.setPersistence(auth, remember ? authSdk.browserLocalPersistence : authSdk.browserSessionPersistence);
                const credential = await authSdk.signInWithEmailAndPassword(auth, email, password);
                const user = credential.user;
                if (!user.emailVerified) {
                    await authSdk.sendEmailVerification(user);
                    await authSdk.signOut(auth);
                    showMessage('Confirma tu correo electrónico desde el enlace que te enviamos antes de iniciar sesión.', 'error');
                    return;
                }

                const profileRef = firestoreSdk.doc(db, 'usuarios', user.uid);
                let profileSnapshot = await firestoreSdk.getDoc(profileRef);
                if (!profileSnapshot.exists()) {
                    const legacyQuery = firestoreSdk.query(firestoreSdk.collection(db, 'usuarios'), firestoreSdk.where('email', '==', email));
                    const legacySnapshot = await firestoreSdk.getDocs(legacyQuery);
                    const legacyProfile = legacySnapshot.docs[0]?.data();
                    if (['admin', 'ventas', 'logistica'].includes(String(legacyProfile?.rol || '').toLowerCase())) {
                        await authSdk.signOut(auth);
                        showMessage('Tu rol anterior debe migrarse a tu UID por un administrador antes de usar el panel.', 'error');
                        return;
                    }
                    await firestoreSdk.setDoc(profileRef, {
                        uid: user.uid,
                        auth_uid: user.uid,
                        email: user.email.toLowerCase(),
                        nombre: user.displayName || legacyProfile?.nombre || email.split('@')[0],
                        rol: 'usuario',
                        creado_en: new Date().toISOString()
                    });
                    profileSnapshot = await firestoreSdk.getDoc(profileRef);
                }
                const profile = profileSnapshot.data();
                if (profile.auth_uid !== user.uid || profile.email !== user.email.toLowerCase()) {
                    await authSdk.signOut(auth);
                    throw new Error('El perfil Firestore no coincide con la cuenta autenticada. Solicita su migración por UID.');
                }
                const normalizedRole = ['admin', 'ventas', 'logistica'].includes(String(profile.rol || '').toLowerCase()) ? profile.rol.toLowerCase() : 'user';
                await firestoreSdk.updateDoc(profileRef, { ultimo_acceso: new Date().toISOString() });
                const clientQuery = firestoreSdk.query(firestoreSdk.collection(db, 'clientes'), firestoreSdk.where('correo', '==', user.email.toLowerCase()));
                const clientSnapshot = await firestoreSdk.getDocs(clientQuery);
                if (clientSnapshot.empty) {
                    await firestoreSdk.addDoc(firestoreSdk.collection(db, 'clientes'), {
                        nombre: profile.nombre || user.displayName || email.split('@')[0],
                        correo: user.email.toLowerCase(),
                        telefono: '',
                        empresa: '',
                        estado: 'activo',
                        etapa_crm: 'Prospecto',
                        fecha_registro: new Date().toISOString()
                    });
                }

                localStorage.setItem('userEmail', user.email.toLowerCase());
                localStorage.setItem('userName', profile.nombre || user.displayName || email.split('@')[0]);
                localStorage.setItem('userUid', user.uid);
                localStorage.setItem('userRole', normalizedRole);
                localStorage.setItem('isLoggedIn', '1');
                localStorage.setItem('rememberUser', remember ? '1' : '0');
                sessionStorage.setItem('lastEmail', email);

                const opensBusinessPanel = ['admin', 'ventas', 'logistica'].includes(normalizedRole);
                showMessage(opensBusinessPanel ? 'Acceso verificado. Abriendo el panel empresarial…' : 'Acceso verificado. Abriendo tu perfil…');
                setTimeout(() => { window.location.href = opensBusinessPanel ? 'admin.html' : 'profile.html'; }, 500);
            } catch (error) {
                console.error('No se pudo iniciar sesión:', error);
                const messages = {
                    'auth/operation-not-allowed': 'El acceso con correo y contraseña está desactivado. Un administrador debe habilitarlo en Firebase Console > Authentication > Sign-in method.',
                    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
                    'auth/user-not-found': 'No existe una cuenta con ese correo.',
                    'auth/wrong-password': 'Correo o contraseña incorrectos.',
                    'auth/invalid-email': 'Escribe un correo válido.',
                    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
                };
                showMessage(messages[error.code] || error.message || 'No se pudo iniciar sesión.', 'error');
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async function (event) {
            event.preventDefault();
            const email = document.getElementById('registerEmail').value.trim().toLowerCase();
            const name = document.getElementById('registerName').value.trim();
            const password = document.getElementById('registerPassword').value;
            try {
                const { auth, authSdk } = await getFirebaseContext();
                await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
                const credential = await authSdk.createUserWithEmailAndPassword(auth, email, password);
                if (name) await authSdk.updateProfile(credential.user, { displayName: name });
                await authSdk.sendEmailVerification(credential.user);
                await authSdk.signOut(auth);
                localStorage.removeItem('userEmail');
                localStorage.removeItem('userName');
                localStorage.removeItem('userUid');
                localStorage.removeItem('userRole');
                localStorage.removeItem('isLoggedIn');
                registerForm.reset();
                showLoginForm();
                showMessage('Cuenta creada. Confirma tu correo con el enlace que te enviamos y después inicia sesión.', 'success', true);
            } catch (error) {
                console.error('No se pudo registrar la cuenta:', error);
                const messages = {
                    'auth/operation-not-allowed': 'El registro con correo y contraseña está desactivado. Un administrador debe habilitarlo en Firebase Console > Authentication > Sign-in method.',
                    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
                    'auth/invalid-email': 'Escribe un correo válido.',
                    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.'
                };
                showMessage(messages[error.code] || error.message || 'No se pudo crear la cuenta.', 'error');
            }
        });
    }

    if (sendCodeBtn) {
        sendCodeBtn.addEventListener('click', async () => {
            const email = document.getElementById('recoverEmail').value.trim().toLowerCase();
            if (!email) return showMessage('Escribe el correo de tu cuenta.', 'error');
            try {
                const { auth, authSdk } = await getFirebaseContext();
                await authSdk.sendPasswordResetEmail(auth, email);
            } catch (error) {
                console.warn('No se pudo solicitar el restablecimiento:', error);
            }
            showMessage('Si el correo corresponde a una cuenta, recibirás un enlace para restablecer la contraseña.', 'success');
        });
    }

    showRegisterBtn?.addEventListener('click', showRegisterForm);
    backToLoginBtn?.addEventListener('click', showLoginForm);
    backToLoginFromRecoveryBtn?.addEventListener('click', showLoginForm);
    forgotPasswordBtn?.addEventListener('click', showRecoverPasswordForm);

    (function () {
        const remembered = localStorage.getItem('rememberUser');
        const saved = localStorage.getItem('userEmail') || sessionStorage.getItem('lastEmail');
        const input = document.getElementById('loginEmail');
        const chk = document.getElementById('rememberCheck');

        if (saved && input) {
            input.value = saved;
        }
        if (remembered && chk) {
            chk.checked = true;
        }
    })();

    async function logout() {
        try {
            const { auth, authSdk } = await getFirebaseContext();
            await authSdk.signOut(auth);
        } catch (error) {
            console.warn('No se pudo cerrar la sesión Firebase:', error);
        }
        localStorage.removeItem('userEmail');
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userName');
        localStorage.removeItem('userUid');
        localStorage.removeItem('userRole');
        localStorage.removeItem('rememberUser');
        updateAuthUI(); // Re-render the UI to show the logged-out state
        // If on a protected page, redirect to home
        if (window.location.pathname.includes('profile.html') || window.location.pathname.includes('admin.html')) {
            window.location.href = 'index.html';
        }
    }

    function updateAuthUI() {
        const navAuthContainer = document.getElementById('nav-auth-buttons');
        const profileEmail = document.getElementById('profileEmail');
        const userEmail = localStorage.getItem('userEmail') || '';
        const isLoggedIn = localStorage.getItem('isLoggedIn') === '1' || Boolean(userEmail);
        const displayName = (localStorage.getItem('userName') || userEmail.split('@')[0]) || 'Usuario';

        if (navAuthContainer) {
            if (isLoggedIn && userEmail) {
                navAuthContainer.innerHTML = `
                    <a href="profile.html" class="hidden md:flex items-center gap-2 text-sm uppercase tracking-wider text-[#2C302E]/80 hover:text-[#606C5A] transition-colors" title="${userEmail}">
                        <i class="bi bi-person-circle"></i>
                        <span>${displayName}</span>
                    </a>
                    <button id="navLogoutBtn" title="Cerrar sesión" class="hidden md:block text-[#2C302E]/80 hover:text-[#606C5A] transition-colors text-xl"><i class="bi bi-box-arrow-right"></i></button>
                    <button id="openCartButton" class="relative border border-transparent hover:border-[#2C302E]/30 rounded-full p-2 transition-colors" type="button">
                        <i class="bi bi-cart3 text-xl text-[#2C302E]"></i>
                        <span id="cartCount" class="absolute -top-1 -right-1 bg-[#606C5A] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">0</span>
                    </button>
                `;
                document.getElementById('navLogoutBtn')?.addEventListener('click', logout);
            } else {
                navAuthContainer.innerHTML = `
                    <a href="login.html" class="hidden md:block border border-[#2C302E] px-5 py-2 rounded-full text-xs uppercase tracking-widest hover:bg-[#2C302E] hover:text-[#F9F6F0] transition-all duration-300">
                        Login
                    </a>
                    <button id="openCartButton" class="relative border border-transparent hover:border-[#2C302E]/30 rounded-full p-2 transition-colors" type="button">
                        <i class="bi bi-cart3 text-xl text-[#2C302E]"></i>
                        <span id="cartCount" class="absolute -top-1 -right-1 bg-[#606C5A] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">0</span>
                    </button>
                `;
            }
            // After innerHTML is replaced, we need to update the cart count from shop's state
            if (window.shop && typeof window.shop.renderCart === 'function') {
                // Calling renderCart is better as it updates multiple count displays
                window.shop.renderCart();
            }
        }

        if (profileEmail) {
            profileEmail.textContent = isLoggedIn && userEmail ? userEmail : 'paramore@ruta.com';
        }
    }

    updateAuthUI();

    const mainLogoutButton = document.querySelector('a[href="login.html"].btn-secondary');
    mainLogoutButton?.addEventListener('click', function (event) {
        event.preventDefault();
        logout();
    });
});
