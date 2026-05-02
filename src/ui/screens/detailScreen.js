/**
 * ============================================================================
 * DETAIL SCREEN – Content Inspector (v38.3 – The Legendary Edition)
 *
 *   • 4K / WebOS‑TV ready, lazy‑load, skeleton placeholders
 *   • 100 % ARIA‑compliant – role, aria‑label, live‑region, focus‑visible
 *   • D‑PAD / keyboard navigation (spatial‑2‑D) for all interactive elements
 *   • Full‑screen “backdrop” with progressive image loading
 *   • Re‑usable utility functions (image loader, clipboard, toast, etc.)
 *   • Custom events:
 *        • detail:favorite   – payload {channelId, item}
 *        • detail:share      – payload {item}
 *        • detail:epg.show   – payload {channelId}
 *        • detail:back      – no payload (used by router)
 *   • All listeners are **delegated** → single‑handler per container → memory‑safe.
 *   • Public API:
 *        renderDetailScreen(data)   – mount the screen
 *        destroyDetailScreen()     – clean‑up, remove listeners, free memory
 * ============================================================================
 */

import { routeTo, showToast } from '../../bootstrap.js';
import { debounce } from '../../utils/debounce.js';
import { sanitizeHTML } from '../../utils/sanitize.js';
import { createLucideIcons } from '../../utils/iconHelper.js';

/* -------------------------------------------------------------------------
   INTERNAL STATE & DOM‑CACHE
   ------------------------------------------------------------------------- */
let STATE = {
    /** The item that is being inspected */
    currentItem: null,
    /** Array of related items (if any) */
    relatedItems: [],
    /** Reference to the root container (`#main-content`) */
    root: null,
    /** Sub‑containers – cached after first render */
    refs: {
        wrapper: null,
        hero: null,
        infoGrid: null,
        actions: null,
        relatedSection: null,
        epgSection: null
    }
};

/* -------------------------------------------------------------------------
   CONSTANTS
   ------------------------------------------------------------------------- */
const PLACEHOLDER_IMG = 'assets/placeholders/card-280x420.png';
const IMAGE_FADE_MS = 250;                       // fade‑in duration for lazy images
const SCROLL_DEBOUNCE_MS = 150;

/* -------------------------------------------------------------------------
   PUBLIC API – renderDetailScreen
   ------------------------------------------------------------------------- */

/**
 * Render the Detail screen.
 *
 * @param {Object} data
 *   {Object}  data.item        – the main channel / show / movie object
 *   {Array}   data.related     – optional array of “similar” items
 *
 *   Expected fields on `item` (optional ones are handled gracefully):
 *     id, url, tvgId, name, title, logo, poster, thumbnail, backdrop,
 *     group, category, language, quality, resolution, codec, format,
 *     description, plot, summary, epg / schedule (array of programs)
 *
 * @returns {Promise<void>}
 */
