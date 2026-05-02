/**
 * ============================================================================
 * Grid System – 2D Content Matrix (v38.2)
 * High‑performance, accessible, D‑PAD / keyboard ready.
 *
 *  • posterCard.render(item, {focusable:true}) → DOM element döner.
 *  • Grid’e eklenen her kart .focusable olduğu için odak‑navigasyonu
 *    / event‑delegation sorunsuz çalışır.
 *  • `render()` → DOM element (default) ya da HTML string (`asString:true`) döndürür.
 *  • Filtre‑çipleri (TÜMÜ, A‑Z, EN YENİ) için delegasyonlu click ve
 *    keydown (Enter/Space) event’leri eklenir.
 *  ============================================================================
 */

import { posterCard } from '../components/posterCard.js';

/**
 * Default options – dışarıdan özelleştirilebilir.
 */
const DEFAULT_OPTIONS = {
    /** true → HTML string döndür, false → HTMLElement döndür */
    asString: false,

    /** Odaklanabilir mi? (posterCard tarafında da aynı) */
    cardOptions: { focusable: true },

    /** Filtre çipleri – etiket ve sıralama işlevi */
    filters: [
        { id: 'all', label: 'TÜMÜ', active: true },
        { id: 'az', label: 'A‑Z', active: false },
        { id: 'new', label: 'EN YENİ', active: false }
    ]
};

/**
 * Public API – render the whole grid.
 *
 * @param {Array<Object>} items   – kanal / içerik dizisi (posterCard expects {id, name, logo, url})
 * @param {Object}       [options] – özelleştirme (asString, cardOptions, filters)
 * @returns {HTMLElement|string}
 */
export const gridSystem = {
    render(items = [], options = {}) {
        const cfg = { ...DEFAULT_OPTIONS, ...options };

        // ----------------------------------------------------------------
        // 1️⃣ Build poster cards (posters are DOM elements)
        // ----------------------------------------------------------------
        const cardsFragment = document.createDocumentFragment();
        items.forEach(item => {
            const card = posterCard.render(item, cfg.cardOptions);
            cardsFragment.appendChild(card);
        });

        // ----------------------------------------------------------------
        // 2️⃣ Build filter chips (delegated events)
        // ----------------------------------------------------------------
        const filterContainer = document.createElement('div');
        filterContainer.className = 'grid-filters';
        cfg.filters.forEach(f => {
            const chip = document.createElement('span');
            chip.className = `filter-chip focusable${f.active ? ' active' : ''}`;
            chip.dataset.filterId = f.id;
            chip.tabIndex = 0;
            chip.textContent = f.label;
            filterContainer.appendChild(chip);
        });

        // ----------------------------------------------------------------
        // 3️⃣ Header (stats + filters)
        // ----------------------------------------------------------------
        const header = document.createElement('div');
        header.className = 'grid-header';

        const stats = document.createElement('div');
        stats.className = 'grid-stats';
        stats.textContent = `${items.length} Kanal Listeleniyor`;
        header.appendChild(stats);
        header.appendChild(filterContainer);

        // ----------------------------------------------------------------
        // 4️⃣ Main grid container
        // ----------------------------------------------------------------
        const grid = document.createElement('div');
        grid.className = 'content-grid';
        grid.appendChild(cardsFragment);

        // ----------------------------------------------------------------
        // 5️⃣ Wrapper
        // ----------------------------------------------------------------
        const wrapper = document.createElement('div');
        wrapper.className = 'content-grid-wrap';
        wrapper.appendChild(header);
        wrapper.appendChild(grid);

        // ----------------------------------------------------------------
        // 6️⃣ Event Delegation – filter chip clicks + keyboard
        // ----------------------------------------------------------------
        filterContainer.addEventListener('click', (e) => {
            const chip = e.target.closest('.filter-chip');
            if (!chip) return;
            const filterId = chip.dataset.filterId;
            // Toggle active class
            filterContainer.querySelectorAll('.filter-chip')
                .forEach(c => c.classList.toggle('active', c === chip));
            // Emit custom event so screen can react (e.g., apply a filter)
            const ev = new CustomEvent('grid:filter', {
                detail: { filterId },
                bubbles: true,
                composed: true
            });
            wrapper.dispatchEvent(ev);
        });

        filterContainer.addEventListener('keydown', (e) => {
            const chip = e.target.closest('.filter-chip');
            if (!chip) return;
            const key = e.key;
            if (key === 'Enter' || key === ' ') {
                e.preventDefault();
                chip.click(); // delegate to click‑handler
            }
        });

        // ----------------------------------------------------------------
        // 7️⃣ Return either HTMLElement or HTML string (legacy)
        // ----------------------------------------------------------------
        if (cfg.asString) {
            // Be careful: once you call outerHTML the element is removed from the DOM.
            return wrapper.outerHTML;
        }
        return wrapper;
    }
};
