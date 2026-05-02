import playlistEngine from '../../content/playlistEngine.js';
import { routeTo } from '../../bootstrap.js';
import { getFavorites } from '../../utils/favoritesStore.js';

let openingPlayer = false;

/* -------------------------------------------------------------------------
   ASSET CONFIGURATION & PROTOCOL RESOLUTION
   ------------------------------------------------------------------------- */
const isFileProtocol = window.location.protocol === 'file:';

/**
 * Resolves asset URLs based on the current environment (file:// vs http://)
 * Standardizes on ./public/ path for webOS production builds.
 */
function assetUrl(path) {
    const cleanPath = String(path || '').replace(/^\/+/, '');
    
    if (isFileProtocol) {
        // webOS production package structure
        return `./public/${cleanPath}`;
    }

    // Dev server (Vite) /assets points to public/assets
    return `/${cleanPath}`;
}

const FALLBACK_IMAGES = {
    sport: assetUrl('assets/placeholders/sport-card.webp'),
    movie: assetUrl('assets/placeholders/movie-card.webp'),
    series: assetUrl('assets/placeholders/series-card.webp'),
    documentary: assetUrl('assets/placeholders/info-card.webp'),
    kids: assetUrl('assets/placeholders/info-card.webp'),
    news: assetUrl('assets/placeholders/info-card.webp'),
    default: assetUrl('assets/placeholders/channel-default.webp')
};

function getChannelFallbackLogo(channel = {}) {
    const type = resolveChannelVisualType(channel);
    return FALLBACK_IMAGES[type] || FALLBACK_IMAGES.default;
}

/**
 * Formats channel count for TV UI (e.g., 1500 -> 1K+, 850 -> 850)
 */
function formatChannelCount(count) {
    if (count >= 1000) return `${Math.floor(count / 1000)}K+`;
    return String(count);
}

/**
 * Local helper to refresh Lucide icons without external dependency errors.
 */
function refreshLucideIcons() {
    if (window.lucide?.createIcons) {
        window.lucide.createIcons({
            attrs: { 'stroke-width': 1.5 },
            nameAttr: 'data-lucide'
        });
    }
}

export async function renderHomeScreen() {
    const root = document.getElementById('main-content');

    if (!root) {
        console.error('[Home] main-content bulunamadı');
        return;
    }

    openingPlayer = false;

    // Reset container classes to avoid layout conflicts
    root.className = '';
    
    // Use an internal wrapper for the screen
    root.innerHTML = `
        <div class="home-screen screen-fade-in">
            <section class="hero-section">
                <div class="hero-content">
                    <div class="system-status">SYSTEM STATUS: OPTIMAL</div>
                    <h1>FONEX SOVEREIGN</h1>
                    <p>
                        Geleceğin IPTV deneyimine hoş geldiniz. Tüm sistemler aktif,
                        kütüphane erişime hazır. En yüksek kalitede yayınlar ve kesintisiz eğlence için sistem hazır.
                    </p>
                    <div class="hero-actions">
                        <button class="hero-btn focusable" data-action="play-first" type="button">
                            <i data-lucide="play"></i>
                            <span>CANLI İZLE</span>
                        </button>
                        <button class="hero-btn focusable" data-route="settings" type="button">
                            <i data-lucide="list-plus"></i>
                            <span>PLAYLIST</span>
                        </button>
                    </div>
                    
                    <div class="hero-stats">
                        <div class="stat-item">
                            <strong id="stat-channels">--</strong>
                            <span>KANAL</span>
                        </div>
                        <div class="stat-item">
                            <strong id="stat-categories">--</strong>
                            <span>KATEGORİ</span>
                        </div>
                        <div class="stat-item">
                            <strong>HIZLI</strong>
                            <span>ZAPPING</span>
                        </div>
                        <div class="stat-item">
                            <strong>TV</strong>
                            <span>READY</span>
                        </div>
                    </div>
                </div>
            </section>

            <section class="home-rows" id="home-rows">
                <div class="home-loading">
                    <div class="spinner-dual"></div>
                    <span>İçerikler hazırlanıyor...</span>
                </div>
            </section>
        </div>
    `;

    await buildHomeRows();
    
    // Inject dynamic hero background
    const hero = root.querySelector('.hero-section');
    if (hero) {
        hero.style.setProperty(
            '--hero-bg-image',
            `url("${assetUrl('assets/backgrounds/hero-default.webp')}")`
        );
    }

    attachHomeListeners(root);
    refreshLucideIcons();

    requestAnimationFrame(() => {
        const first = root.querySelector('.focusable');
        first?.focus?.();
    });
}

