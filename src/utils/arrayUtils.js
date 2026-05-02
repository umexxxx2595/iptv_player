/**
 * ============================================================================
 * FONEX IPTV - ARRAY UTILITIES
 * Version: 2.5.0
 * Platform: LG webOS TV + Modern Browsers
 * Author: FONEX Labs
 * 
 * 📋 PURPOSE:
 *   - High-performance array manipulation helpers
 *   - Playlist processing utilities
 *   - Channel list management
 *   - Pure functions (no mutation)
 * 
 * 🔗 USAGE:
 *   import { arrayUtils } from './utils/arrayUtils.js';
 * 
 * ⚡ PERFORMANCE:
 *   - O(n) time complexity for most operations
 *   - Minimal memory allocations
 *   - Optimized for large datasets (10000+ items)
 * ============================================================================ */

/* ──────────────────────────────────────────────────────────────────────────
   1. UNIQUE & DEDUPLICATION
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Return a new array containing only the first occurrence of each distinct
 * value of `key`. Uses Map for O(n) time complexity.
 * 
 * @template T
 * @param {T[]} arr - Input array (will NOT be mutated)
 * @param {keyof T} key - Property name that should be unique
 * @returns {T[]} New array with unique items
 * 
 * @example
 * const channels = [{id: 1, name: 'A'}, {id: 1, name: 'A'}, {id: 2, name: 'B'}];
 * uniqueBy(channels, 'id'); // [{id: 1, name: 'A'}, {id: 2, name: 'B'}]
 */
export const uniqueBy = (arr, key) => {
    // Defensive checks
    if (!Array.isArray(arr)) {
        console.warn('[arrayUtils] uniqueBy: Input is not an array');
        return [];
    }
    
    if (typeof key !== 'string' && typeof key !== 'symbol') {
        console.warn('[arrayUtils] uniqueBy: Invalid key type');
        return [...arr];
    }
    
    // Map keeps the first value for a given key
    const map = new Map();
    
    for (const item of arr) {
        if (item == null) continue; // Skip null/undefined
        
        const keyValue = item[key];
        if (!map.has(keyValue)) {
            map.set(keyValue, item);
        }
    }
    
    return Array.from(map.values());
};

/**
 * Remove duplicates from array using Set (for primitive values)
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @returns {T[]} New array with duplicates removed
 * 
 * @example
 * unique([1, 2, 2, 3, 3, 3]); // [1, 2, 3]
 */
export const unique = (arr) => {
    if (!Array.isArray(arr)) {
        console.warn('[arrayUtils] unique: Input is not an array');
        return [];
    }
    
    return [...new Set(arr)];
};

/**
 * Remove duplicates based on custom comparator function
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @param {Function} comparator - Function to compare two items
 * @returns {T[]} New array with duplicates removed
 */
export const uniqueByComparator = (arr, comparator) => {
    if (!Array.isArray(arr)) return [];
    if (typeof comparator !== 'function') return [...arr];
    
    const result = [];
    
    for (const item of arr) {
        const isDuplicate = result.some(existing => comparator(item, existing));
        if (!isDuplicate) {
            result.push(item);
        }
    }
    
    return result;
};

/* ──────────────────────────────────────────────────────────────────────────
   2. SORTING
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Returns a shallow-copied array sorted by `key`. Original array is untouched.
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @param {keyof T} key - Property to sort by
 * @param {boolean} [desc=false] - true = descending, false = ascending
 * @returns {T[]} New, sorted array
 * 
 * @example
 * sortBy(channels, 'name'); // Ascending by name
 * sortBy(channels, 'viewers', true); // Descending by viewers
 */
