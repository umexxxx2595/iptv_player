/**
 * ============================================================================
 * FONEX IPTV - TEXT UTILITIES
 * Version: 2.5.0
 * Platform: LG webOS TV + Modern Browsers
 * Author: FONEX Labs
 * 
 * 📋 PURPOSE:
 *   - Smart string manipulation for IPTV content
 *   - Channel name cleaning and normalization
 *   - Text truncation with word boundaries
 *   - Search highlighting
 *   - Turkish locale-aware text processing
 *   - HTML escaping and sanitization
 * 
 * 🔗 USAGE:
 *   import { textUtils } from './utils/textUtils.js';
 * 
 * ⚡ PERFORMANCE:
 *   - Cached regex patterns
 *   - Minimal string allocations
 *   - Optimized for large playlist parsing
 * ============================================================================ */

/* ──────────────────────────────────────────────────────────────────────────
   1. CACHED REGEX PATTERNS (Performance)
   ────────────────────────────────────────────────────────────────────────── */

const regexCache = Object.freeze({
    // Playlist tags: [HD], (SD), |4K|, {LIVE}, etc.
    playlistTags: /\[.*?\]|\(.*?\)|\|.*?\||\{.*?\}/g,
    
    // Special characters for slug generation
    specialChars: /[^\w\s\u00C0-\u00FF\u011E\u011F\u0130\u0131\u015E\u015F\u00C7\u00E7-]/g,
    
    // Multiple spaces
    multipleSpaces: /\s+/g,
    
    // Leading/trailing spaces
    trimSpaces: /^\s+|\s+$/g,
    
    // URL pattern
    url: /https?:\/\/[^\s]+/g,
    
    // Email pattern
    email: /[\w.-]+@[\w.-]+\.\w+/g,
    
    // HTML tags
    htmlTags: /<[^>]*>/g,
    
    // Numbers only
    numbers: /\d+/g,
    
    // Non-numbers
    nonNumbers: /[^\d]/g,
    
    // Turkish characters
    turkishChars: /[ğĞüÜşŞıİöÖçÇ]/g
});

/* ──────────────────────────────────────────────────────────────────────────
   2. TRUNCATION & ELLIPSIS
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Truncate string with smart word boundary
 * @param {string} str - Input string
 * @param {number} length - Max length
 * @param {string} [ellipsis='...'] - Ellipsis string
 * @param {boolean} [wholeWord=true] - Respect word boundaries
 * @returns {string} Truncated string
 * 
 * @example
 * truncate('FONEX IPTV Premium', 10); // "FONEX..."
 */
export const truncate = (str, length = 30, ellipsis = '...', wholeWord = true) => {
    if (!str || typeof str !== 'string') {
        console.warn('[textUtils] truncate: Invalid input');
        return '';
    }
    
    if (str.length <= length) {
        return str;
    }
    
    if (!wholeWord) {
        return str.substring(0, length) + ellipsis;
    }
    
    // Find last space before length limit
    const truncated = str.substring(0, length);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > 0) {
        return truncated.substring(0, lastSpace) + ellipsis;
    }
    
    return truncated + ellipsis;
};

/**
 * Truncate from middle (for long filenames/paths)
 * @param {string} str - Input string
 * @param {number} maxLength - Max total length
 * @param {number} [keepStart=15] - Characters to keep at start
 * @param {number} [keepEnd=15] - Characters to keep at end
 * @returns {string} Truncated string with ellipsis in middle
 * 
 * @example
 * truncateMiddle('very_long_channel_name.m3u8', 20); // "very_long_...m3u8"
 */
export const truncateMiddle = (str, maxLength = 30, keepStart = 15, keepEnd = 15) => {
    if (!str || typeof str !== 'string') return '';
    if (str.length <= maxLength) return str;
    
    const start = str.substring(0, keepStart);
    const end = str.substring(str.length - keepEnd);
    
    return `${start}...${end}`;
};