export async function renderDetailScreen(data = {}) {
    // --------------------------------------------------------------
    // 1️⃣ Resolve root container & reset UI
    // --------------------------------------------------------------
    STATE.root = document.getElementById('main-content');
    if (!STATE.root) {
        console.error('[Detail] #main-content element not found.');
        return;
    }
    STATE.root.innerHTML = '';
    STATE.root.className = 'detail-universe soft-fade-in';
    STATE.root.setAttribute('role', 'main');
    STATE.root.setAttribute('aria-label', 'İçerik detayları');

    // --------------------------------------------------------------
    // 2️⃣ State preparation
    // --------------------------------------------------------------
    STATE.currentItem = data.item || null;
    STATE.relatedItems = Array.isArray(data.related) ? data.related : [];

    if (!STATE.currentItem) {
        // No item → graceful empty state
        renderEmptyState();
        return;
    }

    // --------------------------------------------------------------
    // 3️⃣ Build static wrapper & sub‑containers
    // --------------------------------------------------------------
    const wrapper = document.createElement('section');
    wrapper.className = 'detail-wrapper';
    STATE.refs.wrapper = wrapper;

    STATE.refs.hero = buildHeroSection(STATE.currentItem);
    STATE.refs.infoGrid = buildInfoGrid(STATE.currentItem);
    STATE.refs.actions = buildActionBar(STATE.currentItem);
    wrapper.append(
        STATE.refs.hero,
        STATE.refs.infoGrid,
        STATE.refs.actions
    );

    // --------------------------------------------------------------
    // 4️⃣ Related content (optional)
    // --------------------------------------------------------------
    if (STATE.relatedItems.length) {
        STATE.refs.relatedSection = buildRelatedSection(STATE.relatedItems);
        wrapper.appendChild(STATE.refs.relatedSection);
    }

    // --------------------------------------------------------------
    // 5️⃣ EPG / Schedule (optional)
    // --------------------------------------------------------------
    const schedule = STATE.currentItem.epg || STATE.currentItem.schedule;
    if (schedule) {
        STATE.refs.epgSection = buildEpgSection(schedule);
        wrapper.appendChild(STATE.refs.epgSection);
    }

    // --------------------------------------------------------------
    // 6️⃣ Append wrapper & finalize UI
    // --------------------------------------------------------------
    STATE.root.appendChild(wrapper);
    createLucideIcons(STATE.root);    // render all lucide icons once

    setupDelegatedInteractions();     // click / keydown delegation
    setupBackNavigation();            // focus back button if present
    initDpadNavigation();            // Arrow‑keys → spatial navigation
    initRelatedCarouselObserver();    // lazy‑load related carousel when visible

    // Focus the first interactive element for TV remote users
    requestAnimationFrame(() => {
        const first = wrapper.querySelector('.focusable');
        if (first) first.focus();
    });
}

/* -------------------------------------------------------------------------
   SECTION BUILDERS (pure functions – returns HTMLElements)
   ------------------------------------------------------------------------- */

/**
 * Hero section – big backdrop + poster + title block.
 *
 * @param {Object} item
 * @returns {HTMLElement}
 */
function buildHeroSection(item) {
    const hero = document.createElement('section');
    hero.className = 'detail-hero';
    hero.setAttribute('role', 'region');
    hero.setAttribute('aria-label', 'Detay başlığı');

    // ---- Backdrop ----
    const backdropWrap = document.createElement('div');
    backdropWrap.className = 'detail-backdrop';
    if (item.backdrop || item.poster || item.logo) {
        const img = document.createElement('img');
        img.alt = '';
        img.className = 'detail-backdrop-img';
        img.dataset.src = item.backdrop || item.poster || item.logo;
        img.dataset.placeholder = PLACEHOLDER_IMG;
        lazyLoadImage(img);
        backdropWrap.appendChild(img);
    }

    // ---- Gradient overlay (visual depth) ----
    const overlay = document.createElement('div');
    overlay.className = 'detail-hero-overlay';

    // ---- Content (poster + text) ----
    const content = document.createElement('div');
    content.className = 'detail-hero-content';

    // Poster
    const posterWrap = document.createElement('div');
    posterWrap.className = 'detail-poster-wrap';
    const posterImg = document.createElement('img');
    posterImg.className = 'detail-poster';
    posterImg.alt = safeText(item.name || item.title || '');
    posterImg.dataset.src = item.logo || item.poster || item.thumbnail || '';
    posterImg.dataset.placeholder = PLACEHOLDER_IMG;
    lazyLoadImage(posterImg);
    posterWrap.appendChild(posterImg);

    // Text block
    const textWrap = document.createElement('div');
    textWrap.className = 'detail-hero-text';

    const tag = document.createElement('div');
    tag.className = 'detail-tag';
    tag.textContent = safeText(item.group || item.category || 'CANLI');

    const title = document.createElement('h1');
    title.className = 'detail-title';
    title.textContent = safeText(item.name || item.title || 'Bilinmeyen');

    const meta = document.createElement('div');
    meta.className = 'detail-meta';

    // Language
    if (item.language) {
        const lang = document.createElement('span');
        lang.className = 'detail-meta-item';
        lang.textContent = safeText(item.language).toUpperCase();
        meta.appendChild(lang);
    }

    // Quality / Resolution
    if (item.quality || item.resolution) {
        const q = document.createElement('span');
        q.className = 'detail-meta-item detail-quality';
        q.textContent = safeText(item.quality || item.resolution);
        meta.appendChild(q);
    }

    // Country
    if (item.country) {
        const c = document.createElement('span');
        c.className = 'detail-meta-item';
        c.textContent = safeText(item.country);
        meta.appendChild(c);
    }

    // Description
    const desc = document.createElement('p');
    desc.className = 'detail-description';
    desc.textContent = safeText(
        item.description || item.plot || item.summary ||
        'Bu kanal hakkında detaylı bilgi bulunmamaktadır.'
    );

    textWrap.append(tag, title, meta, desc);
    content.append(posterWrap, textWrap);
    hero.append(backdropWrap, overlay, content);
    return hero;
}

