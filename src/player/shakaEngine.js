/**
 * Brute Force Video Engine - Ultra-Low Latency Edition
 * Optimized for real-time IPTV performance and instant channel zapping.
 */
import eventBus from '../engine/eventBus.js';

export class ShakaEngine {
    constructor(videoElement) {
        this.videoElement = videoElement;
        this.hls = null;
    }

    async init() {
        if (window.shaka) shaka.polyfill.installAll();
    }

    async load(url) {
        this.stop();
        console.log(`[LowLatency] Tuning for real-time: ${url}`);
        
        this.videoElement.muted = true;
        return this.tryHls(url);
    }

    tryHls(url) {
        return new Promise((resolve, reject) => {
            if (!window.Hls || !Hls.isSupported()) {
                return this.tryNative(url).then(resolve).catch(reject);
            }

            const config = {
                enableWorker: true,
                lowLatencyMode: true, // TRUE LOW LATENCY
                backBufferLength: 0,   // Do not buffer old data
                maxBufferLength: 5,    // Buffer only 5 seconds (Very aggressive)
                maxMaxBufferLength: 10,
                manifestLoadingMaxRetry: 10,
                levelLoadingMaxRetry: 10,
                fragLoadingMaxRetry: 10,
                startFragPrefetch: true,
                enableSoftwareAES: true,
                liveSyncDurationCount: 2, // Stay close to live edge
                liveMaxLatencyDurationCount: 4
            };

            this.hls = new Hls(config);
            this.hls.loadSource(url);
            this.hls.attachMedia(this.videoElement);
            
            this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.videoElement.play().then(() => {
                    this.videoElement.muted = false;
                }).catch(() => {});
                eventBus.emit('PLAYER_READY');
                resolve();
            });

            this.hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    this.hls.destroy();
                    this.tryNative(url).then(resolve).catch(reject);
                }
            });
        });
    }

    tryNative(url) {
        return new Promise((resolve, reject) => {
            this.videoElement.src = url;
            this.videoElement.oncanplay = () => {
                this.videoElement.play().then(() => {
                    this.videoElement.muted = false;
                });
                eventBus.emit('PLAYER_READY');
                resolve();
            };
            this.videoElement.onerror = () => reject();
            setTimeout(() => reject(), 10000);
        });
    }

    stop() {
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
        this.videoElement.pause();
        this.videoElement.removeAttribute('src');
        this.videoElement.load();
    }
}
