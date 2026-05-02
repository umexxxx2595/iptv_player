/**
 * Sovereign IndexedDB Engine - High Performance TV Storage
 * v18.3 Error-Tolerant Edition
 */

const DB_NAME = 'SovereignIPTV_DB';
const DB_VERSION = 1;

export const dbEngine = {
    db: null,

    async init() {
        return new Promise((resolve, reject) => {
            try {
                if (this.db) return resolve(this.db);

                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('channels')) {
                        const channelStore = db.createObjectStore('channels', { keyPath: 'id', autoIncrement: true });
                        channelStore.createIndex('group', 'group', { unique: false });
                    }
                    if (!db.objectStoreNames.contains('categories')) {
                        db.createObjectStore('categories', { keyPath: 'name' });
                    }
                    if (!db.objectStoreNames.contains('playlists')) {
                        db.createObjectStore('playlists', { keyPath: 'id', autoIncrement: true });
                    }
                };

                request.onsuccess = (event) => {
                    this.db = event.target.result;
                    resolve(this.db);
                };

                request.onerror = (event) => {
                    console.error('[DB] Error:', event.target.error);
                    resolve(null); // Resolve with null instead of reject to keep the boot chain alive
                };
            } catch (e) {
                console.error('[DB] Fatal:', e);
                resolve(null);
            }
        });
    },

    async saveChannels(channels) {
        try {
            const db = await this.init();
            if (!db) return true;
            
            return new Promise((resolve) => {
                const transaction = db.transaction(['channels'], 'readwrite');
                const store = transaction.objectStore('channels');
                channels.forEach(channel => store.put(channel));
                transaction.oncomplete = () => resolve(true);
                transaction.onerror = () => resolve(true);
            });
        } catch (e) {
            console.error(e);
            return true;
        }
    },

    async getChannelsByGroup(groupName) {
        try {
            const db = await this.init();
            if (!db) return [];
            return new Promise((resolve) => {
                const transaction = db.transaction(['channels'], 'readonly');
                const store = transaction.objectStore('channels');
                const index = store.index('group');
                const request = index.getAll(groupName);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve([]);
            });
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    async getAllCategories() {
        try {
            const db = await this.init();
            if (!db) return [];
            return new Promise((resolve) => {
                const transaction = db.transaction(['categories'], 'readonly');
                const store = transaction.objectStore('categories');
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve([]);
            });
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    async clearStore(storeName) {
        try {
            const db = await this.init();
            if (!db) return true;
            return new Promise((resolve) => {
                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();
                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(true);
            });
        } catch (e) {
            console.error(e);
            return true;
        }
    }
};
