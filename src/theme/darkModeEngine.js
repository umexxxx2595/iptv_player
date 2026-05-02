/**
 * Dark Mode Engine
 * Reliable system-theme sync + manual override.
 */

const STORAGE_KEY = 'fonex_dark_mode';

function safeGetItem(key) {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return window.__fonex_dark_mode_fallback ?? null;
    }
}

function safeSetItem(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        window.__fonex_dark_mode_fallback = value;
    }
}

function safeRemoveItem(key) {
    try {
        window.localStorage.removeItem(key);
    } catch {
        delete window.__fonex_dark_mode_fallback;
    }
}

export const darkModeEngine = {
    _mediaQuery: null,
    _boundChangeHandler: null,
    _initialized: false,

    init() {
        if (this._initialized) {
            const stored = safeGetItem(STORAGE_KEY);
            if (stored !== null) this.setMode(stored === 'true', { persist: false });
            return;
        }

        const stored = safeGetItem(STORAGE_KEY);
        let isDark;

        if (stored === 'true' || stored === 'false') {
            isDark = stored === 'true';
        } else {
            isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }

        this.setMode(isDark, { persist: false });

        if (!this._mediaQuery) {
            this._mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        }

        if (!this._boundChangeHandler) {
            this._boundChangeHandler = (e) => {
                // Sync with system only when user has no explicit preference.
                if (safeGetItem(STORAGE_KEY) === null) {
                    this.setMode(Boolean(e.matches), { persist: false });
                }
            };
        }

        const media = this._mediaQuery;
        if (media.addEventListener) {
            media.removeEventListener('change', this._boundChangeHandler);
            media.addEventListener('change', this._boundChangeHandler);
        } else if (media.addListener) {
            media.removeListener(this._boundChangeHandler);
            media.addListener(this._boundChangeHandler);
        }

        this._initialized = true;
    },

    setMode(isDark, options = { persist: true }) {
        const body = document.body;
        const html = document.documentElement;
        const dark = Boolean(isDark);

        body.classList.toggle('fonex-dark', dark);
        body.classList.toggle('fonex-light', !dark);
        html.classList.toggle('fonex-dark', dark);
        html.classList.toggle('fonex-light', !dark);

        body.dataset.themeMode = dark ? 'dark' : 'light';

        if (options.persist) {
            safeSetItem(STORAGE_KEY, String(dark));
        }

        document.dispatchEvent(new CustomEvent('darkmode:change', {
            detail: { isDark: dark },
            bubbles: true
        }));
    },

    toggle() {
        const currentlyDark = document.body.classList.contains('fonex-dark');
        this.setMode(!currentlyDark, { persist: true });
    },

    reset() {
        safeRemoveItem(STORAGE_KEY);
        this.init();
    },

    destroy() {
        if (!this._mediaQuery || !this._boundChangeHandler) return;
        const media = this._mediaQuery;
        if (media.removeEventListener) {
            media.removeEventListener('change', this._boundChangeHandler);
        } else if (media.removeListener) {
            media.removeListener(this._boundChangeHandler);
        }
    }
};
