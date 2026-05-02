/**
 * ============================================================================
 * FONEX IPTV - ICON HELPER UTILITIES
 * Version: 2.5.0
 * Platform: LG webOS TV + Modern Browsers
 * Author: FONEX Labs
 * 
 * 📋 PURPOSE:
 *   - Safe and performant Lucide icon rendering
 *   - Icon caching for repeated renders
 *   - webOS TV specific optimizations
 *   - Fallback mechanisms for missing icons
 *   - Dynamic icon updates
 * 
 * 🔗 USAGE:
 *   import { iconHelper } from './utils/iconHelper.js';
 * 
 * ⚡ PERFORMANCE:
 *   - Cached icon configurations
 *   - Batch rendering support
 *   - Selective re-rendering (only changed icons)
 * ============================================================================ */

/* ──────────────────────────────────────────────────────────────────────────
   1. ICON CONFIGURATION & CACHE
   ────────────────────────────────────────────────────────────────────────── */

/** @type {Map<string, HTMLElement>} */
const iconCache = new Map();

/** @type {Set<string>} */
const renderedContainers = new Set();

/** @type {Object} */
const iconConfig = Object.freeze({
    // Default Lucide attributes
    defaultAttrs: {
        'stroke-width': 1.5,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'class': 'fonex-icon',
        'aria-hidden': 'true'
    },
    
    // Size presets
    sizes: {
        xs: 14,
        sm: 18,
        md: 24,
        lg: 32,
        xl: 48,
        xxl: 64
    },
    
    // webOS TV specific settings
    webOS: {
        largerIcons: true,
        highContrast: false,
        minSize: 24
    },
    
    // Attribute names
    nameAttr: 'data-lucide',
    sizeAttr: 'data-icon-size'
});

/* ──────────────────────────────────────────────────────────────────────────
   2. CORE ICON RENDERING
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Initialize Lucide icons in container
 * @param {HTMLElement|Document} [container=document] - Container element
 * @param {Object} [options] - Rendering options
 * @returns {boolean} Success status
 * 
 * @example
 * iconHelper.render(); // Render all icons in document
 * iconHelper.render(sidebarElement); // Render only in sidebar
 */
export const renderIcons = (container = document, options = {}) => {
    if (!container) {
        console.warn('[iconHelper] Invalid container provided');
        return false;
    }
    
    // Check if Lucide is available
    if (!window.lucide) {
        console.warn('[iconHelper] Lucide library not loaded');
        return false;
    }
    
    try {
        // Merge default options with provided options
        const config = {
            attrs: { ...iconConfig.defaultAttrs, ...(options.attrs || {}) },
            nameAttr: iconConfig.nameAttr,
            ...(options)
        };
        
        // Apply webOS TV optimizations
        if (document.documentElement.classList.contains('webos-tv')) {
            config.attrs['stroke-width'] = 2;
            config.attrs['class'] += ' webos-icon';
        }
        
        // Render icons
        window.lucide.createIcons(config);
        
        // Cache rendered container
        if (container instanceof HTMLElement) {
            renderedContainers.add(container);
        }
        
        console.info(`[iconHelper] Icons rendered in container`);
        return true;
        
    } catch (error) {
        console.error('[iconHelper] Icon rendering failed:', error);
        return false;
    }
};

/**
 * Refresh icons in specific container (re-render)
 * @param {HTMLElement} container - Container to refresh
 * @returns {boolean} Success status
 */
export const refreshIcons = (container) => {
    if (!container || !(container instanceof HTMLElement)) {
        console.warn('[iconHelper] Invalid container for refresh');
        return false;
    }
    
    // Remove from rendered set to force re-render
    renderedContainers.delete(container);
    
    // Clear icon cache for this container
    const icons = container.querySelectorAll(`[${iconConfig.nameAttr}]`);
    icons.forEach(icon => {
        icon.innerHTML = '';
        iconCache.delete(icon.dataset.lucide);
    });
    
    // Re-render
    return renderIcons(container);
};

/**
 * Render single icon by name
 * @param {string} iconName - Icon name (e.g., 'home', 'settings')
 * @param {Object} [options] - Icon options
 * @returns {SVGElement|null} Created SVG element or null
 * 
 * @example
 * const homeIcon = iconHelper.create('home', { size: 24 });
 */