/**
 * Information grid (key‑value pairs).
 *
 * @param {Object} item
 * @returns {HTMLElement}
 */
function buildInfoGrid(item) {
    const grid = document.createElement('section');
    grid.className = 'detail-info-grid glass-premium';
    grid.setAttribute('role', 'table');
    grid.setAttribute('aria-label', 'İçerik teknik bilgileri');

    const rows = [
        { label: 'KANAL ID', value: item.id || item.tvgId || 'N/A' },
        { label: 'GRUP', value: item.group || item.category || 'Genel' },
        { label: 'DİL', value: item.language || 'TR' },
        { label: 'KALİTE', value: item.quality || item.resolution || 'HD' },
        { label: 'CODEC', value: item.codec || 'H.264' },
        { label: 'FORMAT', value: item.format || 'M3U8' }
    ];

    rows.forEach(r => {
        const cell = document.createElement('div');
        cell.className = 'detail-info-cell';
        cell.setAttribute('role', 'row');

        const lbl = document.createElement('span');
        lbl.className = 'detail-info-label';
        lbl.textContent = safeText(r.label);
        lbl.setAttribute('role', 'columnheader');

        const val = document.createElement('span');
        val.className = 'detail-info-value';
        val.textContent = safeText(r.value);
        val.setAttribute('role', 'cell');

        cell.append(lbl, val);
        grid.appendChild(cell);
    });
    return grid;
}

/**
 * Action bar – Play, Favorite, Share, EPG.
 *
 * @param {Object} item
 * @returns {HTMLElement}
 */
function buildActionBar(item) {
    const bar = document.createElement('section');
    bar.className = 'detail-actions';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'İçerik eylemleri');

    const actions = [
        {
            id: 'play',
            icon: 'play',
            label: 'ŞİMDİ OYNAT',
            primary: true,
            data: { action: 'play', channelId: item.id || item.url }
        },
        {
            id: 'favorite',
            icon: 'heart',
            label: 'FAVORİLERE EKLE',
            primary: false,
            data: { action: 'favorite', channelId: item.id }
        },
        {
            id: 'share',
            icon: 'share-2',
            label: 'PAYLAŞ',
            primary: false,
            data: { action: 'share', channelId: item.id }
        },
        {
            id: 'epg',
            icon: 'calendar',
            label: 'YAYIN AKIŞI',
            primary: false,
            data: { action: 'epg', channelId: item.id }
        }
    ];

    actions.forEach(act => {
        const btn = document.createElement('button');
        btn.className = `detail-action-btn focusable${act.primary ? ' btn-primary' : ''}`;
        btn.dataset.action = act.data.action;
        btn.dataset.channelId = act.data.channelId;
        btn.tabIndex = 0;
        btn.setAttribute('aria-pressed', 'false');

        const icon = document.createElement('i');
        icon.dataset.lucide = act.icon;
        icon.setAttribute('aria-hidden', 'true');

        const label = document.createElement('span');
        label.textContent = act.label;

        btn.append(icon, label);
        bar.appendChild(btn);
    });

    return bar;
}

