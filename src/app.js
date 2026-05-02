/**
 * ============================================================================
 * FONEX IPTV - APP CONFIGURATION & ENGINE
 * Version: 3.1.0
 * Platform: LG webOS TV + Modern Browsers
 * Author: FONEX Labs
 * 
 * 📋 RESPONSIBILITIES:
 *   - Application configuration management
 *   - LocalStorage persistence
 *   - Boot sequence coordination
 *   - Router initialization
 * 
 * 🔗 DEPENDENCIES:
 *   - bootstrap.js (router)
 *   - boot-loader.js (loading screen)
 * ============================================================================ */

/* ──────────────────────────────────────────────────────────────────────────
   1. APP CONFIGURATION (Immutable)
   ────────────────────────────────────────────────────────────────────────── */
const AppConfig = {
    /** Application Info */
    name: 'FONEX IPTV',
    version: '3.1.0',
    build: '2026.01',
    developer: 'FONEX Labs',
    platform: 'webOS TV',

    /** Default M3U playlist URL (empty = user must configure) */
    defaultM3U: '',

    /** Theme name - read by themeManager */
    theme: 'fonex-dark',

    /** LocalStorage namespace */
    storageKey: 'fonex_settings_v3',

    /** Session Storage namespace */
    sessionKey: 'fonex_session_v3',

    /** Cache namespace */
    cacheKey: 'fonex_cache_v3',

    /** Feature Flags */
    features: Object.freeze({
        enablePWA: false,
        enableCache: true,
        enableAnalytics: false,
        enableDebug: false,
        enableWebOS: true
    }),

    /** Performance Settings */
    performance: Object.freeze({
        preloadChannels: 10,
        cacheTimeout: 300000, // 5 minutes
        retryAttempts: 3,
        retryDelay: 1000
    }),

    /** User Settings (Mutable - runtime updates) */
    settings: {
        autoPlay: true,
        bufferSize: 10,
        lowLatency: true,
        lastPage: 'home',
        language: 'tr',
        timezone: 'Europe/Istanbul',
        parentalControl: false,
        favorites: [],
        recentChannels: [],
        volume: 80,
        subtitles: false,
        subtitleLanguage: 'tr',
        playbackSpeed: 1.0,
        quality: 'auto'
    }
};
// Shallow freeze: settings object intentionally remains mutable for runtime updates.
Object.freeze(AppConfig);

/* ──────────────────────────────────────────────────────────────────────────
   2. UTILITY FUNCTIONS
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Save settings to LocalStorage safely
 * @param {string} [key=AppConfig.storageKey] - Storage key
 * @param {any} [data=AppConfig.settings] - Data to store
 */
const saveSettings = (key = AppConfig.storageKey, data = AppConfig.settings) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        console.info(`[AppConfig] Settings saved for key: ${key}`);
    } catch (e) {
        console.error("[AppConfig] Storage error", e);
    }
};

/**
 * Load settings from LocalStorage
 * @returns {object} Parsed settings or null
 */
const loadSettings = () => {
    try {
        const stored = localStorage.getItem(AppConfig.storageKey);
        if (stored) {
            return JSON.parse(stored);
        }
        return null;
    } catch (error) {
        console.error('[AppConfig] Failed to load settings:', error);
        return null;
    }
};

/**
 * Save data to SessionStorage
 * @param {string} key - Storage key
 * @param {any} data - Data to store
 * @returns {boolean} Success status
 */
