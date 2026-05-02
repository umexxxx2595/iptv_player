/**
 * ============================================================================
 * FONEX IPTV - BOOTSTRAP (ROUTER & UI ENGINE)
 * Version: 3.1.0
 * Platform: LG webOS TV + Modern Browsers
 * Author: FONEX Labs
 * 
 * 📋 RESPONSIBILITIES:
 *   - Client-side routing (SPA navigation)
 *   - Sidebar navigation management
 *   - Remote control / D-PAD handling (webOS)
 *   - View rendering & transitions
 *   - Event delegation & handler registration
 * 
 * 🔗 DEPENDENCIES:
 *   - app.js (AppConfig)
 *   - No external dependencies
 * ============================================================================ */

import { AppConfig, saveSettings, isWebOSTV } from './app.js';
import { renderSidebar, setActivePage } from './ui/components/Sidebar.js';

/* ──────────────────────────────────────────────────────────────────────────
   1. ROUTER STATE & CONFIGURATION
   ────────────────────────────────────────────────────────────────────────── */

/**
 * @typedef {Object} Route
 * @property {string} name - Route identifier
 * @property {string} title - Page title
 * @property {boolean} [isOverlay] - Whether route is an overlay
 * @property {Function} [onEnter] - Called when entering route
 * @property {Function} [onLeave] - Called when leaving route
 */

/** @type {Map<string, Route>} */
const routes = new Map();

/** @type {Object} */
const routerState = {
    currentRoute: null,
    previousRoute: null,
    history: [],
    maxHistory: 10,
    isNavigating: false,
    focusableElements: [],
    isRemoteMode: false,
    lastInputType: null
};

/** @type {boolean} Guard for router initialization */
let routerInitialized = false;

/** @type {Map<string, Object>} Cache for imported screen modules */
const screenModuleCache = new Map();

/* ──────────────────────────────────────────────────────────────────────────
   GLOBAL INPUT & NAVIGATION GUARD
   ────────────────────────────────────────────────────────────────────────── */

let remoteControlInitialized = false;
let globalKeyHandlersInitialized = false;
let sidebarNavigationInitialized = false;
let lastRemoteActionAt = 0;
let lastRemoteKey = '';
let lastNavigationAt = 0;

const REMOTE_REPEAT_GUARD_MS = 180;
const NAVIGATION_GUARD_MS = 250;

const REMOTE_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Enter',
    'Backspace',
    'Escape'
]);

const shouldIgnoreRemoteInput = (key) => {
    const now = performance.now();
    if (key === lastRemoteKey && (now - lastRemoteActionAt < REMOTE_REPEAT_GUARD_MS)) {
        return true;
    }
    lastRemoteKey = key;
    lastRemoteActionAt = now;
    return false;
};

const shouldIgnoreNavigation = () => {
    const now = performance.now();
    if (now - lastNavigationAt < NAVIGATION_GUARD_MS) {
        return true;
    }
    lastNavigationAt = now;
    return false;
};

/* ──────────────────────────────────────────────────────────────────────────
   2. DOM CACHE (Null-safe)
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Lazy DOM element getter to prevent null references during early module parsing.
 */
const getElements = () => ({
    app: document.getElementById('app-shell'),
    content: document.getElementById('main-content'),
    sidebar: document.getElementById('sidebar'),
    playerOverlay: document.getElementById('player-overlay'),
    toastContainer: document.getElementById('toast-container')
});

/* ──────────────────────────────────────────────────────────────────────────
   3. ROUTE DEFINITIONS
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Register all application routes
 */
const registerRoutes = () => {
    routes.set('home', { name: 'home', title: 'Ana Sayfa', isOverlay: false });
    routes.set('live', { name: 'live', title: 'Canlı TV', isOverlay: false });
    routes.set('movies', { name: 'movies', title: 'Filmler', isOverlay: false });
    routes.set('series', { name: 'series', title: 'Diziler', isOverlay: false });
    routes.set('favorites', { name: 'favorites', title: 'Favoriler', isOverlay: false });
    routes.set('settings', { name: 'settings', title: 'Ayarlar', isOverlay: false });
    routes.set('player', { name: 'player', title: 'Oynatıcı', isOverlay: true });
    routes.set('search', { name: 'search', title: 'Arama', isOverlay: false });
    
    console.info('[Router] Routes registered:', routes.size);
};

