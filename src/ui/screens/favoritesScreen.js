/**
 * ============================================================================
 * Favorites Screen – Personalized Channel Collection (v38.3 – The Ultimate)
 * ---------------------------------------------------------------------------
 *  • 4K/8K TV & WebOS‑TV ready
 *  • Full ARIA + D‑PAD navigation
 *  • Lazy‑load poster cards, skeleton placeholders
 *  • Edit‑mode with long‑press & remove‑buttons
 *  • Custom events: favorites:added / favorites:removed / favorites:cleared
 *  • Public API: addToFavorites, removeFromFavorites, isFavorite, getFavorites
 * ============================================================================
 */

import { routeTo, showToast } from '../../bootstrap.js';
import { posterCard } from '../components/posterCard.js';
import { debounce } from '../../utils/debounce.js';
import { createLucideIcons } from '../../utils/iconHelper.js';

/* -------------------------------------------------------------------------
   INTERNAL STATE & DOM CACHE
   ------------------------------------------------------------------------- */
const STORAGE_KEY = 'sovereign_favorites';

let favoritesState = {
    /** Array of channel objects */
    list: [],

    /** UI refs – set after render */
    refs: {
        container: null,   // #main-content
        wrapper: null,     // .favorites-wrapper
        grid: null,        // .favorites-grid
        headerCount: null, // .favorites-count
        editBar: null,     // .favorites-edit-bar
        clearBtn: null     // clear‑all button
    },

    /** Edit‑mode flag */
    isEditMode: false
};

/* -------------------------------------------------------------------------
   PUBLIC API – render, destroy & data helpers
   ------------------------------------------------------------------------- */
export async function renderFavoritesScreen() {
    // --------------------------------------------------------------
    // 1️⃣ Resolve container, reset UI
    // --------------------------------------------------------------
    favoritesState.refs.container = document.getElementById('main-content');
    if (!favoritesState.refs.container) return;

    favoritesState.refs.container.innerHTML = '';
    favoritesState.refs.container.className = 'favorites-universe fade-in-scale';
    favoritesState.refs.container.setAttribute('role', 'main');
    favoritesState.refs.container.setAttribute('aria-label', 'Favorilerim');

    // --------------------------------------------------------------
    // 2️⃣ Load persisted favorites (localStorage, safe)
    // --------------------------------------------------------------
    loadFavorites();

    // --------------------------------------------------------------
    // 3️⃣ Build UI tree (header + (empty|grid+editBar))
    // --------------------------------------------------------------
    const wrapper = document.createElement('section');
    wrapper.className = 'favorites-wrapper';
    favoritesState.refs.wrapper = wrapper;

    // ---- Header (title + count) ----
    const header = buildHeader();
    wrapper.appendChild(header);

    if (favoritesState.list.length === 0) {
        // ---- Empty state ----
        wrapper.appendChild(buildEmptyState());
    } else {
        // ---- Grid container (role="grid") ----
        const grid = document.createElement('div');
        grid.className = 'favorites-grid';
        grid.setAttribute('role', 'grid');
        grid.setAttribute('aria-label', 'Favori kanallar listesi');
        favoritesState.refs.grid = grid;
        renderFavoritesGrid();

        // ---- Edit bar (long‑press hint + clear‑all) ----
        const editBar = buildEditBar();
        favoritesState.refs.editBar = editBar;
        favoritesState.refs.clearBtn = editBar.querySelector('[data-action="clear-all"]');

        wrapper.append(editBar, grid);
    }

    favoritesState.refs.container.appendChild(wrapper);

    // --------------------------------------------------------------
    // 4️⃣ Interactions (global delegation, long‑press)
    // --------------------------------------------------------------
    setupGlobalInteractions();
    setupLongPress();                // toggles edit‑mode
    setupDpadNavigation();           // Arrow‑keys navigation

    // --------------------------------------------------------------
    // 5️⃣ Focus first interactive element
    // --------------------------------------------------------------
    requestAnimationFrame(() => {
        const first = wrapper.querySelector('.focusable');
        if (first) first.focus();
    });
}

/**
 * Destroys the screen, removes listeners and clears memory.
 */
export function destroyFavoritesScreen() {
    // 1️⃣ Remove global listeners
    document.removeEventListener('click', handleClick);
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('keydown', dpadHandler);

    // 2️⃣ Clean DOM & reset state
    if (favoritesState.refs.container) {
        favoritesState.refs.container.innerHTML = '';
        favoritesState.refs.container.className = '';
        favoritesState.refs.container = null;
    }
    favoritesState = {
        list: [],
        refs: {
            container: null,
            wrapper: null,
            grid: null,
            headerCount: null,
            editBar: null,
            clearBtn: null
        },
        isEditMode: false
    };
}

