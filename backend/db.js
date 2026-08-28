const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, 'data', 'store.json');

function ensureStore() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    const initial = { customers: [], orders: [], invoices: [], interactions: [] };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
  }
}

function readStore() {
  ensureStore();
  const raw = fs.readFileSync(STORE_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function getCollection(name) {
  const store = readStore();
  return store[name] || [];
}

function saveCollection(name, data) {
  const store = readStore();
  store[name] = data;
  writeStore(store);
}

function nextId(collectionName) {
  const coll = getCollection(collectionName);
  const max = coll.reduce((m, it) => Math.max(m, it.id || 0), 0);
  return max + 1;
}

module.exports = {
  readStore,
  writeStore,
  getCollection,
  saveCollection,
  nextId,
  STORE_PATH
};
