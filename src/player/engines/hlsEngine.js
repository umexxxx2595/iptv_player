/**
 * HLS Engine Adapter
 * Encapsulates HLS.js logic and configuration.
 */

import { classifyHlsError } from '../health/errorClassifier.js';

export class HLSEngine {
    static PROFILES = {
        fast: {
            lowLatencyMode: false,
            enableWorker: true,
            liveSyncDurationCount: 1,
            liveMaxLatencyDurationCount: 3,
            maxBufferLength: 6,
            maxMaxBufferLength: 18,
            backBufferLength: 6,
            manifestLoadingTimeOut: 8000,
            levelLoadingTimeOut: 8000,
            fragLoadingTimeOut: 9000,
            startFragPrefetch: true
        },
        balanced: {
            lowLatencyMode: false,
            enableWorker: true,
            liveSyncDurationCount: 2,
            liveMaxLatencyDurationCount: 4,
            maxBufferLength: 8,
            maxMaxBufferLength: 22,
            backBufferLength: 8,
            manifestLoadingTimeOut: 9000,
            levelLoadingTimeOut: 9000,
            fragLoadingTimeOut: 10000,
            startFragPrefetch: true,
            testBandwidth: false
        },
        stable: {
            lowLatencyMode: false,
            enableWorker: true,
            liveSyncDurationCount: 2,
            liveMaxLatencyDurationCount: 4,
            maxBufferLength: 10,
            maxMaxBufferLength: 24,
            backBufferLength: 8,
            manifestLoadingTimeOut: 9000,
            levelLoadingTimeOut: 9000,
            fragLoadingTimeOut: 11000,
            startFragPrefetch: true
        },
        compat: {
            lowLatencyMode: false,
            enableWorker: false,
            liveSyncDurationCount: 2,
            liveMaxLatencyDurationCount: 5,
            maxBufferLength: 12,
            maxMaxBufferLength: 30,
            backBufferLength: 10,
            manifestLoadingTimeOut: 10000,
            levelLoadingTimeOut: 10000,
            fragLoadingTimeOut: 12000,
            fragLoadingMaxRetry: 2,
            startFragPrefetch: false,
            testBandwidth: false
        }
    };

    constructor() {
        this.hls = null;
        this.video = null;
        this.attachId = 0;
    }

