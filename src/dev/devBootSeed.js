const DEV_BOOT_SEED_ENABLED = true;

const DEV_M3U_URL =
    'http://beyaz29.shop:80/get.php?username=Ea0602&password=UMFGZyz9&type=m3u_plus';

const STORAGE_URL_KEY = 'fonex_playlist_url';
const SETTINGS_KEY = 'fonex_settings_v2';

async function fetchM3UText(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
        console.info('[DevBootSeed] Fetching demo M3U from:', url);

        const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal
        });

        console.info('[DevBootSeed] Fetch HTTP Status:', response.status, response.statusText);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();

        console.info('[DevBootSeed] Fetched text length:', text.length);
        console.info('[DevBootSeed] Fetched text preview:', text.slice(0, 80));

        if (!text || text.indexOf('#EXTM3U') === -1) {
            throw new Error('Fetched content is not valid M3U');
        }

        return text;
    } finally {
        clearTimeout(timeout);
    }
}

function seedSettings(url) {
    try {
        const current = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');

        localStorage.setItem(
            SETTINGS_KEY,
            JSON.stringify({
                ...current,
                playlistUrl: url,
                m3uUrl: url,
                playlist: url,
                devSeedEnabled: true,
                devSeedMode: 'memory-only',
                devSeedUpdatedAt: new Date().toISOString()
            })
        );

        localStorage.setItem(STORAGE_URL_KEY, url);
    } catch (error) {
        console.warn('[DevBootSeed] Settings seed failed:', error);
    }
}

function clearVolatileStorage() {
    try {
        sessionStorage.clear();

        [
            'fonex_playback_strategies',
            'fonex_recent_watched',
            'fonex_playlist_cache',
            'fonex_channels_cache',
            'fonex_categories_cache',
            'fonex_last_playlist_hash'
        ].forEach((key) => {
            localStorage.removeItem(key);
        });

        // Important:
        // Do not depend on fonex_playlist_m3u for large files.
        // It may exceed localStorage quota.
        localStorage.removeItem('fonex_playlist_m3u');
    } catch (error) {
        console.warn('[DevBootSeed] Volatile cleanup failed:', error);
    }
}

export async function runDevBootSeed() {
    if (!DEV_BOOT_SEED_ENABLED) return false;

    console.warn('[DevBootSeed] Enabled. Seeding demo playlist in memory.');

    clearVolatileStorage();
    seedSettings(DEV_M3U_URL);

    try {
        const m3uText = await fetchM3UText(DEV_M3U_URL);

        const module = await import('../content/playlistEngine.js');
        const playlistEngine = module.default || module.playlistEngine;

        if (!playlistEngine) {
            throw new Error('playlistEngine import failed');
        }

        playlistEngine.clear();

        const ok = playlistEngine.loadPlaylist(m3uText);
        const count = playlistEngine.getAllChannels
            ? playlistEngine.getAllChannels().length
            : 0;

        console.info('[DevBootSeed] Playlist loaded in memory:', {
            ok,
            channelCount: count,
            textLength: m3uText.length
        });

        if (!ok || count <= 0) {
            throw new Error(`Playlist parsed but channel count is ${count}`);
        }

        return true;
    } catch (error) {
        console.error('[DevBootSeed] M3U fetch/load failed:', {
            message: error && error.message,
            error
        });

        return false;
    }
}