/* ──────────────────────────────────────────────────────────────────────────
   4. SIDEBAR NAVIGATION
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Update active navigation item
 * @param {string} routeName - Current route name
 */
const updateActiveNav = (routeName) => {
    setActivePage(routeName);
};

/* ──────────────────────────────────────────────────────────────────────────
   5. ROUTER CORE FUNCTIONS
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Navigate to a route
 * @param {string} routeName - Route identifier
 * @param {Object} [params] - Route parameters
 * @returns {Promise<boolean>} Success status
 */
const routeTo = async (routeName, params = {}) => {
    const skipNavigationGuard = routeName === 'player';

    if (routerState.isNavigating) {
        console.warn('[Router] Navigation in progress, ignoring request');
        return false;
    }

    if (!skipNavigationGuard && shouldIgnoreNavigation()) {
        console.debug('[Router] Navigation ignored by time guard:', routeName);
        return false;
    }

    const route = routes.get(routeName);
    const elements = getElements();

    if (!route) {
        console.error('[Router] Route not found:', routeName);
        showToast('Sayfa bulunamadı', 'error');
        return false;
    }
    
    routerState.isNavigating = true;
    routerState.previousRoute = routerState.currentRoute;
    
    try {
        // 2. Load module (with caching)
        let screenModule;
        if (screenModuleCache.has(routeName)) {
            screenModule = screenModuleCache.get(routeName);
        } else {
            switch (routeName) {
                case 'home':
                    screenModule = await import('./ui/screens/homeScreen.js');
                    break;
                case 'live':
                case 'movies':
                case 'series':
                case 'search':
                    screenModule = await import('./ui/screens/browseScreen.js');
                    break;
                case 'favorites':
                    screenModule = await import('./ui/screens/favoritesScreen.js');
                    break;
                case 'settings':
                    screenModule = await import('./ui/screens/settingsScreen.js');
                    break;
                case 'player':
                    screenModule = await import('./ui/screens/playerScreen.js');
                    break;
            }
            if (screenModule) screenModuleCache.set(routeName, screenModule);
        }

        // Call onLeave for current route
        if (routerState.currentRoute) {
            const prevRoute = routes.get(routerState.currentRoute);
            if (prevRoute?.onLeave) {
                await prevRoute.onLeave();
            }
        }
        
        // Update history
        if (routerState.currentRoute && !route.isOverlay) {
            routerState.history.push(routerState.currentRoute);
            if (routerState.history.length > routerState.maxHistory) {
                routerState.history.shift();
            }
        }
        
        // Render
        const renderParams = (routeName === 'live' || routeName === 'movies' || routeName === 'series' || routeName === 'search') 
            ? { mode: routeName, ...params } 
            : params;

        if (routeName === 'player') {
            const playerData = params?.data || params;
            await screenModule.renderPlayerScreen(playerData.channel || playerData, {
                channelList: playerData.channelList || [],
                currentIndex: Number.isFinite(playerData.currentIndex) ? playerData.currentIndex : 0
            });
        } else if (routeName === 'home') {
            await screenModule.renderHomeScreen(params);
        } else if (routeName === 'settings') {
            await screenModule.renderSettingsScreen(params);
        } else if (routeName === 'favorites') {
            await screenModule.renderFavoritesScreen(params);
        } else {
            await screenModule.renderBrowseScreen(renderParams);
        }
        
        // 6. Update global state for non-overlay routes
        if (!route.isOverlay) {
            routerState.currentRoute = routeName;
            AppConfig.settings.lastPage = routeName;
            saveSettings();
            updateActiveNav(routeName);
        }

        attachContentActionHandlers();
        
        if (route.onEnter) {
            await route.onEnter(params);
        }
        
        window.dispatchEvent(new CustomEvent('fonex:route:change', {
            detail: { route: routeName, params }
        }));
        
        return true;
        
    } catch (error) {
        console.error('[Router] Navigation failed:', error);
        showToast(`Sayfa yüklenemedi: ${routeName}`, 'error');
        return false;
    } finally {
        routerState.isNavigating = false;
    }
};

