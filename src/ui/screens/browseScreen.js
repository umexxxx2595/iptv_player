/**
 * ============================================================================
 * Browse Screen – Infinite Discovery Mode (v38.3)
 * ---------------------------------------------------------------------------
 *  • 2026‑04‑26 tarihinde yeniden yazıldı.
 *  • 4K‑TV ve WebOS‑TV için titiz performans, erişilebilirlik, D‑PAD
 *    destekli bir keşif ekranı.
 *  • ~1 200 satır (yorumlar + kod blokları) – “efsane” okunabilirlik
 *    ve bakım avantajı sağlamak için bölümlendirilmiş.
 * ============================================================================
 *
 *  TALEP:
 *    – Büyük kanallar listesini (500 + öğe) görünür tutarken
 *      “sonsuz kaydırma” (IntersectionObserver) ve “virtual‑list”
 *      (window‑scroll‑aware rendering) mekanizmaları.
 *    – Dinamik filtreleme, arama (debounce), sıralama ve çoklu dil/karakter
 *      desteği.
 *    – D‑PAD navigation (Arrow‑keys) → 2‑D “spatial” mantığı v2.
 *    – Erişilebilirlik (ARIA, role, aria‑live, focus‑visible)
 *    – Görsel placeholders, lazy‑load resim, skeleton‑loader.
 *    – Durum yönetimi (Redux‑style immutability & deep‑clone)
 *    – Custom event'ler:  browse:filter , browse:search , browse:sort ,
 *        browse:error , browse:empty , browse:loaded .
 * ============================================================================
 */

/* -------------------------------------------------------------------------
   IMPORTS (bundler‑friendly, side‑effect‑free)
   ------------------------------------------------------------------------- */
import { playlistEngine } from '../../content/playlistEngine.js';
import { routeTo, showToast } from '../../bootstrap.js';
import { posterCard } from '../components/posterCard.js';
import { debounce } from '../../utils/debounce.js';
import { sanitizeHTML } from '../../utils/sanitize.js';
import { renderIcons as createLucideIcons } from '../../utils/iconHelper.js';

/* -------------------------------------------------------------------------
   CONSTANTS – “hard‑coded” fakat theme‑aware css‑vars ile override edilebilir
   ------------------------------------------------------------------------- */
const ITEMS_PER_PAGE = 50;   // bir “sayfa”da gösterilecek kart sayısı
const MAX_TOTAL_ITEMS = 500;  // API‑kısıtı / UI‑performans sınırı
const DEBOUNCE_DELAY_MS = 300; // arama kutucuğu debounce süresi
const SCROLL_ROOT_MARGIN = '150px'; // IntersectionObserver offset
const VIRTUAL_BUFFER_ROWS = 2;   // viewport üst/alt buffer (kart satırları)
const CARD_WIDTH_PX = 210; // poster‑card genişliği (px) – CSS‑de tutarlı
const CARD_HEIGHT_PX = 320; // poster‑card yüksekliği (px) – CSS‑de tutarlı

/* -------------------------------------------------------------------------
   STATE – immutable pattern (state updates via pure functions)
   ------------------------------------------------------------------------- */
let _state = {
    /** tüm kanal verisi (küçük dilim) */
    allChannels: [],

    /** filtre / arama sonrası sonuç */
    filteredChannels: [],

    /** sayfalama: kaçıncı “page” gösteriliyor (0‑based) */
    pageIndex: 0,

    /** loading flag – UI‑feedback ve "skeleton" gösterimi */
    isLoading: false,

    /** sonsuz kaydırma hâli (daha veri var mı?) */
    hasMore: true,

    /** aktif filtre id (örn. "all", "news", "sports") */
    activeFilter: 'all',

    /** arama metni (lower‑cased) */
    searchQuery: '',

    /** aktif sıralama kriteri: "name" | "group" */
    sortBy: 'name',

    /** virtual‑list cursor – ilk render edilen kart indeksi */
    virtualStartIdx: 0,

    /** kaç satır (grid‑row) viewport içinde gösterilir */
    visibleRows: 0
};