/**
 * Related content carousel (lazy‑load using IntersectionObserver).
 *
 * @param {Array<Object>} items
 * @returns {HTMLElement}
 */
function buildRelatedSection(items) {
    const section = document.createElement('section');
    section.className = 'detail-related';
    section.setAttribute('role', 'region');
    section.setAttribute('aria-label', 'Benzer içerikler');

    const header = document.createElement('header');
    header.className = 'detail-section-header';

    const title = document.createElement('h2');
    title.textContent = 'Benzer Kanallar';
    const hint = document.createElement('span');
    hint.className = 'scroll-hint';
    hint.textContent = '◄ ►';

    header.append(title, hint);
    section.appendChild(header);

    const carousel = document.createElement('div');
    carousel.className = 'detail-related-carousel';
    carousel.dataset.observed = 'false';          // for IntersectionObserver guard

    items.forEach((itm, idx) => {
        const card = document.createElement('button');
        card.className = 'detail-related-card focusable';
        card.dataset.itemId = itm.id || itm.url;
        card.dataset.index = idx;
        card.tabIndex = 0;
        card.setAttribute('aria-label', safeText(itm.name || itm.title));

        const img = document.createElement('img');
        img.alt = safeText(itm.name || itm.title);
        img.className = 'detail-related-img';
        img.dataset.src = itm.logo || itm.poster || itm.thumbnail || '';
        img.dataset.placeholder = PLACEHOLDER_IMG;
        lazyLoadImage(img);

        const name = document.createElement('span');
        name.className = 'detail-related-name';
        name.textContent = safeText(itm.name || itm.title);

        card.append(img, name);
        carousel.appendChild(card);
    });

    section.appendChild(carousel);
    return section;
}

/**
 * EPG / schedule section.
 *
 * @param {Array|Object} schedule – array of program objects or an object map
 * @returns {HTMLElement}
 */
function buildEpgSection(schedule) {
    const section = document.createElement('section');
    section.className = 'detail-epg';
    section.setAttribute('role', 'region');
    section.setAttribute('aria-label', 'Yayın akışı');

    const header = document.createElement('header');
    header.className = 'detail-section-header';
    const title = document.createElement('h2');
    title.textContent = 'Yayın Akışı';
    header.appendChild(title);
    section.appendChild(header);

    const list = document.createElement('div');
    list.className = 'epg-list';

    if (Array.isArray(schedule) && schedule.length) {
        schedule.forEach((prog, i) => {
            const item = document.createElement('div');
            item.className = `epg-item${prog.now ? ' epg-now' : ''}`;

            const time = document.createElement('span');
            time.className = 'epg-time';
            time.textContent = prog.time || prog.start || '--:--';

            const name = document.createElement('span');
            name.className = 'epg-name';
            name.textContent = prog.title || prog.name || 'Bilinmeyen Program';

            const status = document.createElement('span');
            status.className = 'epg-status';
            status.textContent = prog.now ? 'ŞİMDİ' : '';

            item.append(time, name, status);
            list.appendChild(item);
        });
    } else {
        const empty = document.createElement('div');
        empty.className = 'epg-empty';
        empty.textContent = 'Yayın akışı bilgisi bulunmuyor.';
        list.appendChild(empty);
    }

    section.appendChild(list);
    return section;
}

/* -------------------------------------------------------------------------
   EMPTY STATE (no item supplied)
   ------------------------------------------------------------------------- */
