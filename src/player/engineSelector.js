// src/player/engineSelector.js

import { detectPlatform, PLATFORM_TYPES } from './platform/platformDetector.js';
import { detectStreamType, isUnsupportedByWeb } from './resolver/streamTypeDetector.js';

export const ENGINE_TYPES = Object.freeze({
    NATIVE: 'native',
    HLS_JS: 'hls-js',
    SHAKA: 'shaka',
    MPEG_TS: 'mpeg-ts',
    AVPLAY: 'avplay',
    WEBOS_NATIVE: 'webos-native',
    UNSUPPORTED: 'unsupported'
});

export const BUFFER_PRESETS = Object.freeze({ FAST: 'fast', BALANCED: 'balanced', STABLE: 'stable' });

export const ENGINE_RUNTIME = Object.freeze({
    [ENGINE_TYPES.NATIVE]: { implemented: true },
    [ENGINE_TYPES.HLS_JS]: { implemented: true },
    [ENGINE_TYPES.WEBOS_NATIVE]: { implemented: false },
    [ENGINE_TYPES.SHAKA]: { implemented: false },
    [ENGINE_TYPES.MPEG_TS]: { implemented: false },
    [ENGINE_TYPES.AVPLAY]: { implemented: false },
    [ENGINE_TYPES.UNSUPPORTED]: { implemented: false }
});

export function selectPlaybackPlan(channel = {}, options = {}) {
    const url = channel?.url || options.url || '';
    const platformInfo = options.platformInfo || detectPlatform();
    const streamInfo = options.streamInfo || detectStreamType(url);
    const engines = [];
    const bufferPreset = BUFFER_PRESETS.BALANCED;

    if (isUnsupportedByWeb(streamInfo)) {
        engines.push({ type: ENGINE_TYPES.UNSUPPORTED, reason: 'unsupported-format' });
        return buildPlan(channel, url, platformInfo, streamInfo, engines, bufferPreset, 'unsupported');
    }

    // 🚀 OTT PLAYER GİZLİ SİLAHI: LG WEBOS DONANIM MOTORU (M3U8 & TS İÇİN)
    if (platformInfo.platform === PLATFORM_TYPES.LG_WEBOS) {
        if (streamInfo.isHls || streamInfo.isMpegTs || streamInfo.isIptvLive) {
            
            // 1. ŞANS: LG'nin kendi iç donanım çözücüsü (En hızlısı, CORS dinlemez)
            engines.push({ type: ENGINE_TYPES.WEBOS_NATIVE, reason: 'ott-webos-hardware', timeoutMs: 8000 });
            
            // 2. ŞANS: Eğer donanım formatı sevmezse, standart HTML5 Native (Hızlı fallback)
            engines.push({ type: ENGINE_TYPES.NATIVE, reason: 'ott-html5-fallback', timeoutMs: 6000 });
            
            // 3. ŞANS: Yazılımsal Çözüm (HLS.js - Sadece yukarıdakiler çökerse devreye girer)
            engines.push({ type: ENGINE_TYPES.HLS_JS, reason: 'ott-software-decode' });
            
        } else if (streamInfo.isMp4) {
            engines.push({ type: ENGINE_TYPES.NATIVE, reason: 'webos-mp4-direct' });
        }
        return buildPlan(channel, url, platformInfo, streamInfo, engines, bufferPreset, 'ott-webos-plan');
    }

    // PC veya Diğer Tarayıcılar İçin
    if (streamInfo.isHls || streamInfo.isIptvLive) {
        engines.push({ type: ENGINE_TYPES.HLS_JS, reason: 'browser-software' });
        engines.push({ type: ENGINE_TYPES.NATIVE, reason: 'browser-hardware' });
    } else {
        engines.push({ type: ENGINE_TYPES.NATIVE, reason: 'browser-native-direct' });
    }

    return buildPlan(channel, url, platformInfo, streamInfo, engines, bufferPreset, 'ott-default-plan');
}

function buildPlan(channel, url, platformInfo, streamInfo, engines, bufferPreset, reason) {
    const runnableEngines = engines.filter(e => ENGINE_RUNTIME[e.type]?.implemented && e.type !== ENGINE_TYPES.UNSUPPORTED);
    return {
        channelId: channel?.uid || channel?.id || url, channelName: channel?.name || 'Unknown',
        url, platform: platformInfo, stream: streamInfo, engines, runnableEngines,
        primaryEngine: runnableEngines[0]?.type || ENGINE_TYPES.UNSUPPORTED, bufferPreset, reason, createdAt: Date.now()
    };
}

export function describePlaybackPlan(plan) {
    return { channel: plan.channelName, primaryEngine: plan.primaryEngine, runnableEngines: plan.runnableEngines?.map(e => e.type), reason: plan.reason };
}