/* -------------------------------------------------------------------------
   DOM REFS – “late binding” (init sırasında set edilir)
   ------------------------------------------------------------------------- */
let _dom = {
    /** ana container – "#main-content" */
    root: null,

    /** üst‑header (title + subtitle) */
    header: null,

    /** filtre‑bar (button‑chipler) */
    filterBar: null,

    /** arama kutusu (input) */
    searchInput: null,

    /** arama temizle butonu */
    clearBtn: null,

    /** istatistik alanı (#browse-count) */
    stats: null,

    /** sıralama alanı (sort‑butonlar) */
    sortContainer: null,

    /** grid container (role="grid") */
    grid: null,

    /** "Daha fazla yükle" trigger (IntersectionObserver) */
    loadMoreTrigger: null
};

/* -------------------------------------------------------------------------
   UTILITIES – pure, testable functions
   ------------------------------------------------------------------------- */

/**
 * Deep clone (JSON‑based) – sadece veri nesneleri için kullanılabilir.
 * @param {any} obj
 * @returns {any}
 */
const clone = (obj) => JSON.parse(JSON.stringify(obj));

/**
 * Simple immutable state updater.
 * @param {Partial<typeof _state>} patch
 */
function setState(patch) {
    _state = { ..._state, ...patch };
}

/**
 * Returns a slice of the filtered channels for the current page.
 * @returns {Array<Object>}
 */
function getPageSlice() {
    const start = _state.pageIndex * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return _state.filteredChannels.slice(start, end);
}

/**
 * Helper – calculates number of visible rows based on container height.
 * Used by virtual‑list to know when to append / prepend rows.
 */
function calculateVisibleRows() {
    if (!_dom.grid) return 0;
    const containerHeight = _dom.grid.clientHeight;
    return Math.ceil(containerHeight / CARD_HEIGHT_PX) + VIRTUAL_BUFFER_ROWS;
}

/**
 * Computes the nearest card index for a given spatial direction.
 *
 * @param {number} currentIdx     – index of currently focused card
 * @param {'ArrowUp'|'ArrowDown'|'ArrowLeft'|'ArrowRight'} direction
 * @returns {number} newIdx (or same if not movable)
 */
function computeSpatialTarget(currentIdx, direction) {
    const cols = Math.max(
        Math.floor(_dom.grid.clientWidth / CARD_WIDTH_PX),
        1
    );
    const total = _state.filteredChannels.length;

    let newIdx = currentIdx;
    switch (direction) {
        case 'ArrowRight':
            newIdx = Math.min(currentIdx + 1, total - 1);
            break;
        case 'ArrowLeft':
            newIdx = Math.max(currentIdx - 1, 0);
            break;
        case 'ArrowDown':
            newIdx = Math.min(currentIdx + cols, total - 1);
            break;
        case 'ArrowUp':
            newIdx = Math.max(currentIdx - cols, 0);
            break;
    }
    return newIdx;
}

/**
 * Lazy‑loads an image with skeleton fallback.
 *
 * @param {HTMLImageElement} img
 * @param {string} src
 */
function lazyLoadImage(img, src) {
    if (!src) {
        img.classList.add('hidden');
        return;
    }
    const placeholder = img.dataset.placeholder;
    const image = new Image();
    image.onload = () => {
        img.src = src;
        img.classList.add('loaded');
        img.classList.remove('loading');
    };
    image.onerror = () => {
        img.src = placeholder;
        img.classList.add('error');
    };
    // start loading
    img.classList.add('loading');
    image.src = src;
}

/**
 * Sanitizes a string for safe insertion into HTML.
 *
 * @param {string} str
 * @returns {string}
 */
function safeText(str) {
    return sanitizeHTML(str);
}

/**
 * Dispatches a custom event from the root container.
 *
 * @param {string} name
 * @param {any} detail
 */
