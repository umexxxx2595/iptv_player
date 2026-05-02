/**
 * Maps WebOS / Browser keys to internal actions.
 */
import eventBus from '../engine/eventBus.js';

const KEY_MAP = {
    37: 'LEFT',
    38: 'UP',
    39: 'RIGHT',
    40: 'DOWN',
    13: 'ENTER',
    461: 'BACK',      // WebOS Back
    27: 'BACK',       // Browser Escape
    415: 'PLAY',      // WebOS Play
    19: 'PAUSE',      // WebOS Pause
    413: 'STOP',      // WebOS Stop
    33: 'PAGE_UP',
    34: 'PAGE_DOWN',
    403: 'RED',
    404: 'GREEN',
    405: 'YELLOW',
    406: 'BLUE'
};

export function initKeyHandler() {
    window.addEventListener('keydown', (e) => {
        const keyCode = e.keyCode || e.which;
        const action = KEY_MAP[keyCode];

        if (action) {
            console.log(`[Remote] Key: ${keyCode} -> Action: ${action}`);
            eventBus.emit('KEY_ACTION', { action, originalEvent: e });
            
            // Prevent default browser behavior for navigation keys
            if (['LEFT', 'UP', 'RIGHT', 'DOWN', 'BACK', 'ENTER'].includes(action)) {
                e.preventDefault();
            }
        }
    });
}
