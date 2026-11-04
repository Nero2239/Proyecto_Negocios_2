// Serialize refreshes so an older request cannot overwrite a more recent change.
export function createRefreshQueue(refresh) {
    let task = null;
    let pending = false;
    return function requestRefresh() {
        pending = true;
        if (!task) {
            task = Promise.resolve().then(async () => {
                while (pending) {
                    pending = false;
                    await refresh();
                }
            }).finally(() => { task = null; });
        }
        return task;
    };
}

// Firestore delivers changes from this page, other tabs and other signed-in devices.
export function watchChanges({ onSnapshot, references, refresh, onError, delay = 80 }) {
    const requestRefresh = createRefreshQueue(refresh);
    const reportError = onError || (error => console.error('Error de sincronización:', error));
    let subscriptions = [];
    let timer = null;
    let stopped = false;

    function scheduleRefresh() {
        if (stopped) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            requestRefresh().catch(reportError);
        }, delay);
    }

    function start() {
        stopped = false;
        subscriptions = references.map(reference => onSnapshot(reference, scheduleRefresh, reportError));
    }

    function suspend() {
        stopped = true;
        clearTimeout(timer);
        subscriptions.forEach(unsubscribe => unsubscribe());
        subscriptions = [];
    }

    function resume(event) {
        if (event.persisted && stopped) start();
    }

    start();
    globalThis.addEventListener?.('pagehide', suspend);
    globalThis.addEventListener?.('pageshow', resume);
    return () => {
        suspend();
        globalThis.removeEventListener?.('pagehide', suspend);
        globalThis.removeEventListener?.('pageshow', resume);
    };
}
