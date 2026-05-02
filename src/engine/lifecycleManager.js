/**
 * Manages the application lifecycle (Initialization, Visibility, Termination).
 */
import eventBus from './eventBus.js';

class LifecycleManager {
    constructor() {
        this.isInitialized = false;
    }

    init() {
        console.log('[Lifecycle] Initializing App...');
        
        // Listen for WebOS visibility events
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.onBackground();
            } else {
                this.onForeground();
            }
        });

        window.addEventListener('unload', () => this.onTerminate());

        this.isInitialized = true;
        eventBus.emit('APP_READY');
    }

    onBackground() {
        console.log('[Lifecycle] App moved to background');
        eventBus.emit('APP_BACKGROUND');
    }

    onForeground() {
        console.log('[Lifecycle] App moved to foreground');
        eventBus.emit('APP_FOREGROUND');
    }

    onTerminate() {
        console.log('[Lifecycle] App terminating');
        eventBus.emit('APP_TERMINATE');
    }
}

export const lifecycleManager = new LifecycleManager();
export default lifecycleManager;
