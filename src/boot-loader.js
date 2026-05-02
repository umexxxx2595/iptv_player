/**
 * ============================================================================
 * FONEX IPTV - BOOT LOADER (ENTRY POINT)
 * Version: 3.1.0
 * Platform: LG webOS TV + Modern Browsers
 * Author: FONEX Labs
 * 
 * 📋 RESPONSIBILITIES:
 *   - Application boot sequence coordination
 *   - Performance monitoring & reporting
 *   - Loader UI management
 *   - Error boundary integration
 *   - Module synchronization
 * 
 * 🔗 DEPENDENCIES:
 *   - bootstrap.js (router & UI engine)
 *   - app.js (configuration)
 * ============================================================================ */

// Module-level variables to hold shared state across boot stages
let AppConfig;
let initRouter;

/* ──────────────────────────────────────────────────────────────────────────
   1. CONSTANTS & PERFORMANCE TRACKING
   ────────────────────────────────────────────────────────────────────────── */
const BOOT_VERSION = '3.1.0';
const bootStart = performance.now();
const MAX_BOOT_TIME = 5000; // 5 seconds timeout

/* ──────────────────────────────────────────────────────────────────────────
   2. DOM ELEMENT CACHE (Null-safe)
   ────────────────────────────────────────────────────────────────────────── */
/**
 * Lazy DOM element getter to prevent null references during early module parsing.
 */
const getElements = () => ({
    loader: document.getElementById('app-loader'),
    shell: document.getElementById('app-shell'),
    bootStatus: document.getElementById('boot-status'),
    versionDisplay: document.getElementById('version-display'),
    progressBar: document.querySelector('.loader-progress-bar'),
    errorBoundary: document.getElementById('error-boundary'),
    errorMessage: document.getElementById('error-message')
});

/* ──────────────────────────────────────────────────────────────────────────
   3. BOOT STATE MANAGEMENT
   ────────────────────────────────────────────────────────────────────────── */
const bootState = {
    stage: 'initializing',
    progress: 0,
    errors: [],
    startTime: bootStart,
    endTime: null
};

/* ──────────────────────────────────────────────────────────────────────────
   4. UTILITY FUNCTIONS
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Update boot progress bar
 * @param {number} progress - 0-100
 */
const updateProgress = (progress) => {
    bootState.progress = Math.min(100, Math.max(0, progress));
    const elements = getElements();
    if (elements.progressBar) {
        elements.progressBar.style.width = `${bootState.progress}%`;
    }
};

/**
 * Update boot status text
 * @param {string} text - Status message
 */
const updateStatus = (text) => {
    const elements = getElements();
    if (elements.bootStatus) {
        elements.bootStatus.textContent = text;
    }
};

/**
 * Safe DOM manipulation with null check
 * @param {Function} fn - DOM manipulation function
 */
const safeDOM = (fn) => {
    try {
        fn();
    } catch (error) {
        console.warn('[BootLoader] DOM operation failed:', error);
    }
};

/* ──────────────────────────────────────────────────────────────────────────
   5. BOOT SEQUENCE
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Main boot sequence - coordinates all initialization steps
 * @returns {Promise<boolean>} Success status
 */
