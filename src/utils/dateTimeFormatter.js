/**
 * ============================================================================
 * FONEX IPTV - DATE/TIME FORMATTER UTILITIES
 * Version: 2.5.0
 * Platform: LG webOS TV + Modern Browsers
 * Author: FONEX Labs
 * 
 * 📋 PURPOSE:
 *   - Premium time formatting for player displays
 *   - EPG (TV Guide) date/time handling
 *   - Broadcast duration calculations
 *   - Relative time formatting (time ago)
 *   - Turkish locale support
 * 
 * 🔗 USAGE:
 *   import { dateTimeFormatter } from './utils/dateTimeFormatter.js';
 * 
 * ⚡ PERFORMANCE:
 *   - Cached Intl.DateTimeFormat instances
 *   - Minimal allocations for hot paths
 *   - Optimized for 60fps player UI
 * ============================================================================ */

/* ──────────────────────────────────────────────────────────────────────────
   1. CACHED FORMATTERS (Performance Optimization)
   ────────────────────────────────────────────────────────────────────────── */

/** @type {Map<string, Intl.DateTimeFormat>} */
const formatterCache = new Map();

/**
 * Get or create cached DateTimeFormat instance
 * @param {string} locale - Locale string
 * @param {Intl.DateTimeFormatOptions} options - Format options
 * @returns {Intl.DateTimeFormat} Cached formatter
 */
const getCachedFormatter = (locale, options) => {
    const cacheKey = `${locale}:${JSON.stringify(options)}`;
    
    if (!formatterCache.has(cacheKey)) {
        formatterCache.set(cacheKey, new Intl.DateTimeFormat(locale, options));
    }
    
    return formatterCache.get(cacheKey);
};

/* ──────────────────────────────────────────────────────────────────────────
   2. TIME FORMATTING (Player Display)
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Format seconds to HH:MM:SS or MM:SS
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted time string
 * 
 * @example
 * formatSeconds(3661); // "01:01:01"
 * formatSeconds(125);  // "02:05"
 */
export const formatSeconds = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
        console.warn('[dateTimeFormatter] Invalid seconds value:', seconds);
        return '00:00';
    }
    
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/**
 * Format milliseconds to MM:SS.ms
 * @param {number} ms - Duration in milliseconds
 * @param {boolean} [showMs=false] - Show milliseconds
 * @returns {string} Formatted time string
 * 
 * @example
 * formatMilliseconds(125430); // "02:05"
 * formatMilliseconds(125430, true); // "02:05.430"
 */
export const formatMilliseconds = (ms, showMs = false) => {
    if (typeof ms !== 'number' || isNaN(ms) || ms < 0) {
        console.warn('[dateTimeFormatter] Invalid milliseconds value:', ms);
        return '00:00';
    }
    
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    
    let result = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    
    if (showMs) {
        const millis = ms % 1000;
        result += `.${millis.toString().padStart(3, '0')}`;
    }
    
    return result;
};

/**
 * Format time for video player (current/total)
 * @param {number} current - Current time in seconds
 * @param {number} total - Total duration in seconds
 * @returns {string} Formatted "current / total" string
 */
export const formatPlayerTime = (current, total) => {
    const currentStr = formatSeconds(current);
    const totalStr = formatSeconds(total);
    return `${currentStr} / ${totalStr}`;
};

/**
 * Format remaining time with sign
 * @param {number} current - Current time in seconds
 * @param {number} total - Total duration in seconds
 * @returns {string} Remaining time with negative sign
 * 
 * @example
 * formatRemainingTime(30, 120); // "-01:30"
 */
export const formatRemainingTime = (current, total) => {
    const remaining = total - current;
    if (remaining <= 0) return '00:00';
    return `-${formatSeconds(remaining)}`;
};

/* ──────────────────────────────────────────────────────────────────────────
   3. DATE FORMATTING (EPG/TV Guide)
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Format date to Turkish short format
 * @param {Date|string|number} date - Date input
 * @returns {string} Formatted date (DD.MM.YYYY)
 */
export const formatDateShort = (date) => {
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
            console.warn('[dateTimeFormatter] Invalid date:', date);
            return '--.--.----';
        }
        
        const formatter = getCachedFormatter('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        return formatter.format(d);
    } catch (error) {
        console.error('[dateTimeFormatter] formatDateShort error:', error);
        return '--.--.----';
    }
};

/**
 * Format date to Turkish long format
 * @param {Date|string|number} date - Date input
 * @returns {string} Formatted date (DD MMMM YYYY)
 */
export const formatDateLong = (date) => {
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
            console.warn('[dateTimeFormatter] Invalid date:', date);
            return '-- ------ ----';
        }
        
        const formatter = getCachedFormatter('tr-TR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        
        return formatter.format(d);
    } catch (error) {
        console.error('[dateTimeFormatter] formatDateLong error:', error);
        return '-- ------ ----';
    }
};

/**
 * Format time (HH:MM)
 * @param {Date|string|number} date - Date input
 * @returns {string} Formatted time (HH:MM)
 */
