require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'changeme';

// Initialize Firebase Admin
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({});
  } else if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  } else {
    console.warn('Firebase Admin SDK not fully configured. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_PROJECT_ID.');
    admin.initializeApp();
  }
} catch (err) {
  console.error('Firebase admin init error', err);
}

const db = admin.firestore();
const clientesCol = db.collection('clientes');

function requireApiKey(req, res, next) {
  const key = req.header('x-api-key') || req.query.api_key;
  if (!key || key !== ADMIN_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Create cliente
app.post('/api/clientes', requireApiKey, async (req, res) => {
  try {
    const { nombre, correo, telefono, empresa, estado } = req.body;
    if (!nombre || !correo) return res.status(400).json({ error: 'nombre y correo son obligatorios' });
    const payload = {
      nombre,
      correo,
      telefono: telefono || '',
      empresa: empresa || '',
      fecha_registro: new Date().toISOString(),
      estado: estado || 'activo'
    };
    const docRef = await clientesCol.add(payload);
    const doc = await docRef.get();
    return res.status(201).json({ id: docRef.id, ...doc.data() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'error interno' });
  }
});

// List clientes
app.get('/api/clientes', requireApiKey, async (req, res) => {
  try {
    const snapshot = await clientesCol.orderBy('fecha_registro', 'desc').get();
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json(list);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'error interno' });
  }
});

// Get cliente by id
app.get('/api/clientes/:id', requireApiKey, async (req, res) => {
  try {
    const doc = await clientesCol.doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'no encontrado' });
    return res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'error interno' });
  }
});

// Update cliente
app.put('/api/clientes/:id', requireApiKey, async (req, res) => {
  try {
    const data = {};
    ['nombre','correo','telefono','empresa','estado'].forEach(k => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
    data.updated_at = new Date().toISOString();
    await clientesCol.doc(req.params.id).set(data, { merge: true });
    const doc = await clientesCol.doc(req.params.id).get();
    return res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'error interno' });
  }
});

// Delete cliente
app.delete('/api/clientes/:id', requireApiKey, async (req, res) => {
  try {
    await clientesCol.doc(req.params.id).delete();
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'error interno' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`CRM API listening on port ${port}`));
