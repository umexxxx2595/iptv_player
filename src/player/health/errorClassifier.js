export const ErrorKinds = {
    AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    MANIFEST_TIMEOUT: 'MANIFEST_TIMEOUT',
    SOFT_BUFFER: 'SOFT_BUFFER',
    MEDIA_RECOVERABLE: 'MEDIA_RECOVERABLE',
    NETWORK_RECOVERABLE: 'NETWORK_RECOVERABLE',
    DECODE_STALL: 'DECODE_STALL',
    UNSUPPORTED_CODEC: 'UNSUPPORTED_CODEC',
    UNKNOWN: 'UNKNOWN'
};

export function classifyHlsError(data = {}) {
    if (!data) return ErrorKinds.UNKNOWN;

    const status = data?.response?.code || data?.networkDetails?.status || data?.error?.status;

    if (status === 401 || status === 403) return ErrorKinds.AUTH_FORBIDDEN;
    if (status === 404) return ErrorKinds.NOT_FOUND;
    
    if (data.details === 'manifestLoadTimeOut') return ErrorKinds.MANIFEST_TIMEOUT;
    
    if (
        data.details === 'bufferStalledError' || 
        data.details === 'bufferSeekOverHole' || 
        data.details === 'bufferNudgeOnStall'
    ) {
        return ErrorKinds.SOFT_BUFFER;
    }

    // HLS.js specific error types
    if (window.Hls && data.type === window.Hls.ErrorTypes?.MEDIA_ERROR) {
        return ErrorKinds.MEDIA_RECOVERABLE;
    }
    if (window.Hls && data.type === window.Hls.ErrorTypes?.NETWORK_ERROR) {
        return ErrorKinds.NETWORK_RECOVERABLE;
    }

    // Fallback for custom or direct string types
    if (data.type === 'mediaError') return ErrorKinds.MEDIA_RECOVERABLE;
    if (data.type === 'networkError') return ErrorKinds.NETWORK_RECOVERABLE;

    return ErrorKinds.UNKNOWN;
}