export const formatTime = (date) => {
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
            console.warn('[dateTimeFormatter] Invalid date:', date);
            return '--:--';
        }
        
        const formatter = getCachedFormatter('tr-TR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return formatter.format(d);
    } catch (error) {
        console.error('[dateTimeFormatter] formatTime error:', error);
        return '--:--';
    }
};

/**
 * Format date and time combined
 * @param {Date|string|number} date - Date input
 * @returns {string} Formatted date and time
 */
export const formatDateTime = (date) => {
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
            console.warn('[dateTimeFormatter] Invalid date:', date);
            return '--.--.---- --:--';
        }
        
        return `${formatDateShort(d)} ${formatTime(d)}`;
    } catch (error) {
        console.error('[dateTimeFormatter] formatDateTime error:', error);
        return '--.--.---- --:--';
    }
};

/**
 * Get current time (HH:MM)
 * @returns {string} Current time
 */
export const getCurrentTime = () => {
    return formatTime(new Date());
};

/**
 * Get current date (DD.MM.YYYY)
 * @returns {string} Current date
 */
export const getCurrentDate = () => {
    return formatDateShort(new Date());
};

/* ──────────────────────────────────────────────────────────────────────────
   4. RELATIVE TIME (Time Ago)
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Format relative time (time ago)
 * @param {Date|string|number} date - Past date
 * @returns {string} Relative time string
 * 
 * @example
 * formatRelativeTime(Date.now() - 60000); // "1 dakika önce"
 * formatRelativeTime(Date.now() - 3600000); // "1 saat önce"
 */
export const formatRelativeTime = (date) => {
    try {
        const d = new Date(date);
        const now = new Date();
        
        if (isNaN(d.getTime())) {
            console.warn('[dateTimeFormatter] Invalid date:', date);
            return 'Bilinmiyor';
        }
        
        const diffMs = now - d;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffSeconds < 60) {
            return 'Şimdi';
        } else if (diffMinutes < 60) {
            return `${diffMinutes} dakika önce`;
        } else if (diffHours < 24) {
            return `${diffHours} saat önce`;
        } else if (diffDays < 7) {
            return `${diffDays} gün önce`;
        } else if (diffDays < 30) {
            return `${Math.floor(diffDays / 7)} hafta önce`;
        } else if (diffDays < 365) {
            return `${Math.floor(diffDays / 30)} ay önce`;
        } else {
            return `${Math.floor(diffDays / 365)} yıl önce`;
        }
    } catch (error) {
        console.error('[dateTimeFormatter] formatRelativeTime error:', error);
        return 'Bilinmiyor';
    }
};

/**
 * Format countdown (time remaining)
 * @param {Date|string|number} targetDate - Target date
 * @returns {string} Countdown string
 * 
 * @example
 * formatCountdown(Date.now() + 3600000); // "59 dakika 00 saniye kaldı"
 */
export const formatCountdown = (targetDate) => {
    try {
        const target = new Date(targetDate);
        const now = new Date();
        
        if (isNaN(target.getTime())) {
            console.warn('[dateTimeFormatter] Invalid target date:', targetDate);
            return 'Süre doldu';
        }
        
        const diffMs = target - now;
        
        if (diffMs <= 0) {
            return 'Süre doldu';
        }
        
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
            return `${diffDays} gün ${diffHours % 24} saat kaldı`;
        } else if (diffHours > 0) {
            return `${diffHours} saat ${diffMinutes % 60} dakika kaldı`;
        } else if (diffMinutes > 0) {
            return `${diffMinutes} dakika ${diffSeconds % 60} saniye kaldı`;
        } else {
            return `${diffSeconds} saniye kaldı`;
        }
    } catch (error) {
        console.error('[dateTimeFormatter] formatCountdown error:', error);
        return 'Süre doldu';
    }
};

/* ──────────────────────────────────────────────────────────────────────────
   5. EPG (TV GUIDE) SPECIFIC FORMATTERS
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Format EPG program duration
 * @param {number} startTime - Start timestamp (seconds)
 * @param {number} endTime - End timestamp (seconds)
 * @returns {string} Formatted duration
 */
export const formatEpgDuration = (startTime, endTime) => {
    const duration = endTime - startTime;
    return formatSeconds(duration);
};

/**
 * Format EPG program time slot
 * @param {Date|string|number} start - Start time
 * @param {Date|string|number} end - End time
 * @returns {string} Formatted time slot (HH:MM - HH:MM)
 */
export const formatEpgTimeSlot = (start, end) => {
    const startStr = formatTime(start);
    const endStr = formatTime(end);
    return `${startStr} - ${endStr}`;
};

/**
 * Get program status (live, upcoming, past)
 * @param {Date|string|number} start - Start time
 * @param {Date|string|number} end - End time
 * @returns {{status: string, label: string, color: string}} Program status
 */
