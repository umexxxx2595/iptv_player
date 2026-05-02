/**
 * Playback Orchestrator
 * High-level coordinator for stream resolution, engine selection, and error recovery.
 */

import { HLSEngine } from './engines/hlsEngine.js';
import { NativeEngine } from './engines/nativeEngine.js';
import { resolveM3UStream } from './resolver/streamResolver.js';
import { saveStrategyCache } from './resolver/strategyCache.js';
import {
    ENGINE_TYPES,
    selectPlaybackPlan,
    describePlaybackPlan
} from './engineSelector.js';
import { detectStreamType } from './resolver/streamTypeDetector.js';

export class PlaybackOrchestrator {
    constructor(playerState) {
        this.playerState = playerState;
        this.activeEngine = null;
        this.hlsEngine = new HLSEngine();
        this.nativeEngine = new NativeEngine();
        this.abortController = null;
    }

    /**
     * Plays a channel by choosing the best strategy and engine.
     */
    async play(channel, options = {}) {
        const originalUrl = channel.url;
        const channelId = channel.uid || channel.id || originalUrl;

        const plan = selectPlaybackPlan(channel, { url: originalUrl });
        this.playerState.lastPlaybackPlan = plan;

        console.info('[Orchestrator] Playback plan:', describePlaybackPlan(plan));

        if (options.onPlan) options.onPlan(plan);

        if (!plan.runnableEngines?.length) {
            throw { type: 'unsupported', message: 'Bu yayın tipi mevcut oynatıcı motorlarıyla desteklenmiyor.', plan };
        }

        const cachedStrategy = this.playerState.strategyCache?.[channelId];
        if (cachedStrategy) {
            const cachedResult = await this.tryCachedStrategy(cachedStrategy, originalUrl, channel, options, plan);
            if (cachedResult === true) return true;
        }

        let lastError = null;

        for (const engine of plan.runnableEngines) {
            try {
                const ok = await this.tryEngine(engine, originalUrl, channel, options, plan);
                if (ok) return true;
            } catch (error) {
                // GERÇEK BİR KANAL DEĞİŞİMİ Mİ YOKSA MOTOR HATASI MI? (HAYAT KURTARAN KONTROL)
                const isTrulyStale = 
                    options.sessionId !== this.playerState.playbackSessionId || 
                    options.renderToken !== this.playerState.renderToken;

                if ((error?.type === 'stale' || error?.type === 'aborted') && isTrulyStale) {
                    throw error; // Kullanıcı gerçekten kanalı değiştirdiyse işlemi iptal et
                }

                // MOTOR PATLADI, PES ETME! BİR SONRAKİ MOTORA (NATIVE) GEÇ!
                lastError = error;
                console.warn('[Orchestrator] Engine failed (Ignored Fake Stale), trying next if available:', {
                    engine: engine.type, reason: engine.reason, error
                });

                if (engine.type === ENGINE_TYPES.NATIVE) {
                    try { this.nativeEngine.destroy(); } catch(e){}
                }
                if (engine.type === ENGINE_TYPES.HLS_JS) {
                    try { this.hlsEngine.destroy(); } catch(e){}
                }
            }
        }

        if (this.shouldPreferResolver(channel)) {
            try {
                console.warn('[Orchestrator] Plan engines failed, trying resolver path:', lastError);
                options.onStrategyChange?.('resolver-hls');
                return await this.executeResolverPath(channel, originalUrl, options);
            } catch (resolverError) {
                const isTrulyStale = options.sessionId !== this.playerState.playbackSessionId;
                if ((resolverError?.type === 'stale' || resolverError?.type === 'aborted') && isTrulyStale) throw resolverError;
                throw resolverError;
            }
        }

        throw lastError || { type: 'playbackFailed', message: 'Yayın mevcut motorlarla başlatılamadı.', plan };
    }

    async tryCachedStrategy(cachedStrategy, originalUrl, channel, options, plan) {
        console.info('[Orchestrator] Trying cached strategy:', {
            channel: channel.name,
            cachedStrategy
        });

        try {
            if (cachedStrategy === 'native-hls' || cachedStrategy === 'native') {
                const nativeAllowed = plan.runnableEngines?.some(
                    engine => engine.type === ENGINE_TYPES.NATIVE
                );

                if (!nativeAllowed) {
                    console.info('[Orchestrator] Cached native skipped: native not in current plan');
                    return false;
                }

                options.onStrategyChange?.(cachedStrategy);
                await this.attemptNative(originalUrl, {
                    ...options,
                    timeoutMs: 2200,
                    successEvents: cachedStrategy === 'native-hls'
                        ? ['loadeddata', 'canplay']
                        : ['loadedmetadata', 'loadeddata', 'canplay']
                });

                this.playerState.lastAttemptedStrategy = cachedStrategy;
                this.playerState.lastAttemptedUrl = originalUrl;
                return true;
            }

            if (cachedStrategy === 'direct-hls') {
                const hlsAllowed = plan.runnableEngines?.some(
                    engine => engine.type === ENGINE_TYPES.HLS_JS
                );

                if (!hlsAllowed) {
                    console.info('[Orchestrator] Cached HLS skipped: hls-js not in current plan');
                    return false;
                }

                options.onStrategyChange?.('direct-hls');
                await this.attemptHls(originalUrl, {
                    ...options,
                    hlsProfile: plan.bufferPreset || 'balanced'
                });

                this.playerState.lastAttemptedStrategy = 'direct-hls';
                this.playerState.lastAttemptedUrl = originalUrl;
                return true;
            }

            if (cachedStrategy === 'resolver-hls') {
                if (!this.shouldPreferResolver(channel)) {
                    console.info('[Orchestrator] Cached resolver skipped: channel no longer prefers resolver');
                    return false;
                }

                options.onStrategyChange?.('resolver-hls');
                await this.executeResolverPath(channel, originalUrl, options);

                return true;
            }

            return false;
        } catch (error) {
            console.warn('[Orchestrator] Cached strategy failed, continuing with plan:', {
                cachedStrategy,
                error
            });

            if (cachedStrategy === 'native-hls' || cachedStrategy === 'native') {
                this.nativeEngine.destroy();
            }

            return false;
        }
    }