/**
 * Truncate lines to specific count
 * @param {string} str - Input string
 * @param {number} maxLines - Maximum lines
 * @returns {string} Truncated to max lines
 */
export const truncateLines = (str, maxLines = 3) => {
    if (!str || typeof str !== 'string') return '';
    
    const lines = str.split('\n');
    if (lines.length <= maxLines) return str;
    
    return lines.slice(0, maxLines).join('\n') + '\n...';
};

/* ──────────────────────────────────────────────────────────────────────────
   3. CHANNEL NAME CLEANING
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Clean channel name by removing playlist tags
 * @param {string} name - Channel name
 * @param {Object} [options] - Cleaning options
 * @returns {string} Cleaned channel name
 * 
 * @example
 * cleanChannelName('TRT 1 [HD] |4K|'); // "TRT 1"
 */
export const cleanChannelName = (name, options = {}) => {
    if (!name || typeof name !== 'string') {
        console.warn('[textUtils] cleanChannelName: Invalid input');
        return options.fallback || 'Bilinmeyen Kanal';
    }
    
    let cleaned = name;
    
    // Remove playlist tags
    if (options.removeTags !== false) {
        cleaned = cleaned.replace(regexCache.playlistTags, '');
    }
    
    // Remove common suffixes
    if (options.removeSuffixes) {
        cleaned = cleaned.replace(/(HD|SD|UHD|4K|8K|FHD|FULL\s*HD)\s*/gi, '');
    }
    
    // Remove country codes
    if (options.removeCountryCodes) {
        cleaned = cleaned.replace(/\b(TR|UK|US|DE|FR|IT|ES)\b\s*/gi, '');
    }
    
    // Remove extra spaces
    cleaned = cleaned.replace(regexCache.multipleSpaces, ' ');
    
    // Trim and return
    return cleaned.trim() || options.fallback || 'Bilinmeyen Kanal';
};

/**
 * Normalize channel name for comparison/search
 * @param {string} name - Channel name
 * @returns {string} Normalized name (lowercase, no special chars)
 */
export const normalizeChannelName = (name) => {
    if (!name || typeof name !== 'string') return '';
    
    return cleanChannelName(name)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(regexCache.specialChars, '')
        .replace(regexCache.multipleSpaces, ' ')
        .trim();
};

/**
 * Extract quality tag from channel name
 * @param {string} name - Channel name
 * @returns {string} Quality tag (HD, SD, 4K, etc.) or ''
 */
export const extractQuality = (name) => {
    if (!name || typeof name !== 'string') return '';
    
    const qualityMatch = name.match(/\b(4K|8K|UHD|FHD|HD|SD)\b/i);
    return qualityMatch ? qualityMatch[0].toUpperCase() : '';
};

/**
 * Extract country code from channel name
 * @param {string} name - Channel name
 * @returns {string} Country code or ''
 */
export const extractCountry = (name) => {
    if (!name || typeof name !== 'string') return '';
    
    const countryMatch = name.match(/\b(TR|UK|US|DE|FR|IT|ES|RU|AR|IN|CN)\b/i);
    return countryMatch ? countryMatch[0].toUpperCase() : '';
};

/* ──────────────────────────────────────────────────────────────────────────
   4. CASE CONVERSION
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Capitalize first letter
 * @param {string} str - Input string
 * @returns {string} Capitalized string
 */
export const capitalize = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Capitalize first letter of each word
 * @param {string} str - Input string
 * @returns {string} Title case string
 */
export const titleCase = (str) => {
    if (!str || typeof str !== 'string') return '';
    
    return str
        .toLowerCase()
        .split(' ')
        .map(word => capitalize(word))
        .join(' ');
};

/**
 * Convert to sentence case
 * @param {string} str - Input string
 * @returns {string} Sentence case string
 */
export const sentenceCase = (str) => {
    if (!str || typeof str !== 'string') return '';
    
    return str
        .toLowerCase()
        .replace(/(^\s*\w|[\.\!\?]\s*\w)/g, c => c.toUpperCase());
};