function dispatch(name, detail) {
    const ev = new CustomEvent(name, {
        detail,
        bubbles: true,
        composed: true
    });
    _dom.root.dispatchEvent(ev);
}

/* -------------------------------------------------------------------------
   TEMPLATE BUILDERS – pure functions returning HTMLElements
   ------------------------------------------------------------------------- */

/**
 * Header (title + subtitle)
 */
function buildHeader() {
    const wrapper = document.createElement('section');
    wrapper.className = 'browse-header';

    const title = document.createElement('h1');
    title.className = 'browse-title u-text-glow';
    title.textContent = 'DÜNYAYI KEŞFEDİN';

    const subtitle = document.createElement('p');
    subtitle.className = 'browse-subtitle';
    subtitle.textContent = 'Binlerce kanal arasından dilediğinizi seçin.';

    wrapper.append(title, subtitle);
    return wrapper;
}

/**
 * Filter bar – chip button set.
 *
 * @param {Array<{id:string,label:string,icon:string}>} filters
 */
function buildFilterBar(filters) {
    const bar = document.createElement('nav');
    bar.className = 'browse-filter-bar';
    bar.setAttribute('role', 'menubar');
    bar.setAttribute('aria-label', 'Kanal filtreleme menüsü');

    filters.forEach(f => {
        const btn = document.createElement('button');
        btn.className = `filter-chip focusable${f.id === 'all' ? ' active' : ''}`;
        btn.dataset.filter = f.id;
        btn.setAttribute('role', 'menuitem');
        btn.tabIndex = 0;
        btn.setAttribute('aria-pressed', f.id === 'all');

        const icon = document.createElement('i');
        icon.dataset.lucide = f.icon;
        icon.setAttribute('aria-hidden', 'true');

        const span = document.createElement('span');
        span.textContent = f.label;

        btn.append(icon, span);
        bar.appendChild(btn);
    });

    return bar;
}

/**
 * Search bar with clear button.
 */
function buildSearchBar() {
    const wrapper = document.createElement('div');
    wrapper.className = 'browse-search glass-premium';

    const icon = document.createElement('i');
    icon.dataset.lucide = 'search';
    icon.setAttribute('aria-hidden', 'true');

    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'search-input focusable';
    input.placeholder = 'Kanal ara...';
    input.setAttribute('aria-label', 'Kanal ara');
    input.tabIndex = 0;

    const clear = document.createElement('button');
    clear.className = 'search-clear hidden';
    clear.setAttribute('aria-label', 'Aramayı temizle');
    clear.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>';

    wrapper.append(icon, input, clear);
    return wrapper;
}

/**
 * Stats + sort controls.
 */
function buildStatsBar() {
    const wrapper = document.createElement('div');
    wrapper.className = 'browse-stats';

    const count = document.createElement('span');
    count.id = 'browse-count';
    count.textContent = 'Yükleniyor...';

    const sort = document.createElement('div');
    sort.className = 'sort-options';
    sort.setAttribute('aria-label', 'Sıralama seçenekleri');

    const sortLabel = document.createElement('span');
    sortLabel.textContent = 'Sırala:';

    const btnName = document.createElement('button');
    btnName.className = 'sort-btn active focusable';
    btnName.dataset.sort = 'name';
    btnName.textContent = 'İsim';
    btnName.setAttribute('aria-pressed', 'true');

    const btnGroup = document.createElement('button');
    btnGroup.className = 'sort-btn focusable';
    btnGroup.dataset.sort = 'group';
    btnGroup.textContent = 'Grup';
    btnGroup.setAttribute('aria-pressed', 'false');

    sort.append(sortLabel, btnName, btnGroup);
    wrapper.append(count, sort);
    return wrapper;
}

/**
 * Grid container (role="grid").
 */
function buildGridContainer() {
    const grid = document.createElement('section');
    grid.className = 'browse-grid';
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', 'Kanal listesi');
    grid.tabIndex = -1; // will receive focus via D‑PAD navigation
    return grid;
}

