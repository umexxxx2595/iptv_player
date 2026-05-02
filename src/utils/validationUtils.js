/**
 * ============================================================================
 * FONEX IPTV - VALIDATION UTILITIES
 * Version: 2.5.0
 * Platform: LG webOS TV + Modern Browsers
 * Author: FONEX Labs
 * 
 * 📋 PURPOSE:
 *   - Security & integrity checks for user input
 *   - URL validation for playlist streams
 *   - XSS protection and sanitization
 *   - Form validation helpers
 *   - IPTV-specific validation (M3U, streams, EPG)
 * 
 * 🔗 USAGE:
 *   import { validationUtils } from './utils/validationUtils.js';
 * 
 * ⚡ SECURITY:
 *   - CSP-compliant sanitization
 *   - XSS prevention
 *   - URL protocol validation
 *   - Input length limits
 * ============================================================================ */

/* ──────────────────────────────────────────────────────────────────────────
   1. CACHED REGEX PATTERNS (Performance)
   ────────────────────────────────────────────────────────────────────────── */

const regexCache = Object.freeze({
    // URL validation
    url: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i,
    
    // Strict URL (requires protocol)
    strictUrl: /^https?:\/\/[\w\-]+(\.[\w\-]+)+[/#?]?.*$/i,
    
    // M3U/M3U8 playlist
    m3u: /\.m3u8?(\?.*)?$/i,
    
    // Email
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    
    // IPv4
    ipv4: /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    
    // IPv6
    ipv6: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:)?((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/i,
    
    // Hostname
    hostname: /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
    
    // Port number
    port: /^([0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$/,
    
    // XSS patterns
    xssScript: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    xssEvent: /\bon\w+\s*=/gi,
    xssJavascript: /javascript\s*:/gi,
    xssDataUri: /data\s*:/gi,
    
    // SQL injection patterns
    sqlInjection: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b|--|;|\/\*|\*\/)/gi,
    
    // Safe filename
    filename: /^[^<>:"\/\\|?*\x00-\x1F]+$/,
    
    // Numeric only
    numeric: /^\d+$/,
    
    // Alphanumeric
    alphanumeric: /^[a-zA-Z0-9]+$/,
    
    // Turkish characters
    turkishChars: /[ğĞüÜşŞıİöÖçÇ]/
});

/* ──────────────────────────────────────────────────────────────────────────
   2. URL VALIDATION
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @param {Object} [options] - Validation options
 * @returns {boolean} True if valid URL
 * 
 * @example
 * isValidUrl('https://example.com'); // true
 * isValidUrl('not-a-url'); // false
 */
export const isValidUrl = (url, options = {}) => {
    if (!url || typeof url !== 'string') {
        console.warn('[validationUtils] isValidUrl: Invalid input');
        return false;
    }
    
    const trimmed = url.trim();
    
    if (trimmed.length === 0) return false;
    if (trimmed.length > 2048) {
        console.warn('[validationUtils] isValidUrl: URL too long');
        return false;
    }
    
    try {
        // Strict mode requires protocol
        if (options.strict) {
            return regexCache.strictUrl.test(trimmed);
        }
        
        // Try URL constructor
        new URL(trimmed.startsWith('http') ? trimmed : `http://${trimmed}`);
        return true;
        
    } catch (error) {
        return false;
    }
};

/**
 * Validate URL is HTTPS (secure)
 * @param {string} url - URL to validate
 * @returns {boolean} True if HTTPS
 */
export const isSecureUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

/**
 * Validate URL protocol is allowed
 * @param {string} url - URL to validate
 * @param {string[]} [allowedProtocols=['http:', 'https:']] - Allowed protocols
 * @returns {boolean} True if protocol is allowed
 */
export const isAllowedProtocol = (url, allowedProtocols = ['http:', 'https:']) => {
    if (!url || typeof url !== 'string') return false;
    
    try {
        const parsed = new URL(url);
        return allowedProtocols.includes(parsed.protocol);
    } catch {
        return false;
    }
};

/**
 * Validate stream URL (HLS/DASH)
 * @param {string} url - Stream URL
 * @returns {boolean} True if valid stream URL
 */
export const isValidStreamUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    
    const lowerUrl = url.toLowerCase();
    
    // Check for stream extensions
    const streamExtensions = ['.m3u8', '.mpd', '.ts', '.mp4', '.webm'];
    const hasStreamExt = streamExtensions.some(ext => lowerUrl.includes(ext));
    
    // Check for stream keywords
    const streamKeywords = ['stream', 'live', 'hls', 'dash', 'playlist'];
    const hasKeyword = streamKeywords.some(kw => lowerUrl.includes(kw));
    
    return isValidUrl(url) && (hasStreamExt || hasKeyword);
};

/* ──────────────────────────────────────────────────────────────────────────
   3. PLAYLIST VALIDATION (M3U/M3U8)
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Validate M3U/M3U8 playlist URL or content
 * @param {string} url - Playlist URL or content
 * @returns {boolean} True if valid M3U
 * 
 * @example
 * isM3U('https://example.com/playlist.m3u8'); // true
 * isM3U('#EXTM3U\n#EXTINF:...'); // true
 */
export const isM3U = (url) => {
    if (!url || typeof url !== 'string') {
        console.warn('[validationUtils] isM3U: Invalid input');
        return false;
    }
    
    const lower = url.toLowerCase().trim();
    
    // Check URL extension
    if (lower.startsWith('http')) {
        return regexCache.m3u.test(lower) || lower.includes('m3u_plus');
    }
    
    // Check M3U content header
    if (lower.startsWith('#extm3u')) {
        return true;
    }
    
    return false;
};

/**
 * Validate M3U content structure
 * @param {string} content - M3U file content
 * @returns {{valid: boolean, errors: string[], channelCount: number}} Validation result
 */
export const validateM3UContent = (content) => {
    const result = {
        valid: false,
        errors: [],
        channelCount: 0
    };
    
    if (!content || typeof content !== 'string') {
        result.errors.push('Empty or invalid content');
        return result;
    }
    
    // Check header
    if (!content.trim().startsWith('#EXTM3U')) {
        result.errors.push('Missing #EXTM3U header');
        return result;
    }
    
    // Count channels
    const extInfMatches = content.match(/#EXTINF:/gi);
    result.channelCount = extInfMatches ? extInfMatches.length : 0;
    
    if (result.channelCount === 0) {
        result.errors.push('No channels found (#EXTINF tags missing)');
        return result;
    }
    
    // Check for URLs
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = content.match(urlPattern);
    
    if (!urls || urls.length === 0) {
        result.errors.push('No stream URLs found');
        return result;
    }
    
    result.valid = true;
    return result;
};

/**
 * Extract playlist info from M3U content
 * @param {string} content - M3U content
 * @returns {Object} Playlist metadata
 */
export const extractPlaylistInfo = (content) => {
    if (!content || typeof content !== 'string') {
        return { title: '', logo: '', channels: 0 };
    }
    
    const info = {
        title: '',
        logo: '',
        channels: 0
    };
    
    // Extract title from #EXTM3U line
    const titleMatch = content.match(/#EXTM3U\s+x-tvg-name="([^"]+)"/i);
    if (titleMatch) {
        info.title = titleMatch[1];
    }
    
    // Extract logo
    const logoMatch = content.match(/logo="([^"]+)"/i);
    if (logoMatch) {
        info.logo = logoMatch[1];
    }
    
    // Count channels
    const extInfMatches = content.match(/#EXTINF:/gi);
    info.channels = extInfMatches ? extInfMatches.length : 0;
    
    return info;
};

/* ──────────────────────────────────────────────────────────────────────────
   4. INPUT SANITIZATION (XSS Protection)
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Sanitize string for safe HTML display
 * @param {string} str - Input string
 * @param {Object} [options] - Sanitization options
 * @returns {string} Sanitized string
 * 
 * @example
 * sanitize('<script>alert("xss")</script>'); // "&lt;script&gt;..."
 */
export const sanitize = (str, options = {}) => {
    if (!str || typeof str !== 'string') {
        console.warn('[validationUtils] sanitize: Invalid input');
        return '';
    }
    
    let sanitized = str;
    
    // Remove script tags
    if (options.removeScripts !== false) {
        sanitized = sanitized.replace(regexCache.xssScript, '');
    }
    
    // Remove event handlers
    if (options.removeEvents !== false) {
        sanitized = sanitized.replace(regexCache.xssEvent, '');
    }
    
    // Remove javascript: protocol
    if (options.removeJavascript !== false) {
        sanitized = sanitized.replace(regexCache.xssJavascript, '');
    }
    
    // Remove data: URIs
    if (options.removeDataUri !== false) {
        sanitized = sanitized.replace(regexCache.xssDataUri, '');
    }
    
    // HTML entity encoding
    sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    // Trim if option enabled
    if (options.trim) {
        sanitized = sanitized.trim();
    }
    
    // Length limit
    if (options.maxLength && sanitized.length > options.maxLength) {
        sanitized = sanitized.substring(0, options.maxLength);
    }
    
    return sanitized;
};

/**
 * Sanitize for attribute context (quotes escaped)
 * @param {string} str - Input string
 * @returns {string} Sanitized string
 */
export const sanitizeAttribute = (str) => {
    if (!str || typeof str !== 'string') return '';
    
    return sanitize(str)
        .replace(/=/g, '&#61;')
        .replace(/\//g, '&#47;');
};

/**
 * Sanitize for JavaScript context
 * @param {string} str - Input string
 * @returns {string} Sanitized string
 */
export const sanitizeJS = (str) => {
    if (!str || typeof str !== 'string') return '';
    
    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/</g, '\\x3c')
        .replace(/>/g, '\\x3e');
};

/**
 * Strip all HTML tags
 * @param {string} str - Input string
 * @returns {string} Plain text
 */
export const stripTags = (str) => {
    if (!str || typeof str !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = str;
    return div.textContent || '';
};

/* ──────────────────────────────────────────────────────────────────────────
   5. EMAIL VALIDATION
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True if valid email
 */
export const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    
    const trimmed = email.trim();
    
    if (trimmed.length > 254) return false;
    if (trimmed.length < 5) return false;
    
    return regexCache.email.test(trimmed);
};

/**
 * Normalize email (lowercase, trim)
 * @param {string} email - Email address
 * @returns {string} Normalized email
 */
export const normalizeEmail = (email) => {
    if (!email || typeof email !== 'string') return '';
    return email.trim().toLowerCase();
};

/* ──────────────────────────────────────────────────────────────────────────
   6. IP ADDRESS & HOSTNAME VALIDATION
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Validate IPv4 address
 * @param {string} ip - IP address
 * @returns {boolean} True if valid IPv4
 */
export const isValidIPv4 = (ip) => {
    if (!ip || typeof ip !== 'string') return false;
    return regexCache.ipv4.test(ip.trim());
};

/**
 * Validate IPv6 address
 * @param {string} ip - IP address
 * @returns {boolean} True if valid IPv6
 */
export const isValidIPv6 = (ip) => {
    if (!ip || typeof ip !== 'string') return false;
    return regexCache.ipv6.test(ip.trim());
};

/**
 * Validate IP address (v4 or v6)
 * @param {string} ip - IP address
 * @returns {boolean} True if valid IP
 */
export const isValidIP = (ip) => {
    return isValidIPv4(ip) || isValidIPv6(ip);
};

/**
 * Validate hostname
 * @param {string} hostname - Hostname
 * @returns {boolean} True if valid hostname
 */
export const isValidHostname = (hostname) => {
    if (!hostname || typeof hostname !== 'string') return false;
    
    const trimmed = hostname.trim();
    
    if (trimmed.length > 253) return false;
    if (trimmed.startsWith('.') || trimmed.endsWith('.')) return false;
    
    return regexCache.hostname.test(trimmed);
};

/**
 * Validate port number
 * @param {string|number} port - Port number
 * @returns {boolean} True if valid port
 */
export const isValidPort = (port) => {
    if (typeof port === 'number') {
        return port >= 0 && port <= 65535;
    }
    
    if (typeof port === 'string') {
        return regexCache.port.test(port);
    }
    
    return false;
};

/* ──────────────────────────────────────────────────────────────────────────
   7. SECURITY VALIDATION
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Check for XSS patterns
 * @param {string} str - Input string
 * @returns {{safe: boolean, threats: string[]}} Security check result
 */
export const checkXSS = (str) => {
    const result = {
        safe: true,
        threats: []
    };
    
    if (!str || typeof str !== 'string') {
        result.threats.push('Invalid input');
        result.safe = false;
        return result;
    }
    
    if (regexCache.xssScript.test(str)) {
        result.threats.push('Script tag detected');
        result.safe = false;
    }
    
    if (regexCache.xssEvent.test(str)) {
        result.threats.push('Event handler detected');
        result.safe = false;
    }
    
    if (regexCache.xssJavascript.test(str)) {
        result.threats.push('JavaScript protocol detected');
        result.safe = false;
    }
    
    if (regexCache.xssDataUri.test(str)) {
        result.threats.push('Data URI detected');
        result.safe = false;
    }
    
    return result;
};

/**
 * Check for SQL injection patterns
 * @param {string} str - Input string
 * @returns {{safe: boolean, threats: string[]}} Security check result
 */
export const checkSQLInjection = (str) => {
    const result = {
        safe: true,
        threats: []
    };
    
    if (!str || typeof str !== 'string') {
        result.threats.push('Invalid input');
        result.safe = false;
        return result;
    }
    
    if (regexCache.sqlInjection.test(str)) {
        result.threats.push('SQL injection pattern detected');
        result.safe = false;
    }
    
    return result;
};

/**
 * Full security check (XSS + SQL)
 * @param {string} str - Input string
 * @returns {{safe: boolean, threats: string[]}} Security check result
 */
export const securityCheck = (str) => {
    const xss = checkXSS(str);
    const sql = checkSQLInjection(str);
    
    return {
        safe: xss.safe && sql.safe,
        threats: [...xss.threats, ...sql.threats]
    };
};

/* ──────────────────────────────────────────────────────────────────────────
   8. INPUT TYPE VALIDATION
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Validate string is numeric
 * @param {string} str - Input string
 * @returns {boolean} True if numeric
 */
export const isNumeric = (str) => {
    if (!str || typeof str !== 'string') return false;
    return regexCache.numeric.test(str.trim());
};

/**
 * Validate string is alphanumeric
 * @param {string} str - Input string
 * @returns {boolean} True if alphanumeric
 */
export const isAlphanumeric = (str) => {
    if (!str || typeof str !== 'string') return false;
    return regexCache.alphanumeric.test(str.trim());
};

/**
 * Validate string contains Turkish characters
 * @param {string} str - Input string
 * @returns {boolean} True if contains Turkish chars
 */
export const hasTurkishChars = (str) => {
    if (!str || typeof str !== 'string') return false;
    return regexCache.turkishChars.test(str);
};

/**
 * Validate filename is safe
 * @param {string} filename - Filename
 * @returns {boolean} True if safe filename
 */
export const isValidFilename = (filename) => {
    if (!filename || typeof filename !== 'string') return false;
    
    const trimmed = filename.trim();
    
    if (trimmed.length === 0) return false;
    if (trimmed.length > 255) return false;
    if (trimmed === '.' || trimmed === '..') return false;
    
    return regexCache.filename.test(trimmed);
};

/**
 * Validate string length
 * @param {string} str - Input string
 * @param {number} min - Minimum length
 * @param {number} max - Maximum length
 * @returns {{valid: boolean, length: number}} Validation result
 */
export const validateLength = (str, min = 0, max = Infinity) => {
    if (!str || typeof str !== 'string') {
        return { valid: false, length: 0 };
    }
    
    const length = str.length;
    const valid = length >= min && length <= max;
    
    return { valid, length };
};

/* ──────────────────────────────────────────────────────────────────────────
   9. FORM VALIDATION HELPERS
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Validate required field
 * @param {*} value - Field value
 * @returns {boolean} True if not empty
 */
export const isRequired = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
};

/**
 * Validate minimum length
 * @param {string} str - Input string
 * @param {number} min - Minimum length
 * @returns {boolean} True if meets minimum
 */
export const minLength = (str, min) => {
    if (!str || typeof str !== 'string') return false;
    return str.length >= min;
};

/**
 * Validate maximum length
 * @param {string} str - Input string
 * @param {number} max - Maximum length
 * @returns {boolean} True if within maximum
 */
export const maxLength = (str, max) => {
    if (!str || typeof str !== 'string') return true; // Empty is ok
    return str.length <= max;
};

/**
 * Validate pattern match
 * @param {string} str - Input string
 * @param {RegExp|string} pattern - Pattern to match
 * @returns {boolean} True if matches
 */
export const matchesPattern = (str, pattern) => {
    if (!str || typeof str !== 'string') return false;
    
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    return regex.test(str);
};

/**
 * Validate form field with multiple rules
 * @param {*} value - Field value
 * @param {Object} rules - Validation rules
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export const validateField = (value, rules = {}) => {
    const result = {
        valid: true,
        errors: []
    };
    
    // Required check
    if (rules.required && !isRequired(value)) {
        result.valid = false;
        result.errors.push('Bu alan zorunludur');
    }
    
    // String validations
    if (typeof value === 'string') {
        if (rules.minLength && !minLength(value, rules.minLength)) {
            result.valid = false;
            result.errors.push(`Minimum ${rules.minLength} karakter`);
        }
        
        if (rules.maxLength && !maxLength(value, rules.maxLength)) {
            result.valid = false;
            result.errors.push(`Maximum ${rules.maxLength} karakter`);
        }
        
        if (rules.pattern && !matchesPattern(value, rules.pattern)) {
            result.valid = false;
            result.errors.push('Geçersiz format');
        }
        
        if (rules.email && !isValidEmail(value)) {
            result.valid = false;
            result.errors.push('Geçersiz e-posta');
        }
        
        if (rules.url && !isValidUrl(value)) {
            result.valid = false;
            result.errors.push('Geçersiz URL');
        }
        
        if (rules.sanitize) {
            value = sanitize(value);
        }
    }
    
    return result;
};

/* ──────────────────────────────────────────────────────────────────────────
   10. PLAYLIST-SPECIFIC VALIDATION
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Validate channel object
 * @param {Object} channel - Channel object
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export const validateChannel = (channel) => {
    const result = {
        valid: true,
        errors: []
    };
    
    if (!channel || typeof channel !== 'object') {
        result.valid = false;
        result.errors.push('Invalid channel object');
        return result;
    }
    
    // Name validation
    if (!channel.name || typeof channel.name !== 'string') {
        result.valid = false;
        result.errors.push('Channel name required');
    } else if (channel.name.length > 200) {
        result.valid = false;
        result.errors.push('Channel name too long');
    }
    
    // URL validation
    if (!channel.url || typeof channel.url !== 'string') {
        result.valid = false;
        result.errors.push('Channel URL required');
    } else if (!isValidStreamUrl(channel.url)) {
        result.valid = false;
        result.errors.push('Invalid stream URL');
    }
    
    return result;
};

/**
 * Validate category object
 * @param {Object} category - Category object
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export const validateCategory = (category) => {
    const result = {
        valid: true,
        errors: []
    };
    
    if (!category || typeof category !== 'object') {
        result.valid = false;
        result.errors.push('Invalid category object');
        return result;
    }
    
    if (!category.name || typeof category.name !== 'string') {
        result.valid = false;
        result.errors.push('Category name required');
    } else if (category.name.length > 100) {
        result.valid = false;
        result.errors.push('Category name too long');
    }
    
    return result;
};

/* ──────────────────────────────────────────────────────────────────────────
   11. EXPORTS (Frozen Object)
   ────────────────────────────────────────────────────────────────────────── */

export const validationUtils = Object.freeze({
    // URL Validation
    isValidUrl,
    isSecureUrl,
    isAllowedProtocol,
    isValidStreamUrl,
    
    // Playlist Validation
    isM3U,
    validateM3UContent,
    extractPlaylistInfo,
    
    // Sanitization
    sanitize,
    sanitizeAttribute,
    sanitizeJS,
    stripTags,
    
    // Email
    isValidEmail,
    normalizeEmail,
    
    // IP & Hostname
    isValidIPv4,
    isValidIPv6,
    isValidIP,
    isValidHostname,
    isValidPort,
    
    // Security
    checkXSS,
    checkSQLInjection,
    securityCheck,
    
    // Input Types
    isNumeric,
    isAlphanumeric,
    hasTurkishChars,
    isValidFilename,
    validateLength,
    
    // Form Helpers
    isRequired,
    minLength,
    maxLength,
    matchesPattern,
    validateField,
    
    // Playlist Specific
    validateChannel,
    validateCategory
});

/* ──────────────────────────────────────────────────────────────────────────
   END OF VALIDATIONUTILS.JS v2.5.0
   ============================================================================ */
