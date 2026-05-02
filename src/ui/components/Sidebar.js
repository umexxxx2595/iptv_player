/**
 * Sidebar Menu
 * Stable, accessible, and D-PAD friendly navigation component.
 */

import { AppConfig } from '../../app.js';
import { renderIcons } from '../../utils/iconHelper.js';

const NAV_ITEMS = [
    { id: 'home', icon: 'home', label: 'ANA SAYFA' },
    { id: 'live', icon: 'tv', label: 'CANLI TV', disabled: true },
    { id: 'movies', icon: 'film', label: 'FİLMLER', disabled: true },
    { id: 'series', icon: 'monitor', label: 'DİZİLER', disabled: true },
    { id: 'favorites', icon: 'heart', label: 'FAVORİLER', disabled: true },
    { id: 'settings', icon: 'settings', label: 'AYARLAR' }
];

/**
 * Empty object to avoid overriding CSS tokens with inline styles.
 * Measurement tokens should come from base.css/components.css.
 */
const DEFAULT_CSS_VARS = Object.freeze({});

let sidebarRoot = null;
let navContainer = null;
let onNavigate = null;
let keyHandlerBound = null;
let clickHandlerBound = null;

/**
 * Polyfill-like helper for CSS.escape for older webOS versions.
 */
function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(String(value));
    return String(value).replace(/"/g, '\\"');
}

/**
 * Manually manages the .focused class for better TV D-PAD visibility stability.
 */
function syncFocusedClass(target) {
    if (!navContainer) return;

    navContainer.querySelectorAll('.nav-item').forEach((item) => {
        item.classList.toggle('focused', item === target);
    });
}

export function renderSidebar(activePage = 'home', options = {}) {
    const {
        cssVars = DEFAULT_CSS_VARS,
        onNavigate: externalNavigate = null
    } = options;

    onNavigate = typeof externalNavigate === 'function' ? externalNavigate : null;

    sidebarRoot = document.getElementById('main-sidebar');
    if (!sidebarRoot) {
        console.error('[Sidebar] #main-sidebar not found.');
        return null;
    }

    // Clean old listeners/DOM safely, keep root node alive.
    destroySidebar({ keepRoot: true });
    sidebarRoot = document.getElementById('main-sidebar');

    // Apply any dynamic overrides (rarely used now that we have strong CSS layers)
    Object.entries(cssVars).forEach(([k, v]) => sidebarRoot.style.setProperty(k, v));

    const build = () => {
        if (!sidebarRoot) return;

        const logo = document.createElement('div');
        logo.className = 'sidebar-logo';
        logo.setAttribute('aria-label', 'FONEX Logo');
        logo.innerHTML = '<span class="sidebar-mark">⚡</span>';

        navContainer = document.createElement('div');
        navContainer.className = 'nav-items-container';
        navContainer.setAttribute('role', 'menubar');
        navContainer.setAttribute('aria-label', 'Ana navigasyon');

        NAV_ITEMS.forEach((item, index) => {
            const isActive = item.id === activePage;
            const btn = document.createElement('button');
            btn.className = `nav-item focusable${isActive ? ' active' : ''}`;
            btn.type = 'button';
            btn.dataset.page = item.id;
            btn.setAttribute('role', 'menuitem');
            btn.setAttribute('tabindex', isActive || index === 0 ? '0' : '-1');
            btn.setAttribute('aria-label', item.label);
            
            if (isActive) {
                btn.classList.add('focused');
                btn.setAttribute('aria-current', 'page');
            }

            if (item.disabled) {
                btn.disabled = true;
                btn.setAttribute('aria-disabled', 'true');
                btn.style.opacity = '0.35';
                btn.style.cursor = 'not-allowed';
            }

            const icon = document.createElement('i');
            icon.dataset.lucide = item.icon;
            icon.setAttribute('aria-hidden', 'true');

            const text = document.createElement('span');
            text.className = 'nav-text';
            text.textContent = item.label;

            btn.append(icon, text);
            navContainer.appendChild(btn);
        });

        const footer = document.createElement('footer');
        footer.className = 'sidebar-footer';
        footer.setAttribute('aria-hidden', 'true');
        footer.textContent = `v${AppConfig?.version ?? '2.5.0'}`;

        sidebarRoot.append(logo, navContainer, footer);

        keyHandlerBound = handleKeydown;
        clickHandlerBound = handleClick;
        navContainer.addEventListener('keydown', keyHandlerBound);
        navContainer.addEventListener('click', clickHandlerBound);

        renderIcons(sidebarRoot);
        toggleSidebar(false);
    };

    // Render immediately for critical navigation availability
    build();

    return sidebarRoot;
}

