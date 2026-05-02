/**
 * Stream Resolver Module
 * Handles nested M3U playlists and final manifest resolution.
 */

import { detectStreamType } from './streamTypeDetector.js';

/**
 * Resolves a nested M3U playlist to find the final stream URL or manifest.
 */
export async function resolveM3UStream(url, signal) {
    console.log('[StreamResolver] Resolving stream:', url);

    try {
        const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            signal
        });

        if (!response.ok) {
            throw {
                type: 'networkError',
                details: 'nestedM3ULoadError',
                status: response.status,
                url
            };
        }

        const text = await response.text();
        if (!text || !text.trim()) {
            throw {
                type: 'mediaError',
                details: 'nestedM3UEmpty',
                url
            };
        }

        // 1. Is it actually an HLS manifest?
        if (text.includes('#EXTM3U') && text.includes('#EXT-X-')) {
            return {
                url,
                streamInfo: detectStreamType(url),
                source: 'hls-manifest'
            };
        }

        // 2. Is it a nested M3U? Look for the first HTTP link or valid path
        const lines = text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        const streamLine = lines.find((line) => {
            return (
                line.startsWith('http://') ||
                line.startsWith('https://') ||
                line.startsWith('/') ||
                (!line.startsWith('#') && line.length > 4)
            );
        });

        if (!streamLine) {
            throw {
                type: 'mediaError',
                details: 'nestedM3UNoStreamUrl',
                url
            };
        }

        // Resolve absolute URL if relative
        const absoluteUrl =
            streamLine.startsWith('http://') ||
            streamLine.startsWith('https://')
                ? streamLine
                : new URL(streamLine, url).toString();

        return {
            url: absoluteUrl,
            streamInfo: detectStreamType(absoluteUrl),
            source: 'nested-url'
        };

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('[StreamResolver] Resolution aborted');
            throw error;
        }
        
        console.error('[StreamResolver] Resolution failed:', error);
        throw error;
    }
}
