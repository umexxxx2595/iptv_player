// src/player/resolver/streamTypeDetector.js

const STREAM_TYPES = Object.freeze({
    HLS: 'hls',
    MPEG_TS: 'mpeg-ts',
    MP4: 'mp4',
    DASH: 'dash',
    RTMP: 'rtmp',
    RTSP: 'rtsp',
    IPTV_LIVE: 'iptv-live',
    UNKNOWN: 'unknown'
});

function normalizeUrl(url = '') {
    return String(url || '').trim();
}

function stripQuery(url = '') {
    return normalizeUrl(url).split('?')[0].toLowerCase();
}

function detectStreamType(url = '') {
    const rawUrl = normalizeUrl(url);
    const cleanUrl = stripQuery(rawUrl);
    const lowerUrl = rawUrl.toLowerCase();

    if (!rawUrl) {
        return buildResult(STREAM_TYPES.UNKNOWN, rawUrl, 'empty-url');
    }

    if (
        cleanUrl.endsWith('.m3u8') ||
        cleanUrl.endsWith('.m3u') ||
        lowerUrl.includes('m3u8') ||
        lowerUrl.includes('/hls/') ||
        lowerUrl.includes('playlist.m3u8')
    ) {
        return buildResult(STREAM_TYPES.HLS, rawUrl, 'hls-signature');
    }

    if (
        cleanUrl.endsWith('.ts') ||
        lowerUrl.includes('mpegts') ||
        lowerUrl.includes('mpeg-ts')
    ) {
        return buildResult(STREAM_TYPES.MPEG_TS, rawUrl, 'mpeg-ts-signature');
    }

    if (
        cleanUrl.endsWith('.mp4') ||
        cleanUrl.endsWith('.m4v') ||
        lowerUrl.includes('video/mp4')
    ) {
        return buildResult(STREAM_TYPES.MP4, rawUrl, 'mp4-signature');
    }

    if (
        cleanUrl.endsWith('.mpd') ||
        lowerUrl.includes('/dash/')
    ) {
        return buildResult(STREAM_TYPES.DASH, rawUrl, 'dash-signature');
    }

    if (lowerUrl.startsWith('rtmp://')) {
        return buildResult(STREAM_TYPES.RTMP, rawUrl, 'rtmp-protocol');
    }

    if (lowerUrl.startsWith('rtsp://')) {
        return buildResult(STREAM_TYPES.RTSP, rawUrl, 'rtsp-protocol');
    }

    if (
        lowerUrl.includes('/live/') ||
        lowerUrl.includes('username=') ||
        lowerUrl.includes('password=') ||
        lowerUrl.includes('type=m3u') ||
        lowerUrl.includes('get.php')
    ) {
        return buildResult(STREAM_TYPES.IPTV_LIVE, rawUrl, 'iptv-live-signature');
    }

    return buildResult(STREAM_TYPES.UNKNOWN, rawUrl, 'unknown-signature');
}

function buildResult(type, url, reason) {
    return {
        type,
        url,
        reason,
        isHls: type === STREAM_TYPES.HLS,
        isMpegTs: type === STREAM_TYPES.MPEG_TS,
        isMp4: type === STREAM_TYPES.MP4,
        isDash: type === STREAM_TYPES.DASH,
        isRtmp: type === STREAM_TYPES.RTMP,
        isRtsp: type === STREAM_TYPES.RTSP,
        isIptvLive: type === STREAM_TYPES.IPTV_LIVE,
        isUnknown: type === STREAM_TYPES.UNKNOWN
    };
}

function shouldUseHlsPipeline(streamInfo) {
    return (
        streamInfo?.isHls ||
        streamInfo?.isIptvLive
    );
}

function shouldUseNativeDirect(streamInfo) {
    return (
        streamInfo?.isMp4 ||
        streamInfo?.isMpegTs
    );
}

function isUnsupportedByWeb(streamInfo) {
    return (
        streamInfo?.isRtmp ||
        streamInfo?.isRtsp
    );
}

export {
    STREAM_TYPES,
    detectStreamType,
    shouldUseHlsPipeline,
    shouldUseNativeDirect,
    isUnsupportedByWeb
};