async function buildHomeRows() {
    const rowsRoot = document.getElementById('home-rows');
    if (!rowsRoot) return;

    rowsRoot.innerHTML = '';

    let allChannels = [];

    try {
        allChannels = playlistEngine.getAllChannels?.() || [];
    } catch (error) {
        console.error('[Home] Kanallar alınamadı:', error);
        allChannels = [];
    }

    if (!Array.isArray(allChannels) || !allChannels.length) {
        rowsRoot.innerHTML = `
            <div class="home-empty">
                <h2>İçerik bulunamadı</h2>
                <p>Playlist yüklendi ama kanal listesi okunamadı.</p>
            </div>
        `;
        return;
    }

    const grouped = groupChannelsForHome(allChannels);

    // Update Hero Stats with proper formatting
    const statChannels = document.getElementById('stat-channels');
    const statCategories = document.getElementById('stat-categories');
    if (statChannels) statChannels.textContent = formatChannelCount(allChannels.length);
    if (statCategories) statCategories.textContent = `${grouped.length}+`;

    // 1. Build Favorites Row
    const favorites = getFavorites();
    if (favorites.length > 0) {
        const favRow = buildCategoryRow({ name: 'FAVORİLER', channels: favorites });
        favRow.classList.add('row-favorites');
        rowsRoot.appendChild(favRow);
    }

    // 2. Build Recently Watched Row
    const recent = getRecentlyWatched();
    if (recent.length > 0) {
        const recentRow = buildCategoryRow({ name: 'SON İZLENENLER', channels: recent });
        recentRow.classList.add('row-recently-watched');
        rowsRoot.appendChild(recentRow);
    }

    if (!grouped.length && !recent.length && !favorites.length) {
        rowsRoot.innerHTML = `
            <div class="home-empty">
                <h2>Kategori bulunamadı</h2>
                <p>Kanal listesi var ama kategori gruplaması yapılamadı.</p>
            </div>
        `;
        return;
    }

    // Limit categories for home performance
    grouped.slice(0, 18).forEach((category) => {
        const row = buildCategoryRow(category);
        rowsRoot.appendChild(row);
    });

    refreshLucideIcons();
}

/**
 * Groups channels and normalizes group names for the home view.
 */
function groupChannelsForHome(channels = []) {
    const groups = new Map();

    channels.forEach((channel) => {
        if (!channel || !channel.url) return;

        const rawGroup = channel.group || channel.category || channel.groupTitle || 'Diğer';
        const groupName = normalizeGroupLabel(rawGroup);

        if (!groups.has(groupName)) {
            groups.set(groupName, {
                name: groupName,
                channels: []
            });
        }

        groups.get(groupName).channels.push(channel);
    });

    const preferredOrder = [
        'Discovery',
        'EX-YU SPORT',
        'FRANCE',
        'TR',
        'TIVIBU',
        'BEIN',
        'SPORT',
        'MOVIES',
        'SERIES'
    ];

    const result = Array.from(groups.values())
        .filter(group => group.channels.length)
        .sort((a, b) => {
            const aName = String(a.name).toUpperCase();
            const bName = String(b.name).toUpperCase();

            const aIndex = preferredOrder.findIndex(key => aName.includes(key));
            const bIndex = preferredOrder.findIndex(key => bName.includes(key));

            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;

            return b.channels.length - a.channels.length;
        });

    return result;
}

function buildCategoryRow(category) {
    const row = document.createElement('section');
    row.className = 'content-row';

    const title = category.name || 'Kategori';
    const channels = category.channels || [];

    row.innerHTML = `
        <div class="row-header">
            <h2>${escapeHTML(title)}</h2>
            <span>${channels.length} İÇERİK</span>
        </div>
        <div class="row-scroll-container"></div>
    `;

    const scroller = row.querySelector('.row-scroll-container');

    channels.slice(0, 18).forEach((channel) => {
        scroller.appendChild(buildChannelCard(channel, title));
    });

    return row;
}

/**
 * High-end Channel Card system with robust error handling.
 */