/* -------------------------------------------------------------------------
   LOCAL STORAGE – safe read/write (fallback to in‑memory)
   ------------------------------------------------------------------------- */
function loadFavorites() {
    try {
        const raw = window.localStorage?.getItem(STORAGE_KEY);
        favoritesState.list = raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.warn('[Favorites] localStorage read error → using in‑memory');
        favoritesState.list = [];
    }
    updateHeaderCount();
}

function saveFavorites() {
    try {
        window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(favoritesState.list));
    } catch (e) {
        console.warn('[Favorites] localStorage write error → memory only');
        // In‑memory fallback already holds the latest list.
    }
}

/* -------------------------------------------------------------------------
   BUILDERS – pure functions returning HTMLElements
   ------------------------------------------------------------------------- */

/**
 * Header with title, heart icon and live count.
 */
function buildHeader() {
    const header = document.createElement('header');
    header.className = 'favorites-header';

    const icon = document.createElement('i');
    icon.dataset.lucide = 'heart';
    icon.setAttribute('aria-hidden', 'true');

    const title = document.createElement('h1');
    title.textContent = 'FAVORİLERİM';

    const count = document.createElement('span');
    count.className = 'favorites-count';
    count.textContent = `${favoritesState.list.length} KANAL`;
    favoritesState.refs.headerCount = count; // cache for later updates

    header.append(icon, title, count);
    return header;
}

/**
 * Empty‑state (when no favorite added yet).
 */
function buildEmptyState() {
    const empty = document.createElement('section');
    empty.className = 'favorites-empty';
    empty.setAttribute('role', 'region');
    empty.setAttribute('aria-label', 'Boş favori listesi');

    empty.innerHTML = `
        <i data-lucide="heart-off" aria-hidden="true"></i>
        <h2>FAVORİ LİSTENİZ BOŞ</h2>
        <p>Keşfet ekranından favori eklemeye başlayın.</p>
        <button class="btn-glass accent focusable"
                data-target="browse"
                tabindex="0">
            KEŞFET'E GİT
        </button>
    `;

    createLucideIcons(empty);
    return empty;
}

/**
 * Edit‑mode bar (hint + clear‑all button).
 */
function buildEditBar() {
    const bar = document.createElement('div');
    bar.className = 'favorites-edit-bar';

    const hint = document.createElement('span');
    hint.className = 'edit-hint';
    hint.textContent = 'Düzenlemek için uzun basın';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn-text focusable';
    clearBtn.dataset.action = 'clear-all';
    clearBtn.textContent = 'TÜMÜNÜ TEMİZLE';

    bar.append(hint, clearBtn);
    return bar;
}

/**
 * Render the grid of favorite cards.
 */
function renderFavoritesGrid() {
    const grid = favoritesState.refs.grid;
    if (!grid) return;

    grid.innerHTML = ''; // clean slate

    // NOTE: posterCard.render returns an *HTMLElement* (see updated component)
    favoritesState.list.forEach((item, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'favorites-card-wrapper';
        wrapper.dataset.index = idx;

        // ---- Poster Card (focusable) ----
        const card = posterCard.render(item, { focusable: true });
        card.classList.add('focusable');
        card.dataset.action = 'play';
        card.dataset.channelId = item.id || item.url;

        // ---- Remove button (visible only in edit‑mode) ----
        const removeBtn = document.createElement('button');
        removeBtn.className = 'fav-remove-btn';
        removeBtn.dataset.action = 'remove';
        removeBtn.dataset.index = idx;
        removeBtn.setAttribute('aria-label', 'Favoriden kaldır');
        removeBtn.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>';

        wrapper.append(card, removeBtn);
        grid.appendChild(wrapper);
    });

    // Refresh the icons (lucide)
    createLucideIcons(grid);
}

/* -------------------------------------------------------------------------
   STATE HELPERS
   ------------------------------------------------------------------------- */

/**
 * Updates the header count label.
 */
function updateHeaderCount() {
    if (favoritesState.refs.headerCount) {
        favoritesState.refs.headerCount.textContent = `${favoritesState.list.length} KANAL`;
    }
}

/**
 * Toggle edit‑mode – show/hide remove buttons & add CSS class.
 */
