/**
 * Native Video Engine Adapter
 * Handles standard HTML5 video playback (MP4, TS, and native HLS on Safari/webOS).
 */

export class NativeEngine {
    constructor() {
        this.video = null;
        this.cleanupAttach = null;
        this.attachId = 0;
    }

    async attach(video, url, options = {}) {
        this.destroy();

        this.video = video;
        this.attachId += 1;

        const currentAttachId = this.attachId;
        const timeoutMs = options.timeoutMs || 10000;

        const successEvents = Array.isArray(options.successEvents) && options.successEvents.length
            ? options.successEvents
            : ['loadedmetadata', 'canplay', 'loadeddata'];

        return new Promise((resolve, reject) => {
            let timeoutId = null;
            let settled = false;

            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }

                video.removeEventListener('loadedmetadata', onLoaded);
                video.removeEventListener('canplay', onLoaded);
                video.removeEventListener('loadeddata', onLoaded);
                video.removeEventListener('error', onError);

                if (this.cleanupAttach === cleanup) {
                    this.cleanupAttach = null;
                }
            };

            const finish = (ok, payload) => {
                if (settled) return;
                settled = true;

                cleanup();

                if (currentAttachId !== this.attachId) {
                    reject({ type: 'nativeStale' });
                    return;
                }

                if (ok) {
                    resolve(true);
                } else {
                    reject(payload);
                }
            };

            const onLoaded = (event) => {
                const eventType = event?.type || '';

                if (!successEvents.includes(eventType)) {
                    console.info('[NativeEngine] Ignoring non-success probe event:', {
                        eventType,
                        successEvents
                    });
                    return;
                }

                finish(true, {
                    type: 'nativeReady',
                    eventType
                });
            };

            const onError = () => {
                finish(false, {
                    type: 'nativeError',
                    error: video.error
                });
            };

            this.cleanupAttach = cleanup;

            try {
                video.pause?.();
                video.removeAttribute('src');
                video.srcObject = null;
                video.load?.();

                video.addEventListener('loadedmetadata', onLoaded);
                video.addEventListener('canplay', onLoaded);
                video.addEventListener('loadeddata', onLoaded);
                video.addEventListener('error', onError);

                timeoutId = setTimeout(() => {
                    finish(false, {
                        type: 'nativeTimeout',
                        url,
                        timeoutMs
                    });
                }, timeoutMs);

                // OTT PLAYER TAKTİĞİ: WebOS'a yayın formatını zorla dayat!
                const sourceConfigType = options.type || '';
                
                // İçerideki eski kaynakları temizle
                while (video.firstChild) {
                    video.removeChild(video.firstChild);
                }

                if (sourceConfigType) {
                    // Eğer özel bir format (örn: application/x-mpegURL) verildiyse Source ile bağla
                    const sourceElement = document.createElement('source');
                    sourceElement.src = url;
                    sourceElement.type = sourceConfigType;
                    video.appendChild(sourceElement);
                    console.info(`[NativeEngine] Attached via <source> with type: ${sourceConfigType}`);
                } else {
                    // Normal MP4 veya tarayıcı ise doğrudan SRC kullan
                    video.src = url;
                    console.info(`[NativeEngine] Attached via direct video.src`);
                }

                video.load?.();

                video.play?.().catch(() => {
                    // Native probe sırasında autoplay başarısız olabilir.
                    // Bu fatal değil; loadedmetadata/canplay/loadeddata beklenir.
                });
            } catch (error) {
                finish(false, {
                    type: 'nativeSetupError',
                    error
                });
            }
        });
    }

    stop() {
        if (this.cleanupAttach) {
            this.cleanupAttach();
        }

        if (this.video) {
            try {
                this.video.pause?.();
                this.video.removeAttribute('src');
                this.video.srcObject = null;
                this.video.load?.();
            } catch (error) {
                console.warn('[NativeEngine] stop cleanup failed:', error);
            }
        }
    }

    destroy() {
        this.attachId += 1;

        if (this.cleanupAttach) {
            this.cleanupAttach();
            this.cleanupAttach = null;
        }

        if (this.video) {
            try {
                this.video.pause?.();
                this.video.removeAttribute('src');
                this.video.srcObject = null;
                this.video.load?.();
            } catch (error) {
                console.warn('[NativeEngine] destroy cleanup failed:', error);
            }

            this.video = null;
        }
    }
}
