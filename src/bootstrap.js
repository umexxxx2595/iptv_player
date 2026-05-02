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
import {
    clearRecentChannels,
    getCatalogByMode,
    getChannelById,
    searchCatalog,
    updatePlaybackSettings
} from './data/catalogStore.js';
import { importPlaylistFromText, importPlaylistFromUrl, restoreDemoPlaylist } from './services/playlistImportService.js';
import { getFavorites, toggleFavorite } from './utils/favoritesStore.js';
import { renderSidebar, setActivePage } from './ui/components/Sidebar.js';

const routes = new Map();

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

let routerInitialized = false;
const screenModuleCache = new Map();

let remoteControlInitialized = false;
let globalKeyHandlersInitialized = false;
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

const getElements = () => ({
    app: document.getElementById('app-shell'),
    content: document.getElementById('main-content'),
    sidebar: document.getElementById('main-sidebar'),
    playerOverlay: document.getElementById('player-overlay'),
    toastContainer: document.getElementById('toast-container')
});

const registerRoutes = () => {
    routes.set('home', { name: 'home', title: 'Ana Sayfa', isOverlay: false });
    routes.set('live', { name: 'live', title: 'Canli TV', isOverlay: false });
    routes.set('movies', { name: 'movies', title: 'Filmler', isOverlay: false });
    routes.set('series', { name: 'series', title: 'Diziler', isOverlay: false });
    routes.set('favorites', { name: 'favorites', title: 'Favoriler', isOverlay: false });
    routes.set('settings', { name: 'settings', title: 'Ayarlar', isOverlay: false });
    routes.set('player', { name: 'player', title: 'Oynatici', isOverlay: true });
    routes.set('search', { name: 'search', title: 'Arama', isOverlay: false });
};

const updateActiveNav = (routeName) => {
    setActivePage(routeName);
};

const routeTo = async (routeName, params = {}) => {
    const skipNavigationGuard = routeName === 'player';

    if (routerState.isNavigating) {
        return false;
    }

    if (!skipNavigationGuard && routerState.currentRoute && shouldIgnoreNavigation()) {
        return false;
    }

    const route = routes.get(routeName);
    if (!route) {
        showToast('Sayfa bulunamadi', 'error');
        return false;
    }

    routerState.isNavigating = true;
    routerState.previousRoute = routerState.currentRoute;

    try {
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
            if (screenModule) {
                screenModuleCache.set(routeName, screenModule);
            }
        }

        if (routerState.currentRoute) {
            const prevRoute = routes.get(routerState.currentRoute);
            if (prevRoute?.onLeave) {
                await prevRoute.onLeave();
            }
        }

        if (routerState.currentRoute && !route.isOverlay) {
            routerState.history.push(routerState.currentRoute);
            if (routerState.history.length > routerState.maxHistory) {
                routerState.history.shift();
            }
        }

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
        showToast(`Sayfa yuklenemedi: ${routeName}`, 'error');
        return false;
    } finally {
        routerState.isNavigating = false;
    }
};

const goBack = async () => {
    if (routerState.history.length === 0) return false;
    const previousRoute = routerState.history.pop();
    return await routeTo(previousRoute);
};

const goHome = async () => {
    return await routeTo('home');
};

const buildChannelListForTarget = (target) => {
    const collection = target.dataset.channelCollection || target.dataset.channelMode || 'live';
    const mode = target.dataset.channelMode || 'live';
    const query = target.dataset.channelQuery || '';

    if (collection === 'favorites') {
        return getFavorites();
    }

    if (collection === 'recent') {
        return AppConfig.settings.recentChannels || [];
    }

    if (collection === 'search') {
        return searchCatalog(query);
    }

    return getCatalogByMode(mode);
};

const setupRemoteControl = () => {
    if (!isWebOSTV()) return;
    document.addEventListener('keydown', handleRemoteKey, { passive: false });
};