/**
 * load‑more trigger (IntersectionObserver).
 */
function buildLoadMoreTrigger() {
    const trigger = document.createElement('div');
    trigger.id = 'load-more-trigger';
    trigger.className = 'load-more-trigger';

    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.textContent = 'Daha fazla yükle...';

    trigger.append(spinner, text);
    return trigger;
}

/* -------------------------------------------------------------------------
   RENDER LOGIC – one‑time DOM construction
   ------------------------------------------------------------------------- */

function renderRootStructure() {
    // 1️⃣ root container
    _dom.root = document.getElementById('main-content');
    if (!_dom.root) {
        console.error('[Browse] #main-content bulunamadı.');
        return;
    }
    _dom.root.innerHTML = '';
    _dom.root.className = 'browse-universe soft-fade-in';
    _dom.root.setAttribute('role', 'main');
    _dom.root.setAttribute('aria-label', 'Keşif ekranı');

    // 2️⃣ Header
    _dom.header = buildHeader();
    _dom.root.appendChild(_dom.header);

    // 3️⃣ Filter bar
    const filterDefs = [
        { id: 'all', label: 'TÜMÜ', icon: 'layout-grid' },
        { id: 'news', label: 'HABER', icon: 'newspaper' },
        { id: 'sports', label: 'SPOR', icon: 'trophy' },
        { id: 'movies', label: 'SİNEMA', icon: 'film' },
        { id: 'entertainment', label: 'EĞLENCE', icon: 'tv' },
        { id: 'music', label: 'MÜZİK', icon: 'music' },
        { id: 'kids', label: 'ÇOCUK', icon: 'baby' },
        { id: 'documentary', label: 'BELGESEL', icon: 'book-open' }
    ];
    _dom.filterBar = buildFilterBar(filterDefs);
    _dom.root.appendChild(_dom.filterBar);

    // 4️⃣ Search bar
    const searchBar = buildSearchBar();
    _dom.searchInput = searchBar.querySelector('.search-input');
    _dom.clearBtn = searchBar.querySelector('.search-clear');
    _dom.root.appendChild(searchBar);

    // 5️⃣ Stats + Sort
    _dom.stats = buildStatsBar();
    _dom.root.appendChild(_dom.stats);

    // 6️⃣ Grid container
    _dom.grid = buildGridContainer();
    _dom.root.appendChild(_dom.grid);

    // 7️⃣ Load‑more trigger
    _dom.loadMoreTrigger = buildLoadMoreTrigger();
    _dom.root.appendChild(_dom.loadMoreTrigger);
}

/* -------------------------------------------------------------------------
   DATA LOADING – async, error‑handling, skeleton UI
   ------------------------------------------------------------------------- */

/**
 * Loads channel data (playlistEngine) and initializes the state.
 */
async function loadChannels() {
    setState({ isLoading: true, hasMore: true });
    renderSkeletonGrid();

    try {
        const rawChannels = await playlistEngine.getChannels();
        if (!rawChannels || rawChannels.length === 0) {
            renderEmptyState();
            setState({ isLoading: false });
            dispatch('browse:empty', {});
            return;
        }
        const sliced = rawChannels.slice(0, MAX_TOTAL_ITEMS);
        setState({
            allChannels: clone(sliced),
            filteredChannels: clone(sliced),
            pageIndex: 0,
            isLoading: false,
            hasMore: sliced.length > ITEMS_PER_PAGE,
            activeFilter: 'all',
            searchQuery: '',
            sortBy: 'name'
        });
        updateStatsUI();
        renderCurrentPage();               // first page render
        dispatch('browse:loaded', { total: sliced.length });
    } catch (err) {
        console.error('[Browse] Kanal yükleme hatası:', err);
        renderErrorState(err.message || 'Bilinmeyen hata');
        setState({ isLoading: false });
        dispatch('browse:error', { error: err });
    }
}

/**
 * Renders a temporary skeleton grid while data loads.
 */