export const sortBy = (arr, key, desc = false) => {
    if (!Array.isArray(arr)) {
        console.warn('[arrayUtils] sortBy: Input is not an array');
        return [];
    }
    
    if (typeof key !== 'string' && typeof key !== 'symbol') {
        console.warn('[arrayUtils] sortBy: Invalid key type');
        return [...arr];
    }
    
    return arr.slice().sort((a, b) => {
        const aVal = a?.[key];
        const bVal = b?.[key];
        
        // Handle null/undefined
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        
        // Numbers
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return desc ? bVal - aVal : aVal - bVal;
        }
        
        // Strings (locale-aware)
        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return desc 
                ? bVal.localeCompare(aVal, 'tr') 
                : aVal.localeCompare(bVal, 'tr');
        }
        
        // Fallback
        if (aVal < bVal) return desc ? 1 : -1;
        if (aVal > bVal) return desc ? -1 : 1;
        return 0;
    });
};

/**
 * Sort by multiple keys (multi-level sorting)
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @param {Array<{key: keyof T, desc?: boolean}>} keys - Sort keys with order
 * @returns {T[]} New, sorted array
 * 
 * @example
 * sortByKeys(channels, [
 *   {key: 'category', desc: false},
 *   {key: 'name', desc: false}
 * ]);
 */
export const sortByKeys = (arr, keys) => {
    if (!Array.isArray(arr)) return [];
    if (!Array.isArray(keys) || keys.length === 0) return [...arr];
    
    return arr.slice().sort((a, b) => {
        for (const {key, desc = false} of keys) {
            const aVal = a?.[key];
            const bVal = b?.[key];
            
            if (aVal == null && bVal == null) continue;
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            
            let comparison = 0;
            
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                comparison = desc ? bVal - aVal : aVal - bVal;
            } else if (typeof aVal === 'string' && typeof bVal === 'string') {
                comparison = desc 
                    ? bVal.localeCompare(aVal, 'tr') 
                    : aVal.localeCompare(bVal, 'tr');
            } else {
                if (aVal < bVal) comparison = desc ? 1 : -1;
                if (aVal > bVal) comparison = desc ? -1 : 1;
            }
            
            if (comparison !== 0) return comparison;
        }
        return 0;
    });
};

/* ──────────────────────────────────────────────────────────────────────────
   3. CHUNKING & BATCHING
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Splits an array into equally sized chunks. Last chunk may be smaller.
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @param {number} size - Desired chunk size (must be > 0)
 * @returns {T[][]} Array of chunks
 * 
 * @example
 * chunk([1,2,3,4,5], 2); // [[1,2], [3,4], [5]]
 */
export const chunk = (arr, size) => {
    if (!Array.isArray(arr)) {
        console.warn('[arrayUtils] chunk: Input is not an array');
        return [];
    }
    
    if (typeof size !== 'number' || size <= 0) {
        console.warn('[arrayUtils] chunk: Invalid size');
        return [];
    }
    
    const chunksCount = Math.ceil(arr.length / size);
    const result = new Array(chunksCount);
    
    for (let i = 0; i < chunksCount; i++) {
        const start = i * size;
        const end = Math.min(start + size, arr.length);
        result[i] = arr.slice(start, end);
    }
    
    return result;
};

/**
 * Split array into batches for processing (async-friendly)
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @param {number} batchSize - Items per batch
 * @returns {Generator<T[], void, void>} Generator for lazy iteration
 */
export function* batchIterator(arr, batchSize) {
    if (!Array.isArray(arr) || batchSize <= 0) return;
    
    for (let i = 0; i < arr.length; i += batchSize) {
        yield arr.slice(i, i + batchSize);
    }
}

/* ──────────────────────────────────────────────────────────────────────────
   4. FILTERING & SEARCHING
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Filter array by search term (case-insensitive, multiple properties)
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @param {string} term - Search term
 * @param {keyof T[]} [properties] - Properties to search in
 * @returns {T[]} Filtered array
 * 
 * @example
 * fuzzySearch(channels, 'bein', ['name', 'category']);
 */
