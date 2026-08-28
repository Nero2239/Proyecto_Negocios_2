const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  const orders = db.getCollection('orders');
  res.json(orders);
});

router.post('/', (req, res) => {
  const list = db.getCollection('orders');
  const id = db.nextId('orders');
  const now = new Date().toISOString();
  const orderNumber = `RS-${now.slice(0,10).replace(/-/g,'')}-${String(id).padStart(4,'0')}`;
  const item = Object.assign({ id, orderNumber, created_at: now, status: 'created' }, req.body);
  list.push(item);
  db.saveCollection('orders', list);
  res.status(201).json(item);
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const item = db.getCollection('orders').find(o => o.id === id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

module.exports = router;