    /**
     * Initializes and attaches HLS.js to the video element.
     */
    async attach(video, url, options = {}) {
        const { onEvent, hlsProfile = 'fast' } = options;
        this.attachId += 1;
        const currentAttachId = this.attachId;

        return new Promise((resolve, reject) => {
            if (!window.Hls || !window.Hls.isSupported()) {
                reject({ type: 'hlsUnsupported' });
                return;
            }

            this.destroy();
            this.video = video;
            this.resetVideoElement(video);

            const profileConfig = HLSEngine.PROFILES[hlsProfile] || HLSEngine.PROFILES.fast;

            this.hls = new window.Hls({
                ...profileConfig,
                manifestLoadingMaxRetry: 1,
                manifestLoadingRetryDelay: 500,
                levelLoadingMaxRetry: 1,
                levelLoadingRetryDelay: 500,
                fragLoadingRetryDelay: 500,
                testBandwidth: false
            });

            const hls = this.hls;
            let settled = false;
            const isCurrentAttach = () => currentAttachId === this.attachId;

            let attachTimeoutId = setTimeout(() => {
                finish(false, {
                    type: 'hlsAttachTimeout',
                    message: 'HLS motoru video elementine bağlanamadı.',
                    url,
                    hlsProfile
                });
            }, options.attachTimeoutMs || 5000);

            const finish = (ok, payload) => {
                if (settled) return;
                if (!isCurrentAttach()) {
                    settled = true;
                    if (attachTimeoutId) {
                        clearTimeout(attachTimeoutId);
                        attachTimeoutId = null;
                    }
                    reject({ type: 'stale' });
                    return;
                }
                settled = true;

                if (attachTimeoutId) {
                    clearTimeout(attachTimeoutId);
                    attachTimeoutId = null;
                }

                if (ok) resolve(true);
                else {
                    this.destroy();
                    reject(payload);
                }
            };

            hls.on(window.Hls.Events.MANIFEST_PARSED, (_, data) => {
                if (!isCurrentAttach()) return;
                console.info('[HLS] MANIFEST_PARSED', {
                    levels: data?.levels?.length,
                    firstLevel: data?.firstLevel
                });

                if (onEvent) {
                    onEvent('manifest_parsed', data);
                }

                try {
                    hls.startLoad();
                } catch (error) {
                    console.warn('[HLS] startLoad failed:', error);
                }

                finish(true);
            });

            hls.on(window.Hls.Events.LEVEL_LOADED, (_, data) => {
                if (!isCurrentAttach()) return;
                console.info('[HLS] LEVEL_LOADED', {
                    live: data?.details?.live,
                    fragments: data?.details?.fragments?.length,
                    targetduration: data?.details?.targetduration
                });

                if (onEvent) {
                    onEvent('level_loaded', data);
                }
            });

            hls.on(window.Hls.Events.FRAG_LOADED, (_, data) => {
                if (!isCurrentAttach()) return;
                console.info('[HLS] FRAG_LOADED', {
                    sn: data?.frag?.sn,
                    duration: data?.frag?.duration,
                    type: data?.frag?.type
                });

                if (onEvent) {
                    onEvent('frag_loaded', data);
                }
            });

            hls.on(window.Hls.Events.ERROR, (_, data) => {
                if (!isCurrentAttach()) return;
                const kind = classifyHlsError(data);
                
                if (onEvent) onEvent('error', { kind, data, fatal: data.fatal });

                if (!settled && data.fatal) {
                    finish(false, { type: 'hlsFatal', kind, data });
                }
            });

            hls.on(window.Hls.Events.BUFFER_APPENDED, (_, data) => {
                if (!isCurrentAttach()) return;
                console.info('[HLS] BUFFER_APPENDED', {
                    type: data?.type,
                    parent: data?.parent
                });

                if (onEvent) {
                    onEvent('buffer_appended', data);
                }
            });

            hls.on(window.Hls.Events.MEDIA_ATTACHED, () => {
                if (!isCurrentAttach()) return;
                console.info('[HLS] MEDIA_ATTACHED');

                if (attachTimeoutId) {
                    clearTimeout(attachTimeoutId);
                    attachTimeoutId = setTimeout(() => {
                        finish(false, {
                            type: 'hlsManifestTimeout',
                            message: 'HLS manifest zamanında alınamadı.',
                            url,
                            hlsProfile
                        });
                    }, options.manifestAttachTimeoutMs || 8000);
                }

                if (onEvent) {
                    onEvent('media_attached');
                }

                try {
                    const freshUrl = withPlaybackCacheBust(url);
                    hls.loadSource(freshUrl);
                } catch (error) {
                    finish(false, {
                        type: 'hlsLoadSourceError',
                        error
                    });
                }
            });

            hls.attachMedia(video);
        });
    }

    stop() {
        if (this.hls) {
            this.hls.stopLoad?.();
        }
    }

    destroy() {
        this.attachId += 1;
        if (this.hls) {
            try {
                this.hls.stopLoad?.();
                this.hls.detachMedia?.();
                this.hls.destroy?.();
            } catch (e) {
                console.warn('[HLS] destroy failed:', e);
            }
            this.hls = null;
        }

        if (this.video) {
            this.resetVideoElement(this.video);
            this.video = null;
        }
    }

    resetVideoElement(video) {
        if (!video) return;

        try {
            video.pause?.();
            video.removeAttribute('src');
            video.srcObject = null;
            video.load?.();
            video.currentTime = 0;
        } catch (error) {
            console.warn('[HLS] Video reset failed:', error);
        }
    }

    recover(type) {
        if (!this.hls) return false;
        if (type === 'media') {
            this.hls.recoverMediaError();
            return true;
        }
        if (type === 'network') {
            this.hls.startLoad();
            return true;
        }
        return false;
    }
}

function withPlaybackCacheBust(url) {
    const raw = String(url || '');
    if (!raw) return raw;

    const separator = raw.includes('?') ? '&' : '?';
    return `${raw}${separator}_fonex_ts=${Date.now()}`;
}
