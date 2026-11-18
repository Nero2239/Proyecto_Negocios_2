const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const jar = process.env.FIRESTORE_EMULATOR_JAR || path.join(process.env.USERPROFILE || process.env.HOME, '.cache/firebase/emulators/cloud-firestore-emulator-v1.22.0.jar');
if (!fs.existsSync(jar)) throw new Error('Configura FIRESTORE_EMULATOR_JAR con el .jar oficial del emulador Firestore.');
const port = 8787, host = `127.0.0.1:${port}`;
function probe() { return new Promise(resolve => { const socket = net.connect(port, '127.0.0.1'); socket.once('connect', () => { socket.destroy(); resolve(true); }); socket.once('error', () => resolve(false)); }); }
(async () => {
    if (await probe()) throw new Error(`Puerto ${port} ocupado; no se borrarán datos de otro emulador.`);
    // The emulator's rules diagnostics ship an English bundle; es_MX can crash on rejected requests.
    const emulator = spawn(process.env.JAVA_BIN || 'java', ['-Duser.language=en', '-Duser.country=US', '-jar', jar, '--host', '127.0.0.1', '--port', String(port), '--project_id', 'demo-ruta-etapa4', '--rules', 'firestore.rules'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = ''; const logFile = path.join(require('node:os').tmpdir(), 'ruta-etapa4-emulator.log'); fs.writeFileSync(logFile, '');
    const log = data => { logs = (logs + data).slice(-10000); fs.appendFileSync(logFile, data); };
    emulator.stdout.on('data', log); emulator.stderr.on('data', log);
    emulator.on('error', error => console.error(error.message));
    try {
        let ready = false;
        for (let i = 0; i < 100; i++) { if (await probe()) { ready = true; break; } await new Promise(resolve => setTimeout(resolve, 200)); }
        if (!ready) throw new Error('El emulador no inició: ' + logs);
        const code = await new Promise(resolve => {
            const child = spawn(process.execPath, ['--test', 'tests/emulator.test.cjs'], { windowsHide: true, stdio: 'inherit', env: { ...process.env, FIRESTORE_EMULATOR_HOST: host, GCLOUD_PROJECT: 'demo-ruta-etapa4' } });
            const deadline = setTimeout(() => { console.error('Pruebas excedieron 120s. Registro: ' + logFile); child.kill(); }, 120000);
            child.once('exit', code => { clearTimeout(deadline); resolve(code === null ? 1 : code); });
        });
        process.exitCode = code || 0;
    } finally { emulator.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