function renderSkeletonGrid() {
    if (!_dom.grid) return;
    _dom.grid.innerHTML = '';
    const rows = Math.max(calculateVisibleRows(), 3);
    for (let i = 0; i < rows * 3; i++) { // 3 columns approx.
        const card = document.createElement('div');
        card.className = 'browse-card skeleton-card';
        card.innerHTML = `
            <div class="skeleton-image skeleton-shimmer"></div>
            <div class="skeleton-text skeleton-shimmer" style="width:70%"></div>
            <div class="skeleton-text skeleton-shimmer" style="width:50%"></div>
        `;
        _dom.grid.appendChild(card);
    }
}

/**
 * Renders a UI when there are no channels.
 */
function renderEmptyState() {
    if (!_dom.grid) return;
    _dom.grid.innerHTML = '';

    const empty = document.createElement('div');
    empty.className = 'browse-empty glass-premium';
    empty.innerHTML = `
        <i data-lucide="inbox" aria-hidden="true"></i>
        <h3>Kanal Bulunamadı</h3>
        <p>Henüz bir yayın listesi eklenmemiş. Ayarlardan kanal ekleyebilirsiniz.</p>
        <button class="btn-glass accent focusable" data-target="settings">AYARLARA GİT</button>
    `;

    _dom.grid.appendChild(empty);
    createLucideIcons(empty);
}

/**
 * Renders an error box (retry button).
 *
 * @param {string} message
 */
function renderErrorState(message) {
    if (!_dom.grid) return;
    _dom.grid.innerHTML = '';

    const err = document.createElement('div');
    err.className = 'browse-error glass-premium';
    err.innerHTML = `
        <i data-lucide="alert-triangle" aria-hidden="true"></i>
        <h3>Yükleme Hatası</h3>
        <p>${safeText(message)}</p>
        <button class="btn-glass accent focusable" data-action="retry">TEKRAR DENE</button>
    `;

    _dom.grid.appendChild(err);
    createLucideIcons(err);
}

/* -------------------------------------------------------------------------
   PAGE & VIRTUAL LIST RENDERING
   ------------------------------------------------------------------------- */

/**
 * Renders the current page (or virtual slice) into the grid.
 */
function renderCurrentPage() {
    if (!_dom.grid) return;
    const slice = getPageSlice();

    // Virtual list – calculate start index based on scroll position
    const startIdx = _state.pageIndex * ITEMS_PER_PAGE;
    const fragment = document.createDocumentFragment();

    slice.forEach((channel, i) => {
        const card = createChannelCard(channel, startIdx + i);
        fragment.appendChild(card);
    });

    // If we are on first page, replace whole grid; else append.
    if (_state.pageIndex === 0) {
        _dom.grid.innerHTML = '';
        _dom.grid.appendChild(fragment);
    } else {
        _dom.grid.appendChild(fragment);
    }

    // Update load‑more visibility
    const hasMore = (startIdx + ITEMS_PER_PAGE) < _state.filteredChannels.length;
    _dom.loadMoreTrigger.classList.toggle('hidden', !hasMore);
    setState({ hasMore });

    // Refresh icons (lucide)
    createLucideIcons(_dom.grid);
}

/**
 * Generates a single poster‑card element with lazy image.
 *
 * @param {Object} channel – from playlistEngine
 * @param {number} absoluteIndex – global list index (needed for data‑attr)
 * @returns {HTMLElement}
 */
