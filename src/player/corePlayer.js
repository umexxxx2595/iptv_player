/**
 * Core Player - Unified interface for video playback.
 * High-performance cleanup, error recovery and Channel Switching.
 */
import eventBus from '../engine/eventBus.js';
import { ShakaEngine } from './shakaEngine.js';
import playlistEngine from '../content/playlistEngine.js';

class CorePlayer {
    constructor() {
        this.videoElement = null;
        this.container = null;
        this.controls = null;
        this.loader = null;
        this.isPlaying = false;
        this.engine = null;
        this.hideTimeout = null;
        this.currentIndex = -1;
    }

    async init(videoElement) {
        if (this.engine) return; 
        
        this.videoElement = videoElement;
        this.container = document.getElementById('player-container');
        this.controls = document.getElementById('player-controls');
        this.loader = document.getElementById('player-loader');
        
        this.engine = new ShakaEngine(this.videoElement);
        await this.engine.init(); 
        
        this.setupListeners();
    }

    setupListeners() {
        const hideLoader = () => {
            this.loader?.classList.add('hidden');
            this.isPlaying = true;
            this.showControls();
            
            // Force Layout Refresh to fix "No Image" bugs
            this.videoElement.style.display = 'none';
            this.videoElement.offsetHeight; // trigger reflow
            this.videoElement.style.display = 'block';
        };

        this.videoElement.addEventListener('playing', hideLoader);
        this.videoElement.addEventListener('canplay', hideLoader);
        eventBus.on('PLAYER_READY', hideLoader);

        // Handle Key Shortcuts
        window.addEventListener('keydown', (e) => {
            if (this.container.classList.contains('hidden')) return;
            
            switch(e.key.toLowerCase()) {
                case 'm': this.toggleMute(); break;
                case 'f': this.toggleFullscreen(); break;
                case ' ': e.preventDefault(); this.togglePlay(); break;
                case 'arrowup': this.adjustVolume(0.1); break;
                case 'arrowdown': this.adjustVolume(-0.1); break;
            }
        });

        this.videoElement.addEventListener('timeupdate', () => this.updateUI());
        
        eventBus.on('PLAYER_ERROR', (data) => {
            this.handleError(data.message || 'Yayın açılamadı.');
        });
        
        eventBus.on('KEY_ACTION', ({ action }) => {
            if (this.container && !this.container.classList.contains('hidden')) {
                if (action === 'BACK') this.stop();
                if (action === 'UP') this.prevChannel();
                if (action === 'DOWN') this.nextChannel();
                if (action === 'LEFT') this.seek(-10);
                if (action === 'RIGHT') this.seek(10);
                if (action === 'ENTER') this.togglePlay();
            }
        });
    }

    toggleMute() {
        this.videoElement.muted = !this.videoElement.muted;
        window.showToast(this.videoElement.muted ? 'SES KAPALI' : 'SES AÇIK');
    }

    adjustVolume(delta) {
        this.videoElement.volume = Math.max(0, Math.min(1, this.videoElement.volume + delta));
        window.showToast(`SES: %${Math.round(this.videoElement.volume * 100)}`);
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.container.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }

    async nextChannel() {
        const playlist = playlistEngine.currentPlaylist;
        if (playlist.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % playlist.length;
        const channel = playlist[this.currentIndex];
        await this.load(channel.url, channel.name);
        window.showToast(`Kanal: ${channel.name}`);
    }

    async prevChannel() {
        const playlist = playlistEngine.currentPlaylist;
        if (playlist.length === 0) return;
        this.currentIndex = (this.currentIndex - 1 + playlist.length) % playlist.length;
        const channel = playlist[this.currentIndex];
        await this.load(channel.url, channel.name);
        window.showToast(`Kanal: ${channel.name}`);
    }

    handleError(msg) {
        this.loader?.classList.add('hidden');
        if (window.showToast) window.showToast(msg, 'error');
        setTimeout(() => {
            if (!this.isPlaying) this.stop();
        }, 3000);
    }

    seek(seconds) {
        if (this.videoElement) {
            this.videoElement.currentTime += seconds;
            window.showToast(seconds > 0 ? `+${seconds}s` : `${seconds}s`);
        }
    }

    showControls() {
        this.controls?.classList.remove('hidden-controls');
        if (this.hideTimeout) clearTimeout(this.hideTimeout);
        this.hideTimeout = setTimeout(() => {
            if (this.isPlaying) this.controls?.classList.add('hidden-controls');
        }, 5000);
    }

    updateUI() {
        if (!this.videoElement) return;
        const progress = (this.videoElement.currentTime / (this.videoElement.duration || 1)) * 100;
        const bar = document.querySelector('.player-progress-bar');
        if (bar) bar.style.width = `${progress}%`;
    }

    async load(url, name = 'YAYIN') {
        const title = document.getElementById('current-channel-name');
        if (title) title.textContent = name.toUpperCase();

        // Update current index if possible
        const playlist = playlistEngine.currentPlaylist;
        const idx = playlist.findIndex(ch => ch.url === url);
        if (idx !== -1) this.currentIndex = idx;

        this.container?.classList.remove('hidden');
        this.loader?.classList.remove('hidden');
        this.isPlaying = false;

        try {
            await this.engine.load(url);
            this.videoElement.play().catch(() => {
                window.showToast('Oynatmak için ENTER basın');
                this.loader?.classList.add('hidden');
            });
        } catch (e) {
            this.handleError('Yayın bağlantısı kurulamadı.');
        }
    }

    stop() {
        this.engine?.destroy();
        this.videoElement.pause();
        this.videoElement.src = "";
        this.container?.classList.add('hidden');
        this.loader?.classList.add('hidden');
        this.isPlaying = false;
    }

    togglePlay() {
        if (this.isPlaying) {
            this.videoElement.pause();
            this.isPlaying = false;
        } else {
            this.videoElement.play();
            this.isPlaying = true;
            this.loader?.classList.add('hidden');
        }
    }
}

export const corePlayer = new CorePlayer();
export default corePlayer;