function buildChannelCard(channel, categoryName = '') {
    const visualType = resolveChannelVisualType(channel);
    const logo = normalizeChannelLogo(channel, visualType);
    const fallbackLogo = getChannelFallbackLogo(channel);
    const displayName = cleanChannelName(channel.name || 'Kanal');
    const group = normalizeGroupLabel(channel.group || channel.category || categoryName || 'CANLI');
    const containClass = shouldContainLogo(channel) ? ' logo-contain' : '';

    const card = document.createElement('button');
    card.className = `poster-card poster-card--${visualType} focusable`;
    card.type = 'button';
    card.dataset.action = 'play';
    card.dataset.url = channel.url || '';

    card.innerHTML = `
        <div class="card-media${containClass}">
            <img
                src="${escapeAttribute(logo)}"
                alt="${escapeAttribute(displayName)}"
                loading="lazy"
                data-fallback="${escapeAttribute(fallbackLogo)}"
            />
            <span class="card-badge">${escapeHTML(group)}</span>
        </div>
        <div class="card-info">
            <div class="card-title">${escapeHTML(displayName)}</div>
            <div class="card-subtitle">${getQualityLabel(channel)} • CANLI</div>
        </div>
    `;

    const img = card.querySelector('img');
    
    img.addEventListener('error', () => {
        const fallback = img.dataset.fallback || FALLBACK_IMAGES.default;

        if (img.dataset.fallbackApplied === 'true') {
            img.style.display = 'none';
            card.classList.add('logo-hard-failed');
            return;
        }

        img.dataset.fallbackApplied = 'true';
        img.src = fallback;
        card.classList.add('is-fallback');
        card.classList.remove('has-iptv-logo');
    });

    img.addEventListener('load', () => {
        img.style.display = '';
        card.classList.add('has-image');

        if (img.src.includes('/assets/placeholders/') || img.src.includes('/public/assets/placeholders/')) {
            card.classList.add('is-fallback');
        } else {
            card.classList.add('has-iptv-logo');
        }
    });

    return card;
}

/**
 * Resolves the visual type of the channel (sport, movie, etc.)
 */
function resolveChannelVisualType(channel = {}) {
    const name = String(channel.name || '').toUpperCase();
    const group = String(channel.group || channel.category || '').toUpperCase();
    const combined = `${name} ${group}`;

    if (combined.includes('SPORT') || combined.includes('SPOR') || combined.includes('ARENA') || 
        combined.includes('BEIN') || combined.includes('TIVIBU') || combined.includes('S SPORT')) {
        return 'sport';
    }

    if (combined.includes('MOVIE') || combined.includes('FILM') || combined.includes('CINEMA') || 
        combined.includes('SİNEMA')) {
        return 'movie';
    }

    if (combined.includes('SERIES') || combined.includes('DIZI') || combined.includes('DİZİ') || 
        combined.includes('NETFLIX') || combined.includes('EXXEN')) {
        return 'series';
    }

    if (combined.includes('DISCOVERY') || combined.includes('DOCUMENTARY') || combined.includes('DOCU') || 
        combined.includes('BELGESEL') || combined.includes('SCIENCE') || combined.includes('NAT GEO')) {
        return 'documentary';
    }

    if (combined.includes('KIDS') || combined.includes('ÇOCUK') || combined.includes('COCUK') || 
        combined.includes('CARTOON') || combined.includes('DISNEY')) {
        return 'kids';
    }

    if (combined.includes('NEWS') || combined.includes('HABER') || combined.includes('CNN') || combined.includes('BBC')) {
        return 'news';
    }

    return 'default';
}

/**
 * Determines if a logo should be displayed in 'contain' mode.
 */
function shouldContainLogo(channel = {}) {
    const logo = String(channel.logo || '').toLowerCase();
    const name = String(channel.name || '').toUpperCase();

    if (!logo || logo.includes('/assets/placeholders/')) {
        return false;
    }

    return (
        name.includes('TRT') ||
        name.includes('BEIN') ||
        name.includes('CNN') ||
        name.includes('BBC') ||
        name.includes('TF1') ||
        name.includes('FRANCE') ||
        logo.includes('logo')
    );
}

/**
 * Normalizes channel logo with environment-aware fallbacks.
 */
function normalizeChannelLogo(channel = {}) {
    const logo = String(channel.logo || '').trim();

    if (!logo || logo.length < 8) {
        return getChannelFallbackLogo(channel);
    }

    const lowerLogo = logo.toLowerCase();
    if (
        lowerLogo.includes('placeholder') ||
        lowerLogo.includes('no-logo') ||
        lowerLogo.includes('default') ||
        lowerLogo === 'null' ||
        lowerLogo === 'undefined'
    ) {
        return getChannelFallbackLogo(channel);
    }

    return logo;
}

/**
 * Normalizes group labels for cleaner badges.
 */