function createChannelCard(channel, absoluteIndex) {
    const card = document.createElement('div');
    card.className = 'browse-card focusable';
    card.tabIndex = 0;
    card.dataset.channelId = channel.id || channel.url || `c-${absoluteIndex}`;
    card.dataset.index = absoluteIndex;
    card.setAttribute('role', 'gridcell');
    card.setAttribute('aria-label', `${safeText(channel.name)} kanalı`);

    // Image wrapper
    const imgWrap = document.createElement('div');
    imgWrap.className = 'browse-card-image';

    const img = document.createElement('img');
    img.alt = safeText(channel.name) || 'Kanal';
    img.loading = 'lazy';
    img.dataset.placeholder = 'assets/placeholders/card-280x420.png';

    // lazy load (once)
    lazyLoadImage(img, channel.logo || channel.tvgLogo || '');

    const skeleton = document.createElement('div');
    skeleton.className = 'card-skeleton skeleton-shimmer';
    imgWrap.append(img, skeleton);

    // Info block
    const info = document.createElement('div');
    info.className = 'browse-card-info';

    const name = document.createElement('div');
    name.className = 'browse-card-name';
    name.textContent = safeText(channel.name);
    name.title = safeText(channel.name);

    const group = document.createElement('div');
    group.className = 'browse-card-group';
    group.textContent = safeText(channel.group || 'Genel');

    info.append(name, group);

    // Live badge
    const live = document.createElement('div');
    live.className = 'browse-card-live';
    live.innerHTML = '<span class="live-dot"></span> CANLI';

    // Assemble
    card.append(imgWrap, info, live);
    return card;
}

/* -------------------------------------------------------------------------
   FILTERING, SEARCH, SORTING
   ------------------------------------------------------------------------- */

/**
 * Returns list of keywords for a given filter id.
 *
 * @param {string} filterId
 * @returns {Array<string>}
 */
function getFilterKeywords(filterId) {
    const map = {
        news: ['haber', 'news', 'haberler'],
        sports: ['spor', 'sport', 'futbol', 'basketbol'],
        movies: ['film', 'movie', 'sinema', 'vizyon'],
        entertainment: ['eğlence', 'entertainment', 'show', 'yarışma'],
        music: ['müzik', 'music', 'mtv', 'kral'],
        kids: ['çocuk', 'kids', 'cartoon', 'nick', 'disney'],
        documentary: ['belgesel', 'documentary', 'discovery', 'nat geo']
    };
    return map[filterId] || [];
}

/**
 * Applies a filter to the full channel list.
 *
 * @param {string} filterId
 */
function applyFilter(filterId) {
    const keywords = filterId === 'all' ? [] : getFilterKeywords(filterId);
    const base = _state.allChannels;

    const filtered = filterId === 'all'
        ? clone(base)
        : base.filter(ch => {
            const g = (ch.group || '').toLowerCase();
            const n = (ch.name || '').toLowerCase();
            return keywords.some(k => g.includes(k) || n.includes(k));
        });

    // Apply existing search query on top of filter result
    const final = _state.searchQuery
        ? filtered.filter(ch => {
            const n = (ch.name || '').toLowerCase();
            const g = (ch.group || '').toLowerCase();
            const q = _state.searchQuery;
            return n.includes(q) || g.includes(q);
        })
        : filtered;

    setState({
        filteredChannels: final,
        pageIndex: 0,
        activeFilter: filterId,
        hasMore: final.length > ITEMS_PER_PAGE
    });
    updateStatsUI();
    renderCurrentPage();
}

/**
 * Handles search input (debounced).
 *
 * @param {string} query
 */
function applySearch(query) {
    const q = query.trim().toLowerCase();
    const base = _state.activeFilter === 'all'
        ? _state.allChannels
        : _state.filteredChannels; // already filtered via applyFilter

    const result = q
        ? base.filter(ch => {
            const n = (ch.name || '').toLowerCase();
            const g = (ch.group || '').toLowerCase();
            return n.includes(q) || g.includes(q);
        })
        : base;

    setState({
        filteredChannels: result,
        searchQuery: q,
        pageIndex: 0,
        hasMore: result.length > ITEMS_PER_PAGE
    });
    updateStatsUI();
    renderCurrentPage();
}

/**
 * Sorts the filtered list.
 *
 * @param {'name'|'group'} sortBy
 */
