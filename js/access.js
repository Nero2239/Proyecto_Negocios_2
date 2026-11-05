(() => {
const views = {
    admin: ['dashboard', 'productos', 'pedidos', 'promociones', 'clientes', 'reportes', 'usuarios', 'crm', 'interacciones', 'dashboard-crm', 'mi-actividad', 'scm-dashboard', 'scm-productos', 'scm-inventario', 'scm-proveedores', 'scm-pedidos', 'scm-reportes', 'erp'],
    ventas: ['dashboard', 'crm', 'interacciones', 'dashboard-crm', 'mi-actividad', 'erp'],
    logistica: ['dashboard', 'scm-dashboard', 'scm-productos', 'scm-inventario', 'scm-proveedores', 'scm-pedidos', 'scm-reportes', 'erp'],
    usuario: []
};

function normalizeRole(role) {
    const value = String(role || '').trim().toLowerCase();
    return Object.hasOwn(views, value) ? value : 'usuario';
}

function allowedViews(role) {
    return new Set(views[normalizeRole(role)]);
}

function roleHome(role) {
    return ({ admin: 'dashboard', ventas: 'crm', logistica: 'scm-dashboard' })[normalizeRole(role)] || null;
}

function profileLinks(role) {
    const home = roleHome(role);
    if (!home) return [];
    const permitted = allowedViews(role);
    return [
        { id: 'adminPanelLink', view: home, label: ({ admin: 'Panel de administración', ventas: 'Panel de ventas', logistica: 'Panel de logística' })[normalizeRole(role)], icon: 'bi-speedometer2' },
        { view: 'erp', label: 'Operación ERP', icon: 'bi-diagram-3' },
        { view: 'crm', label: 'Clientes e interacciones CRM', icon: 'bi-people' },
        { view: 'scm-dashboard', label: 'Inventario y suministros SCM', icon: 'bi-boxes' },
        { view: 'usuarios', label: 'Usuarios y permisos', icon: 'bi-person-gear' }
    ].filter((link, index, links) => permitted.has(link.view) && links.findIndex(candidate => candidate.view === link.view) === index)
        .map(link => ({ ...link, href: `admin.html?view=${encodeURIComponent(link.view)}` }));
}


globalThis.RutaSalvajeAccess = Object.freeze({ normalizeRole, allowedViews, roleHome, profileLinks });
})();