function handleClick(e) {
    const btn = e.target.closest('.nav-item');
    if (!btn || !navContainer || !navContainer.contains(btn)) return;

    if (btn.disabled) return;

    const page = btn.dataset.page;
    if (!page) return;
    if (btn.classList.contains('active')) return;

    syncFocusedClass(btn);

    const ev = new CustomEvent('sovereign:navigate', {
        detail: { page, source: 'sidebar' },
        bubbles: true,
        composed: true
    });
    document.dispatchEvent(ev);

    if (onNavigate) onNavigate(page);
}

function handleKeydown(e) {
    const btn = e.target.closest('.nav-item');
    if (!btn || !navContainer || !navContainer.contains(btn)) return;

    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
        return;
    }

    const items = Array.from(navContainer.querySelectorAll('.nav-item'));
    if (!items.length) return;

    const idx = items.indexOf(btn);
    if (idx < 0) return;

    let targetIndex = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') targetIndex = (idx + 1) % items.length;
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') targetIndex = (idx - 1 + items.length) % items.length;
    if (e.key === 'Home') targetIndex = 0;
    if (e.key === 'End') targetIndex = items.length - 1;

    if (targetIndex === -1) return;

    e.preventDefault();
    const target = items[targetIndex];
    rovingTabindex(target, items);
    syncFocusedClass(target);
    target.focus();
}

function rovingTabindex(target, items) {
    items.forEach((item) => item.setAttribute('tabindex', item === target ? '0' : '-1'));
}

export function setActivePage(pageId) {
    if (!navContainer) return;

    const items = Array.from(navContainer.querySelectorAll('.nav-item'));
    const target = navContainer.querySelector(`[data-page="${cssEscape(pageId)}"]`);
    if (!target) return;

    items.forEach((btn) => {
        const isActive = btn === target;
        btn.classList.toggle('active', isActive);
        
        if (isActive) {
            btn.setAttribute('aria-current', 'page');
            btn.setAttribute('tabindex', '0');
            btn.classList.add('focused');
        } else {
            btn.removeAttribute('aria-current');
            btn.setAttribute('tabindex', '-1');
            btn.classList.remove('focused');
        }
    });
}

export function toggleSidebar(forceState) {
    const root = sidebarRoot || document.getElementById('main-sidebar');
    if (!root) return;

    const isExpanded = root.classList.contains('is-expanded');
    const shouldExpand = typeof forceState === 'boolean' ? forceState : !isExpanded;
    root.classList.toggle('is-expanded', shouldExpand);
    root.setAttribute('aria-expanded', String(shouldExpand));
}

export function destroySidebar({ keepRoot = false } = {}) {
    if (navContainer) {
        if (keyHandlerBound) navContainer.removeEventListener('keydown', keyHandlerBound);
        if (clickHandlerBound) navContainer.removeEventListener('click', clickHandlerBound);
    }

    const root = sidebarRoot || document.getElementById('main-sidebar');
    if (root) {
        root.innerHTML = '';
        root.classList.remove('is-expanded');
        root.removeAttribute('aria-expanded');
    }

    navContainer = null;
    onNavigate = null;
    keyHandlerBound = null;
    clickHandlerBound = null;

    if (!keepRoot) {
        sidebarRoot = null;
    }
}

export default {
    renderSidebar,
    setActivePage,
    toggleSidebar,
    destroySidebar
};