export const getProgramStatus = (start, end) => {
    try {
        const now = new Date();
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return { status: 'unknown', label: 'Bilinmiyor', color: '#6E6E82' };
        }
        
        if (now >= startDate && now <= endDate) {
            return { status: 'live', label: 'CANLI', color: '#FF3B30' };
        } else if (now < startDate) {
            return { status: 'upcoming', label: 'YAKLAŞIYOR', color: '#00F2FF' };
        } else {
            return { status: 'past', label: 'GEÇMİŞ', color: '#6E6E82' };
        }
    } catch (error) {
        console.error('[dateTimeFormatter] getProgramStatus error:', error);
        return { status: 'unknown', label: 'Hata', color: '#6E6E82' };
    }
};

/**
 * Calculate progress percentage for live program
 * @param {Date|string|number} start - Start time
 * @param {Date|string|number} end - End time
 * @returns {number} Progress percentage (0-100)
 */
export const getProgramProgress = (start, end) => {
    try {
        const now = new Date();
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return 0;
        }
        
        const total = endDate - startDate;
        const elapsed = now - startDate;
        
        if (total <= 0) return 100;
        if (elapsed <= 0) return 0;
        if (elapsed >= total) return 100;
        
        return Math.round((elapsed / total) * 100);
    } catch (error) {
        console.error('[dateTimeFormatter] getProgramProgress error:', error);
        return 0;
    }
};

/* ──────────────────────────────────────────────────────────────────────────
   6. BROADCAST HELPERS
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Check if time is within broadcast window
 * @param {Date|string|number} start - Start time
 * @param {Date|string|number} end - End time
 * @returns {boolean} True if currently broadcasting
 */
export const isCurrentlyBroadcasting = (start, end) => {
    try {
        const now = new Date();
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return false;
        }
        
        return now >= startDate && now <= endDate;
    } catch (error) {
        console.error('[dateTimeFormatter] isCurrentlyBroadcasting error:', error);
        return false;
    }
};

/**
 * Get time until broadcast starts
 * @param {Date|string|number} start - Start time
 * @returns {string} Time until start
 */
export const timeUntilBroadcast = (start) => {
    try {
        const startDate = new Date(start);
        const now = new Date();
        
        if (isNaN(startDate.getTime())) {
            return 'Bilinmiyor';
        }
        
        const diff = startDate - now;
        
        if (diff <= 0) {
            return 'Başladı';
        }
        
        return formatCountdown(startDate);
    } catch (error) {
        console.error('[dateTimeFormatter] timeUntilBroadcast error:', error);
        return 'Bilinmiyor';
    }
};

/* ──────────────────────────────────────────────────────────────────────────
   7. UTILITY FUNCTIONS
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Parse time string to seconds
 * @param {string} timeStr - Time string (HH:MM:SS or MM:SS)
 * @returns {number} Seconds
 * 
 * @example
 * parseTimeString("01:30:45"); // 5445
 * parseTimeString("05:30"); // 330
 */
export const parseTimeString = (timeStr) => {
    if (typeof timeStr !== 'string' || !timeStr) {
        console.warn('[dateTimeFormatter] Invalid time string:', timeStr);
        return 0;
    }
    
    const parts = timeStr.split(':').map(p => parseInt(p, 10) || 0);
    
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    
    return 0;
};

/**
 * Add seconds to date
 * @param {Date} date - Base date
 * @param {number} seconds - Seconds to add
 * @returns {Date} New date
 */
export const addSeconds = (date, seconds) => {
    if (!(date instanceof Date) || typeof seconds !== 'number') {
        console.warn('[dateTimeFormatter] Invalid parameters for addSeconds');
        return new Date();
    }
    
    return new Date(date.getTime() + seconds * 1000);
};

/**
 * Add minutes to date
 * @param {Date} date - Base date
 * @param {number} minutes - Minutes to add
 * @returns {Date} New date
 */
export const addMinutes = (date, minutes) => {
    return addSeconds(date, minutes * 60);
};

/**
 * Add hours to date
 * @param {Date} date - Base date
 * @param {number} hours - Hours to add
 * @returns {Date} New date
 */
export const addHours = (date, hours) => {
    return addSeconds(date, hours * 3600);
};

/* ──────────────────────────────────────────────────────────────────────────
   8. EXPORTS (Frozen Object)
   ────────────────────────────────────────────────────────────────────────── */

export const dateTimeFormatter = Object.freeze({
    // Time Formatting
    formatSeconds,
    formatMilliseconds,
    formatPlayerTime,
    formatRemainingTime,
    
    // Date Formatting
    formatDateShort,
    formatDateLong,
    formatTime,
    formatDateTime,
    getCurrentTime,
    getCurrentDate,
    
    // Relative Time
    formatRelativeTime,
    formatCountdown,
    
    // EPG Specific
    formatEpgDuration,
    formatEpgTimeSlot,
    getProgramStatus,
    getProgramProgress,
    
    // Broadcast Helpers
    isCurrentlyBroadcasting,
    timeUntilBroadcast,
    
    // Utilities
    parseTimeString,
    addSeconds,
    addMinutes,
    addHours
});

/* ──────────────────────────────────────────────────────────────────────────
   END OF DATETIMEFORMATTER.JS v2.5.0
   ============================================================================ */