export const bootSequence = async () => {
    const isDevMode =
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1' ||
        location.search.includes('devSeed=true');

    if (isDevMode) {
        try {
            const { runDevBootSeed } = await import('./dev/devBootSeed.js');
            await runDevBootSeed();
        } catch (e) {
            console.warn('[BootLoader] Dev seed failed to load:', e);
        }
    }

    const appModule = await import('./app.js');
    const bootstrapModule = await import('./bootstrap.js');
    AppConfig = appModule.AppConfig;

    const elements = getElements();
    console.info(`[BootLoader] Starting version: ${BOOT_VERSION}`);

    if (typeof appModule.initApp === 'function') {
        await appModule.initApp();
        console.info('[BootLoader] App initialized');
    }

    initRouter = bootstrapModule.initRouter;

    const platformName = AppConfig.platform || (appModule.isWebOSTV() ? 'webOS TV' : 'Web Browser');

    console.log(
        `%c╔═══════════════════════════════════════════╗
║   FONEX IPTV v${AppConfig.version} - BOOT
║   Platform: ${platformName}
╚═══════════════════════════════════════════╝`,
        'color:#00F2FF;font-weight:bold;font-family:monospace;'
    );
    
    bootState.stage = 'starting';
    updateProgress(15);
    updateStatus('SİSTEM ÇEKİRDEĞİ YÜKLENİYOR...');
    
    try {
        // Stage 1: Initialize configuration (30%)
        bootState.stage = 'config';
        updateProgress(30);
        updateStatus('TEMA MOTORU HAZIRLANIYOR...');
        await sleep(200); // Visual rhythm
        
        // Stage 2: Initialize router & UI engine (45%)
        bootState.stage = 'engine';
        updateProgress(45);
        updateStatus('TV ARAYÜZÜ BAŞLATILIYOR...');
        
        if (typeof initRouter === 'function') {
            await initRouter();
            console.info('[BootLoader] Router initialized');
        }
        await sleep(150);
        
        // Stage 3: Load initial route (65%)
        bootState.stage = 'route-ready';
        updateProgress(65);
        updateStatus('ANA EKRAN HAZIRLANIYOR...');
        await sleep(200);
        
        // Stage 4: Preload critical assets (85%)
        bootState.stage = 'rendering';
        updateProgress(85);
        updateStatus('İÇERİK EKRANI OLUŞTURULUYOR...');
        
        // Use a timeout for asset preloading to prevent infinite hang
        await Promise.race([
            preloadCriticalAssets(),
            sleep(2000) // 2s safety timeout
        ]);
        
        // Stage 5: Finalize boot (100%)
        bootState.stage = 'finalizing';
        updateProgress(100);
        updateStatus('FONEX HAZIR');
        
        await finalizeBoot();
        
        bootState.stage = 'ready';
        return true;
        
    } catch (error) {
        console.error('[BootLoader] Boot sequence failed:', error);
        bootState.errors.push({
            stage: bootState.stage,
            error: error.message,
            timestamp: Date.now()
        });
        await handleBootError(error);
        return false;
    }
};

/**
 * Preload critical assets for smooth UX
 */
const preloadCriticalAssets = async () => {
    // Preload icons
    if (window.lucide?.createIcons) {
        window.lucide.createIcons();
        console.info('[BootLoader] Icons preloaded');
    }
    
    // Preload fonts
    if (document.fonts?.ready) {
        try {
            await document.fonts.ready;
            console.info('[BootLoader] Fonts loaded');
        } catch (e) {
            console.warn('[BootLoader] Font loading failed or timed out', e);
        }
    }
};

/**
 * Finalize boot - hide loader, show app shell
 */
export const finalizeBoot = () => {
    return new Promise((resolve) => {
        bootState.endTime = performance.now();
        const bootDuration = bootState.endTime - bootStart;
        const elements = getElements();
        
        safeDOM(() => {
            // Update status
            if (elements.bootStatus) {
                elements.bootStatus.textContent = 'FONEX HAZIR';
            }
            
            // 1. Prepare App Shell
            if (elements.shell) {
                elements.shell.removeAttribute('aria-hidden');
                elements.shell.classList.remove('initializing');
                elements.shell.classList.add('ready', 'visible');
            }
            
            // 2. Hide Loader
            if (elements.loader) {
                elements.loader.classList.add('hidden');
                elements.loader.setAttribute('aria-hidden', 'true');
                
                // Focus first interactive element
                requestAnimationFrame(() => {
                    focusFirstElement();
                    
                    // 3. Mark Application Ready
                    document.documentElement.classList.add('app-ready');
                    document.body.classList.add('app-ready');
                    
                    
                    reportBootPerformance(bootDuration);
                    
                    // 4. Dispatch ready event when UI is officially visible
                    window.dispatchEvent(new CustomEvent('fonex:boot:complete', {
                        detail: {
                            bootTime: bootDuration,
                            version: AppConfig.version
                        }
                    }));

                    resolve();
                });
            } else {
                document.documentElement.classList.add('app-ready');
                focusFirstElement();
                reportBootPerformance(bootDuration);
                resolve();
            }
        });
    });
};

/**
 * Focus first interactive element for keyboard/remote navigation
 */
const focusFirstElement = () => {
    const focusableElements = document.querySelectorAll(
        '.nav-item, .focusable, button, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length > 0) {
        // webOS TV: Don't auto-focus, wait for remote input
        if (document.documentElement.classList.contains('webos-tv')) {
            focusableElements[0]?.classList.add('focused');
            console.info('[BootLoader] webOS detected - visual focus prepared');
        } else {
            focusableElements[0].focus();
            console.info('[BootLoader] First element focused');
        }
    }
};

/**
 * Report boot performance metrics
 * @param {number} duration - Boot duration in ms
 */