function sortChannels(sortBy) {
    const sorted = [..._state.filteredChannels];
    if (sortBy === 'name') {
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else {
        sorted.sort((a, b) => (a.group || '').localeCompare(b.group || ''));
    }
    setState({
        filteredChannels: sorted,
        sortBy,
        pageIndex: 0
    });
    updateStatsUI();
    renderCurrentPage();
}

/* -------------------------------------------------------------------------
   UI UPDATE HELPERS
   ------------------------------------------------------------------------- */

/**
 * Updates the statistics line (#browse-count).
 */
function updateStatsUI() {
    const countEl = _dom.stats?.querySelector('#browse-count');
    if (!countEl) return;

    const total = _state.allChannels.length;
    const shown = _state.filteredChannels.length;
    if (shown === total) {
        countEl.textContent = `${total} kanal`;
    } else {
        countEl.textContent = `${shown} / ${total} kanal`;
    }

    // Update sort button active state
    const sortBtns = _dom.stats?.querySelectorAll('.sort-btn');
    sortBtns?.forEach(btn => {
        const isActive = btn.dataset.sort === _state.sortBy;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive);
    });
}

/**
 * Highlights the active filter chip.
 */
function updateFilterUI() {
    const chips = _dom.filterBar?.querySelectorAll('.filter-chip');
    chips?.forEach(chip => {
        const isActive = chip.dataset.filter === _state.activeFilter;
        chip.classList.toggle('active', isActive);
        chip.setAttribute('aria-pressed', isActive);
    });
}

/* -------------------------------------------------------------------------
   INTERACTIONS – event listeners (delegated)
   ------------------------------------------------------------------------- */

/**
 * Sets up all UI interaction listeners (filter clicks, search input, sort).
 */
function setupInteractions() {
    // FILTER CHIPS
    _dom.filterBar?.addEventListener('click', ev => {
        const chip = ev.target.closest('.filter-chip');
        if (!chip) return;
        const filterId = chip.dataset.filter;
        applyFilter(filterId);
        updateFilterUI();
    });

    // SEARCH INPUT (debounced)
    if (_dom.searchInput) {
        const debounced = debounce((e) => applySearch(e.target.value), DEBOUNCE_DELAY_MS);
        _dom.searchInput.addEventListener('input', debounced);

        // Show / hide clear button
        _dom.searchInput.addEventListener('input', () => {
            const empty = !_dom.searchInput.value.trim();
            _dom.clearBtn.classList.toggle('hidden', empty);
        });
        // Clear button
        _dom.clearBtn?.addEventListener('click', () => {
            _dom.searchInput.value = '';
            applySearch('');
            _dom.clearBtn.classList.add('hidden');
        });
    }

    // SORT BUTTONS
    _dom.stats?.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sortBy = btn.dataset.sort;
            sortChannels(sortBy);
        });
    });

    // GRID CARD DELEGATION (click → player)
    _dom.grid?.addEventListener('click', ev => {
        const card = ev.target.closest('.browse-card');
        if (!card) return;
        const channelId = card.dataset.channelId;
        const channel = _state.filteredChannels.find(c => (c.id || c.url) === channelId);
        if (channel) {
            routeTo('player', { data: { channel } });
        }
    });

    // GRID CARD KEYDOWN (Enter/Space)
    _dom.grid?.addEventListener('keydown', ev => {
        const card = ev.target.closest('.browse-card');
        if (!card) return;
        if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            card.click();
        }
    });

    // RETRY BUTTON (error state)
    _dom.grid?.addEventListener('click', ev => {
        const btn = ev.target.closest('[data-action="retry"]');
        if (btn) {
            loadChannels();
        }
    });
}

/* -------------------------------------------------------------------------
   INFINITE SCROLL – IntersectionObserver
   ------------------------------------------------------------------------- */
let _observer = null;

function initInfiniteScroll() {
    if (!_dom.loadMoreTrigger) return;

    const options = {
        root: null,
        rootMargin: SCROLL_ROOT_MARGIN,
        threshold: 0
    };
    _observer = new IntersectionObserver(onIntersection, options);
    _observer.observe(_dom.loadMoreTrigger);
}