function normalizeGroupLabel(group = '') {
    const value = String(group).trim();
    const upper = value.toUpperCase();

    if (upper.includes('EX-YU') && upper.includes('SPORT')) return 'EX-YU SPORT';
    if (upper.includes('BEIN')) return 'BEIN SPORTS';
    if (upper.includes('SPORT') || upper.includes('SPOR')) return 'SPORT';
    if (upper.includes('FRANCE')) return 'FRANCE';
    if (upper.includes('ULUSAL')) return 'TR • ULUSAL';
    if (upper.includes('TR')) return 'TR';
    if (upper.includes('MOVIE') || upper.includes('FILM')) return 'FİLM';
    if (upper.includes('SERIES') || upper.includes('DIZI') || upper.includes('DİZİ')) return 'DİZİ';
    if (upper.includes('DISCOVERY') || upper.includes('BELGESEL')) return 'BELGESEL';
    if (upper.includes('NEWS') || upper.includes('HABER')) return 'HABER';

    return value.length > 16 ? value.slice(0, 16) : value;
}

/**
 * Cleans technical noise from channel names for cleaner UI.
 */
function cleanChannelName(name = '') {
    return String(name)
        .replace(/\s*\|\s*.*/g, '')
        .replace(/\s*\[.*?\]\s*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function attachHomeListeners(root) {
    root.addEventListener('click', async (event) => {
        const target = event.target.closest('[data-action], [data-route]');
        if (!target) return;

        event.preventDefault();
        event.stopPropagation();

        const route = target.dataset.route;
        const action = target.dataset.action;

        if (route) {
            routeTo(route);
            return;
        }

        if (action === 'play-first') {
            const firstChannel = getFirstPlayableChannel();
            if (firstChannel) {
                await openPlayer(firstChannel);
            }
            return;
        }

        if (action === 'play') {
            const url = target.dataset.url;
            const channel = findChannelByUrl(url);

            if (channel) {
                await openPlayer(channel);
            }
        }
    });
}

async function openPlayer(channel) {
    if (openingPlayer) return;
    openingPlayer = true;

    try {
        const channelList = getChannelListFor(channel);
        const currentIndex = Math.max(
            0,
            channelList.findIndex(item => item.url === channel.url)
        );

        saveRecentlyWatched(channel);

        await routeTo('player', {
            data: {
                channel,
                channelList,
                currentIndex
            }
        });
    } catch (error) {
        console.error('[Home] Player açılamadı:', error);
        openingPlayer = false;
    }
}

/**
 * Saves channel to local history (limit 15)
 */
function saveRecentlyWatched(channel) {
    try {
        if (!channel || !channel.url) return;
        const history = getRecentlyWatched();
        
        const filtered = history.filter(item => item.url !== channel.url);
        filtered.unshift(channel);
        const limited = filtered.slice(0, 15);
        
        localStorage.setItem('fonex_recent_watched', JSON.stringify(limited));
    } catch (e) {
        console.error('[Home] History save error:', e);
    }
}

/**
 * Gets history from local storage
 */
function getRecentlyWatched() {
    try {
        const raw = localStorage.getItem('fonex_recent_watched');
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/**
 * Detects quality from channel name
 */
function getQualityLabel(channel = {}) {
    const name = String(channel.name || '').toUpperCase();

    if (name.includes('4K') || name.includes('2160') || name.includes('UHD')) return '4K';
    if (name.includes('1080') || name.includes('FHD') || name.includes('FULL HD')) return 'FHD';
    if (name.includes('720') || name.includes('HD')) return 'HD';

    return 'LIVE';
}

function findChannelByUrl(url) {
    if (!url) return null;

    try {
        if (playlistEngine.findChannelByUrl) {
            const found = playlistEngine.findChannelByUrl(url);
            if (found) return found;
        }

        const allChannels = playlistEngine.getAllChannels?.() || [];
        return allChannels.find(channel => channel.url === url) || null;
    } catch (error) {
        console.error('[Home] Kanal arama hatası:', error);
        return null;
    }
}

function getFirstPlayableChannel() {
    try {
        const allChannels = playlistEngine.getAllChannels?.() || [];
        return allChannels.find(channel => channel?.url) || null;
    } catch {
        return null;
    }
}

function getChannelListFor(channel) {
    try {
        const allChannels = playlistEngine.getAllChannels?.() || [];
        const group = channel.group || channel.category;

        const sameGroup = allChannels.filter(item => {
            return item.url && (item.group === group || item.category === group);
        });

        return sameGroup.length ? sameGroup : allChannels.filter(item => item.url);
    } catch {
        return [channel];
    }
}

function escapeHTML(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
    return escapeHTML(value);
}
