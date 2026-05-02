/**
 * Simple HTML sanitizer to prevent XSS.
 * @param {string} str - Input string
 * @returns {string} - Sanitized string
 */
export function sanitizeHTML(str) {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}