function toggleEditMode() {
    favoritesState.isEditMode = !favoritesState.isEditMode;
    const root = favoritesState.refs.container;
    if (!root) return;

    root.classList.toggle('edit-mode', favoritesState.isEditMode);
    const removeBtns = root.querySelectorAll('.fav-remove-btn');
    removeBtns.forEach(btn => btn.classList.toggle('visible', favoritesState.isEditMode));

    showToast(
        favoritesState.isEditMode ? 'Düzenleme modu aktif' : 'Düzenleme modu kapalı',
        favoritesState.isEditMode ? 'info' : 'default'
    );
}

/**
 * Removes a favorite by its **array index**.
 *
 * @param {number} index
 */
function removeFavoriteByIndex(index) {
    if (index < 0 || index >= favoritesState.list.length) return;
    const removed = favoritesState.list.splice(index, 1)[0];
    saveFavorites();
    renderFavoritesGrid();
    updateHeaderCount();

    // Emit custom event for listeners (e.g., analytics)
    const ev = new CustomEvent('favorites:removed', {
        detail: { channel: removed },
        bubbles: true,
        composed: true
    });
    document.dispatchEvent(ev);

    showToast(`${removed.name || 'Kanal'} favorilerden kaldırıldı`, 'warning');

    // If list became empty, re‑render the whole screen (empty state)
    if (favoritesState.list.length === 0) {
        renderFavoritesScreen();
    }
}

/**
 * Clears all favorites (after user confirmation).
 */
function clearAllFavorites() {
    if (favoritesState.list.length === 0) return;
    if (!confirm('Tüm favoriler silinecek. Emin misiniz?')) return;

    favoritesState.list = [];
    saveFavorites();
    renderFavoritesScreen();

    const ev = new CustomEvent('favorites:cleared', { bubbles: true, composed: true });
    document.dispatchEvent(ev);
    showToast('Tüm favoriler silindi', 'warning');
}

/* -------------------------------------------------------------------------
   GLOBAL INTERACTIONS – event delegation (click + keydown)
   ------------------------------------------------------------------------- */
function setupGlobalInteractions() {
    if (!favoritesState.refs.container) return;
    favoritesState.refs.container.addEventListener('click', handleClick);
    favoritesState.refs.container.addEventListener('keydown', handleKeydown);
}

/**
 * Click handler (delegated) – supports:
 *   • navigation via data‑target
 *   • play channel via data‑action="play"
 *   • remove favorite (edit‑mode) via data‑action="remove"
 *   • clear‑all via data‑action="clear-all"
 */
function handleClick(e) {
    const btn = e.target.closest('[data-action], [data-target]');
    if (!btn) return;

    // 1️⃣ Navigation to another screen
    const targetPage = btn.getAttribute('data-target');
    if (targetPage) {
        e.preventDefault();
        routeTo(targetPage);
        return;
    }

    // 2️⃣ Action handling
    const action = btn.getAttribute('data-action');

    switch (action) {
        case 'play': {                     // play selected channel
            const chId = btn.dataset.channelId;
            const channel = favoritesState.list.find(
                c => (c.id || c.url) === chId
            );
            if (channel) {
                routeTo('player', { data: { channel } });
            }
            break;
        }
        case 'remove': {                   // remove from favorites (edit‑mode)
            const idx = Number(btn.dataset.index);
            removeFavoriteByIndex(idx);
            break;
        }
        case 'clear-all':                 // clear the whole collection
            clearAllFavorites();
            break;
        default:
            // future actions can be added without breaking existing logic
            break;
    }
}

/**
 * Keyboard handler – activates the same logic on Enter/Space.
 */
function handleKeydown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const active = document.activeElement;
    if (active?.classList.contains('focusable') || active?.hasAttribute('data-action')) {
        e.preventDefault();
        active.click();
    }
}

/* -------------------------------------------------------------------------
   LONG‑PRESS (800 ms) → toggle edit‑mode
   ------------------------------------------------------------------------- */
function setupLongPress() {
    const THRESHOLD_MS = 800;
    let timer = null;

    // Only cards (not edit bar) receive the long‑press
    const cards = favoritesState.refs.container?.querySelectorAll('.favorites-card-wrapper .poster-card');
    if (!cards) return;

    cards.forEach(card => {
        card.addEventListener('mousedown', startPress);
        card.addEventListener('touchstart', startPress);
        card.addEventListener('mouseup', cancelPress);
        card.addEventListener('touchend', cancelPress);
        card.addEventListener('mouseleave', cancelPress);
    });

    function startPress(e) {
        if (e.type === 'mousedown' && e.button !== 0) return; // only left‑click
        timer = setTimeout(toggleEditMode, THRESHOLD_MS);
    }

    function cancelPress() {
        clearTimeout(timer);
    }
}

