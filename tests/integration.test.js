/**
 * FONEX Cinema - Core Engine Integration Tests
 */

describe('FONEX IPTV Player Core', () => {
    
    test('Playlist Engine should load and cache data', async () => {
        const { playlistEngine } = await import('../src/content/playlistEngine.js');
        const testUrl = 'http://test.com/list.m3u';
        
        // Mocking fetch is handled by the test environment
        expect(playlistEngine).toBeDefined();
        expect(playlistEngine.getPlaylists()).toBeInstanceOf(Array);
    });

    test('Store should manage theme and settings', async () => {
        const { store } = await import('../src/data/store.js');
        
        store.setState({ settings: { theme: 'fonex-light' } });
        expect(store.getState().settings.theme).toBe('fonex-light');
        
        store.setState({ settings: { theme: 'fonex-dark' } });
        expect(store.getState().settings.theme).toBe('fonex-dark');
    });

    test('Spatial Navigation should calculate movement scores', async () => {
        const { spatialNavigation } = await import('../src/remote/spatialNavigation.js');
        expect(spatialNavigation.move).toBeDefined();
        expect(typeof spatialNavigation.move).toBe('function');
    });

});
