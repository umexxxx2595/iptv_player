import Hls from 'hls.js';

import { addRecentChannel } from '../../data/catalogStore.js';
import { isFavorite, toggleFavorite } from '../../utils/favoritesStore.js';
import { sanitizeHTML } from '../../utils/sanitize.js';

const destroyVideoPlayback = (playerOverlay) => {
    if (!playerOverlay) {
        return;
    }

    if (typeof playerOverlay._cleanupPlayer === 'function') {
        playerOverlay._cleanupPlayer();
    }

    playerOverlay._cleanupPlayer = null;
};

const buildSource = (channel = {}) => {
    if (channel && typeof channel.url === 'string' && channel.url.trim()) {
        return channel.url;
    }

    return 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
};

const attachMediaSource = (video, url) => {
    if (!video || !url) {
        return () => {};
    }

    if (Hls.isSupported() && /m3u8($|\?)/i.test(url)) {
        const hls = new Hls({
            lowLatencyMode: true,
            backBufferLength: 90
        });

        hls.loadSource(url);
        hls.attachMedia(video);
        video.dataset.hlsAttached = 'true';

        return () => {
            hls.destroy();
            video.removeAttribute('src');
            video.load();
        };
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        return () => {
            video.pause();
            video.removeAttribute('src');
            video.load();
        };
    }

    video.src = url;
    return () => {
        video.pause();
        video.removeAttribute('src');
        video.load();
    };
};

export const renderPlayerScreen = async (channel = {}, context = {}) => {
    const safeChannel = {
        id: channel?.id || '',
        name: channel?.name || 'Demo Kanal',
        category: channel?.category || 'Canli',
        url: buildSource(channel),
        description: channel?.description || '',
        mode: channel?.mode || 'live'
    };

    const playerOverlay = document.getElementById('player-overlay');
    if (!playerOverlay) {
        return false;
    }

    destroyVideoPlayback(playerOverlay);
    addRecentChannel(safeChannel);

    const currentIndex = Number.isFinite(context.currentIndex) ? context.currentIndex : 0;
    const hasPrevious = currentIndex > 0;
    const hasNext = Array.isArray(context.channelList) && currentIndex < context.channelList.length - 1;
    const favoriteLabel = isFavorite(safeChannel) ? 'Favoriden cikar' : 'Favoriye ekle';
    const safeChannelName = sanitizeHTML(safeChannel.name);
    const safeCategory = sanitizeHTML(safeChannel.category);
    const safeListSize = sanitizeHTML(String(context.channelList?.length || 0));

    playerOverlay.classList.add('active');
    playerOverlay.setAttribute('aria-hidden', 'false');
    playerOverlay.innerHTML = `
        <section class="player-screen">
            <header class="player-header-bar">
                <div class="screen-header">
                    <h1>${safeChannelName}</h1>
                    <p>${safeCategory} | Liste boyutu: ${safeListSize}</p>
                </div>
                <div class="player-actions">
                    <button type="button" class="focusable action-pill" data-player-action="toggle-favorite">${sanitizeHTML(favoriteLabel)}</button>
                    <button type="button" class="focusable action-pill" data-close-player="true">Kapat</button>
                </div>
            </header>
            <video
                class="focusable"
                controls
                autoplay
                playsinline
                aria-label="${safeChannelName}"
            ></video>
            <div class="player-control-row">
                <button type="button" class="focusable action-pill" data-player-nav="prev" ${hasPrevious ? '' : 'disabled'}>Onceki</button>
                <button type="button" class="focusable action-pill" data-player-nav="next" ${hasNext ? '' : 'disabled'}>Sonraki</button>
            </div>
        </section>
    `;

    const video = playerOverlay.querySelector('video');
    const closeButton = playerOverlay.querySelector('[data-close-player="true"]');
    const favoriteButton = playerOverlay.querySelector('[data-player-action="toggle-favorite"]');

    const cleanupPlayback = attachMediaSource(video, safeChannel.url);
    playerOverlay._cleanupPlayer = () => {
        cleanupPlayback();
    };

    closeButton?.addEventListener('click', () => {
        destroyVideoPlayback(playerOverlay);
        playerOverlay.classList.remove('active');
        playerOverlay.setAttribute('aria-hidden', 'true');
        playerOverlay.innerHTML = '';
    });

    favoriteButton?.addEventListener('click', () => {
        const active = toggleFavorite(safeChannel);
        favoriteButton.textContent = active ? 'Favoriden cikar' : 'Favoriye ekle';
    });

    playerOverlay.querySelectorAll('[data-player-nav]').forEach((button) => {
        button.addEventListener('click', async () => {
            const direction = button.getAttribute('data-player-nav');
            const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
            const nextChannel = context.channelList?.[nextIndex];
            if (!nextChannel) {
                return;
            }

            const bootstrapModule = await import('../../bootstrap.js');
            await bootstrapModule.routeTo('player', {
                channel: nextChannel,
                channelList: context.channelList || [],
                currentIndex: nextIndex
            });
        });
    });

    requestAnimationFrame(() => closeButton?.focus());

    return true;
};