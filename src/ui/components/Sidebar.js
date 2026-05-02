const NAV_ITEMS = [
    { route: 'home', label: 'Ana Sayfa' },
    { route: 'live', label: 'Canli TV' },
    { route: 'movies', label: 'Filmler' },
    { route: 'series', label: 'Diziler' },
    { route: 'favorites', label: 'Favoriler' },
    { route: 'settings', label: 'Ayarlar' }
];

const getSidebarElement = () => document.getElementById('main-sidebar');

const createItemMarkup = (item, activeRoute) => {
    const isActive = item.route === activeRoute;
    const activeClass = isActive ? ' active focused' : '';
    const activeState = isActive ? 'true' : 'false';

    return `
        <button
            type="button"
            class="nav-item focusable${activeClass}"
            data-route="${item.route}"
            aria-current="${activeState}"
        >
            <span class="nav-item-label">${item.label}</span>
        </button>
    `;
};

export const setActivePage = (routeName) => {
    const sidebar = getSidebarElement();

    if (!sidebar) {
        return false;
    }

    sidebar.querySelectorAll('.nav-item').forEach((item) => {
        const isActive = item.dataset.route === routeName;
        item.classList.toggle('active', isActive);
        item.classList.toggle('focused', isActive);
        item.setAttribute('aria-current', isActive ? 'true' : 'false');
    });

    return true;
};

export const renderSidebar = (activeRoute = 'home') => {
    const sidebar = getSidebarElement();

    if (!sidebar) {
        return false;
    }

    sidebar.classList.add('sidebar-shell');
    sidebar.setAttribute('aria-expanded', 'true');
    sidebar.innerHTML = `
        <div class="sidebar-brand">
            <div class="sidebar-brand-mark">FONEX</div>
            <div class="sidebar-brand-subtitle">IPTV Player</div>
        </div>
        <div class="sidebar-nav">
            ${NAV_ITEMS.map((item) => createItemMarkup(item, activeRoute)).join('')}
        </div>
    `;

    sidebar.querySelectorAll('.nav-item').forEach((item) => {
        item.addEventListener('click', async () => {
            const routeName = item.dataset.route;
            const bootstrapModule = await import('../../bootstrap.js');
            await bootstrapModule.routeTo(routeName);
        });
    });

    return true;
};
