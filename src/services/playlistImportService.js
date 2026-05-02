import { replacePlaylistFromText, saveDemoPlaylist, savePlaylistState } from '../data/catalogStore.js';
import { parseM3UText } from '../utils/m3uParser.js';

const PROXIES = [
    '',
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest='
];

const fetchPlaylistText = async (url) => {
    let lastError = new Error('Bilinmeyen playlist hatasi');

    for (const proxy of PROXIES) {
        try {
            const targetUrl = proxy ? `${proxy}${encodeURIComponent(url)}` : url;
            const response = await fetch(targetUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const text = await response.text();
            if (!text || text.trim().length < 20) {
                throw new Error('Gelen veri gecersiz veya bos');
            }

            return text;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError;
};

const parseWithWorker = (url) => {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('../workers/m3uParser.worker.js', import.meta.url), {
            type: 'module'
        });

        worker.onmessage = (event) => {
            const { type, playlist, error, percent } = event.data || {};

            if (type === 'PROGRESS') {
                window.dispatchEvent(new CustomEvent('fonex:playlist:progress', {
                    detail: { percent }
                }));
                return;
            }

            worker.terminate();

            if (type === 'SUCCESS') {
                resolve(Array.isArray(playlist) ? playlist : []);
                return;
            }

            reject(new Error(error || 'Playlist worker hatasi'));
        };

        worker.onerror = (error) => {
            worker.terminate();
            reject(error instanceof Error ? error : new Error('Playlist worker baslatilamadi'));
        };

        worker.postMessage({ url });
    });
};

export const importPlaylistFromUrl = async (url) => {
    const trimmedUrl = String(url || '').trim();
    if (!trimmedUrl) {
        throw new Error('Playlist URL bos olamaz.');
    }

    let parsedItems = [];

    if (typeof Worker !== 'undefined' && typeof window !== 'undefined') {
        try {
            parsedItems = await parseWithWorker(trimmedUrl);
        } catch (error) {
            console.warn('[PlaylistImport] Worker fallback kullaniliyor:', error);
        }
    }

    if (parsedItems.length === 0) {
        const text = await fetchPlaylistText(trimmedUrl);
        parsedItems = parseM3UText(text);
    }

    if (parsedItems.length === 0) {
        throw new Error('Playlist import edildi ancak gecerli kanal bulunamadi.');
    }

    return savePlaylistState({
        items: parsedItems,
        sourceType: 'url',
        sourceLabel: trimmedUrl,
        sourceUrl: trimmedUrl
    });
};

export const importPlaylistFromText = async (text, label = 'Yapistirilan playlist') => {
    return replacePlaylistFromText(text, label);
};

export const restoreDemoPlaylist = () => {
    return saveDemoPlaylist();
};
