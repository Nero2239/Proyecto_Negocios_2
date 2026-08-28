const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/', (req, res) => {
  // Simula la creación de una factura basada en un pedido
  const invoices = db.getCollection('invoices');
  const id = db.nextId('invoices');
  const now = new Date().toISOString();
  const payload = req.body || {};
  const invoiceNumber = `F-${now.slice(0,10).replace(/-/g,'')}-${String(id).padStart(4,'0')}`;
  const invoice = Object.assign({ id, invoiceNumber, created_at: now }, payload);
  invoices.push(invoice);
  db.saveCollection('invoices', invoices);
  res.status(201).json(invoice);
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const item = db.getCollection('invoices').find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

module.exports = router;
