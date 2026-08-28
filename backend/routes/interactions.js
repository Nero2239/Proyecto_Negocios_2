const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const items = db.getCollection('interactions');
  res.json(items);
});

router.post('/', (req, res) => {
  const list = db.getCollection('interactions');
  const id = db.nextId('interactions');
  const now = new Date().toISOString();
  const item = Object.assign({ id, created_at: now }, req.body);
  list.push(item);
  db.saveCollection('interactions', list);
  res.status(201).json(item);
});

module.exports = router;