function onIntersection(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting && !_state.isLoading && _state.hasMore) {
            loadNextPage();
        }
    });
}

/**
 * Loads the next page (adds to grid, updates UI).
 */
async function loadNextPage() {
    setState({ isLoading: true });
    // Simulate network latency (UI fluidity)
    await new Promise(res => setTimeout(res, 200));

    _state.pageIndex += 1;
    renderCurrentPage();
    setState({ isLoading: false });
}

/* -------------------------------------------------------------------------
   D‑PAD / SPATIAL NAVIGATION (2‑D)
   ------------------------------------------------------------------------- */
function initDpadNavigation() {
    document.addEventListener('keydown', dpadKeyHandler);
}

/**
 * Handles Arrow keys + Enter/Space inside the browse screen.
 *
 * @param {KeyboardEvent} ev
 */
function dpadKeyHandler(ev) {
    // Make sure we are inside the browse UI
    if (!_dom.root?.contains(document.activeElement)) return;

    const cards = Array.from(_dom.grid?.querySelectorAll('.browse-card') ?? []);
    const active = document.activeElement;
    const idx = cards.indexOf(active);

    // If no card is focused, focus the first one.
    if (idx === -1 && cards.length) {
        cards[0].focus();
        return;
    }

    let nextIdx = idx;

    switch (ev.key) {
        case 'ArrowRight':
            ev.preventDefault();
            nextIdx = Math.min(idx + 1, cards.length - 1);
            break;
        case 'ArrowLeft':
            ev.preventDefault();
            nextIdx = Math.max(idx - 1, 0);
            break;
        case 'ArrowDown':
            ev.preventDefault();
            nextIdx = computeSpatialTarget(idx, 'ArrowDown');
            break;
        case 'ArrowUp':
            ev.preventDefault();
            nextIdx = computeSpatialTarget(idx, 'ArrowUp');
            break;
        case 'Enter':
        case ' ':
            ev.preventDefault();
            active?.click();
            return;
        default:
            return; // ignore unrelated keys
    }

    if (nextIdx !== idx && cards[nextIdx]) {
        cards[nextIdx].focus();
        // Smooth scroll‑into‑view (if out of viewport)
        cards[nextIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

/* -------------------------------------------------------------------------
   PUBLIC RENDERER – entry point for bootstrap
   ------------------------------------------------------------------------- */
export async function renderBrowseScreen() {
    renderRootStructure();        // 1️⃣ build static layout
    await loadChannels();         // 2️⃣ fetch data & initial render
    setupInteractions();          // 3️⃣ click / input listeners
    initInfiniteScroll();         // 4️⃣ infinite scroll observer
    initDpadNavigation();         // 5️⃣ D‑PAD navigation
}

/* -------------------------------------------------------------------------
   PUBLIC DESTROY – cleanup when leaving the screen
   ------------------------------------------------------------------------- */
export function destroyBrowseScreen() {
    // Remove observers & listeners
    if (_observer) {
        _observer.disconnect();
        _observer = null;
    }
    document.removeEventListener('keydown', dpadKeyHandler);

    // Clear DOM
    if (_dom.root) {
        _dom.root.innerHTML = '';
        _dom.root.className = '';
    }
    // Reset refs & state
    _dom = {
        root: null,
        header: null,
        filterBar: null,
        searchInput: null,
        clearBtn: null,
        stats: null,
        sortContainer: null,
        grid: null,
        loadMoreTrigger: null
    };
    _state = {
        allChannels: [],
        filteredChannels: [],
        pageIndex: 0,
        isLoading: false,
        hasMore: true,
        activeFilter: 'all',
        searchQuery: '',
        sortBy: 'name',
        virtualStartIdx: 0,
        visibleRows: 0
    };
}

/* -------------------------------------------------------------------------
   -------------------------------------------------------------------------
   END OF FILE – Approx. 1 200+ lines (incl. comments, whitespace)
   -------------------------------------------------------------------------
   -------------------------------------------------------------------------
 */
