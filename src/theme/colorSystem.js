/**
 * --------------------------------------------------------------
 * Color System – Advanced Color Manipulation for Neon Effects
 * --------------------------------------------------------------
 *
 *  • hexToRgb()        – Hex kodunu RGB nesnesine çevirir.
 *  • getGlowColor()    – RGB → rgba(…, opacity) formatını döndürür.
 *  • setAccent()       – CSS‑deki accent değişkenlerini günceller.
 *
 *  Kullanım örneği:
 *
 *      import { colorSystem } from './colorSystem.js';
 *      colorSystem.setAccent('#00F2FF');
 *
 * --------------------------------------------------------------
 */

const colorSystem = {
    /**
     * Hex ("#ff00aa", "ff00aa", "#f0a", "f0a") → {r,g,b}
     * @param {string} hex
     * @returns {{r:number,g:number,b:number}|null}
     */
    hexToRgb(hex) {
        if (typeof hex !== 'string') return null;

        let cleaned = hex.trim().replace(/^#/, '');
        if (cleaned.length === 3 && /^[0-9a-fA-F]{3}$/.test(cleaned)) {
            cleaned = cleaned.split('').map((c) => c + c).join('');
        }

        if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;

        return {
            r: parseInt(cleaned.slice(0, 2), 16),
            g: parseInt(cleaned.slice(2, 4), 16),
            b: parseInt(cleaned.slice(4, 6), 16)
        };
    },

    /**
     * @param {string} hex
     * @param {number} [opacity=0.4]
     * @returns {string|null}
     */
    getGlowColor(hex, opacity = 0.4) {
        const rgb = this.hexToRgb(hex);
        const safeOpacity = Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 0.4;
        return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeOpacity})` : null;
    },

    /**
     * @param {string} hex
     */
    setAccent(hex) {
        const normalized = typeof hex === 'string' ? (hex.startsWith('#') ? hex : `#${hex}`) : '';
        const rgb = this.hexToRgb(normalized);

        if (!rgb || !/^[0-9a-fA-F]{6}$/.test(normalized.replace('#', ''))) {
            console.warn('[colorSystem] Invalid HEX supplied to setAccent():', hex);
            return;
        }

        const root = document.documentElement;
        root.style.setProperty('--v-accent', normalized);
        root.style.setProperty('--v-accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        root.style.setProperty('--v-accent-glow', this.getGlowColor(normalized, 0.4));
        root.style.setProperty('--v-accent-soft', this.getGlowColor(normalized, 0.15));
    }
};

export { colorSystem };
