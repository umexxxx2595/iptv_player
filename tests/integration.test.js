// @vitest-environment jsdom

import { beforeEach, describe, expect, test } from 'vitest';

describe('FONEX IPTV Player Core', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        document.body.innerHTML = `
            <div id="app-shell"></div>
            <nav id="main-sidebar"></nav>
            <main id="main-content"></main>
            <div id="toast-container"></div>
            <div id="player-overlay"></div>
            <div id="error-boundary" hidden></div>
            <p id="error-message"></p>
        `;
    });

    test('App config should persist and restore settings safely', async () => {
        const { AppConfig, saveSettings, loadSettings } = await import('../src/app.js');

        AppConfig.settings.language = 'en';
        saveSettings();

        expect(loadSettings()).toMatchObject({ language: 'en' });
    });

    test('Favorites store should add and remove channels', async () => {
        const { addFavorite, getFavorites, removeFavorite, isFavorite } = await import('../src/utils/favoritesStore.js');
        const channel = { id: 'kanal-d', name: 'Kanal D', url: 'https://example.com/live.m3u8' };

        expect(addFavorite(channel)).toBe(true);
        expect(isFavorite(channel)).toBe(true);
        expect(getFavorites()).toHaveLength(1);

        expect(removeFavorite(channel)).toBe(true);
        expect(getFavorites()).toHaveLength(0);
    });

    test('Favorites should preserve content mode for non-live items', async () => {
        const { addFavorite, getFavorites } = await import('../src/utils/favoritesStore.js');
        const movie = {
            id: 'movie-1',
            name: 'Aksiyon Film',
            url: 'https://example.com/movie.mp4',
            category: 'Film',
            description: 'Ornek aciklama',
            mode: 'movies'
        };

        expect(addFavorite(movie)).toBe(true);
        expect(getFavorites()[0]).toMatchObject({
            id: 'movie-1',
            mode: 'movies',
            description: 'Ornek aciklama'
        });
    });

    test('M3U parser should detect live and movie entries', async () => {
        const { parseM3UText } = await import('../src/utils/m3uParser.js');
        const text = `#EXTM3U
#EXTINF:-1 group-title="Spor",Sports HD
https://example.com/live.m3u8
#EXTINF:-1 group-title="Film",Aksiyon Film
https://example.com/movie.mp4`;

        const items = parseM3UText(text);

        expect(items).toHaveLength(2);
        expect(items[0].mode).toBe('live');
        expect(items[1].mode).toBe('movies');
    });

    test('Catalog store should persist imported playlist state', async () => {
        const { savePlaylistState, getCatalogByMode, getPlaylistState } = await import('../src/data/catalogStore.js');

        savePlaylistState({
            items: [
                { id: 's1', name: 'Series One', url: 'https://example.com/series.m3u8', category: 'Dizi', mode: 'series' }
            ],
            sourceType: 'text',
            sourceLabel: 'Test source'
        });

        expect(getPlaylistState().sourceType).toBe('text');
        expect(getCatalogByMode('series')).toHaveLength(1);
    });

    test('Router should render sidebar and default route', async () => {
        const { initRouter, routerState } = await import('../src/bootstrap.js');

        await initRouter();

        expect(routerState.currentRoute).toBe('home');
        expect(document.querySelectorAll('#main-sidebar .nav-item').length).toBeGreaterThan(0);
        expect(document.getElementById('main-content')?.textContent).toContain('FONEX IPTV');
    });
});