export const createIcon = (iconName, options = {}) => {
    if (!iconName || typeof iconName !== 'string') {
        console.warn('[iconHelper] Invalid icon name:', iconName);
        return null;
    }
    
    if (!window.lucide?.icons?.[iconName]) {
        console.warn('[iconHelper] Icon not found:', iconName);
        return null;
    }
    
    try {
        // Get icon data
        const iconData = window.lucide.icons[iconName];
        
        // Create SVG element
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.setAttribute('width', options.size || iconConfig.sizes.md);
        svg.setAttribute('height', options.size || iconConfig.sizes.md);
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', iconConfig.defaultAttrs['stroke-width']);
        svg.setAttribute('stroke-linecap', iconConfig.defaultAttrs['stroke-linecap']);
        svg.setAttribute('stroke-linejoin', iconConfig.defaultAttrs['stroke-linejoin']);
        
        // Add class
        const className = options.class || iconConfig.defaultAttrs['class'];
        if (className) {
            svg.setAttribute('class', className);
        }
        
        // Create path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', iconData[0]);
        
        // Add attributes to path
        if (iconData[1]) {
            Object.entries(iconData[1]).forEach(([key, value]) => {
                path.setAttribute(key, value);
            });
        }
        
        svg.appendChild(path);
        
        // Cache icon
        iconCache.set(iconName, svg);
        
        return svg;
        
    } catch (error) {
        console.error('[iconHelper] createIcon failed:', error);
        return null;
    }
};

/* ──────────────────────────────────────────────────────────────────────────
   3. ICON SIZE UTILITIES
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Get icon size value
 * @param {string|number} size - Size name or pixel value
 * @returns {number} Size in pixels
 * 
 * @example
 * getIconSize('lg'); // 32
 * getIconSize(48); // 48
 */
export const getIconSize = (size) => {
    if (typeof size === 'number') {
        return Math.max(iconConfig.webOS.minSize, size);
    }
    
    if (typeof size === 'string' && iconConfig.sizes[size]) {
        return iconConfig.sizes[size];
    }
    
    return iconConfig.sizes.md;
};

/**
 * Set icon size on element
 * @param {SVGElement} icon - Icon element
 * @param {string|number} size - Size name or pixel value
 * @returns {boolean} Success status
 */
export const setIconSize = (icon, size) => {
    if (!icon || !(icon instanceof SVGElement)) {
        console.warn('[iconHelper] Invalid icon element');
        return false;
    }
    
    const pixelSize = getIconSize(size);
    icon.setAttribute('width', pixelSize);
    icon.setAttribute('height', pixelSize);
    
    return true;
};

/**
 * Get all available icon size presets
 * @returns {Object} Size presets
 */
export const getIconSizes = () => {
    return { ...iconConfig.sizes };
};

/* ──────────────────────────────────────────────────────────────────────────
   4. ICON STATE MANAGEMENT
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Set icon active state
 * @param {SVGElement} icon - Icon element
 * @param {boolean} active - Active state
 */
export const setIconActive = (icon, active) => {
    if (!icon || !(icon instanceof SVGElement)) return;
    
    if (active) {
        icon.classList.add('icon-active');
    } else {
        icon.classList.remove('icon-active');
    }
};

/**
 * Set icon disabled state
 * @param {SVGElement} icon - Icon element
 * @param {boolean} disabled - Disabled state
 */
export const setIconDisabled = (icon, disabled) => {
    if (!icon || !(icon instanceof SVGElement)) return;
    
    if (disabled) {
        icon.classList.add('icon-disabled');
        icon.setAttribute('aria-disabled', 'true');
    } else {
        icon.classList.remove('icon-disabled');
        icon.removeAttribute('aria-disabled');
    }
};

/**
 * Set icon loading state
 * @param {SVGElement} icon - Icon element
 * @param {boolean} loading - Loading state
 */
export const setIconLoading = (icon, loading) => {
    if (!icon || !(icon instanceof SVGElement)) return;
    
    if (loading) {
        icon.classList.add('icon-loading');
        icon.setAttribute('aria-busy', 'true');
    } else {
        icon.classList.remove('icon-loading');
        icon.removeAttribute('aria-busy');
    }
};

/* ──────────────────────────────────────────────────────────────────────────
   5. BATCH OPERATIONS
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Render icons in multiple containers
 * @param {HTMLElement[]} containers - Array of containers
 * @returns {number} Number of successfully rendered containers
 */
