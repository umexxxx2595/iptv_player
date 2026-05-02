/**
 * Engine Bootstrap - Initializes core services.
 */
import lifecycleManager from './lifecycleManager.js';
import eventBus from './eventBus.js';
import { themeManager } from '../theme/themeManager.js';

export async function bootstrapEngine() {
    console.log('[Engine] Bootstrapping...');

    try {
        // 1. Initialize Lifecycle
        lifecycleManager.init();

        // 2. Initialize Theme
        themeManager.init();

        // 2. Setup Error Handling
        window.onerror = (msg, url, lineNo, columnNo, error) => {
            eventBus.emit('GLOBAL_ERROR', { msg, url, lineNo, error });
            return false;
        };

        console.log('[Engine] Bootstrap Complete');
        return true;
    } catch (error) {
        console.error('[Engine] Bootstrap Failed:', error);
        throw error;
    }
}
