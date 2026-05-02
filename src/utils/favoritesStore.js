const FAVORITES_KEY = 'fonex_favorites_v1';
const MAX_FAVORITES = 300;

export function getChannelKey(channel = {}) {
    return String(channel.url || channel.id || channel.name || '').trim();
}

export function getFavorites() {
    try {
        const raw = localStorage.getItem(FAVORITES_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function saveFavorites(list = []) {
    try {
        const clean = Array.isArray(list) ? list.slice(0, MAX_FAVORITES) : [];
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(clean));
        window.dispatchEvent(new CustomEvent('fonex:favorites:changed', {
            detail: { count: clean.length }
        }));
        return true;
    } catch (error) {
        console.warn('[FavoritesStore] Favoriler kaydedilemedi:', error);
        return false;
    }
}

export function isFavorite(channel = {}) {
    const key = getChannelKey(channel);
    if (!key) return false;

    return getFavorites().some(item => getChannelKey(item) === key);
}

export function addFavorite(channel = {}) {
    const key = getChannelKey(channel);
    if (!key) return false;

    const current = getFavorites();

    if (current.some(item => getChannelKey(item) === key)) {
        return false;
    }

    const item = {
        id: channel.id || '',
        name: channel.name || 'Kanal',
        url: channel.url || '',
        logo: channel.logo || '',
        group: channel.group || channel.category || '',
        category: channel.category || channel.group || '',
        description: channel.description || '',
        mode: channel.mode || 'live'
    };

    saveFavorites([item, ...current]);
    return true;
}

export function removeFavorite(channel = {}) {
    const key = getChannelKey(channel);
    if (!key) return false;

    const current = getFavorites();
    const next = current.filter(item => getChannelKey(item) !== key);

    if (next.length === current.length) {
        return false;
    }

    saveFavorites(next);
    return true;
}

export function toggleFavorite(channel = {}) {
    if (isFavorite(channel)) {
        removeFavorite(channel);
        return false;
    }

    addFavorite(channel);
    return true;
}