export const saveToSession = (key, data) => {
    try {
        sessionStorage.setItem(`${AppConfig.sessionKey}_${key}`, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('[AppConfig] Session save failed:', error);
        return false;
    }
};

/**
 * Load data from SessionStorage
 * @param {string} key - Storage key
 * @returns {any} Parsed data or null
 */
export const loadFromSession = (key) => {
    try {
        const stored = sessionStorage.getItem(`${AppConfig.sessionKey}_${key}`);
        return stored ? JSON.parse(stored) : null;
    } catch (error) {
        console.error('[AppConfig] Session load failed:', error);
        return null;
    }
};

/**
 * Clear all app storage
 */
export const clearStorage = () => {
    try {
        localStorage.removeItem(AppConfig.storageKey);

        // Remove only app-scoped session keys
        const prefix = `${AppConfig.sessionKey}_`;
        Object.keys(sessionStorage).forEach((key) => {
            if (key.startsWith(prefix)) {
                sessionStorage.removeItem(key);
            }
        });

        console.info('[AppConfig] Storage cleared');
    } catch (error) {
        console.error('[AppConfig] Failed to clear storage:', error);
    }
};

/* ──────────────────────────────────────────────────────────────────────────
   3. PLATFORM DETECTION
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Detect if running on webOS TV
 * @returns {boolean}
 */
const isWebOSTV = () => {
    return (typeof webOS !== 'undefined' && webOS.device) || 
           navigator.userAgent.includes('webOS');
};

/**
 * Detect if running in PWA mode
 * @returns {boolean}
 */
const isPWA = () => {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
};

/**
 * Get platform info
 * @returns {object} Platform details
 */
const getPlatformInfo = () => {
    return {
        isWebOS: isWebOSTV(),
        isPWA: isPWA(),
        userAgent: navigator.userAgent,
        language: navigator?.language || 'tr',
        online: navigator?.onLine ?? true,
        screen: {
            width: window.innerWidth || 1920,
            height: window.innerHeight || 1080,
            pixelDepth: screen?.pixelDepth || 24
        }
    };
};

/* ──────────────────────────────────────────────────────────────────────────
   4. ERROR HANDLING
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Report error to error boundary
 * @param {Error} error - Error object
 * @param {string} context - Error context
 */
export const reportError = (error, context = 'Unknown') => {
    console.error(`[AppConfig] Error in ${context}:`, error);
    
    // Show error boundary if critical
    const msg = String(error?.message || '');
    if (msg.includes('Critical') || 
        msg.includes('Fatal') ||
        context.includes('Bootstrap')) {
        
        const errorBoundary = document.getElementById('error-boundary');
        const errorMessage = document.getElementById('error-message');
        
        if (errorBoundary && errorMessage) {
            errorBoundary.hidden = false;
            errorMessage.textContent = `${context}: ${msg}`;
        }
    }
    
    // Save error to session for debugging
    saveToSession('lastError', {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: Date.now()
    });
};

/**
 * Global error handler setup
 */
export const setupGlobalErrorHandler = () => {
    const previousOnError = window.onerror;

    window.onerror = (msg, url, line, col, error) => {
        reportError(error || new Error(String(msg)), 'Global');
        
        if (typeof previousOnError === 'function') {
            return previousOnError(msg, url, line, col, error);
        }
        return false;
    };
    
    window.addEventListener('unhandledrejection', (event) => {
        reportError(
            event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
            'Unhandled Promise'
        );
    });
};

/* ──────────────────────────────────────────────────────────────────────────
   5. INITIALIZATION
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Initialize Lucide icons
 */
const initIcons = () => {
    if (window.lucide?.createIcons) {
        window.lucide.createIcons();
        console.info('[AppConfig] Lucide icons initialized');
        return true;
    }
    console.warn('[AppConfig] Lucide icons not available');
    return false;
};

/**
 * Apply platform-specific classes
 */
const applyPlatformClasses = () => {
    const html = document.documentElement;
    const platform = getPlatformInfo();
    
    if (platform.isWebOS) {
        html.classList.add('webos-tv');
        console.info('[AppConfig] webOS TV detected');
    }
    
    if (platform.isPWA) {
        html.classList.add('pwa-mode');
        console.info('[AppConfig] PWA mode detected');
    }
    
    // Screen size class
    if (platform.screen.width >= 3840) {
        html.classList.add('tv-4k');
    } else if (platform.screen.width >= 1920) {
        html.classList.add('tv-hd');
    }
};

/**
 * Load user settings and merge with defaults
 */
const loadUserSettings = () => {
    const stored = loadSettings();
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        // Merge only valid keys to prevent type mismatches
        Object.keys(stored).forEach(key => {
            if (key in AppConfig.settings) {
                AppConfig.settings[key] = stored[key];
            }
        });
        console.info('[AppConfig] User settings loaded');
    } else {
        console.info('[AppConfig] Using default settings or invalid storage');
    }
};

/**
 * Initialize Service Worker communication
 */
const initServiceWorker = () => {
    if (!AppConfig.features.enablePWA) return;
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
            console.info('[AppConfig] Service Worker ready:', registration.scope);
            
            // Send platform info to SW
            registration.active?.postMessage({
                type: 'PLATFORM_INFO',
                payload: getPlatformInfo()
            });
        }).catch((error) => {
            console.warn('[AppConfig] Service Worker error:', error);
        });
    }
};

/**
 * Main initialization function
 * @returns {Promise<boolean>} Success status
 */
const initApp = async () => {
    const startTime = performance.now();
    
    try {
        // 1. Setup global error handler
        setupGlobalErrorHandler();
        
        // 2. Apply platform classes
        applyPlatformClasses();
        
        // 3. Load user settings
        loadUserSettings();
        
        // 4. Initialize icons
        initIcons();
        
        // 5. Initialize Service Worker
        initServiceWorker();
        
        const initTime = performance.now() - startTime;
        console.info(`[AppConfig] Initialization completed in ${initTime.toFixed(2)}ms`);
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('fonex:app:ready', {
            detail: { version: AppConfig.version, initTime }
        }));
        
        return true;
        
    } catch (error) {
        reportError(error, 'App Initialization');
        return false;
    }
};

/* ──────────────────────────────────────────────────────────────────────────
   6. AUTO-INIT ON DOM READY
   ────────────────────────────────────────────────────────────────────────── */

// Auto-init removed as per architectural requirement to avoid race conditions.
// Initialization is now orchestrated by index.html.

/* ──────────────────────────────────────────────────────────────────────────
   7. EXPORTS
   ────────────────────────────────────────────────────────────────────────── */
export {
    AppConfig,
    saveSettings,
    loadSettings,
    isWebOSTV,
    isPWA,
    getPlatformInfo,
    initApp
};

export default AppConfig;

/* ──────────────────────────────────────────────────────────────────────────
   END OF APP.JS v3.1.0
   ============================================================================ */