    async tryEngine(engine, originalUrl, channel, options, plan) {
        switch (engine.type) {
            // WEBOS'a ÖZEL DONANIM MOTORU
            case ENGINE_TYPES.WEBOS_NATIVE: {
                console.info('[Orchestrator] Trying LG Hardware Engine:', { channel: channel.name });
                options.onStrategyChange?.('webos-hardware');
                
                // OTT PLAYER TAKTİĞİ: Yayın tipini otomatik tespit et ve donanıma zorla yedir!
                const isHls = originalUrl.includes('.m3u8') || originalUrl.includes('m3u8') || originalUrl.includes('type=m3u');
                const magicType = isHls ? 'application/vnd.apple.mpegurl' : 'video/mp2t';
                
                console.info(`[Orchestrator] LG Hardware Magic Type: ${magicType}`);
                const sourceConfig = { ...options, type: magicType };
                await this.attemptNative(originalUrl, sourceConfig);
                
                this.playerState.lastAttemptedStrategy = 'webos-hardware';
                return true;
            }

            // STANDART HTML5 MOTORU
            case ENGINE_TYPES.NATIVE: {
                console.info('[Orchestrator] Trying HTML5 Native Engine:', { channel: channel.name });
                options.onStrategyChange?.('native');
                await this.attemptNative(originalUrl, options);
                this.playerState.lastAttemptedStrategy = 'native';
                return true;
            }

            // YAZILIMSAL HLS.JS MOTORU
            case ENGINE_TYPES.HLS_JS: {
                console.info('[Orchestrator] Trying Software HLS.js:', { channel: channel.name });
                options.onStrategyChange?.('direct-hls');
                await this.attemptHls(originalUrl, options);
                this.playerState.lastAttemptedStrategy = 'direct-hls';
                return true;
            }

            default:
                return false;
        }
    }

    async executeResolverPath(channel, originalUrl, options) {
        if (this.abortController) this.abortController.abort();
        this.abortController = new AbortController();

        try {
            const resolved = await resolveM3UStream(originalUrl, this.abortController.signal);
            const resolvedStreamInfo = resolved.streamInfo || detectStreamType(resolved.url);

            if (resolvedStreamInfo.isHls || resolvedStreamInfo.isIptvLive) {
                await this.attemptHls(resolved.url, { ...options, sourceMode: 'resolved' });
            } else {
                await this.attemptNative(resolved.url, options);
            }

            this.playerState.lastAttemptedStrategy = 'resolver-hls';
            this.playerState.lastAttemptedUrl = resolved.url || originalUrl;

            return true;

        } catch (e) {
            if (e.name === 'AbortError') throw { type: 'aborted' };
            throw e;
        }
    }

    shouldPreferResolver(channel = {}) {
        const url = String(channel.url || '').toLowerCase();

        // Technical indicators only
        return (
            url.includes('get.php') ||
            url.includes('type=m3u') ||
            url.includes('output=m3u') ||
            url.includes('output=ts')
        );
    }

    async attemptHls(url, options) {
        this.activeEngine = this.hlsEngine;

        console.info('[Orchestrator] attemptHls attach start:', {
            url,
            hlsProfile: options?.hlsProfile,
            bufferPreset: options?.bufferPreset
        });

        await this.hlsEngine.attach(this.playerState.refs.video, url, {
            ...options,
            attachTimeoutMs: options?.attachTimeoutMs || 5000,
            manifestAttachTimeoutMs: options?.manifestAttachTimeoutMs || 8000
        });
    }

    async attemptNative(url, options) {
        this.activeEngine = this.nativeEngine;
        await this.nativeEngine.attach(this.playerState.refs.video, url, options);
    }

    stop() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }

        try {
            this.hlsEngine?.destroy?.();
        } catch (error) {
            console.warn('[Orchestrator] HLS destroy failed:', error);
        }

        try {
            this.nativeEngine?.destroy?.();
        } catch (error) {
            console.warn('[Orchestrator] Native destroy failed:', error);
        }

        this.activeEngine = null;
    }

    destroy() {
        this.stop();
        this.hlsEngine.destroy();
        this.nativeEngine.destroy();
        this.activeEngine = null;
    }

    updateCache(channel, url, strategy) {
        const channelId = channel.uid || channel.id || url;
        this.playerState.strategyCache[channelId] = strategy;
        saveStrategyCache(this.playerState.strategyCache);
    }
}
