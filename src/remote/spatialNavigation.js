/**
 * Spatial Navigation - Manages focus state for TV UI.
 * High-precision directional movement for remote controls.
 */
import eventBus from '../engine/eventBus.js';

class SpatialNavigation {
    constructor() {
        this.currentFocus = null;
        this.lastFocusedInView = new Map(); // Remember focus per screen
        this.focusableSelector = '.sidebar-item, .group-chip, .poster-card, .btn, .btn-wow, .toggle-switch, .form-input-group input, [tabindex="0"]';
    }

    init() {
        // Handle KeyDown from Remote/Keyboard
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Hybrid: Mouse Sync with Remote Focus
        document.addEventListener('mouseover', (e) => {
            const target = e.target.closest(this.focusableSelector);
            if (target) this.setFocus(target, false);
        });

        // Set initial focus
        setTimeout(() => this.focusFirst(), 500);

        // Focus Guard: Robust recovery
        this.startFocusGuard();
    }

    startFocusGuard() {
        setInterval(() => {
            if (!document.activeElement || document.activeElement === document.body) {
                console.log('[Nav] Focus lost, restoring...');
                this.focusFirst();
            }
        }, 2000);
    }

    focusFirst() {
        const first = document.querySelector('.sidebar-item.active') || document.querySelector(this.focusableSelector);
        if (first) this.setFocus(first);
    }

    setFocus(element, shouldScroll = true) {
        if (!element || element === this.currentFocus) return;
        
        if (this.currentFocus) {
            this.currentFocus.classList.remove('focused');
            this.currentFocus.blur();
        }

        this.currentFocus = element;
        this.currentFocus.classList.add('focused');
        this.currentFocus.focus();
        
        // Update Focus Memory for current view
        const viewId = document.querySelector('.home-screen') ? 'home' : (document.querySelector('.settings-container') ? 'settings' : 'default');
        if (!element.classList.contains('sidebar-item')) {
            this.lastFocusedInView.set(viewId, element);
        }

        if (shouldScroll) {
            this.currentFocus.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
            });
        }
    }

    handleKeyDown(e) {
        const keyMap = {
            37: 'LEFT',
            38: 'UP',
            39: 'RIGHT',
            40: 'DOWN',
            13: 'ENTER',
            461: 'BACK', // WebOS Back
            27: 'BACK'   // ESC as Back
        };

        const action = keyMap[e.keyCode];
        if (action) {
            if (action === 'ENTER') {
                if (this.currentFocus) this.currentFocus.click();
            } else if (action === 'BACK') {
                eventBus.emit('KEY_ACTION', { action: 'BACK' });
            } else {
                this.move(action);
            }
            e.preventDefault();
        }
    }

    move(direction) {
        const focusables = Array.from(document.querySelectorAll(this.focusableSelector))
            .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
            
        if (focusables.length === 0) return;
        
        if (!this.currentFocus) {
            this.focusFirst();
            return;
        }

        const currentRect = this.currentFocus.getBoundingClientRect();
        let bestElement = null;
        let minDistance = Infinity;

        focusables.forEach(target => {
            if (target === this.currentFocus) return;

            const targetRect = target.getBoundingClientRect();
            const deltaX = targetRect.left - currentRect.left;
            const deltaY = targetRect.top - currentRect.top;

            let isCorrectDirection = false;
            if (direction === 'UP') isCorrectDirection = deltaY < 0;
            if (direction === 'DOWN') isCorrectDirection = deltaY > 0;
            if (direction === 'LEFT') isCorrectDirection = deltaX < 0;
            if (direction === 'RIGHT') isCorrectDirection = deltaX > 0;

            if (isCorrectDirection) {
                const dist = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
                const axialDiff = (direction === 'UP' || direction === 'DOWN') ? Math.abs(deltaX) : Math.abs(deltaY);
                const score = dist + (axialDiff * 3); // Stronger axial preference

                if (score < minDistance) {
                    minDistance = score;
                    bestElement = target;
                }
            }
        });

        if (bestElement) {
            this.setFocus(bestElement);
        }
    }
}

export const spatialNavigation = new SpatialNavigation();
export default spatialNavigation;