const reportBootPerformance = (duration) => {
    const metrics = {
        bootTime: duration.toFixed(2),
        fcp: performance.getEntriesByType('paint')
            .find(e => e.name === 'first-contentful-paint')?.startTime || duration,
        stage: bootState.stage,
        errors: bootState.errors.length
    };
    
    console.log(
        `%c[BootLoader] ✅ FONEX IPTV Ready in ${metrics.bootTime}ms`,
        'color:#00F2FF;font-weight:bold;'
    );
    
    console.info('[BootLoader] Performance Metrics:', metrics);
    
    // Save to session for debugging
    try {
        sessionStorage.setItem('fonex_boot_metrics', JSON.stringify(metrics));
    } catch (e) {
        console.warn('[BootLoader] Failed to save metrics:', e);
    }
    
    // Warn if boot was slow
    if (duration > MAX_BOOT_TIME) {
        console.warn(
            `[BootLoader] ⚠️ Slow boot detected: ${duration.toFixed(0)}ms > ${MAX_BOOT_TIME}ms`
        );
    }
};

/* ──────────────────────────────────────────────────────────────────────────
   6. ERROR HANDLING
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Handle critical boot errors
 * @param {Error} error - Error object
 */
export const handleBootError = async (error) => {
    bootState.stage = 'error';
    
    console.error(
        `%c[BootLoader] ❌ CRITICAL BOOT ERROR`,
        'color:#FF3B30;font-size:1.2rem;font-weight:bold;',
        error
    );
    
    safeDOM(() => {
        const elements = getElements();

        // Update loader status
        if (elements.bootStatus) {
            elements.bootStatus.textContent = 'BAŞLATMA HATASI';
            elements.bootStatus.classList.add('error-text');
        }
        
        // Show error boundary
        if (elements.errorBoundary && elements.errorMessage) {
            elements.errorBoundary.hidden = false;
            elements.errorBoundary.setAttribute('role', 'alert');
            elements.errorBoundary.setAttribute('aria-live', 'assertive');
            elements.errorMessage.textContent = 
                `Uygulama başlatılamadı: ${error.message}`;
            
            const retryButton = elements.errorBoundary.querySelector('.error-retry-btn');
            requestAnimationFrame(() => retryButton?.focus?.());
        }
        
        // Hide loader after delay
        if (elements.loader) {
            setTimeout(() => {
                elements.loader.classList.add('hidden');
                elements.loader.setAttribute('aria-hidden', 'true');
            }, 2000);
        }

        // Signal fatal boot failure to watchdog
        document.documentElement.classList.add('boot-failed');
    });
    
    // Save error for debugging
    try {
        sessionStorage.setItem('fonex_boot_error', JSON.stringify({
            message: error.message,
            stack: error.stack,
            stage: bootState.stage,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.warn('[BootLoader] Failed to save error:', e);
    }
    
    // Dispatch error event
    window.dispatchEvent(new CustomEvent('fonex:boot:error', {
        detail: { error, stage: bootState.stage }
    }));
};

/**
 * Retry boot sequence
 */
export const retryBoot = async () => {
    console.info('[BootLoader] Retrying boot sequence...');
    
    safeDOM(() => {
        const elements = getElements();
        if (elements.loader) {
            elements.loader.classList.remove('hidden');
        }
        if (elements.shell) {
            elements.shell.classList.remove('ready');
        }
        if (elements.errorBoundary) {
            elements.errorBoundary.hidden = true;
        }
    });
    
    bootState.stage = 'initializing';
    bootState.errors = [];
    bootState.progress = 0;
    updateProgress(0);
    
    await bootSequence();
};

/* ──────────────────────────────────────────────────────────────────────────
   7. UTILITY: SLEEP
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Promise-based sleep function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/* ──────────────────────────────────────────────────────────────────────────
   8. AUTO-INIT ON DOM READY
   ────────────────────────────────────────────────────────────────────────── */

// Auto-init removed to resolve double-initialization race conditions.
// The boot sequence is now manually orchestrated by the entry point (index.html).
/*
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootSequence, { once: true });
    } else {
        bootSequence();
    }
}
*/

/* ──────────────────────────────────────────────────────────────────────────
   9. EXPORTS
   ────────────────────────────────────────────────────────────────────────── */
export default {
    bootSequence,
    finalizeBoot,
    handleBootError,
    retryBoot,
    bootState
};

/* ──────────────────────────────────────────────────────────────────────────
   END OF BOOT-LOADER.JS v3.1.0
   ============================================================================ */