const handleRemoteKey = (e) => {
    const elements = getElements();
    if (!REMOTE_KEYS.has(e.key)) return;

    const keyMap = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        Enter: 'select', Backspace: 'back', Escape: 'back'
    };

    const action = keyMap[e.key];
    if (!action || shouldIgnoreRemoteInput(e.key)) {
        if (action) {
            e.preventDefault();
            e.stopPropagation();
        }
        return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (elements.playerOverlay?.classList.contains('active')) {
        if (action === 'back') {
            closePlayerOverlay();
        }
        return;
    }

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
            let closest = null;
            let minDistance = Infinity;
            Array.from(focusable).forEach((el, i) => {
                if (i <= currentIndex) return;
                const rect = el.getBoundingClientRect();
                if (rect.left > currRect.right - 5) {
                    const dist = Math.abs(rect.top - currRect.top);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closest = i;
                    }
                }
            });
            nextIndex = closest !== null ? closest : Math.min(currentIndex + 1, focusable.length - 1);
            break;
        }
        case 'left': {
            let closest = null;
            let minDistance = Infinity;
            Array.from(focusable).forEach((el, i) => {
                if (i >= currentIndex) return;
                const rect = el.getBoundingClientRect();
                if (rect.right < currRect.left + 5) {
                    const dist = Math.abs(rect.top - currRect.top);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closest = i;
                    }
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

const closePlayerOverlay = () => {
    const elements = getElements();
    if (!elements.playerOverlay) return false;

    if (!elements.playerOverlay.classList.contains('active')) {
        return false;
    }

    if (typeof elements.playerOverlay._cleanupPlayer === 'function') {
        elements.playerOverlay._cleanupPlayer();
        elements.playerOverlay._cleanupPlayer = null;
    }

    elements.playerOverlay.classList.remove('active');
    elements.playerOverlay.setAttribute('aria-hidden', 'true');
    elements.playerOverlay.innerHTML = '';

    const firstFocusable = document.querySelector('#main-content .focusable, #main-sidebar .focusable');
    if (firstFocusable instanceof HTMLElement) {
        firstFocusable.focus();
        syncFocusedClass(firstFocusable);
    }

    return true;
};

const attachContentActionHandlers = () => {
    const elements = getElements();
    if (!elements.content || elements.content.dataset.actionsBound === 'true') return;

    elements.content.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        switch (action) {
            case 'watch-live':
                routeTo('live');
                break;
            case 'browse-movies':
                routeTo('movies');
                break;
            case 'open-settings':
                routeTo('settings');
                break;
            case 'use-demo-playlist':
                restoreDemoPlaylist();
                showToast('Demo katalog geri yuklendi', 'success');
                routeTo('home');
                break;
            case 'clear-recent':
                clearRecentChannels();
                showToast('Son izlenenler temizlendi', 'success');
                routeTo('home');
                break;
            case 'toggle-favorite': {
                const channel = {
                    id: target.dataset.channelId || '',
                    name: target.dataset.channelName || 'Kanal',
                    url: target.dataset.channelUrl || '',
                    category: target.dataset.channelCategory || '',
                    mode: target.dataset.channelMode || 'live'
                };
                const active = toggleFavorite(channel);
                target.textContent = active ? 'Favoriden cikar' : 'Favoriye ekle';
                showToast(active ? 'Favorilere eklendi' : 'Favorilerden cikarildi', 'success');
                if (routerState.currentRoute === 'favorites') {
                    routeTo('favorites');
                }
                break;
            }
            case 'open-player': {
                const channelList = buildChannelListForTarget(target);
                const currentIndex = Number.parseInt(target.dataset.channelIndex || '0', 10);
                const fallbackChannel = {
                    id: target.dataset.channelId || '',
                    name: target.dataset.channelName || 'Kanal',
                    url: target.dataset.channelUrl || '',
                    category: target.dataset.channelCategory || '',
                    mode: target.dataset.channelMode || 'live'
                };
                const channel = channelList[currentIndex] || getChannelById(fallbackChannel.id) || fallbackChannel;

                routeTo('player', {
                    channel,
                    channelList,
                    currentIndex
                });
                break;
            }
        }
    });

    elements.content.addEventListener('submit', async (e) => {
        const form = e.target.closest('[data-form]');
        if (!form) return;

        e.preventDefault();

        const formName = form.getAttribute('data-form');
        if (formName === 'search-form') {
            const formData = new FormData(form);
            const query = String(formData.get('search-query') || '').trim();
            routeTo('search', { query });
            return;
        }

        if (formName === 'import-url-form') {
            const formData = new FormData(form);
            const url = String(formData.get('playlist-url') || '').trim();

            if (!url) {
                showToast('Playlist URL gerekli', 'warning');
                return;
            }

            showToast('Playlist URL yukleniyor...', 'info');

            try {
                await importPlaylistFromUrl(url);
                showToast('Playlist basariyla ice aktarıldi', 'success');
                routeTo('live');
            } catch (error) {
                showToast(error.message || 'Playlist URL import edilemedi', 'error');
            }
            return;
        }

        if (formName === 'import-text-form') {
            const formData = new FormData(form);
            const text = String(formData.get('playlist-text') || '');
            const label = String(formData.get('playlist-label') || 'Yapistirilan playlist').trim();

            if (!text.trim()) {
                showToast('Playlist metni bos olamaz', 'warning');
                return;
            }

            try {
                await importPlaylistFromText(text, label);
                showToast('M3U metni basariyla iceri alindi', 'success');
                routeTo('live');
            } catch (error) {
                showToast(error.message || 'Playlist metni islenemedi', 'error');
            }
        }
    });

    elements.content.addEventListener('change', (e) => {
        const target = e.target.closest('[data-setting]');
        if (!target) return;

        const key = target.getAttribute('data-setting');
        if (!key) return;

        const value = target.type === 'checkbox'
            ? Boolean(target.checked)
            : target.type === 'range'
                ? Number(target.value)
                : target.value;

        updatePlaybackSettings({ [key]: value });
        showToast('Ayar kaydedildi', 'success');
    });

    elements.content.dataset.actionsBound = 'true';
};

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
            e.preventDefault();
            routeTo('search');
            return;
        }
        if (e.key === 's' && !e.ctrlKey && !e.altKey) {
            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
            if (!isInput) {
                e.preventDefault();
                routeTo('settings');
            }
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
