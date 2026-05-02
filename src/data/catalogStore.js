import { AppConfig, saveSettings } from '../app.js';
import { getFavorites } from '../utils/favoritesStore.js';
import { cleanChannelName, normalizeChannelName, truncate } from '../utils/textUtils.js';
import { parseM3UText, inferChannelMode } from '../utils/m3uParser.js';

const PLAYLIST_STATE_KEY = 'fonex_playlist_state_v3';
const RECENT_LIMIT = 18;

const DEMO_ITEMS = Object.freeze([
    {
        id: 'trt1-hd',
        name: 'TRT 1 HD',
        logo: '',
        group: 'Ulusal',
        category: 'Ulusal',
        description: 'Canli yayin akisi icin ornek kanal',
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        mode: 'live'
    },
    {
        id: 'fonex-sport',
        name: 'Fonex Sport',
        logo: '',
        group: 'Spor',
        category: 'Spor',
        description: 'Spor yayinlari ve canli etkinlikler',
        url: 'https://test-streams.mux.dev/test_001/stream.m3u8',
        mode: 'live'
    },
    {
        id: 'news-global',
        name: 'News Global',
        logo: '',
        group: 'Haber',
        category: 'Haber',
        description: 'Guncel haberler ve analiz programlari',
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        mode: 'live'
    },
    {
        id: 'kuzey-hatti',
        name: 'Kuzey Hatti',
        logo: '',
        group: 'Film',
        category: 'Aksiyon',
        description: 'Yuksek tempolu aksiyon filmi secimi',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        mode: 'movies'
    },
    {
        id: 'derin-gece',
        name: 'Derin Gece',
        logo: '',
        group: 'Film',
        category: 'Gerilim',
        description: 'Gerilim kutuphanesinden one cikan baslik',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        mode: 'movies'
    },
    {
        id: 'gizli-kent',
        name: 'Gizli Kent',
        logo: '',
        group: 'Film',
        category: 'Bilim Kurgu',
        description: 'Bilim kurgu severler icin ozel secki',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        mode: 'movies'
    },
    {
        id: 'bozkir-dosyasi',
        name: 'Bozkir Dosyasi',
        logo: '',
        group: 'Dizi',
        category: 'Polisiye',
        description: 'Bolum bazli dizi arsivinin guclu acilisi',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        mode: 'series'
    },
    {
        id: 'gece-operasyonu',
        name: 'Gece Operasyonu',
        logo: '',
        group: 'Dizi',
        category: 'Aksiyon',
        description: 'Aksiyon ve operasyon temali dizi kutuphanesi',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
        mode: 'series'
    }
]);

const clone = (value) => JSON.parse(JSON.stringify(value));

const normalizeItem = (item = {}, index = 0) => {
    const name = cleanChannelName(item.name || item.title || `Icerik ${index + 1}`);
    const mode = item.mode || inferChannelMode(item);

    return {
        id: String(item.id || `${mode}-${normalizeChannelName(name)}-${index}`).trim(),
        name,
        logo: item.logo || '',
        group: item.group || item.category || 'General',
        category: item.category || item.group || 'General',
        description: truncate(item.description || `${name} icin hazir kayit`, 90),
        url: item.url || item.streamUrl || '',
        mode
    };
};

const buildDefaultState = () => ({
    sourceType: 'demo',
    sourceLabel: 'Hazir FONEX katalogu',
    sourceUrl: '',
    importedAt: null,
    items: DEMO_ITEMS.map((item, index) => normalizeItem(item, index))
});

const readState = () => {
    try {
        const raw = localStorage.getItem(PLAYLIST_STATE_KEY);
        if (!raw) {
            return buildDefaultState();
        }

        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.items)) {
            return buildDefaultState();
        }

        return {
            sourceType: parsed.sourceType || 'custom',
            sourceLabel: parsed.sourceLabel || 'Ozel liste',
            sourceUrl: parsed.sourceUrl || '',
            importedAt: parsed.importedAt || null,
            items: parsed.items.map((item, index) => normalizeItem(item, index)).filter((item) => item.url)
        };
    } catch (error) {
        console.warn('[CatalogStore] Playlist state okunamadi:', error);
        return buildDefaultState();
    }
};

