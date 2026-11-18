'use strict';
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { createCommerce } = require('./commerce.cjs');
const { CommerceError } = require('./money.cjs');
const { randomUUID } = require('node:crypto');
const logger = require('firebase-functions/logger');
const PROJECT_ID = 'camping-3a6a4';
const REGION = 'us-central1';
initializeApp({ projectId: PROJECT_ID });
const execute = createCommerce(getFirestore());
// CORS includes localhost, the published site's origin and local file origins.
// Public HTTP invocation lets the Firebase SDK send its ID token; execute()
// still requires verified Firebase Authentication and checks the current role.
exports.commerce = onCall({ region: REGION, cors: true, invoker: 'public', maxInstances: 10, timeoutSeconds: 60 }, async request => {
    try {
        const runtimeProject = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
        if (runtimeProject && runtimeProject !== PROJECT_ID) throw new HttpsError('failed-precondition', 'La función commerce está ejecutándose en otro proyecto. Debe desplegarse en camping-3a6a4.', { category: 'configuration' });
        return await execute(request.auth, request.data);
    }
    catch (error) {
        if (error instanceof HttpsError) throw error;
        if (error instanceof CommerceError) {
            const category = error.code === 'unauthenticated' ? 'authentication' : error.code === 'permission-denied' ? 'authorization' : 'operation';
            throw new HttpsError(error.code, error.message, { category });
        }
        // Correlate server failures without logging payloads, identity or payment data.
        const reference = randomUUID();
        const action = typeof request.data?.action === 'string' && /^[a-zA-Z]{1,40}$/.test(request.data.action) ? request.data.action : 'invalid';
        const code = typeof error?.code === 'number' || (typeof error?.code === 'string' && /^[\w/-]{1,80}$/.test(error.code)) ? error.code : 'unknown';
        const frames = typeof error?.stack === 'string' ? error.stack.split('\n').slice(1, 7).map(line => line.match(/[/\\]([^/\\:()\s]+):(\d+):(\d+)\)?$/)?.slice(1).join(':')).filter(Boolean) : [];
        logger.error('commerce.failure', { reference, action, code, frames });
        if (code === 7 || code === 'permission-denied' || code === 'PERMISSION_DENIED') throw new HttpsError('failed-precondition', 'El backend de compras no tiene permisos para operar en Firestore. Revisa IAM de su cuenta de servicio.', { reference, category: 'backend-permissions' });
        if (code === 4 || code === 14 || code === 'unavailable' || code === 'deadline-exceeded') throw new HttpsError('unavailable', 'El servicio de datos no está disponible temporalmente. Reintenta la misma operación.', { reference, category: 'server' });
        throw new HttpsError('internal', 'El servidor no pudo completar la operación. Se conserva la clave de compra para reintentar sin duplicar el pago.', { reference, category: 'server' });
    }
});