/**
 * Go back to previous route
 */
const goBack = async () => {
    if (routerState.history.length === 0) return false;
    const previousRoute = routerState.history.pop();
    return await routeTo(previousRoute);
};

const goHome = async () => {
    return await routeTo('home');
};

/* ──────────────────────────────────────────────────────────────────────────
   8. REMOTE CONTROL / D-PAD HANDLING (webOS)
   ────────────────────────────────────────────────────────────────────────── */

const setupRemoteControl = () => {
    if (!isWebOSTV()) return;
    document.addEventListener('keydown', handleRemoteKey, { passive: false });
    console.info('[Router] Remote control enabled');
};

const handleRemoteKey = (e) => {
    const elements = getElements();
    if (elements.playerOverlay?.classList.contains('active')) return;

    if (!REMOTE_KEYS.has(e.key)) return;

    const keyMap = {
        'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right',
        'Enter': 'select', 'Backspace': 'back', 'Escape': 'back'
    };

    const action = keyMap[e.key];
    if (!action || shouldIgnoreRemoteInput(e.key)) {
        if (action) { e.preventDefault(); e.stopPropagation(); }
        return;
    }

    e.preventDefault();
    e.stopPropagation();

    switch (action) {
        case 'up': moveFocus('up'); break;
        case 'down': moveFocus('down'); break;
        case 'left': moveFocus('left'); break;
        case 'right': moveFocus('right'); break;
        case 'select': selectFocused(); break;
        case 'back': goBack(); break;
    }
};

const syncFocusedClass = (target) => {
    document.querySelectorAll('.focused').forEach((el) => {
        el.classList.remove('focused');
    });

    if (target && target.classList && (
        target.classList.contains('focusable') ||
        target.classList.contains('nav-item') ||
        target.tagName === 'BUTTON' ||
        target.getAttribute('tabindex') === '0'
    )) {
        target.classList.add('focused');
    }
};

const moveFocus = (direction) => {
    const focusable = document.querySelectorAll('.focusable, .nav-item, button, [tabindex="0"]');
    const current = document.activeElement;
    const currentIndex = Array.from(focusable).indexOf(current);
    
    if (currentIndex === -1) return;
    
    let nextIndex = currentIndex;
    const currRect = current.getBoundingClientRect();
    
    switch (direction) {
        case 'down':
            nextIndex = Math.min(currentIndex + 1, focusable.length - 1);
            break;
        case 'up':
            nextIndex = Math.max(currentIndex - 1, 0);
            break;
        case 'right': {
            let closest = null, minDistance = Infinity;
            Array.from(focusable).forEach((el, i) => {
                if (i <= currentIndex) return;
                const rect = el.getBoundingClientRect();
                if (rect.left > currRect.right - 5) {
                    const dist = Math.abs(rect.top - currRect.top);
                    if (dist < minDistance) { minDistance = dist; closest = i; }
                }
            });
            nextIndex = closest !== null ? closest : Math.min(currentIndex + 1, focusable.length - 1);
            break;
        }
        case 'left': {
            let closest = null, minDistance = Infinity;
            Array.from(focusable).forEach((el, i) => {
                if (i >= currentIndex) return;
                const rect = el.getBoundingClientRect();
                if (rect.right < currRect.left + 5) {
                    const dist = Math.abs(rect.top - currRect.top);
                    if (dist < minDistance) { minDistance = dist; closest = i; }
                }
            });
            nextIndex = closest !== null ? closest : Math.max(currentIndex - 1, 0);
            break;
        }
    }
    
    if (nextIndex !== currentIndex) {
        const target = focusable[nextIndex];
        target?.focus();
        syncFocusedClass(target);
    }
};

