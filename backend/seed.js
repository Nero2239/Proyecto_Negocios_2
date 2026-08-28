const fs = require('fs');
const path = require('path');
const db = require('./db');

function seed() {
  const customers = [
    { id: 1, name: 'Juan Pérez', email: 'juan@example.com', phone: '555-1234', address: 'Calle Falsa 123' },
    { id: 2, name: 'María López', email: 'maria@example.com', phone: '555-5678', address: 'Av. Siempreviva 742' }
  ];

  const orders = [
    { id: 1, orderNumber: 'RS-20260827-0001', customer_id: 1, items: [{ title: 'Tienda de campaña', price: 1200, qty:1 }], total: 1200, currency: 'MXN', status: 'delivered', created_at: new Date().toISOString() },
    { id: 2, orderNumber: 'RS-20260827-0002', customer_id: 2, items: [{ title: 'Saco de dormir', price: 450, qty:1 }], total: 450, currency: 'MXN', status: 'created', created_at: new Date().toISOString() }
  ];

  const invoices = [];
  const interactions = [
    { id: 1, customer_id: 1, type: 'call', note: 'Consultó stock', created_at: new Date().toISOString() }
  ];

  const store = { customers, orders, invoices, interactions };
  const storePath = path.join(__dirname, 'data', 'store.json');
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
  console.log('Seed complete. Wrote', storePath);
}

seed();
