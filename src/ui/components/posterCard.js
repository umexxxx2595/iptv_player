/**
 * Poster Card Component (Premium Optimized)
 * Standardized horizontal cards with glassmorphism badges and premium overlays.
 */

export const posterCard = {
    /**
     * Renders a Premium Poster Card element
     * @param {Object} item - Channel/Movie data
     * @param {Object} options - Rendering options
     * @returns {HTMLElement}
     */
    render(item = {}, options = {}) {
        const cleanName = item.name || 'Bilinmeyen Kanal';
        const category = item.category || 'Genel';
        const itemUrl = item.url || '';
        const itemLogo = item.logo || '';

        const card = document.createElement('div');
        card.className = 'poster-card focusable';
        card.tabIndex = 0;
        card.dataset.action = 'play';
        card.dataset.url = itemUrl;
        card.dataset.category = category;

        // 1. Badge (Premium Style)
        const badge = document.createElement('div');
        badge.className = 'poster-card-badge';
        badge.textContent = category;

        // 2. Image Wrapper & Placeholder
        const imgWrap = document.createElement('div');
        imgWrap.className = 'card-image-wrapper';

        if (itemLogo) {
            const img = document.createElement('img');
            img.src = itemLogo;
            img.alt = '';
            img.loading = 'lazy';
            img.onerror = function() {
                this.onerror = null;
                this.parentElement.innerHTML = this.getPlaceholderHTML();
            }.bind(this);
            imgWrap.appendChild(img);
        } else {
            imgWrap.innerHTML = this.getPlaceholderHTML();
        }

        // 3. Title (Standardized)
        const title = document.createElement('h3');
        title.className = 'poster-card-title';
        title.textContent = cleanName;

        // Assembler
        card.append(badge, imgWrap, title);

        return card;
    },

    /**
     * Helper to generate consistent placeholder HTML
     * @returns {string}
     */
    getPlaceholderHTML() {
        return `
            <div class="card-placeholder">
                <i data-lucide="tv" class="card-placeholder-icon"></i>
            </div>
        `;
    }
};

export default posterCard;
