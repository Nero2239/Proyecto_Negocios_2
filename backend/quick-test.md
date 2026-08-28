Prueba rápida (Windows PowerShell)

1) Abrir PowerShell y entrar en la carpeta backend

```powershell
cd "c:\Users\elchi\Documents\Actividades\Verano 2026 Negocios I\Proyecto\backend"
npm install
npm run seed
npm start
```

2) Verificar salud:

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

3) Crear un pedido (ejemplo curl / PowerShell):

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/orders -ContentType application/json -Body (@{ customer_id=1; items=@(@{title='Prueba';price=1;qty=1}); total=1 } | ConvertTo-Json)
```

4) Listar pedidos:

```powershell
Invoke-RestMethod http://localhost:3001/api/orders
```

Notas:
- Este backend es un prototipo con almacenamiento en archivo JSON (`backend/data/store.json`).
- Para producción se recomienda usar una base de datos relacional (Postgres/SQLite) y autenticación.