const writeState = (nextState) => {
    const safeState = {
        sourceType: nextState.sourceType || 'custom',
        sourceLabel: nextState.sourceLabel || 'Ozel liste',
        sourceUrl: nextState.sourceUrl || '',
        importedAt: nextState.importedAt || Date.now(),
        items: Array.isArray(nextState.items)
            ? nextState.items.map((item, index) => normalizeItem(item, index)).filter((item) => item.url)
            : []
    };

    localStorage.setItem(PLAYLIST_STATE_KEY, JSON.stringify(safeState));
    window.dispatchEvent(new CustomEvent('fonex:playlist:changed', {
        detail: {
            count: safeState.items.length,
            sourceType: safeState.sourceType,
            importedAt: safeState.importedAt
        }
    }));

    return safeState;
};

export const getPlaylistState = () => readState();

export const savePlaylistState = ({ items = [], sourceType = 'custom', sourceLabel = 'Ozel liste', sourceUrl = '' }) => {
    return writeState({
        items,
        sourceType,
        sourceLabel,
        sourceUrl,
        importedAt: Date.now()
    });
};

export const saveDemoPlaylist = () => {
    return writeState(buildDefaultState());
};

export const replacePlaylistFromText = (text, sourceLabel = 'Yapistirilan liste') => {
    const items = parseM3UText(text);
    if (items.length === 0) {
        throw new Error('M3U listesi parse edilemedi veya bos geldi.');
    }

    return savePlaylistState({
        items,
        sourceType: 'text',
        sourceLabel
    });
};

export const getAllCatalogItems = () => clone(readState().items);

export const getChannelById = (id = '') => {
    return getAllCatalogItems().find((item) => item.id === id) || null;
};

export const getCatalogByMode = (mode = 'live') => {
    const items = getAllCatalogItems();
    return items.filter((item) => item.mode === mode);
};

export const searchCatalog = (query = '') => {
    const normalizedQuery = normalizeChannelName(query);
    if (!normalizedQuery) {
        return [];
    }

    return getAllCatalogItems().filter((item) => {
        const haystack = normalizeChannelName([
            item.name,
            item.group,
            item.category,
            item.description
        ].join(' '));
        return haystack.includes(normalizedQuery);
    });
};

export const getCategorySummary = (mode = 'live', limit = 6) => {
    const sourceItems = mode === 'all' ? getAllCatalogItems() : getCatalogByMode(mode);
    const counter = new Map();

    sourceItems.forEach((item) => {
        const key = item.category || item.group || 'Genel';
        counter.set(key, (counter.get(key) || 0) + 1);
    });

    return Array.from(counter.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((left, right) => right.count - left.count)
        .slice(0, limit);
};

export const getRecentItems = () => {
    const items = Array.isArray(AppConfig.settings.recentChannels)
        ? AppConfig.settings.recentChannels
        : [];
    return items.filter((item) => item && item.url).slice(0, RECENT_LIMIT);
};

export const addRecentChannel = (channel = {}) => {
    const current = getRecentItems();
    const key = String(channel.id || channel.url || channel.name || '').trim();
    if (!key) {
        return current;
    }

    const item = {
        ...normalizeItem(channel),
        lastWatchedAt: Date.now()
    };

    const next = [item, ...current.filter((entry) => {
        const entryKey = String(entry.id || entry.url || entry.name || '').trim();
        return entryKey !== key;
    })].slice(0, RECENT_LIMIT);

    AppConfig.settings.recentChannels = next;
    saveSettings();
    return next;
};

export const clearRecentChannels = () => {
    AppConfig.settings.recentChannels = [];
    saveSettings();
    return [];
};

export const updatePlaybackSettings = (partial = {}) => {
    const next = {
        ...AppConfig.settings,
        ...partial
    };
    Object.assign(AppConfig.settings, next);
    saveSettings();
    return AppConfig.settings;
};

export const getDashboardModel = () => {
    const playlist = getPlaylistState();
    const allItems = playlist.items;
    const liveItems = allItems.filter((item) => item.mode === 'live');
    const movieItems = allItems.filter((item) => item.mode === 'movies');
    const seriesItems = allItems.filter((item) => item.mode === 'series');
    const favorites = getFavorites();
    const recent = getRecentItems();

    return {
        source: playlist,
        counts: {
            all: allItems.length,
            live: liveItems.length,
            movies: movieItems.length,
            series: seriesItems.length,
            favorites: favorites.length
        },
        highlights: {
            hero: allItems[0] || null,
            recent: recent.slice(0, 4),
            live: liveItems.slice(0, 4),
            movies: movieItems.slice(0, 4),
            series: seriesItems.slice(0, 4)
        },
        categories: getCategorySummary('all', 8)
    };
};