/**
 * Convert to snake_case
 * @param {string} str - Input string
 * @returns {string} Snake case string
 */
export const toSnakeCase = (str) => {
    if (!str || typeof str !== 'string') return '';
    
    return str
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
};

/**
 * Convert to kebab-case
 * @param {string} str - Input string
 * @returns {string} Kebab case string
 */
export const toKebabCase = (str) => {
    if (!str || typeof str !== 'string') return '';
    
    return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
};

/**
 * Convert to camelCase
 * @param {string} str - Input string
 * @returns {string} Camel case string
 */
export const toCamelCase = (str) => {
    if (!str || typeof str !== 'string') return '';
    
    return str
        .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
        .replace(/^[A-Z]/, c => c.toLowerCase());
};

/* ──────────────────────────────────────────────────────────────────────────
   5. SEARCH & HIGHLIGHT
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Highlight search term in text
 * @param {string} text - Original text
 * @param {string} term - Search term to highlight
 * @param {string} [tag='mark'] - HTML tag for highlight
 * @returns {string} HTML with highlighted term
 */
export const highlight = (text, term, tag = 'mark') => {
    if (!text || typeof text !== 'string') return '';
    if (!term || typeof term !== 'string') return text;
    
    const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
    return text.replace(regex, `<${tag} class="highlight">$1</${tag}>`);
};

/**
 * Escape regex special characters
 * @param {string} str - Input string
 * @returns {string} Escaped string
 */
export const escapeRegex = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Fuzzy match score for search
 * @param {string} text - Text to search in
 * @param {string} term - Search term
 * @returns {number} Match score (0-100)
 */
export const fuzzyMatch = (text, term) => {
    if (!text || !term) return 0;
    
    const normalizedText = normalizeChannelName(text);
    const normalizedTerm = normalizeChannelName(term);
    
    if (normalizedText === normalizedTerm) return 100;
    if (normalizedText.includes(normalizedTerm)) return 80;
    if (normalizedText.startsWith(normalizedTerm)) return 90;
    
    // Calculate similarity
    const words = normalizedText.split(' ');
    const termWords = normalizedTerm.split(' ');
    
    const matchedWords = termWords.filter(tw => 
        words.some(w => w.includes(tw))
    ).length;
    
    return Math.round((matchedWords / termWords.length) * 60);
};

/* ──────────────────────────────────────────────────────────────────────────
   6. HTML ESCAPING & SANITIZATION
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Escape HTML special characters
 * @param {string} str - Input string
 * @param {boolean} [escapeQuotes=true] - Also escape quotes
 * @returns {string} Escaped string
 */
export const escapeHtml = (str, escapeQuotes = true) => {
    if (!str || typeof str !== 'string') return '';
    
    let escaped = str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    if (escapeQuotes) {
        escaped = escaped
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    return escaped;
};

/**
 * Strip HTML tags from string
 * @param {string} str - Input string
 * @returns {string} Plain text
 */
export const stripHtml = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.replace(regexCache.htmlTags, '');
};

/**
 * Sanitize string for safe HTML display
 * @param {string} str - Input string
 * @returns {string} Sanitized string
 */
export const sanitize = (str) => {
    return escapeHtml(stripHtml(str));
};

/* ──────────────────────────────────────────────────────────────────────────
   7. SLUG & URL UTILITIES
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Generate URL-friendly slug
 * @param {string} str - Input string
 * @returns {string} URL slug
 * 
 * @example
 * toSlug('FONEX IPTV - Canlı TV'); // "fonex-iptv-canli-tv"
 */
export const toSlug = (str) => {
    if (!str || typeof str !== 'string') return '';
    
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(regexCache.specialChars, '')
        .replace(regexCache.multipleSpaces, '-')
        .replace(/^-+|-+$/g, ''); // Trim dashes
};

