// Importar funciones de Firebase desde CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAZCztGChAZ9k81WWBkp9TZBx9XphWqcmc",
  authDomain: "camping-3a6a4.firebaseapp.com",
  projectId: "camping-3a6a4",
  storageBucket: "camping-3a6a4.firebasestorage.app",
  messagingSenderId: "181839243079",
  appId: "1:181839243079:web:df39441f32098fc7ca4e62",
  measurementId: "G-F3WW9ZDP57"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Cloud Firestore
const db = getFirestore(app);

// Inicializar Analytics
const analytics = getAnalytics(app);

// Inicializar Auth
const auth = getAuth(app);

export { app, db, auth, analytics };

