Ejemplo de integración (front-end) — uso de la API para crear un pedido

POST /api/orders

```js
// Checkout: enviar pedido al backend en lugar de localStorage
const order = {
  customer_id: 1, // o null para invitados
  items: cart.items,
  total: cart.total,
  currency: 'MXN',
  shipping: { name: form.name.value, address: form.address.value }
};

fetch('http://localhost:3001/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(order)
})
  .then(r => r.json())
  .then(created => console.log('Pedido creado', created))
  .catch(err => console.error(err));
```

POST /api/invoices

```js
fetch('http://localhost:3001/api/invoices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ order_id: created.id, fiscal: { rfc: 'XAXX010101000' } })
})
  .then(r => r.json())
  .then(inv => console.log('Factura', inv));
```

GET /api/orders

```js
fetch('http://localhost:3001/api/orders')
  .then(r => r.json())
  .then(list => renderOrders(list));
```
