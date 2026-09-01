# Firebase CRM Backend (test)

This folder contains a small Express proxy (`index.js`) and a test script (`test-crm.js`) to exercise Firestore `clientes` collection using the Firebase Admin SDK.

Quick start (Windows PowerShell):

1. Copy `.env.example` to `.env` and set `ADMIN_API_KEY` and `GOOGLE_APPLICATION_CREDENTIALS` (path to your service account JSON) or set `FIREBASE_PROJECT_ID` if running in a Google-authenticated environment.

2. Install dependencies and run server:

```powershell
cd "c:\Users\elchi\Documents\Actividades\Verano 2026 Negocios I\Proyecto\backend\firebase-crm"
npm install
npm start
```

3. Run the test script (it will create, update, list and delete a test client):

```powershell
node test-crm.js
```

Notes:
- Ensure the service account has Firestore permissions.
- The Express proxy is optional: the admin panel already supports direct Firestore access from the browser via `window.__firebase`.
