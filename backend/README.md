Ruta Salvaje — CRM Backend (Prototype)

Este backend es un prototipo ligero para el módulo CRM del proyecto.
Usa un almacén JSON simple para evitar dependencias nativas y facilitar pruebas locales.

Rápido:

1. Instalar dependencias:

```powershell
cd backend
npm install
```

2. Sembrar datos de ejemplo:

```powershell
npm run seed
```

3. Iniciar el servidor:

```powershell
npm start
```

Por defecto el servidor arranca en `http://localhost:3001`.

API básica:
- `GET /api/health` - estado
- `GET /api/customers` - listar
- `POST /api/customers` - crear
- `GET /api/customers/:id` - obtener cliente
- `PUT /api/customers/:id` - actualizar
- `GET /api/orders` - listar pedidos
- `POST /api/orders` - crear pedido
- `GET /api/orders/:id` - obtener pedido
- `POST /api/invoices` - generar factura (simulada)
- `GET /api/invoices/:id` - obtener factura
- `GET /api/interactions` - listar interacciones
- `POST /api/interactions` - crear interacción

Integración front-end:
- Cambiar llamadas de `localStorage` a `fetch('http://localhost:3001/api/orders', { method:'POST', body: JSON.stringify(order) })` cuando esté disponible.