export const renderIconsBatch = (containers) => {
    if (!Array.isArray(containers)) {
        console.warn('[iconHelper] renderIconsBatch: containers must be an array');
        return 0;
    }
    
    let successCount = 0;
    
    for (const container of containers) {
        if (renderIcons(container)) {
            successCount++;
        }
    }
    
    console.info(`[iconHelper] Batch render: ${successCount}/${containers.length} successful`);
    return successCount;
};

/**
 * Replace icon in element
 * @param {HTMLElement} container - Container element
 * @param {string} newIconName - New icon name
 * @returns {boolean} Success status
 */
export const replaceIcon = (container, newIconName) => {
    if (!container || !(container instanceof HTMLElement)) {
        console.warn('[iconHelper] Invalid container for replaceIcon');
        return false;
    }
    
    if (!newIconName || typeof newIconName !== 'string') {
        console.warn('[iconHelper] Invalid icon name for replaceIcon');
        return false;
    }
    
    try {
        // Find existing icon
        const existingIcon = container.querySelector('svg');
        
        if (existingIcon) {
            existingIcon.remove();
        }
        
        // Create new icon
        const newIcon = createIcon(newIconName);
        if (newIcon) {
            container.appendChild(newIcon);
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error('[iconHelper] replaceIcon failed:', error);
        return false;
    }
};

/* ──────────────────────────────────────────────────────────────────────────
   6. WEBOS TV OPTIMIZATIONS
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Apply webOS TV specific icon optimizations
 */
export const applyWebOSOptimizations = () => {
    if (!document.documentElement.classList.contains('webos-tv')) {
        console.info('[iconHelper] Not webOS TV, skipping optimizations');
        return;
    }
    
    // Increase all icon sizes
    const icons = document.querySelectorAll('.fonex-icon, .sovereign-icon');
    icons.forEach(icon => {
        const currentSize = parseInt(icon.getAttribute('width') || '24', 10);
        const newSize = Math.max(currentSize + 8, iconConfig.webOS.minSize);
        icon.setAttribute('width', newSize);
        icon.setAttribute('height', newSize);
    });
    
    // Increase stroke width for better visibility
    document.documentElement.style.setProperty('--icon-stroke-width', '2');
    
    console.info('[iconHelper] webOS TV optimizations applied');
};

/**
 * Enable high contrast mode for icons
 * @param {boolean} enabled - Enable/disable
 */
export const setHighContrast = (enabled) => {
    if (enabled) {
        document.documentElement.classList.add('icon-high-contrast');
        iconConfig.webOS.highContrast = true;
    } else {
        document.documentElement.classList.remove('icon-high-contrast');
        iconConfig.webOS.highContrast = false;
    }
};

/* ──────────────────────────────────────────────────────────────────────────
   7. ICON REGISTRATION & AVAILABILITY
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Check if icon exists in Lucide library
 * @param {string} iconName - Icon name
 * @returns {boolean} True if exists
 */
export const iconExists = (iconName) => {
    return !!(window.lucide?.icons?.[iconName]);
};

/**
 * Get list of all available icons
 * @returns {string[]} Array of icon names
 */
export const getAvailableIcons = () => {
    if (!window.lucide?.icons) {
        console.warn('[iconHelper] Lucide icons not available');
        return [];
    }
    
    return Object.keys(window.lucide.icons);
};

/**
 * Validate icon name
 * @param {string} iconName - Icon name to validate
 * @returns {{valid: boolean, suggestion?: string}} Validation result
 */
export const validateIconName = (iconName) => {
    if (!iconName || typeof iconName !== 'string') {
        return { valid: false, error: 'Invalid icon name' };
    }
    
    if (iconExists(iconName)) {
        return { valid: true };
    }
    
    // Try to find similar icon
    const availableIcons = getAvailableIcons();
    const similar = availableIcons.find(name => 
        name.toLowerCase().includes(iconName.toLowerCase())
    );
    
    return {
        valid: false,
        suggestion: similar
    };
};

/* ──────────────────────────────────────────────────────────────────────────
   8. ANIMATION UTILITIES
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Add pulse animation to icon
 * @param {SVGElement} icon - Icon element
 * @param {number} duration - Animation duration in ms
 */
export const pulseIcon = (icon, duration = 1000) => {
    if (!icon || !(icon instanceof SVGElement)) return;
    
    icon.style.animation = `iconPulse ${duration}ms ease-in-out`;
    
    setTimeout(() => {
        icon.style.animation = '';
    }, duration);
};

/**
 * Add rotate animation to icon
 * @param {SVGElement} icon - Icon element
 * @param {number} degrees - Rotation degrees
 * @param {number} duration - Animation duration in ms
 */
export const rotateIcon = (icon, degrees = 360, duration = 500) => {
    if (!icon || !(icon instanceof SVGElement)) return;
    
    icon.style.transition = `transform ${duration}ms ease`;
    icon.style.transform = `rotate(${degrees}deg)`;
    
    setTimeout(() => {
        icon.style.transform = 'rotate(0deg)';
    }, duration + 100);
};

/**
 * Add scale animation to icon
 * @param {SVGElement} icon - Icon element
 * @param {number} scale - Scale factor
 * @param {number} duration - Animation duration in ms
 */
export const scaleIcon = (icon, scale = 1.2, duration = 300) => {
    if (!icon || !(icon instanceof SVGElement)) return;
    
    icon.style.transition = `transform ${duration}ms ease`;
    icon.style.transform = `scale(${scale})`;
    
    setTimeout(() => {
        icon.style.transform = 'scale(1)';
    }, duration + 100);
};

/* ──────────────────────────────────────────────────────────────────────────
   9. CLEANUP & MEMORY MANAGEMENT
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Clear icon cache
 */
export const clearIconCache = () => {
    iconCache.clear();
    renderedContainers.clear();
    console.info('[iconHelper] Icon cache cleared');
};

/**
 * Remove all icons from container
 * @param {HTMLElement} container - Container element
 */
export const removeIcons = (container) => {
    if (!container || !(container instanceof HTMLElement)) {
        console.warn('[iconHelper] Invalid container for removeIcons');
        return;
    }
    
    const icons = container.querySelectorAll('svg.fonex-icon, svg.sovereign-icon');
    icons.forEach(icon => icon.remove());
    
    renderedContainers.delete(container);
    
    console.info('[iconHelper] Icons removed from container');
};

/* ──────────────────────────────────────────────────────────────────────────
   10. INITIALIZATION
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Initialize icon helper
 * @param {Object} options - Initialization options
 * @returns {boolean} Success status
 */
export const initIconHelper = (options = {}) => {
    console.info('[iconHelper] Initializing...');
    
    // Check Lucide availability
    if (!window.lucide) {
        console.error('[iconHelper] Lucide library not loaded!');
        return false;
    }
    
    // Apply custom config
    if (options.sizes) {
        Object.assign(iconConfig.sizes, options.sizes);
    }
    
    if (options.defaultAttrs) {
        Object.assign(iconConfig.defaultAttrs, options.defaultAttrs);
    }
    
    // Check for webOS TV
    if (document.documentElement.classList.contains('webos-tv')) {
        applyWebOSOptimizations();
    }
    
    console.info('[iconHelper] Initialized successfully');
    return true;
};

/* ──────────────────────────────────────────────────────────────────────────
   11. EXPORTS (Frozen Object)
   ────────────────────────────────────────────────────────────────────────── */

export const iconHelper = Object.freeze({
    // Core Rendering
    renderIcons,
    refreshIcons,
    createIcon,
    
    // Size Utilities
    getIconSize,
    setIconSize,
    getIconSizes,
    
    // State Management
    setIconActive,
    setIconDisabled,
    setIconLoading,
    
    // Batch Operations
    renderIconsBatch,
    replaceIcon,
    
    // webOS TV
    applyWebOSOptimizations,
    setHighContrast,
    
    // Registration
    iconExists,
    getAvailableIcons,
    validateIconName,
    
    // Animations
    pulseIcon,
    rotateIcon,
    scaleIcon,
    
    // Cleanup
    clearIconCache,
    removeIcons,
    
    // Initialization
    initIconHelper
});

// Backward compatibility alias
// Some screens import createLucideIcons from iconHelper.
// Internally we use renderIcons as the real Lucide renderer.
export const createLucideIcons = (container = document, options = {}) => {
    return renderIcons(container, options);
};

/* ──────────────────────────────────────────────────────────────────────────
   END OF ICONHELPER.JS v2.5.0
   ============================================================================ */