export const fuzzySearch = (arr, term, properties = []) => {
    if (!Array.isArray(arr)) return [];
    if (!term || typeof term !== 'string') return [...arr];
    
    const searchTerm = term.toLowerCase().trim();
    
    return arr.filter(item => {
        if (item == null) return false;
        
        // If no properties specified, search all string properties
        const propsToSearch = properties.length > 0 
            ? properties 
            : Object.keys(item).filter(key => typeof item[key] === 'string');
        
        return propsToSearch.some(prop => {
            const value = item[prop];
            return value?.toLowerCase().includes(searchTerm);
        });
    });
};

/**
 * Filter by multiple conditions (AND logic)
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @param {Object} conditions - Key-value pairs to match
 * @returns {T[]} Filtered array
 */
export const filterBy = (arr, conditions) => {
    if (!Array.isArray(arr)) return [];
    if (typeof conditions !== 'object' || conditions === null) return [...arr];
    
    const keys = Object.keys(conditions);
    if (keys.length === 0) return [...arr];
    
    return arr.filter(item => {
        if (item == null) return false;
        
        return keys.every(key => {
            const expected = conditions[key];
            const actual = item[key];
            
            // Handle arrays (includes check)
            if (Array.isArray(expected)) {
                return expected.includes(actual);
            }
            
            return actual === expected;
        });
    });
};

/**
 * Group array items by key
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @param {keyof T} key - Grouping key
 * @returns {Map<any, T[]>} Map of grouped items
 * 
 * @example
 * groupBy(channels, 'category'); // Map { 'Sports': [...], 'News': [...] }
 */
export const groupBy = (arr, key) => {
    if (!Array.isArray(arr)) return new Map();
    if (typeof key !== 'string' && typeof key !== 'symbol') return new Map();
    
    return arr.reduce((groups, item) => {
        if (item == null) return groups;
        
        const groupKey = item[key];
        if (groupKey == null) return groups;
        
        const group = groups.get(groupKey) || [];
        group.push(item);
        groups.set(groupKey, group);
        
        return groups;
    }, new Map());
};

/* ──────────────────────────────────────────────────────────────────────────
   5. TRANSFORMATION
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Transform array to object with key extractor
 * 
 * @template T, K
 * @param {T[]} arr - Input array
 * @param {Function} keyFn - Function to extract key
 * @returns {Object} Object map
 * 
 * @example
 * toMap(channels, c => c.id); // { '1': {...}, '2': {...} }
 */
export const toMap = (arr, keyFn) => {
    if (!Array.isArray(arr)) return {};
    if (typeof keyFn !== 'function') return {};
    
    return arr.reduce((acc, item, index) => {
        if (item == null) return acc;
        
        const key = keyFn(item, index);
        if (key != null) {
            acc[key] = item;
        }
        
        return acc;
    }, {});
};

/**
 * Flatten nested arrays (one level)
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @returns {T[]} Flattened array
 */
export const flatten = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.flat();
};

/**
 * Deep flatten nested arrays
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @param {number} [depth=Infinity] - Depth to flatten
 * @returns {T[]} Flattened array
 */
export const flattenDeep = (arr, depth = Infinity) => {
    if (!Array.isArray(arr)) return [];
    return arr.flat(depth);
};

/**
 * Compact array (remove falsy values)
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @returns {T[]} Compacted array
 */
export const compact = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.filter(Boolean);
};

/* ──────────────────────────────────────────────────────────────────────────
   6. STATISTICS & ANALYSIS
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Get min value from array by key
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @param {keyof T} key - Property to find min
 * @returns {number|null} Min value or null
 */
export const minBy = (arr, key) => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    if (typeof key !== 'string' && typeof key !== 'symbol') return null;
    
    let min = Infinity;
    
    for (const item of arr) {
        const value = item?.[key];
        if (typeof value === 'number' && value < min) {
            min = value;
        }
    }
    
    return min === Infinity ? null : min;
};

