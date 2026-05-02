/**
 * Theme Manager
 * Global theme application + persistence + events.
 */

import { themePresets, getTheme, listThemes } from './themePresets.js';
import { darkModeEngine } from './darkModeEngine.js';
import { colorSystem } from './colorSystem.js';

const STORAGE_KEY = 'fonex_theme';

function safeGet(key) {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return window.__fnxThemeFallback ?? null;
    }
}

function safeSet(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        window.__fnxThemeFallback = value;
    }
}

function safeRemove(key) {
    try {
        window.localStorage.removeItem(key);
    } catch {
        delete window.__fnxThemeFallback;
    }
}

class ThemeManager {
    constructor() {
        const stored = safeGet(STORAGE_KEY);
        this.currentTheme = stored && themePresets[stored] ? stored : 'obsidian';
    }

    init() {
        this.applyTheme(this.currentTheme, { persist: false });
    }

    applyTheme(themeId, opts = { persist: true }) {
        const resolved = getTheme(themeId);
        const effectiveId = resolved.id || 'obsidian';
        const root = document.documentElement;

        Object.entries(resolved.vars || {}).forEach(([varName, value]) => {
            root.style.setProperty(varName, value);
        });

        // Ensure rgb helper vars exist for CSS relying on rgba(var(--x-rgb),a)
        if (resolved.vars?.['--v-accent']) {
            const accentRgb = hexToRgbString(resolved.vars['--v-accent']);
            if (accentRgb) root.style.setProperty('--v-accent-rgb', accentRgb);
        }
        if (resolved.vars?.['--v-secondary']) {
            const secondaryRgb = hexToRgbString(resolved.vars['--v-secondary']);
            if (secondaryRgb) root.style.setProperty('--v-secondary-rgb', secondaryRgb);
        }

        Array.from(root.classList).forEach((cls) => {
            if (cls.startsWith('theme-')) root.classList.remove(cls);
        });
        root.classList.add(`theme-${effectiveId}`);

        this.currentTheme = effectiveId;
        if (opts.persist) safeSet(STORAGE_KEY, effectiveId);

        document.dispatchEvent(new CustomEvent('themechange', {
            detail: { themeId: effectiveId, theme: resolved },
            bubbles: true
        }));
    }

    getThemes() {
        return listThemes().map((def) => ({
            id: def.id,
            name: def.name ?? def.id,
            vars: def.vars,
            preview: def.preview ?? null,
            meta: def.meta ?? null
        }));
    }

    getCurrent() {
        return this.currentTheme;
    }

    reset() {
        safeRemove(STORAGE_KEY);
        this.currentTheme = 'obsidian';
        this.applyTheme('obsidian');

        if (darkModeEngine && typeof darkModeEngine.init === 'function') {
            darkModeEngine.init();
        }
    }
}

function hexToRgbString(hex) {
    if (typeof hex !== 'string') return null;
    const cleaned = hex.trim().replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;

    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
}

export const themeManager = new ThemeManager();
