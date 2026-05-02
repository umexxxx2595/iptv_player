/**
 * Row Carousel Component (Premium Content Rail)
 * Features baseline headers, item counters, and smooth D-PAD navigation.
 */

import { posterCard } from './posterCard.js';

export const rowCarousel = {
    /**
     * Renders a Content Rail element
     * @param {string} title - Rail title
     * @param {Array} items - List of channel/movie items
     * @param {Object} options - Rendering options
     * @returns {HTMLElement}
     */
    render(title = '', items = [], options = {}) {
        const rail = document.createElement('section');
        rail.className = 'content-rail';

        const safeItems = Array.isArray(items) ? items : [];

        // 1. Header with Metadata
        const header = document.createElement('div');
        header.className = 'rail-header';
        
        const titleEl = document.createElement('h2');
        titleEl.className = 'rail-title';
        titleEl.textContent = title;

        const metaEl = document.createElement('span');
        metaEl.className = 'rail-meta';
        metaEl.textContent = `${safeItems.length} İÇERİK`;
        
        header.append(titleEl, metaEl);

        // 2. Scroll Container
        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'row-scroll-container';

        // 3. Render Cards
        safeItems.forEach(item => {
            const card = posterCard.render(item, options.cardOptions);
            scrollContainer.appendChild(card);
        });

        // 4. Focus Management Helper
        const setFocusedCard = (card) => {
            scrollContainer.querySelectorAll('.poster-card.focusable')
                .forEach(el => el.classList.toggle('focused', el === card));
        };

        // 5. Navigation & Action Handler (D-PAD Optimized)
        const handleKeydown = (e) => {
            const cards = Array.from(scrollContainer.querySelectorAll('.poster-card.focusable'));
            if (!cards.length) return;

            const activeCard = document.activeElement.closest?.('.poster-card');
            
            // Handle Action
            if (e.key === 'Enter' || e.key === ' ') {
                if (!activeCard || !rail.contains(activeCard)) return;
                e.preventDefault();
                e.stopPropagation();
                activeCard.click();
                return;
            }

            // Handle Navigation
            const currentIndex = cards.indexOf(activeCard);
            if (currentIndex === -1) return;

            let nextIndex = currentIndex;
            if (e.key === 'ArrowRight') {
                nextIndex = Math.min(currentIndex + 1, cards.length - 1);
            } else if (e.key === 'ArrowLeft') {
                nextIndex = Math.max(currentIndex - 1, 0);
            } else {
                return;
            }

            if (nextIndex === currentIndex) return;

            e.preventDefault();
            const nextCard = cards[nextIndex];
            nextCard.focus();
            setFocusedCard(nextCard);

            nextCard.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        };

        // 6. Event Bindings
        rail.addEventListener('keydown', handleKeydown);

        scrollContainer.addEventListener('focusin', (e) => {
            const card = e.target.closest('.poster-card');
            if (card) setFocusedCard(card);
        });

        scrollContainer.addEventListener('focusout', (e) => {
            if (!scrollContainer.contains(e.relatedTarget)) {
                scrollContainer.querySelectorAll('.poster-card.focused')
                    .forEach(el => el.classList.remove('focused'));
            }
        });

        // Assembler
        rail.append(header, scrollContainer);

        return rail;
    }
};

export default rowCarousel;