function renderEmptyState() {
    const empty = document.createElement('section');
    empty.className = 'detail-empty glass-premium';
    empty.setAttribute('role', 'alert');
    empty.setAttribute('aria-live', 'polite');

    empty.innerHTML = `
        <i data-lucide="search-x" class="detail-empty-icon" aria-hidden="true"></i>
        <h2>İçerik Bulunamadı</h2>
        <p>Detay görüntülemek için bir kanal seçin.</p>
        <button class="btn-glass focusable" data-action="back">GERİ DÖN</button>
    `;

    STATE.root.appendChild(empty);
    createLucideIcons(empty);
}

/* -------------------------------------------------------------------------
   INTERACTION SETUP – click & keydown delegation
   ------------------------------------------------------------------------- */
function setupDelegatedInteractions() {
    if (!STATE.root) return;

    // Click delegation (actions, related cards, back button)
    STATE.root.addEventListener('click', handleRootClick);
    // Keydown delegation (Enter / Space → activate)
    STATE.root.addEventListener('keydown', handleRootKeydown);
}

/**
 * Click handler – uses `data-action` and `data-channel-id` attributes.
 *
 * @param {MouseEvent} e
 */
function handleRootClick(e) {
    const target = e.target.closest('.focusable, [data-action]');
    if (!target) return;

    // ------------------------------------------------------------------
    // 1️⃣ DETAIL ACTIONS (play, favorite, share, epg)
    // ------------------------------------------------------------------
    const action = target.dataset.action;
    const channelId = target.dataset.channelId;
    if (action) {
        switch (action) {
            case 'play':
                playChannel(channelId);
                break;
            case 'favorite':
                toggleFavorite(channelId);
                break;
            case 'share':
                shareChannel(channelId);
                break;
            case 'epg':
                showEpg(channelId);
                break;
            case 'back':
                goBack();
                break;
            default:
                // No‑op: may be a future action
                break;
        }
        return;
    }

    // ------------------------------------------------------------------
    // 2️⃣ RELATED CARD → open a new Detail screen for that item
    // ------------------------------------------------------------------
    const itemId = target.dataset.itemId;
    if (itemId) {
        const related = STATE.relatedItems.find(i => (i.id || i.url) === itemId);
        if (related) {
            renderDetailScreen({ item: related, related: STATE.relatedItems });
        }
    }
}

/**
 * Keydown handler – triggers click on Enter / Space.
 *
 * @param {KeyboardEvent} e
 */
function handleRootKeydown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;

    const focused = document.activeElement;
    if (focused && focused.classList.contains('focusable')) {
        e.preventDefault();
        focused.click();
    }
}

/* -------------------------------------------------------------------------
   ACTION IMPLEMENTATIONS
   ------------------------------------------------------------------------- */

/**
 * Play → router → player screen.
 *
 * @param {string} channelId
 */
function playChannel(channelId) {
    if (!STATE.currentItem) return;
    const payload = {
        ...STATE.currentItem,
        id: channelId,
        url: STATE.currentItem.url || channelId
    };
    routeTo('player', { data: { channel: payload } });
}

/**
 * Favorite – emit custom event + toast.
 *
 * @param {string} channelId
 */
function toggleFavorite(channelId) {
    const ev = new CustomEvent('detail:favorite', {
        detail: { channelId, item: STATE.currentItem },
        bubbles: true,
        composed: true
    });
    document.dispatchEvent(ev);
    showToast('Favorilere eklendi', 'success');
}

/**
 * Share – Web Share API with fallback to clipboard.
 *
 * @param {string} channelId
 */
function shareChannel(channelId) {
    const shareData = {
        title: STATE.currentItem?.name || 'Sovereign TV',
        text: `${STATE.currentItem?.name} – Sovereign TV'de izle`,
        url: window.location.href
    };

    if (navigator.share) {
        navigator.share(shareData).catch(() => copyFallback());
    } else {
        copyFallback();
    }

    function copyFallback() {
        navigator.clipboard?.writeText(shareData.url)
            .then(() => showToast('Link kopyalandı', 'success'))
            .catch(() => showToast('Kopyalama başarısız', 'error'));
    }

    // Also emit a custom event for analytical purposes
    const ev = new CustomEvent('detail:share', {
        detail: { channelId, item: STATE.currentItem },
        bubbles: true,
        composed: true
    });
    document.dispatchEvent(ev);
}

