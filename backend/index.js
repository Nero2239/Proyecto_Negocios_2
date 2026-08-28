const express = require('express');
const cors = require('cors');
const path = require('path');

const customers = require('./routes/customers');
const orders = require('./routes/orders');
const invoices = require('./routes/invoices');
const interactions = require('./routes/interactions');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/customers', customers);
app.use('/api/orders', orders);
app.use('/api/invoices', invoices);
app.use('/api/interactions', interactions);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`CRM backend listening on http://localhost:${PORT}`));
