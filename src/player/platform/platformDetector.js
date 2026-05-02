// src/player/platform/platformDetector.js

const PLATFORM_TYPES = Object.freeze({
    LG_WEBOS: 'lg-webos',
    SAMSUNG_TIZEN: 'samsung-tizen',
    BROWSER: 'browser',
    TV_BROWSER: 'tv-browser',
    UNKNOWN: 'unknown'
});

const DEVICE_TYPES = Object.freeze({
    TV: 'tv',
    DESKTOP: 'desktop',
    MOBILE: 'mobile',
    UNKNOWN: 'unknown'
});

function safeLower(value = '') {
    return String(value || '').toLowerCase();
}

function hasWebOS() {
    const ua = safeLower(navigator?.userAgent);
    const hasWebOSObject = typeof window !== 'undefined' && (
        typeof window.webOS !== 'undefined' ||
        typeof window.webOSSystem !== 'undefined'
    );

    return (
        hasWebOSObject ||
        ua.includes('webos') ||
        ua.includes('web0s') ||
        ua.includes('webappmanager')
    );
}

function hasTizen() {
    const ua = safeLower(navigator?.userAgent);
    const hasTizenObject = typeof window !== 'undefined' && (
        typeof window.tizen !== 'undefined' ||
        typeof window.webapis !== 'undefined'
    );

    return (
        hasTizenObject ||
        ua.includes('tizen') ||
        ua.includes('smart-tv') ||
        ua.includes('samsung')
    );
}

function isLikelyTVBrowser() {
    const ua = safeLower(navigator?.userAgent);

    return (
        ua.includes('smart-tv') ||
        ua.includes('smarttv') ||
        ua.includes('hbbtv') ||
        ua.includes('netcast') ||
        ua.includes('webos') ||
        ua.includes('tizen') ||
        ua.includes('tv')
    );
}

function isLikelyMobile() {
    const ua = safeLower(navigator?.userAgent);

    return (
        ua.includes('android') ||
        ua.includes('iphone') ||
        ua.includes('ipad') ||
        ua.includes('mobile')
    );
}

function detectPlatform() {
    const userAgent = navigator?.userAgent || '';
    const ua = safeLower(userAgent);

    let platform = PLATFORM_TYPES.UNKNOWN;
    let deviceType = DEVICE_TYPES.UNKNOWN;

    if (hasWebOS()) {
        platform = PLATFORM_TYPES.LG_WEBOS;
        deviceType = DEVICE_TYPES.TV;
    } else if (hasTizen()) {
        platform = PLATFORM_TYPES.SAMSUNG_TIZEN;
        deviceType = DEVICE_TYPES.TV;
    } else if (isLikelyTVBrowser()) {
        platform = PLATFORM_TYPES.TV_BROWSER;
        deviceType = DEVICE_TYPES.TV;
    } else {
        platform = PLATFORM_TYPES.BROWSER;
        deviceType = isLikelyMobile() ? DEVICE_TYPES.MOBILE : DEVICE_TYPES.DESKTOP;
    }

    const isSimulatorLike =
        ua.includes('simulator') ||
        ua.includes('emulator') ||
        ua.includes('chrome') ||
        ua.includes('localhost') ||
        safeLower(location?.hostname).includes('localhost');

    return {
        platform,
        deviceType,
        userAgent,
        isLGWebOS: platform === PLATFORM_TYPES.LG_WEBOS,
        isSamsungTizen: platform === PLATFORM_TYPES.SAMSUNG_TIZEN,
        isBrowser: platform === PLATFORM_TYPES.BROWSER,
        isTV: deviceType === DEVICE_TYPES.TV,
        isSimulatorLike,
        capabilities: detectCapabilities(platform)
    };
}

function detectCapabilities(platform) {
    const video = document.createElement('video');

    const nativeHls =
        video.canPlayType('application/vnd.apple.mpegurl') ||
        video.canPlayType('application/x-mpegURL');

    const mp4 =
        video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"') ||
        video.canPlayType('video/mp4');

    const mse =
        typeof window !== 'undefined' &&
        typeof window.MediaSource !== 'undefined';

    const samsungAvplay =
        typeof window !== 'undefined' &&
        typeof window.webapis !== 'undefined' &&
        !!window.webapis?.avplay;

    return {
        nativeHls: Boolean(nativeHls),
        nativeHlsScore: nativeHls || '',
        mp4: Boolean(mp4),
        mp4Score: mp4 || '',
        mse,
        hlsJsPossible: mse,
        samsungAvplay,
        platform
    };
}

function getPlatformLabel(platformInfo = detectPlatform()) {
    if (platformInfo.isLGWebOS) return 'LG webOS';
    if (platformInfo.isSamsungTizen) return 'Samsung Tizen';
    if (platformInfo.isTV) return 'TV Browser';
    return 'Browser';
}

export {
    PLATFORM_TYPES,
    DEVICE_TYPES,
    detectPlatform,
    detectCapabilities,
    getPlatformLabel
};