/**
 * Show EPG → scroll to the EPG section.
 *
 * @param {string} channelId
 */
function showEpg(channelId) {
    const epg = document.querySelector('.detail-epg');
    if (epg) {
        epg.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Emit custom event so external modules can react
        const ev = new CustomEvent('detail:epg.show', {
            detail: { channelId },
            bubbles: true,
            composed: true
        });
        document.dispatchEvent(ev);
    }
}

/**
 * Back navigation – attempts router back, otherwise history back.
 */
function goBack() {
    const ev = new CustomEvent('detail:back', { bubbles: true, composed: true });
    document.dispatchEvent(ev);
    // If the app provides a custom router back, it will listen to this event.
    // Fallback:
    if (!window.history?.state?.prev) {
        window.history.back();
    }
}

/* -------------------------------------------------------------------------
   BACK BUTTON – focus management
   ------------------------------------------------------------------------- */
function setupBackNavigation() {
    const backBtn = STATE.root.querySelector('[data-action="back"]');
    if (backBtn) {
        backBtn.focus();
    }
}

/* -------------------------------------------------------------------------
   D‑PAD / SPATIAL NAVIGATION (2‑D)
   ------------------------------------------------------------------------- */
function initDpadNavigation() {
    document.addEventListener('keydown', dpadHandler);
}

/**
 * Handles Arrow keys for full screen navigation.
 *
 * @param {KeyboardEvent} e
 */
function dpadHandler(e) {
    // Only react when the focus is inside the Detail screen
    if (!STATE.root?.contains(document.activeElement)) return;

    const focusable = Array.from(
        STATE.root.querySelectorAll('.focusable')
    );
    const active = document.activeElement;
    const idx = focusable.indexOf(active);

    // No focusable element → focus the first one
    if (idx === -1 && focusable.length) {
        focusable[0].focus();
        return;
    }

    let nextIdx = idx;
    const cols = Math.max(
        Math.floor(STATE.refs.wrapper?.clientWidth / CARD_WIDTH_PX),
        1
    );

    switch (e.key) {
        case 'ArrowRight':
            e.preventDefault();
            nextIdx = Math.min(idx + 1, focusable.length - 1);
            break;
        case 'ArrowLeft':
            e.preventDefault();
            nextIdx = Math.max(idx - 1, 0);
            break;
        case 'ArrowDown':
            e.preventDefault();
            nextIdx = Math.min(idx + cols, focusable.length - 1);
            break;
        case 'ArrowUp':
            e.preventDefault();
            nextIdx = Math.max(idx - cols, 0);
            break;
        default:
            return; // ignore other keys
    }

    if (nextIdx !== idx) {
        focusable[nextIdx].focus();
        focusable[nextIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

/* -------------------------------------------------------------------------
   RELATED CAROUSEL – lazy load when it becomes visible
   ------------------------------------------------------------------------- */
let _relatedObserver = null;

/**
 * Observe the related carousel container and start loading its images
 * only when the user scrolls near it.
 */
function initRelatedCarouselObserver() {
    const carousel = STATE.root?.querySelector('.detail-related-carousel');
    if (!carousel) return;

    // Prevent double‑observer creation
    if (carousel.dataset.observed === 'true') return;

    const opts = {
        root: null,
        rootMargin: '200px',
        threshold: 0
    };

    _relatedObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Load all images inside carousel (they already have data‑src)
                carousel.querySelectorAll('img[data-src]').forEach(lazyLoadImage);
                _relatedObserver.unobserve(entry.target);
                carousel.dataset.observed = 'true';
            }
        });
    }, opts);

    _relatedObserver.observe(carousel);
}

