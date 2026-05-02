import { cleanChannelName, normalizeChannelName } from './textUtils.js';

const MOVIE_PATTERNS = ['vod', 'movie', 'film', 'sinema', 'cine'];
const SERIES_PATTERNS = ['series', 'dizi', 'show', 'episode', 'sezon'];

const includesPattern = (value = '', patterns = []) => {
    const haystack = normalizeChannelName(String(value).toLowerCase());
    return patterns.some((pattern) => haystack.includes(pattern));
};

export const inferChannelMode = (item = {}) => {
    const fields = [
        item.group,
        item.category,
        item.name,
        item.url
    ].filter(Boolean);

    const combined = fields.join(' ').toLowerCase();

    if (includesPattern(combined, SERIES_PATTERNS)) {
        return 'series';
    }

    if (includesPattern(combined, MOVIE_PATTERNS)) {
        return 'movies';
    }

    return 'live';
};

export const parseM3UText = (text = '') => {
    if (typeof text !== 'string' || text.trim().length === 0) {
        return [];
    }

    const playlist = [];
    const lines = text.split(/\r?\n/);
    let currentItem = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!line || line === '#EXTM3U') {
            continue;
        }

        if (line.startsWith('#EXTINF:')) {
            const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
            const groupMatch = line.match(/group-title="([^"]+)"/i);
            const idMatch = line.match(/tvg-id="([^"]+)"/i);
            const nameMatch = line.match(/,(.*)$/);

            currentItem = {
                id: idMatch ? idMatch[1].trim() : '',
                name: cleanChannelName(nameMatch ? nameMatch[1].trim() : 'Channel'),
                logo: logoMatch ? logoMatch[1].trim() : '',
                group: groupMatch ? groupMatch[1].trim() : 'General',
                category: groupMatch ? groupMatch[1].trim() : 'General',
                description: '',
                url: ''
            };
            continue;
        }

        if (line.startsWith('#EXTGRP:') && currentItem) {
            const group = line.replace('#EXTGRP:', '').trim();
            currentItem.group = group || currentItem.group;
            currentItem.category = group || currentItem.category;
            continue;
        }

        if (/^(https?|rtmp|rtp):/i.test(line) && currentItem) {
            currentItem.url = line;
            currentItem.mode = inferChannelMode(currentItem);
            playlist.push(currentItem);
            currentItem = null;
        }
    }

    return playlist.map((item, index) => ({
        id: item.id || `${item.mode}-${normalizeChannelName(item.name)}-${index}`,
        name: item.name || `Channel ${index + 1}`,
        logo: item.logo || '',
        group: item.group || 'General',
        category: item.category || item.group || 'General',
        description: item.description || `${item.group || item.category || 'Genel'} icerigi`,
        url: item.url || '',
        mode: item.mode || inferChannelMode(item)
    })).filter((item) => item.url);
};