/**
 * Extract domain from URL
 * @param {string} url - URL string
 * @returns {string} Domain name
 */
export const extractDomain = (url) => {
    if (!url || typeof url !== 'string') return '';
    
    try {
        const match = url.match(/^https?:\/\/([^\/\?#]+)/i);
        return match ? match[1] : '';
    } catch {
        return '';
    }
};

/**
 * Check if string is valid URL
 * @param {string} str - Input string
 * @returns {boolean} True if valid URL
 */
export const isValidUrl = (str) => {
    if (!str || typeof str !== 'string') return false;
    
    try {
        new URL(str);
        return true;
    } catch {
        return false;
    }
};

/* ──────────────────────────────────────────────────────────────────────────
   8. TURKISH TEXT UTILITIES
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Turkish-aware lowercase conversion
 * @param {string} str - Input string
 * @returns {string} Lowercase string
 */
export const toLowerCaseTR = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.toLocaleLowerCase('tr-TR');
};

/**
 * Turkish-aware uppercase conversion
 * @param {string} str - Input string
 * @returns {string} Uppercase string
 */
export const toUpperCaseTR = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.toLocaleUpperCase('tr-TR');
};

/**
 * Remove Turkish characters (for URL/slug)
 * @param {string} str - Input string
 * @returns {string} String without Turkish chars
 */
export const removeTurkishChars = (str) => {
    if (!str || typeof str !== 'string') return '';
    
    const turkishMap = {
        'ğ': 'g', 'Ğ': 'G',
        'ü': 'u', 'Ü': 'U',
        'ş': 's', 'Ş': 'S',
        'ı': 'i', 'İ': 'I',
        'ö': 'o', 'Ö': 'O',
        'ç': 'c', 'Ç': 'C'
    };
    
    return str.replace(regexCache.turkishChars, char => turkishMap[char] || char);
};

/**
 * Turkish plural form
 * @param {number} count - Count
 * @param {string} singular - Singular form
 * @param {string} [plural] - Plural form (auto-generated if not provided)
 * @returns {string} Correct plural form
 */
export const pluralizeTR = (count, singular, plural) => {
    if (!singular || typeof singular !== 'string') return '';
    
    if (plural) {
        return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
    }
    
    // Simple vowel harmony for Turkish plural
    const lastVowel = singular.match(/[aeıioöuü]/gi)?.pop()?.toLowerCase();
    const isFrontVowel = ['e', 'i', 'ö', 'ü'].includes(lastVowel);
    const suffix = isFrontVowel ? 'ler' : 'lar';
    
    return count === 1 ? `1 ${singular}` : `${count} ${singular}${suffix}`;
};

/* ──────────────────────────────────────────────────────────────────────────
   9. STRING ANALYSIS
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Count words in string
 * @param {string} str - Input string
 * @returns {number} Word count
 */
export const wordCount = (str) => {
    if (!str || typeof str !== 'string') return 0;
    return str.trim().split(/\s+/).filter(w => w.length > 0).length;
};

/**
 * Count characters (with/without spaces)
 * @param {string} str - Input string
 * @param {boolean} [includeSpaces=false] - Include spaces in count
 * @returns {number} Character count
 */
export const charCount = (str, includeSpaces = false) => {
    if (!str || typeof str !== 'string') return 0;
    
    if (includeSpaces) {
        return str.length;
    }
    
    return str.replace(/\s/g, '').length;
};

/**
 * Check if string contains only numbers
 * @param {string} str - Input string
 * @returns {boolean} True if numeric
 */
export const isNumeric = (str) => {
    if (!str || typeof str !== 'string') return false;
    return /^[\d.,]+$/.test(str.trim());
};

/**
 * Check if string is empty or whitespace only
 * @param {string} str - Input string
 * @returns {boolean} True if empty
 */
export const isEmpty = (str) => {
    return !str || (typeof str === 'string' && str.trim().length === 0);
};

/**
 * Get reading time estimate (Turkish: ~4 chars per ms)
 * @param {string} str - Input text
 * @returns {string} Estimated reading time
 */
export const getReadingTime = (str) => {
    if (!str || typeof str !== 'string') return '0 dk';
    
    const chars = charCount(str, true);
    const minutes = Math.ceil(chars / 1000); // ~1000 chars per minute
    
    if (minutes < 1) return '< 1 dk';
    return `${minutes} dk`;
};

/* ──────────────────────────────────────────────────────────────────────────
   10. ENCODING & DECODING
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Base64 encode (UTF-8 safe)
 * @param {string} str - Input string
 * @returns {string} Base64 encoded string
 */
export const base64Encode = (str) => {
    if (!str || typeof str !== 'string') return '';
    
    try {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
            (_, p1) => String.fromCharCode(parseInt(p1, 16))
        ));
    } catch (error) {
        console.error('[textUtils] base64Encode failed:', error);
        return '';
    }
};