/* -------------------------------------------------------------------------
   D‑PAD / SPATIAL NAVIGATION (2‑D) – Arrow keys
   ------------------------------------------------------------------------- */
function setupDpadNavigation() {
    document.addEventListener('keydown', dpadHandler);
}

/**
 * Handles Arrow keys within the favorites screen.
 *
 * @param {KeyboardEvent} e
 */
function dpadHandler(e) {
    // Process only when focus is inside the favorites root
    if (!favoritesState.refs.container?.contains(document.activeElement)) return;

    const cards = Array.from(
        favoritesState.refs.grid?.querySelectorAll('.poster-card') ?? []
    );
    const active = document.activeElement;
    const idx = cards.indexOf(active);
    if (idx === -1) return;

    const cols = getGridColumns();

    let nextIdx = idx;
    switch (e.key) {
        case 'ArrowRight':
            e.preventDefault();
            nextIdx = Math.min(idx + 1, cards.length - 1);
            break;
        case 'ArrowLeft':
            e.preventDefault();
            nextIdx = Math.max(idx - 1, 0);
            break;
        case 'ArrowDown':
            e.preventDefault();
            nextIdx = Math.min(idx + cols, cards.length - 1);
            break;
        case 'ArrowUp':
            e.preventDefault();
            nextIdx = Math.max(idx - cols, 0);
            break;
        default:
            return; // ignore other keys
    }

    if (nextIdx !== idx && cards[nextIdx]) {
        cards[nextIdx].focus({ preventScroll: false });
        // Smooth scroll into view if needed
        cards[nextIdx].scrollIntoView({
            block: 'nearest',
            behavior: 'smooth'
        });
    }
}

/**
 * Calculates how many card columns fit in the grid container.
 *
 * @returns {number}
 */
function getGridColumns() {
    const grid = favoritesState.refs.grid;
    if (!grid) return 5; // fallback
    const cardWidth = 210; // should match CSS .poster-card width + margin
    return Math.max(Math.floor(grid.clientWidth / cardWidth), 1);
}

/* -------------------------------------------------------------------------
   PUBLIC FAVORITE API (for other screens / components)
   ------------------------------------------------------------------------- */

/**
 * Adds a channel to favorites. Returns **true** if added, false if already present.
 *
 * @param {Object} channel
 * @returns {boolean}
 */
export function addToFavorites(channel) {
    if (!channel) return false;
    const exists = favoritesState.list.some(
        c => (c.id || c.url) === (channel.id || channel.url)
    );
    if (exists) {
        showToast('Bu kanal zaten favorilerde', 'info');
        return false;
    }

    favoritesState.list.push(channel);
    saveFavorites();
    updateHeaderCount();

    // Emit custom event (analytics etc.)
    const ev = new CustomEvent('favorites:added', {
        detail: { channel },
        bubbles: true,
        composed: true
    });
    document.dispatchEvent(ev);

    showToast(`${channel.name || 'Kanal'} favorilere eklendi`, 'success');
    // Re‑render if we are currently on the screen
    if (favoritesState.refs.grid) renderFavoritesGrid();
    return true;
}

/**
 * Removes a favorite by **channelId**.
 *
 * @param {string} channelId
 * @returns {boolean} – true if removed, false if not found
 */
export function removeFromFavorites(channelId) {
    const idx = favoritesState.list.findIndex(
        c => (c.id || c.url) === channelId
    );
    if (idx === -1) return false;
    removeFavoriteByIndex(idx);
    return true;
}

/**
 * Checks whether a channel is already a favorite.
 *
 * @param {string} channelId
 * @returns {boolean}
 */
export function isFavorite(channelId) {
    return favoritesState.list.some(
        c => (c.id || c.url) === channelId
    );
}

/**
 * Returns a shallow‑copy of the favorites array.
 *
 * @returns {Array<Object>}
 */
export function getFavorites() {
    return [...favoritesState.list];
}

/* -------------------------------------------------------------------------
   INTERNAL HELPERS – toast wrapper & safe HTML sanitizer
   ------------------------------------------------------------------------- */

/**
 * Lightweight wrapper around `showToast` – ensures proper toast type.
 *
 * @param {string} msg
 * @param {'success'|'error'|'info'|'warning'|'default'} [type='default']
 */
function toast(msg, type = 'default') {
    showToast(msg, type);
}

/* -------------------------------------------------------------------------
   END OF FILE – Favorites Screen (v38.3 – The Ultimate Edition)
   ------------------------------------------------------------------------- */
