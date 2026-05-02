/**
 * Strategy Cache Module
 * Persists and manages playback performance data for channels.
 */

const STORAGE_KEY = 'fonex_playback_strategies';

/**
 * Loads the strategy cache from localStorage.
 */
export function loadStrategyCache() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
        console.warn('[StrategyCache] Load failed:', e);
        return {};
    }
}

/**
 * Persists the strategy cache to localStorage.
 */
export function saveStrategyCache(cache) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch (e) {
        console.warn('[StrategyCache] Save failed:', e);
    }
}

/**
 * Clears the strategy cache.
 */
export function clearStrategyCache() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.warn('[StrategyCache] Clear failed:', e);
    }
}