/**
 * Base64 decode (UTF-8 safe)
 * @param {string} str - Base64 encoded string
 * @returns {string} Decoded string
 */
export const base64Decode = (str) => {
    if (!str || typeof str !== 'string') return '';
    
    try {
        return decodeURIComponent(atob(str).split('').map(c =>
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
    } catch (error) {
        console.error('[textUtils] base64Decode failed:', error);
        return '';
    }
};

/**
 * URL encode
 * @param {string} str - Input string
 * @returns {string} URL encoded string
 */
export const urlEncode = (str) => {
    if (!str || typeof str !== 'string') return '';
    return encodeURIComponent(str);
};

/**
 * URL decode
 * @param {string} str - URL encoded string
 * @returns {string} Decoded string
 */
export const urlDecode = (str) => {
    if (!str || typeof str !== 'string') return '';
    
    try {
        return decodeURIComponent(str);
    } catch {
        return str;
    }
};

/* ──────────────────────────────────────────────────────────────────────────
   11. COMPARISON & SIMILARITY
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Levenshtein distance for string similarity
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Distance (0 = identical)
 */
export const levenshtein = (a, b) => {
    if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);
    
    const matrix = [];
    
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[b.length][a.length];
};

/**
 * String similarity percentage
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Similarity (0-100)
 */
export const similarity = (a, b) => {
    if (!a || !b) return 0;
    
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    
    if (longer.length === 0) return 100;
    
    const distance = levenshtein(longer, shorter);
    return Math.round(((longer.length - distance) / longer.length) * 100);
};

/* ──────────────────────────────────────────────────────────────────────────
   12. EXPORTS (Frozen Object)
   ────────────────────────────────────────────────────────────────────────── */

export const textUtils = Object.freeze({
    // Truncation
    truncate,
    truncateMiddle,
    truncateLines,
    
    // Channel Name Cleaning
    cleanChannelName,
    normalizeChannelName,
    extractQuality,
    extractCountry,
    
    // Case Conversion
    capitalize,
    titleCase,
    sentenceCase,
    toSnakeCase,
    toKebabCase,
    toCamelCase,
    
    // Search & Highlight
    highlight,
    escapeRegex,
    fuzzyMatch,
    
    // HTML
    escapeHtml,
    stripHtml,
    sanitize,
    
    // Slug & URL
    toSlug,
    extractDomain,
    isValidUrl,
    
    // Turkish
    toLowerCaseTR,
    toUpperCaseTR,
    removeTurkishChars,
    pluralizeTR,
    
    // Analysis
    wordCount,
    charCount,
    isNumeric,
    isEmpty,
    getReadingTime,
    
    // Encoding
    base64Encode,
    base64Decode,
    urlEncode,
    urlDecode,
    
    // Comparison
    levenshtein,
    similarity
});

/* ──────────────────────────────────────────────────────────────────────────
   END OF TEXTUTILS.JS v2.5.0
   ============================================================================ */
