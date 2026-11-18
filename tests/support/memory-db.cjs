const assert = require('node:assert/strict');
function memoryDb() {
    const records = new Map(); let queue = Promise.resolve();
    const doc = path => ({ path, id: path.split('/').at(-1) });
    const snapshot = reference => ({ exists: records.has(reference.path), id: reference.id, data: () => structuredClone(records.get(reference.path)) });
    return { records, doc,
        collection: path => ({ where: (field, op, value) => ({ limit: () => ({ query: path, field, value }) }) }),
        runTransaction(fn) {
            const run = queue.then(async () => {
                let writing = false; const writes = [];
                const tx = { get: async ref => {
                    assert.equal(writing, false, 'Firestore requires all reads before writes');
                    if (ref.query) { const docs = [...records].filter(([path, data]) => path.startsWith(ref.query + '/') && data[ref.field] === ref.value).slice(0, 1).map(([path]) => snapshot(doc(path))); return { empty: docs.length === 0, docs }; }
                    return snapshot(ref);
                }, set: (ref, data, options) => { writing = true; writes.push([ref, data, options?.merge]); }, update: (ref, data) => { writing = true; writes.push([ref, data, true]); } };
                const result = await fn(tx);
                for (const [ref, data, merge] of writes) records.set(ref.path, merge ? { ...records.get(ref.path), ...structuredClone(data) } : structuredClone(data));
                return result;
            });
            queue = run.catch(() => {}); return run;
        }
    };
}
module.exports={memoryDb};
