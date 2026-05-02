/**
 * ============================================================================
 * FONEX IPTV - PLAYLIST ENGINE
 * Version: 2.5.0
 * 
 * 📋 RESPONSIBILITIES:
 *   - Playlist state management (Singleton)
 *   - Category management
 *   - Channel filtering
 *   - In-memory data storage
 * ============================================================================ */

import { parseM3U } from './m3uParser.js';

const PLAYLIST_STORAGE_KEY = 'fonex_playlist_m3u';

class PlaylistEngine {
    constructor() {
        /** @type {Array<Object>} */
        this.channels = [];
        
        /** @type {Set<string>} */
        this.categories = new Set();
        
        /** @type {boolean} */
        this.isLoaded = false;
        
        console.info('[PlaylistEngine] Initialized');
    }

    /**
     * Loads and parses a playlist from raw M3U text
     * @param {string} m3uText - Raw M3U content
     * @returns {boolean} Success status
     */
    loadPlaylist(m3uText) {
        try {
            console.info('[PlaylistEngine] Loading new playlist...');
            
            const parsedChannels = parseM3U(m3uText);
            
            if (!parsedChannels || parsedChannels.length === 0) {
                console.warn('[PlaylistEngine] Parsed playlist is empty');
                return false;
            }

            this.channels = parsedChannels;
            this.updateCategories();
            this.isLoaded = true;
            
            console.info(`[PlaylistEngine] Loaded ${this.channels.length} channels across ${this.categories.size} categories`);
            return true;
        } catch (error) {
            console.error('[PlaylistEngine] Failed to load playlist:', error);
            return false;
        }
    }

    /**
     * Internal: Update the unique categories list from current channels
     */
    updateCategories() {
        this.categories.clear();
        this.channels.forEach(channel => {
            if (channel.category) {
                this.categories.add(channel.category);
            }
        });
    }

    /**
     * Attempts to restore playlist from localStorage
     * @returns {boolean}
     */
    restoreSavedPlaylist() {
        try {
            const saved = localStorage.getItem(PLAYLIST_STORAGE_KEY);

            console.info('[PlaylistEngine] restoreSavedPlaylist:', {
                key: PLAYLIST_STORAGE_KEY,
                hasSaved: Boolean(saved),
                length: saved?.length || 0,
                preview: saved ? saved.slice(0, 20) : ''
            });

            if (!saved || !saved.trim()) return false;

            const ok = this.loadPlaylist(saved);

            console.info('[PlaylistEngine] restoreSavedPlaylist result:', ok);

            return ok;
        } catch (error) {
            console.warn('[PlaylistEngine] Saved playlist restore failed:', error);
            return false;
        }
    }

    /**
     * Returns all loaded channels. Automatically loads sample data if empty.
     * @returns {Array<Object>}
     */
    getAllChannels() {
        if (this.channels.length === 0 && !this.isLoaded) {
            const restored = this.restoreSavedPlaylist();

            if (!restored) {
                console.warn('[PlaylistEngine] No saved playlist found. Returning empty channel list.');
                return [];
            }
        }

        return [...this.channels];
    }

    /**
     * Alias for getAllChannels to support legacy screen calls
     * @returns {Array<Object>}
     */
    getChannels() {
        return this.getAllChannels();
    }

    /**
     * Returns a list of unique categories
     * @returns {Array<string>}
     */
    getCategories() {
        if (this.channels.length === 0 && !this.isLoaded) {
            const restored = this.restoreSavedPlaylist();

            if (!restored) {
                console.warn('[PlaylistEngine] No saved playlist found. Returning empty category list.');
                return ['All'];
            }
        }

        const sortedCategories = Array.from(this.categories).sort();
        return ['All', ...sortedCategories];
    }

    /**
     * Returns channels filtered by category
     * @param {string} category - The category name to filter by
     * @returns {Array<Object>}
     */
    getChannelsByCategory(category) {
        if (!category || category === 'All') {
            return this.getAllChannels();
        }
        
        return this.channels.filter(channel => channel.category === category);
    }

    /**
     * Finds a specific channel object by its URL
     * @param {string} url - The channel stream URL
     * @returns {Object|null}
     */
    findChannelByUrl(url) {
        if (!url) return null;

        const normalizedUrl = String(url).trim();

        return this.getAllChannels().find((channel) => {
            return String(channel.url || '').trim() === normalizedUrl;
        }) || null;
    }

    /**
     * Loads hardcoded sample data for testing/demo purposes
     * @returns {boolean}
     */
    loadSampleData() {
        console.info('[PlaylistEngine] Injecting sample data...');
        const sampleM3U = `
#EXTM3U
#EXTINF:-1 tvg-id="h1" tvg-logo="https://picsum.photos/seed/news/300/200" group-title="Haberler",BBC World News
http://dummy.stream/news1
#EXTINF:-1 tvg-id="h2" tvg-logo="https://picsum.photos/seed/cnn/300/200" group-title="Haberler",CNN International
http://dummy.stream/news2
#EXTINF:-1 tvg-id="s1" tvg-logo="https://picsum.photos/seed/sport1/300/200" group-title="Spor",Sky Sports Premier League
http://dummy.stream/sport1
#EXTINF:-1 tvg-id="s2" tvg-logo="https://picsum.photos/seed/sport2/300/200" group-title="Spor",Eurosport 1 HD
http://dummy.stream/sport2
#EXTINF:-1 tvg-id="b1" tvg-logo="https://picsum.photos/seed/doc1/300/200" group-title="Belgesel",National Geographic
http://dummy.stream/doc1
#EXTINF:-1 tvg-id="b2" tvg-logo="https://picsum.photos/seed/doc2/300/200" group-title="Belgesel",Discovery Channel
http://dummy.stream/doc2
#EXTINF:-1 tvg-id="b3" tvg-logo="https://picsum.photos/seed/doc3/300/200" group-title="Belgesel",History Channel
http://dummy.stream/doc3
#EXTINF:-1 tvg-id="fr2" tvg-logo="https://picsum.photos/seed/fr2/300/200" group-title="FR",FRANCE 2 HD
http://dummy.stream/fr2
#EXTINF:-1 tvg-id="m6" tvg-logo="https://picsum.photos/seed/m6/300/200" group-title="FR",M6 HD
http://dummy.stream/m6
#EXTINF:-1 tvg-id="tmc" tvg-logo="https://picsum.photos/seed/tmc/300/200" group-title="FR",TMC HD 1080
http://dummy.stream/tmc
#EXTINF:-1 tvg-id="trt1" tvg-logo="https://picsum.photos/seed/trt1/300/200" group-title="TR",TRT 1 1080p
http://dummy.stream/trt1
#EXTINF:-1 tvg-id="trt1_720" tvg-logo="https://picsum.photos/seed/trt1/300/200" group-title="TR",TRT 1 720p
http://dummy.stream/trt1_720
        `.trim();

        return this.loadPlaylist(sampleM3U);
    }

    /**
     * Clears the current playlist state
     */
    clear() {
        this.channels = [];
        this.categories.clear();
        this.isLoaded = false;
        console.info('[PlaylistEngine] State cleared');
    }
}

/**
 * Export a singleton instance
 */
export const playlistEngine = new PlaylistEngine();

export default playlistEngine;