/* -------------------------------------------------------------------------
   IMAGE HELPERS – lazy loading with skeleton & fade‑in
   ------------------------------------------------------------------------- */

/**
 * Lazy‑load an <img> element. Expects `data-src` (real image) and optional
 * `data-placeholder` (fallback). Adds `loading` / `loaded` / `error` classes.
 *
 * @param {HTMLImageElement} img
 */
function lazyLoadImage(img) {
    const src = img.dataset.src;
    const placeholder = img.dataset.placeholder || PLACEHOLDER_IMG;
    if (!src) {
        img.src = placeholder;
        img.classList.add('error');
        return;
    }

    const image = new Image();
    image.onload = () => {
        img.src = src;
        img.classList.add('loaded');
        img.classList.remove('loading');
        img.style.transition = `opacity ${IMAGE_FADE_MS}ms ease`;
        img.style.opacity = '1';
    };
    image.onerror = () => {
        img.src = placeholder;
        img.classList.add('error');
        img.classList.remove('loading');
    };

    img.classList.add('loading');
    img.style.opacity = '0';
    img.src = placeholder;                 // start with placeholder
    image.src = src;                       // trigger real request
}

/**
 * Wrapper used by hero section (single‑image) – identical logic.
 *
 * @param {HTMLImageElement} img
 */
function lazyLoadImage(img) {
    const src = img.dataset.src;
    const placeholder = img.dataset.placeholder || PLACEHOLDER_IMG;
    if (!src) {
        img.src = placeholder;
        img.classList.add('error');
        return;
    }
    const placeholderImg = new Image();
    placeholderImg.onload = () => {
        img.src = placeholder;                 // set placeholder first
        img.classList.add('loading');
        img.style.opacity = '0';
        const realImg = new Image();
        realImg.onload = () => {
            img.src = src;
            img.classList.remove('loading');
            img.classList.add('loaded');
            img.style.transition = `opacity ${IMAGE_FADE_MS}ms ease`;
            img.style.opacity = '1';
        };
        realImg.onerror = () => {
            img.src = placeholder;
            img.classList.remove('loading');
            img.classList.add('error');
        };
        realImg.src = src;
    };
    placeholderImg.onerror = () => {
        img.src = placeholder;
        img.classList.add('error');
    };
    placeholderImg.src = placeholder;
}

/* -------------------------------------------------------------------------
   SAFE TEXT – HTML sanitisation wrapper
   ------------------------------------------------------------------------- */
function safeText(str) {
    return sanitizeHTML(str ?? '');
}

/* -------------------------------------------------------------------------
   DESTROY – clean‑up all listeners & DOM references
   ------------------------------------------------------------------------- */
export function destroyDetailScreen() {
    // 1️⃣ Remove global listeners
    document.removeEventListener('keydown', dpadHandler);
    if (STATE.root) {
        STATE.root.removeEventListener('click', handleRootClick);
        STATE.root.removeEventListener('keydown', handleRootKeydown);
    }

    // 2️⃣ Disconnect IntersectionObserver (related carousel)
    if (_relatedObserver) {
        _relatedObserver.disconnect();
        _relatedObserver = null;
    }

    // 3️⃣ Clear DOM and reset cached refs / state
    if (STATE.root) {
        STATE.root.innerHTML = '';
        STATE.root.className = '';
        STATE.root = null;
    }
    STATE = {
        currentItem: null,
        relatedItems: [],
        root: null,
        refs: {
            wrapper: null,
            hero: null,
            infoGrid: null,
            actions: null,
            relatedSection: null,
            epgSection: null
        }
    };
}

/* -------------------------------------------------------------------------
   INTERNAL CONSTANTS (card width used by D‑PAD navigation)
   ------------------------------------------------------------------------- */
const CARD_WIDTH_PX = 210; // must match the CSS width of .detail-related-card

/* -------------------------------------------------------------------------
   END OF FILE – Detail Screen (v38.3)
   ------------------------------------------------------------------------- */
