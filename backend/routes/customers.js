const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  const customers = db.getCollection('customers');
  res.json(customers);
});

router.post('/', (req, res) => {
  const list = db.getCollection('customers');
  const id = db.nextId('customers');
  const now = new Date().toISOString();
  const item = Object.assign({ id, created_at: now }, req.body);
  list.push(item);
  db.saveCollection('customers', list);
  res.status(201).json(item);
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const item = db.getCollection('customers').find(c => c.id === id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const list = db.getCollection('customers');
  const idx = list.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const updated = Object.assign({}, list[idx], req.body, { updated_at: new Date().toISOString() });
  list[idx] = updated;
  db.saveCollection('customers', list);
  res.json(updated);
});

module.exports = router;
