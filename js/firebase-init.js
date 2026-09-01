// Firebase initialization and small wrapper for Firestore operations
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAZCztGChAZ9k81WWBkp9TZBx9XphWqcmc",
  authDomain: "camping-3a6a4.firebaseapp.com",
  projectId: "camping-3a6a4",
  storageBucket: "camping-3a6a4.firebasestorage.app",
  messagingSenderId: "181839243079",
  appId: "1:181839243079:web:df39441f32098fc7ca4e62",
  measurementId: "G-F3WW9ZDP57"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function addOrder(order) {
  try {
    const payload = Object.assign({}, order, { created_at: new Date().toISOString() });
    const docRef = await addDoc(collection(db, 'orders'), payload);
    return { id: docRef.id, ...payload };
  } catch (err) {
    console.error('Firebase addOrder error', err);
    throw err;
  }
}

async function getOrdersByEmail(email) {
  try {
    if (!email) return [];
    const q = query(collection(db, 'orders'), where('customerEmail', '==', email), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => Object.assign({ id: d.id }, d.data()));
  } catch (err) {
    console.error('Firebase getOrdersByEmail error', err);
    return [];
  }
}

// Clientes CRUD
async function addClient(client) {
  try {
    const payload = Object.assign({}, client, { fecha_registro: new Date().toISOString() });
    const docRef = await addDoc(collection(db, 'clientes'), payload);
    return { id: docRef.id, ...payload };
  } catch (err) {
    console.error('Firebase addClient error', err);
    throw err;
  }
}

async function getClients() {
  try {
    const q = query(collection(db, 'clientes'), orderBy('fecha_registro', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => Object.assign({ id: d.id }, d.data()));
  } catch (err) {
    console.error('Firebase getClients error', err);
    return [];
  }
}

async function getClientById(id) {
  try {
    const mod = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js');
    const { doc, getDoc } = mod;
    const d = await getDoc(doc(db, 'clientes', id));
    if (!d.exists()) return null;
    return { id: d.id, ...d.data() };
  } catch (err) {
    console.error('Firebase getClientById error', err);
    return null;
  }
}

async function updateClient(id, data) {
  try {
    const mod = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js');
    const { doc, updateDoc } = mod;
    const ref = doc(db, 'clientes', id);
    await updateDoc(ref, Object.assign({}, data, { updated_at: new Date().toISOString() }));
    const { getDoc } = mod;
    const updated = await getDoc(ref);
    return { id: updated.id, ...updated.data() };
  } catch (err) {
    console.error('Firebase updateClient error', err);
    throw err;
  }
}

async function deleteClient(id) {
  try {
    // need deleteDoc and doc imports; dynamic import
    const mod = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js');
    const { doc, deleteDoc } = mod;
    await deleteDoc(doc(db, 'clientes', id));
    return true;
  } catch (err) {
    console.error('Firebase deleteClient error', err);
    throw err;
  }
}

// Expose a simple global API for non-module scripts
window.__firebase = {
  addOrder,
  getOrdersByEmail
};

// extend global API for clients
window.__firebase.addClient = addClient;
window.__firebase.getClients = getClients;
window.__firebase.getClientById = getClientById;
window.__firebase.updateClient = updateClient;
window.__firebase.deleteClient = deleteClient;
