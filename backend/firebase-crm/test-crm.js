require('dotenv').config();
const admin = require('firebase-admin');

async function initFirebase() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      const serviceAccount = require(keyPath);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log('Inicializado Firebase Admin con service account');
      return;
    } catch (err) {
      console.warn('No se pudo cargar la service account desde GOOGLE_APPLICATION_CREDENTIALS:', err.message);
    }
  }

  try {
    admin.initializeApp();
    console.log('Inicializado Firebase Admin con entorno por defecto');
  } catch (err) {
    console.error('Error inicializando Firebase Admin:', err);
    process.exit(1);
  }
}

async function main() {
  await initFirebase();
  const db = admin.firestore();
  try {
    console.log('Creando cliente de prueba...');
    const payload = {
      nombre: 'Test User',
      correo: `test+${Date.now()}@example.com`,
      telefono: '0000000000',
      empresa: 'TestCo',
      fecha_registro: new Date().toISOString(),
      estado: 'activo'
    };
    const docRef = await db.collection('clientes').add(payload);
    console.log('Cliente creado con id:', docRef.id);

    console.log('\nListando últimos 5 clientes:');
    const snap = await db.collection('clientes').orderBy('fecha_registro', 'desc').limit(5).get();
    snap.forEach(d => console.log(d.id, d.data()));

    console.log('\nActualizando cliente de prueba...');
    await db.collection('clientes').doc(docRef.id).update({ telefono: '9999999999', empresa: 'UpdatedCo' });
    const updated = await db.collection('clientes').doc(docRef.id).get();
    console.log('Documento actualizado:', updated.id, updated.data());

    console.log('\nEliminando cliente de prueba...');
    await db.collection('clientes').doc(docRef.id).delete();
    console.log('Eliminado. Verificando que no existe...');
    const check = await db.collection('clientes').doc(docRef.id).get();
    console.log('Existe?', check.exists);
    console.log('\nPrueba completada correctamente.');
  } catch (err) {
    console.error('Error en pruebas CRM:', err);
  }
  process.exit(0);
}

main();