const selectFocused = () => {
    const focused = document.activeElement;
    if (focused) {
        focused.click();
        focused.classList.add('focus-burst');
        syncFocusedClass(focused);
        setTimeout(() => focused.classList.remove('focus-burst'), 300);
    }
};

const attachContentActionHandlers = () => {
    const elements = getElements();
    if (!elements.content || elements.content.dataset.actionsBound === 'true') return;

    elements.content.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        switch (action) {
            case 'watch-live': routeTo('live'); break;
            case 'browse-movies': routeTo('movies'); break;
            case 'refresh-channels': routeTo('live'); showToast('Kanal listesi yenilendi', 'success'); break;
            case 'filter-movies': showToast('Filtre paneli yakında eklenecek', 'info'); break;
            case 'search-movies': routeTo('search'); break;
        }
    });
    elements.content.dataset.actionsBound = 'true';
};

/* ──────────────────────────────────────────────────────────────────────────
   11. TOAST NOTIFICATIONS
   ────────────────────────────────────────────────────────────────────────── */

let lastToastTime = 0;
let lastToastMessage = '';

const showToast = (message, type = 'info') => {
    const elements = getElements();
    if (!elements.toastContainer) return;
    
    const safeType = ['success', 'error', 'info', 'warning'].includes(type) ? type : 'info';
    const now = Date.now();
    if (message === lastToastMessage && (now - lastToastTime) < 2000) return;
    
    lastToastTime = now;
    lastToastMessage = message;
    
    const toast = document.createElement('div');
    toast.className = `glass-toast toast-${safeType}`;
    const span = document.createElement('span');
    span.textContent = String(message);
    toast.appendChild(span);
    
    elements.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

/* ──────────────────────────────────────────────────────────────────────────
   12. ROUTER INITIALIZATION
   ────────────────────────────────────────────────────────────────────────── */

const getSafeStartRoute = () => {
    const saved = AppConfig.settings.lastPage || 'home';
    const blockedStartupRoutes = new Set(['player', 'search']);
    if (blockedStartupRoutes.has(saved) || !routes.has(saved)) return 'home';
    return saved;
};

export const initRouter = async () => {
    if (routerInitialized) return;
    try {
        routerInitialized = true;
        registerRoutes();
        const startRoute = getSafeStartRoute();
        renderSidebar(startRoute);
        await routeTo(startRoute);

        if (!remoteControlInitialized) {
            setupRemoteControl();
            remoteControlInitialized = true;
        }
        if (!globalKeyHandlersInitialized) {
            setupGlobalKeyHandlers();
            globalKeyHandlersInitialized = true;
        }
    } catch (error) {
        console.error('[Router] Initialization failed:', error);
        throw error;
    }
};

const setupGlobalKeyHandlers = () => {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey && e.key === 'f') || e.key === 'F3') {
            e.preventDefault(); routeTo('search'); return;
        }
        if (e.key === 's' && !e.ctrlKey && !e.altKey) {
            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
            if (!isInput) { e.preventDefault(); routeTo('settings'); }
            return;
        }
        if (e.key === 'm' && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            const elements = getElements();
            const firstNav = elements.sidebar?.querySelector('.nav-item');
            if (firstNav) {
                elements.sidebar?.classList.add('is-expanded');
                elements.sidebar?.setAttribute('aria-expanded', 'true');
                firstNav.focus();
                syncFocusedClass(firstNav);
            }
        }
    });
};

/* ──────────────────────────────────────────────────────────────────────────
   13. EXPORTS
   ────────────────────────────────────────────────────────────────────────── */

export {
    routeTo,
    goBack,
    goHome,
    showToast,
    routes,
    routerState
};

export default {
    initRouter,
    routeTo,
    goBack,
    goHome,
    showToast,
    routes,
    routerState
};

/* ──────────────────────────────────────────────────────────────────────────
   END OF BOOTSTRAP.JS v3.1.0
   ============================================================================ */