/**
 * Get max value from array by key
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @param {keyof T} key - Property to find max
 * @returns {number|null} Max value or null
 */
export const maxBy = (arr, key) => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    if (typeof key !== 'string' && typeof key !== 'symbol') return null;
    
    let max = -Infinity;
    
    for (const item of arr) {
        const value = item?.[key];
        if (typeof value === 'number' && value > max) {
            max = value;
        }
    }
    
    return max === -Infinity ? null : max;
};

/**
 * Get sum of numeric values by key
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @param {keyof T} key - Property to sum
 * @returns {number} Sum value
 */
export const sumBy = (arr, key) => {
    if (!Array.isArray(arr)) return 0;
    if (typeof key !== 'string' && typeof key !== 'symbol') return 0;
    
    return arr.reduce((sum, item) => {
        const value = item?.[key];
        return sum + (typeof value === 'number' ? value : 0);
    }, 0);
};

/**
 * Get average of numeric values by key
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @param {keyof T} key - Property to average
 * @returns {number|null} Average value or null
 */
export const averageBy = (arr, key) => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    
    const sum = sumBy(arr, key);
    const count = arr.filter(item => typeof item?.[key] === 'number').length;
    
    return count > 0 ? sum / count : null;
};

/* ──────────────────────────────────────────────────────────────────────────
   7. PERFORMANCE-OPTIMIZED UTILS (For Large Playlists)
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Quick check if array contains value (optimized for large arrays)
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @param {T} value - Value to find
 * @returns {boolean} True if found
 */
export const includes = (arr, value) => {
    if (!Array.isArray(arr)) return false;
    return arr.includes(value);
};

/**
 * Find index with predicate (early exit optimization)
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @param {Function} predicate - Test function
 * @returns {number} Index or -1
 */
export const findIndex = (arr, predicate) => {
    if (!Array.isArray(arr)) return -1;
    if (typeof predicate !== 'function') return -1;
    
    for (let i = 0; i < arr.length; i++) {
        if (predicate(arr[i], i, arr)) {
            return i;
        }
    }
    
    return -1;
};

/**
 * Check if any item matches predicate (early exit)
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @param {Function} predicate - Test function
 * @returns {boolean} True if any match
 */
export const some = (arr, predicate) => {
    if (!Array.isArray(arr)) return false;
    if (typeof predicate !== 'function') return false;
    
    for (let i = 0; i < arr.length; i++) {
        if (predicate(arr[i], i, arr)) {
            return true;
        }
    }
    
    return false;
};

/**
 * Check if all items match predicate (early exit)
 * 
 * @template T
 * @param {T[]} arr - Input array
 * @param {Function} predicate - Test function
 * @returns {boolean} True if all match
 */
export const every = (arr, predicate) => {
    if (!Array.isArray(arr)) return false;
    if (typeof predicate !== 'function') return false;
    
    for (let i = 0; i < arr.length; i++) {
        if (!predicate(arr[i], i, arr)) {
            return false;
        }
    }
    
    return true;
};

/* ──────────────────────────────────────────────────────────────────────────
   8. EXPORTS (Frozen Object)
   ────────────────────────────────────────────────────────────────────────── */

export const arrayUtils = Object.freeze({
    // Unique & Deduplication
    uniqueBy,
    unique,
    uniqueByComparator,
    
    // Sorting
    sortBy,
    sortByKeys,
    
    // Chunking & Batching
    chunk,
    batchIterator,
    
    // Filtering & Searching
    fuzzySearch,
    filterBy,
    groupBy,
    
    // Transformation
    toMap,
    flatten,
    flattenDeep,
    compact,
    
    // Statistics & Analysis
    minBy,
    maxBy,
    sumBy,
    averageBy,
    
    // Performance Utils
    includes,
    findIndex,
    some,
    every
});

/* ──────────────────────────────────────────────────────────────────────────
   END OF ARRAYUTILS.JS v2.5.0
   ============================================================================ */
