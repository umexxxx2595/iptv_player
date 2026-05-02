/**
 * ============================================================================
 * PLAYER SCREEN – The Sovereign Theater (v38.4 – THE LEGENDARY EDITION)
 * ---------------------------------------------------------------------------
 *  • Optimized for LG WebOS, HLS streaming & 4K displays
 *  • Full ARIA support, focus‑visible, D‑PAD remote navigation
 *  • Skeleton loader + lazy image handling
 *  • Immutable state + pure reducers (easier debugging)
 *  • Custom events: player:close, player:error, player:settings, player:refreshed
 *  • Public API: renderPlayerScreen(channel, opts), closePlayer(),
 *                getPlayerState(), refreshPlayer()
 * ============================================================================
 */

import { routeTo, showToast } from '../../bootstrap.js';
import { PlaybackOrchestrator } from '../../player/playbackOrchestrator.js';
import playlistEngine from '../../content/playlistEngine.js';
import { toggleFavorite, isFavorite } from '../../utils/favoritesStore.js';
import { loadStrategyCache, saveStrategyCache } from '../../player/resolver/strategyCache.js';
import { detectStreamType } from '../../player/resolver/streamTypeDetector.js';

/* -------------------------------------------------------------------------
   CONSTANTS (can be overridden by CSS vars if desired)
   ------------------------------------------------------------------------- */
const HUD_HIDE_DELAY = 2200;           // ms → HUD auto‑hide
const CHANNEL_SWITCH_DEBOUNCE = 300;          // ms → prevent rapid channel flips
const SEEK_STEP = 10;             // seconds (← / →) for live seek
const VOLUME_STEP = 0.1;            // 10 %
const SKELETON_CLASS = 'skeleton-shimmer';

/* -------------------------------------------------------------------------
   FEATURE FLAGS (Stage U6 Stability)
   ------------------------------------------------------------------------- */
const ENABLE_HLS_COMPAT_RETRY = false;
const ENABLE_NATIVE_LAST_RESORT = false;

/* -------------------------------------------------------------------------
   GLOBAL EVENT GUARD
   ------------------------------------------------------------------------- */


/* -------------------------------------------------------------------------
   STATE – immutable, single source of truth
   ------------------------------------------------------------------------- */
let playerState = {
    /** Runtime guards */
    renderToken: 0,
    isRendering: false,
    playerEventsBound: false,
    isSwitchingChannel: false,

    /** Playback flags */
    isPlaying: false,
    isFullscreen: false,
    isHudVisible: true,
    playbackStartedToastShown: false,
    /** Media */
    video: null,                 // <video> element reference
    hls: null,                   // HLS.js instance (if used)
    hasFirstFrame: false,        // True after playback actually starts
    lastHlsRecoveryAt: 0,        // Timestamp of last recovery attempt
    /** Channel navigation */
    currentChannel: null,
    channelList: [],
    currentIndex: 0,
    switchLock: false,
    playbackSessionId: 0,
    isResolvingStream: false,
    lastPlaybackError: null,
    /** Timers */
    hudTimeout: null,
    timeInterval: null,
    bufferingTimer: null,
    zapTimer: null,
    loaderStageTimer: null,
    loaderTimeoutTimer: null,
    loaderHardTimeoutTimer: null,
    firstFrameTimer: null,
    authFailureCount: 0,
    forbiddenSegmentCount: 0,
    strategyCache: {},           // Will be loaded via orchestrator or helper
    strategyCacheLoaded: false,
    lastHudActivityAt: 0,        // Throttling for HUD reveal
    hasError: false,
    /** Zap Queue */
    pendingZapIndex: null,
    pendingZapChannel: null,
    lastZapAt: 0,
    /** Audio */
    volume: 1.0,
    isMuted: false,
    mediaTimeoutId: null,
    playbackHealthTimer: null,
    lastHealthTime: 0,
    lastHealthWallClock: 0,
    stallRecoveries: 0,
    lastHlsActivityAt: 0,
    lastHlsEventName: '',
    mediaTimeoutRetryCount: 0,
    decodeRecoveryCount: 0,
    nativeFallbackTried: false,
    postHlsNativeFallbackTried: false,
    hlsCompatRetryTried: false,
    hlsCompatWatchdogTimer: null,
    finalNudgeTried: false,
    lastAttemptedStrategy: '',
    lastAttemptedUrl: '',
    currentPlaybackStrategy: '',
    lastBufferAppendedAt: 0,
    bufferAppendCount: 0,
    earlyDecodeFallbackTimer: null,
    /** UI refs – set after render */
    refs: {
        container: null,         // #player-overlay or #main-content
        hud: null,              // .player-hud
        loader: null,           // .player-loader
        errorOverlay: null,     // .player-error
        bufferOverlay: null,   // .player-buffering
        playButton: null,        // [data-action="toggle-play"] (button ref)
        video: null,
        preview: null
    },
    lastPlaybackPlan: null
};

/* -------------------------------------------------------------------------
   PURE STATE UPDATERS (immutability)
   ------------------------------------------------------------------------- */
function setState(patch) {
    playerState = { ...playerState, ...patch };
}

function beginPlaybackSession() {
    playerState.playbackSessionId += 1;
    playerState.isResolvingStream = true;
    playerState.lastPlaybackError = null;

    return playerState.playbackSessionId;
}

function isActivePlaybackSession(sessionId) {
    return sessionId === playerState.playbackSessionId;
}

function endPlaybackSession(sessionId) {
    if (!isActivePlaybackSession(sessionId)) return;
    playerState.isResolvingStream = false;
}

/* -------------------------------------------------------------------------
   PUBLIC API – renderPlayerScreen
   ------------------------------------------------------------------------- */
export async function renderPlayerScreen(channel, options = {}) {
    const currentToken = Number.isFinite(playerState.renderToken)
        ? playerState.renderToken
        : 0;

    const renderToken = currentToken + 1;

    playerState.renderToken = renderToken;
    playerState.isRendering = true;

    try {
        console.log(`[Player] [Token:${renderToken}] renderPlayerScreen incoming channel:`, channel);

        if (!channel || !channel.url) {
            throw new Error('Kanal bilgisi eksik veya yayın URL bulunamadı');
        }

        const root = document.getElementById('player-overlay') ||
            document.getElementById('main-content');

        if (!root) {
            throw new Error('Player root alanı bulunamadı');
        }

        // 1. Cleanup before new render (unless skipped by zapping)
        if (!options.skipCleanup) {
            cleanupCurrentPlayback();
        }

        // 2. Set new state
        setState({
            currentChannel: channel,
            channelList: options.channelList || playerState.channelList || [],
            currentIndex: Number.isFinite(options.currentIndex)
                ? options.currentIndex
                : playerState.currentIndex || 0,
            switchLock: false,
            isPlaying: false,
            playbackStartedToastShown: false,
            isHudVisible: true,
            isMuted: false,
            volume: 1.0,
            isFullscreen: false,
            hasFirstFrame: false,
            lastHlsRecoveryAt: 0,
            lastHudActivityAt: 0,
            pendingZapIndex: null,
            authFailureCount: 0,
            forbiddenSegmentCount: 0,
            lastPlaybackError: null,
            lastHlsActivityAt: 0,
            lastHlsEventName: '',
            mediaTimeoutRetryCount: 0,
            stallRecoveries: 0,
            decodeRecoveryCount: 0,
            nativeFallbackTried: false,
            postHlsNativeFallbackTried: false,
            hlsCompatRetryTried: false,
            hlsCompatWatchdogTimer: null,
            finalNudgeTried: false,
            lastAttemptedStrategy: '',
            lastAttemptedUrl: '',
            currentPlaybackStrategy: '',
            lastPlaybackPlan: null,
            lastBufferAppendedAt: 0,
            bufferAppendCount: 0,
            earlyDecodeFallbackTimer: null
        });

        // Initialize orchestrator if not exists
        if (!playerState.orchestrator) {
            playerState.orchestrator = new PlaybackOrchestrator(playerState);
        }

        // 3. Rebuild DOM
        root.classList.remove(
            'has-video',
            'is-playing',
            'is-loading',
            'is-error',
            'has-error'
        );

        root.innerHTML = '';
        buildPlayerStructure(root);

        // 4. Validate refs
        if (!playerState.refs.container || !playerState.refs.video) {
            throw new Error('Player DOM yapısı oluşturulamadı');
        }

        // 5. Setup logic & listeners
        const controlsBound = setupControlListeners();
        if (!controlsBound) {
            throw new Error('Player kontrolleri bağlanamadı');
        }

        setupHudBehaviour();
        refreshLucideIcons();
        syncPlayButton();

        // 6. Show initial shell immediately
        root.classList.remove('hidden');
        root.classList.add('active', 'fade-in');
        root.setAttribute('aria-hidden', 'false');
        root.setAttribute('role', 'region');
        root.setAttribute('aria-label', 'Video oynatıcı');

        showLoader('Sinyal alınıyor…', channel?.name || '');

        requestAnimationFrame(() => {
            const btn = playerState.refs.playButton;
            btn?.focus?.();
            syncHudFocusedClass(btn);
        });

        // 7. Start media resolution in background (NON-BLOCKING)
        initializeAndStartMedia(channel, renderToken);

        return root;

    } catch (error) {
        console.error(`[Player] [Token:${renderToken}] renderPlayerScreen failed:`, error);
        
        handleMediaError({
            type: 'playerRuntimeError',
            details: 'renderPlayerScreenFailed',
            error,
            message: error.message
        });

        if (renderToken === playerState.renderToken) {
            // Only route back if this was the last intended render
            setTimeout(() => routeTo('home'), 2000);
        }
    } finally {
        if (renderToken === playerState.renderToken) {
            playerState.isRendering = false;
        }
    }
}

/**
 * Internal async runner for media init without blocking UI shell
 */
async function initializeAndStartMedia(channel, renderToken) {
    try {
        const mediaReady = await initializeMedia(channel, renderToken);

        if (renderToken !== playerState.renderToken) {
            console.warn(`[Player] [Token:${renderToken}] stale media start ignored`);
            return;
        }

        if (mediaReady !== false) {
            await startPlayback(playerState.playbackSessionId);
        }
    } catch (error) {
        if (renderToken !== playerState.renderToken) return;

        console.error(`[Player] [Token:${renderToken}] initializeAndStartMedia failed:`, error);
        handleMediaError({
            type: 'playerRuntimeError',
            details: 'initializeAndStartMediaFailed',
            error,
            message: error.message
        });
    }
}

/* -------------------------------------------------------------------------
   PLAYER DOM BUILDERS
   ------------------------------------------------------------------------- */
function buildPlayerStructure(container) {
    // ---- Preview Layer (for smooth transitions) ----
    const preview = document.createElement('div');
    preview.className = 'player-preview';
    container.appendChild(preview);
    playerState.refs.preview = preview;

    // ---- Video element (native or HLS) ----
    const video = document.createElement('video');
    video.id = 'sovereign-video';
    video.className = 'player-video';
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('x5-playsinline', '');
    video.setAttribute('preload', 'auto');
    video.controls = false;
    video.muted = false;
    video.volume = 1;
    video.autoplay = false;
    container.appendChild(video);
    playerState.refs.video = video;

    // ---- HUD (toolbar) ----
    const hud = buildHudStructure();
    container.appendChild(hud);
    playerState.refs.hud = hud;

    // ---- Loader (spinner) ----
    const loader = document.createElement('div');
    loader.className = 'player-loader';
    loader.innerHTML = `
        <div class="player-loader-pill">
            <div class="spinner-dual"></div>
            <div class="loader-copy">
                <strong data-loader-title>Sinyal alınıyor…</strong>
                <span data-loader-subtitle class="hidden"></span>
            </div>
        </div>
    `;
    container.appendChild(loader);
    playerState.refs.loader = loader;

    // ---- Buffering overlay ----
    const buffering = document.createElement('div');
    buffering.className = 'player-buffering hidden';
    buffering.innerHTML = `<div class="spinner-dual"></div> <span>Tamponlanıyor…</span>`;
    container.appendChild(buffering);
    playerState.refs.bufferOverlay = buffering;

    // ---- Error overlay ----
    const error = document.createElement('div');
    error.className = 'player-error hidden';
    error.innerHTML = `
        <div class="error-content">
            <i data-lucide="alert-triangle" aria-hidden="true"></i>
            <p class="error-message">Yayın yüklenemedi.</p>
            <div class="error-actions">
                <button class="retry-btn focusable primary" data-action="retry" type="button">
                    TEKRAR DENE
                </button>
                <button class="retry-btn focusable" data-action="next-channel" type="button">
                    SONRAKİ KANAL
                </button>
                <button class="retry-btn focusable" data-action="back" type="button">
                    GERİ DÖN
                </button>
            </div>
        </div>`;
    container.appendChild(error);
    playerState.refs.errorOverlay = error;

    // Assign final refs
    playerState.refs.container = container;
    playerState.refs.playButton = hud.querySelector('[data-action="toggle-play"]');
}

function buildHudStructure() {
    const hud = document.createElement('div');
    hud.className = 'player-hud';
    hud.setAttribute('role', 'toolbar');
    hud.setAttribute('aria-label', 'Oynatıcı kontrolleri');
    hud.append(buildHudTop(), buildHudBottom());
    return hud;
}

/* -------------------------------------------------------------------------
   HUD BUILDERS (top & bottom)
   ------------------------------------------------------------------------- */
function buildHudTop() {
    const top = document.createElement('div');
    top.className = 'hud-top';

    // ---- Channel info (logo + text) ----
    const info = document.createElement('div');
    info.className = 'hud-channel-info';

    const logoWrap = document.createElement('div');
    logoWrap.className = 'hud-logo';

    const logoImg = document.createElement('img');
    logoImg.alt = playerState.currentChannel?.name ?? 'Kanal';
    logoImg.className = `hud-logo-img ${SKELETON_CLASS}`;
    const channel = playerState.currentChannel || {};
    if (channel.logo) {
        loadImage(logoImg, channel.logo);
        logoWrap.classList.remove('hidden');
    } else {
        logoWrap.classList.add('hidden');
    }
    logoWrap.appendChild(logoImg);

    const textInfo = document.createElement('div');
    textInfo.className = 'hud-text';

    const name = document.createElement('h3');
    name.className = 'hud-channel-name';
    name.textContent = playerState.currentChannel?.name ?? 'Bilinmeyen Kanal';

    const group = document.createElement('span');
    group.className = 'hud-group';
    group.textContent = playerState.currentChannel?.group ?? 'Genel';

    textInfo.append(name, group);
    info.append(logoWrap, textInfo);
    top.appendChild(info);

    // ---- Clock (updates each second) ----
    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'hud-time';
    timeDisplay.id = 'player-hud-time';
    timeDisplay.textContent = getCurrentTime();
    top.appendChild(timeDisplay);

    // Start time ticker
    startTimeTicker(timeDisplay);

    return top;
}

function buildHudBottom() {
    const bottom = document.createElement('div');
    bottom.className = 'hud-bottom';

    const actions = document.createElement('div');
    actions.className = 'player-controls';

    const btnDefs = [
        { id: 'prev', icon: 'skip-back', label: 'Önceki Kanal', action: 'prev-channel' },
        { id: 'play', icon: 'pause', label: 'Duraklat', action: 'toggle-play' },
        { id: 'next', icon: 'skip-forward', label: 'Sonraki Kanal', action: 'next-channel' },
        {
            id: 'favorite',
            icon: 'heart',
            label: isFavorite(playerState.currentChannel) ? 'Favorilerden çıkar' : 'Favorilere ekle',
            action: 'toggle-favorite',
            favorite: isFavorite(playerState.currentChannel)
        },
        { id: 'mute', icon: 'volume-2', label: 'Ses', action: 'toggle-mute' },
        { id: 'settings', icon: 'settings', label: 'Ayarlar', action: 'settings' },
        { id: 'fullscreen', icon: 'maximize', label: 'Tam Ekran', action: 'toggle-fullscreen' },
        { id: 'back', icon: 'arrow-left', label: 'Geri Dön', action: 'back' }
    ];

    btnDefs.forEach(btn => {
        const button = document.createElement('button');
        button.className = [
            'action-btn',
            'focusable',
            btn.id === 'play' ? 'play-pause' : '',
            btn.favorite ? 'is-favorite' : ''
        ].filter(Boolean).join(' ');
        
        button.dataset.action = btn.action;
        button.type = 'button';
        button.setAttribute('aria-label', btn.label);
        button.title = btn.label;
        button.tabIndex = 0;

        const icon = document.createElement('i');
        icon.dataset.lucide = btn.icon;
        icon.setAttribute('aria-hidden', 'true');

        button.appendChild(icon);
        actions.appendChild(button);
    });

    bottom.appendChild(actions);

    return bottom;
}

/**
 * ──────────────────────────────────────────────────────────────────────────
 * MEDIA UTILITIES
 * ──────────────────────────────────────────────────────────────────────────
 */



/**
 * High-level media initialization.
 * Now delegates to the orchestrator.
 */
async function initializeMedia(channel, renderToken = playerState.renderToken) {
    const sessionId = beginPlaybackSession();
    const token = renderToken;
    const isFresh = () => playerState.renderToken === token;

    if (!isFresh()) {
        console.warn('[Player] Stale initializeMedia call ignored');
        return false;
    }

    // Load strategy cache if not already loaded
    if (!playerState.strategyCacheLoaded) {
        try {
            playerState.strategyCache = loadStrategyCache();
            playerState.strategyCacheLoaded = true;
        } catch (e) {
            console.warn('[Player] Failed to load strategy cache:', e);
        }
    }

    if (!playerState.orchestrator) {
        playerState.orchestrator = new PlaybackOrchestrator(playerState);
    }

    try {
        setControlsEnabled(false);
        clearLoaderTimers();

        showLoader('Sinyal alınıyor…', channel?.name || '');

        const video = playerState.refs.video;
        if (video) {
            bindVideoLifecycleEvents(video, channel.url, {
                sessionId,
                renderToken
            });
        }

            setTimeout(() => {
                if (isStalePlayback(token, sessionId) || playerState.hasFirstFrame) return;
                nudgePlayback('early-nudge-700ms');
                probeVideoVisibility('early-probe-700ms');
            }, 700);

            setTimeout(() => {
                if (isStalePlayback(token, sessionId) || playerState.hasFirstFrame) return;
                probeVideoVisibility('early-probe-1500ms');
            }, 1500);

            setTimeout(() => {
                if (isStalePlayback(token, sessionId) || playerState.hasFirstFrame) return;
                probeVideoVisibility('early-probe-3500ms');
            }, 3500);

            setTimeout(() => {
                if (isStalePlayback(token, sessionId) || playerState.hasFirstFrame) return;
                probeVideoVisibility('late-probe-6500ms');
            }, 6500);

        const currentSessionId = sessionId;

        // Standard stage timers
        playerState.loaderStageTimer = setTimeout(() => {
            if (isStalePlayback(token, currentSessionId) || playerState.pendingZapIndex !== null) return;
            showLoader('Yayın yanıtı bekleniyor…', channel?.name || '');
        }, 5000);

        playerState.mediaTimeoutId = setTimeout(() => {
            if (
                isStalePlayback(token, currentSessionId) ||
                playerState.hasFirstFrame ||
                playerState.pendingZapIndex !== null
            ) {
                return;
            }

            const video = playerState.refs?.video;

            const hasBufferedData =
                playerState.bufferAppendCount > 0 ||
                playerState.lastBufferAppendedAt > 0;

            const hasNoVideoStart =
                !video ||
                (
                    video.readyState === 0 &&
                    Number(video.currentTime || 0) === 0 &&
                    Number(video.videoWidth || 0) === 0 &&
                    Number(video.videoHeight || 0) === 0
                );

            if (hasBufferedData && hasNoVideoStart) {
                if (!playerState.finalNudgeTried) {
                    playerState.finalNudgeTried = true;

                    console.warn('[Player] Buffered data exists but no first frame. Trying final soft nudge before decodeStall...', {
                        readyState: video?.readyState,
                        currentTime: video?.currentTime,
                        videoWidth: video?.videoWidth,
                        videoHeight: video?.videoHeight,
                        bufferAppendCount: playerState.bufferAppendCount
                    });

                    nudgePlayback('final-soft-nudge-before-decodeStall');

                    playerState.mediaTimeoutId = setTimeout(() => {
                        if (
                            isStalePlayback(token, currentSessionId) ||
                            playerState.hasFirstFrame ||
                            playerState.pendingZapIndex !== null
                        ) {
                            return;
                        }

                        handleMediaError({
                            type: 'decodeStall',
                            message: 'Yayın verisi geldi ancak görüntü başlatılamadı.'
                        });
                    }, 4000);

                    return;
                }

                handleMediaError({
                    type: 'decodeStall',
                    message: 'Yayın verisi geldi ancak görüntü başlatılamadı.'
                });
                return;
            }

            handleMediaError({
                type: 'timeout',
                message: 'Kanal şu an yanıt vermiyor.'
            });
        }, 14000);

        // DELEGATE TO ORCHESTRATOR
        await playerState.orchestrator.play(channel, {
            sessionId,
            renderToken,
            strategyCache: playerState.strategyCache,
            onPlan: (plan) => {
                if (!isActivePlaybackSession(sessionId)) return;

                playerState.lastPlaybackPlan = plan;

                console.info('[Player] Playback plan ready:', {
                    channel: plan.channelName,
                    platform: plan.platform?.platform,
                    streamType: plan.stream?.type,
                    primaryEngine: plan.primaryEngine,
                    runnableEngines: plan.runnableEngines?.map(engine => engine.type),
                    futureEngines: plan.futureEngines?.map(engine => engine.type),
                    bufferPreset: plan.bufferPreset
                });
            },
            onStrategyChange: (strategy) => {
                if (!isActivePlaybackSession(sessionId)) return;

                playerState.currentPlaybackStrategy = strategy;

                console.info(`[Player] Strategy switched to: ${strategy}`);
                
                if (strategy === 'native-hls' || strategy === 'native') {
                    showLoader('Yerel oynatıcı hazırlanıyor…', channel?.name || '');
                } else if (strategy === 'native-probe') {
                    showLoader('Yayın denetleniyor (Hızlı)…', channel?.name || '');
                } else if (strategy === 'direct-hls') {
                    showLoader('Sinyal alınıyor (HLS)…', channel?.name || '');
                } else if (strategy === 'resolver-hls') {
                    showLoader('Yayın çözülüyor (Resolver)…', channel?.name || '');
                }
            },
            onEvent: (name, payload) => {
                if (!isActivePlaybackSession(sessionId)) return;

                if (
                    name === 'manifest_parsed' ||
                    name === 'level_loaded' ||
                    name === 'frag_loaded' ||
                    name === 'buffer_appended'
                ) {
                    playerState.lastHlsActivityAt = Date.now();
                    playerState.lastHlsEventName = name;
                }

                if (name === 'manifest_parsed') {
                    nudgePlayback('manifest_parsed');
                }

                if (name === 'frag_loaded') {
                    nudgePlayback('frag_loaded');
                }

                if (name === 'buffer_appended') {
                    playerState.lastBufferAppendedAt = Date.now();
                    playerState.bufferAppendCount += 1;
                    nudgePlayback('buffer_appended');
                }

                if (name === 'error') {
                    if (payload.kind === 'AUTH_FORBIDDEN') {
                        playerState.forbiddenSegmentCount += 1;

                        console.warn('[Player] Forbidden segment/auth error:', {
                            count: playerState.forbiddenSegmentCount,
                            details: payload?.data?.details,
                            fatal: payload?.fatal
                        });

                        if (playerState.forbiddenSegmentCount >= 2) {
                            handleMediaError({
                                type: 'authForbidden',
                                message: 'Bu yayın erişimi reddetti. Token süresi dolmuş veya kanal şu anda kapalı olabilir.'
                            });
                        }

                        return;
                    }

                    if (payload.kind === 'NOT_FOUND') {
                        handleMediaError({
                            type: 'notFound',
                            message: 'Yayın parçası bulunamadı. Kanal geçici olarak kullanılamıyor.'
                        });
                    }
                }
            }
        });

        return true;

    } catch (error) {
        // KANAL DEĞİŞTİRME GİBİ GERÇEK İPTALLERİ SESSİZCE GEÇ
        const isZapping = !isActivePlaybackSession(sessionId) || renderToken !== playerState.renderToken;
        if (error?.type === 'aborted' || (error?.type === 'stale' && isZapping)) {
            console.warn(`[Player] Zapping abort ignored:`, error);
            return false;
        }
        
        // MOTOR GERÇEKTEN PATLADIYSA (CORS/404) GİZLEME, ORKESTRAYA BİLDİR Kİ NATIVE'E GEÇSİN!
        console.error(`[Player] Media Engine Error:`, error);
        handleMediaError(error);
        return false;
    } finally {
        endPlaybackSession(sessionId);
    }
}


function setControlsEnabled(enabled) {
    const hud = playerState.refs.hud;
    if (!hud) return;
    hud.classList.toggle('controls-disabled', !enabled);
}




/**
 * Bind common video lifecycle events (Native & HLS).
 */
function bindVideoLifecycleEvents(video, url, meta = {}) {
    const sessionId = meta.sessionId || playerState.playbackSessionId;
    const renderToken = Number.isFinite(meta.renderToken)
        ? meta.renderToken
        : playerState.renderToken;

    const isFresh = () => {
        return (
            isActivePlaybackSession(sessionId) &&
            renderToken === playerState.renderToken &&
            video === playerState.refs.video
        );
    };

    const guarded = (fn) => {
        return (...args) => {
            if (!isFresh()) return;
            return fn(...args);
        };
    };



    video.onplaying = guarded(() => {
        markPlaybackAlive('playing');

        video.classList.add('ready');

        // Apply smooth fade to container
        playerState.refs.container?.classList.add('has-video');

        // Enable controls now that we have video
        setControlsEnabled(true);

        // Smoothly fade out preview
        if (playerState.refs.preview) {
            playerState.refs.preview.classList.add('fade-out');
        }

        clearLoaderTimers();
        setState({ isPlaying: true });
        syncPlayButton();
        resetHudTimer();

        if (!playerState.playbackStartedToastShown) {
            playerState.playbackStartedToastShown = true;
            showToast(`${playerState.currentChannel?.name || 'Yayın'} başladı`, 'success');
        }

        // Diagnostic check for audio-only scenarios
        setTimeout(() => {
            if (!isFresh()) return;
            if (video.currentTime > 0 && (video.videoWidth === 0 || video.videoHeight === 0)) {
                console.warn('[Player] Audio detected but no video frame. Codec/render issue suspected.', {
                    currentTime: video.currentTime,
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight,
                    readyState: video.readyState
                });
            }
        }, 1500);
    });

    video.onloadedmetadata = guarded(() => {
        console.log('[Video] metadata', {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            duration: video.duration,
            readyState: video.readyState,
            networkState: video.networkState
        });

        if (video.readyState >= 2 || video.currentTime > 0) {
            probeVideoVisibility('loadedmetadata');
            return;
        }

        if (video.videoWidth > 0 && video.videoHeight > 0) {
            showLoader('Görüntü hazırlanıyor…', playerState.currentChannel?.name || '');

            const metadataProbeSessionId = sessionId;
            const metadataProbeRenderToken = renderToken;

            setTimeout(() => {
                if (
                    !isActivePlaybackSession(metadataProbeSessionId) ||
                    metadataProbeRenderToken !== playerState.renderToken ||
                    video !== playerState.refs.video ||
                    playerState.hasFirstFrame
                ) {
                    return;
                }

                probeVideoVisibility('metadata-delayed-probe');
            }, 2500);

            return;
        }

        if (!playerState.hasFirstFrame) {
            showLoader('İlk görüntü bekleniyor…', playerState.currentChannel?.name || '');
        }
    });

    video.oncanplay = guarded(() => {
        markPlaybackAlive('canplay');
        syncPlayButton();
    });

    video.onloadeddata = guarded(() => {
        markPlaybackAlive('loadeddata');
        syncPlayButton();
    });

    video.onpause = guarded(() => {
        setState({ isPlaying: false });
        syncPlayButton();
    });

    video.onended = guarded(() => {
        setState({ isPlaying: false });
        syncPlayButton();
    });

    video.onerror = guarded(() => {
        const strategy = playerState.currentPlaybackStrategy || playerState.lastAttemptedStrategy;

        if (!playerState.hasFirstFrame && strategy === 'native-probe') {
            console.warn('[Player] Native probe video error ignored, waiting for orchestrator fallback:', {
                strategy,
                error: video.error,
                readyState: video.readyState,
                networkState: video.networkState
            });

            setState({ isPlaying: false });
            syncPlayButton();

            return;
        }

        setState({ isPlaying: false });
        syncPlayButton();

        handleMediaError({
            type: 'native',
            error: video.error,
            fatal: true,
            streamType: meta.streamType || detectStreamType(url)
        });
    });

    video.onwaiting = guarded(() => delayedShowBuffering());
    video.onstalled = guarded(() => delayedShowBuffering());

    video.ontimeupdate = guarded(() => {
        if (video.currentTime > 0 && video.readyState >= 2 && !playerState.hasFirstFrame) {
            markPlaybackAlive('timeupdate');
        }
    });
}

/* -------------------------------------------------------------------------
   PLAYBACK CONTROL
   ------------------------------------------------------------------------- */
async function startPlayback(sessionId = playerState.playbackSessionId) {
    const video = playerState.refs.video;

    if (!video) return false;

    if (!isActivePlaybackSession(sessionId)) {
        console.warn('[Player] Stale startPlayback ignored');
        return false;
    }

    // Show loader until playback actually starts
    showLoader('Yayın bağlanıyor…');

    try {
        video.muted = playerState.isMuted === true;
        video.volume = Number.isFinite(playerState.volume) ? playerState.volume : 1;

        await video.play();

        if (!isActivePlaybackSession(sessionId)) {
            console.warn('[Player] Stale playback success ignored');
            return false;
        }

        setState({ isPlaying: true });
        syncPlayButton();

        if (video.readyState >= 2 || video.currentTime > 0) {
            markPlaybackAlive('play-promise-resolved');
        }

        return true;
    } catch (error) {
        if (!isActivePlaybackSession(sessionId)) {
            console.warn('[Player] Stale autoplay error ignored:', error);
            return false;
        }

        console.warn('[Player] Autoplay blocked or failed:', error);

        setState({ isPlaying: false });
        syncPlayButton();

        hideLoader();

        // Do NOT call handleMediaError for autoplay issues
        showToast('Oynatmak için OK / Play tuşuna basın', 'info');
        return false;
    } finally {
        if (isActivePlaybackSession(sessionId)) {
            endPlaybackSession(sessionId);
        }
    }
}

/**
 * Toggle play / pause and update HUD icon.
 */
async function togglePlayPause() {
    const video = playerState.refs.video;
    if (!video) return;

    // Yayın henüz ilk frame vermediyse pause/play toggle yapma.
    // Bu aşamada pause() çağırmak video.play() isteğini bozuyor.
    if (!playerState.hasFirstFrame) {
        showToast('Yayın hazırlanıyor…', 'info');
        nudgePlayback('toggle-during-loading');
        syncPlayButton();
        return;
    }

    if (playerState.isResolvingStream || playerState.pendingZapIndex !== null) {
        showToast('Yayın hazırlanıyor…', 'info');
        nudgePlayback('toggle-during-resolving');
        return;
    }

    try {
        if (video.paused || video.ended) {
            await video.play();
            setState({ isPlaying: true });
        } else {
            video.pause();
            setState({ isPlaying: false });
        }
    } catch (error) {
        console.warn('[Player] Toggle playback failed:', error);
        showToast('Oynatma başlatılamadı', 'warning');
    } finally {
        syncPlayButton();
        resetHudTimer();
    }
}

/**
 * Synchronize the play/pause button icon and label based on actual video state.
 */
function syncPlayButton() {
    const button = playerState.refs.playButton || playerState.refs.container?.querySelector('[data-action="toggle-play"]');
    if (!button) return;

    if (!playerState.refs.playButton) {
        playerState.refs.playButton = button;
    }

    const video = playerState.refs.video;
    const isPlaying = Boolean(
        video &&
        !video.paused &&
        !video.ended &&
        video.readyState > 2
    );

    const iconName = isPlaying ? 'pause' : 'play';
    const label = isPlaying ? 'Duraklat' : 'Oynat';

    button.setAttribute('aria-label', label);
    button.title = label;

    // Lucide <i> elementlerini <svg>'ye çevirdiği için
    // ikonu dataset ile değiştirmek yerine buton içeriğini yeniden basıyoruz.
    if (button.dataset.iconState !== iconName) {
        button.dataset.iconState = iconName;
        button.innerHTML = `<i data-lucide="${iconName}" aria-hidden="true"></i>`;
        refreshLucideIcons();
    }
}

function updatePlayIcon() {
    syncPlayButton();
}

/**
 * Mute / unmute toggle – updates HUD icon and persists volume state.
 */
function toggleMute() {
    const { video } = playerState.refs;
    if (!video) return;

    const nextMuted = !playerState.isMuted;
    video.muted = nextMuted;
    setState({ isMuted: nextMuted });

    const muteIcon = playerState.refs.hud?.querySelector('[data-action="toggle-mute"] i');
    if (muteIcon) {
        muteIcon.dataset.lucide = nextMuted ? 'volume-x' : 'volume-2';
        refreshLucideIcons();
    }

    showToast(nextMuted ? 'Sessiz' : 'Ses açık', 'info');
}

/**
 * Volume step up / down (via remote keys).
 */
function adjustVolume(delta) {
    const { video } = playerState.refs;
    if (!video) return;

    const newVol = Math.max(0, Math.min(1, playerState.volume + delta));
    video.volume = newVol;

    // If volume is changed above zero while muted, unmute to keep UX consistent.
    const shouldUnmute = newVol > 0 && playerState.isMuted;
    if (shouldUnmute) {
        video.muted = false;
    }

    setState({
        volume: newVol,
        isMuted: shouldUnmute ? false : playerState.isMuted
    });

    if (shouldUnmute) {
        const muteIcon = playerState.refs.hud?.querySelector('[data-action="toggle-mute"] i');
        if (muteIcon) {
            muteIcon.dataset.lucide = 'volume-2';
            refreshLucideIcons();
        }
    }

    showToast(`Ses: ${Math.round(newVol * 100)}%`, 'info');
}

/**
 * Fullscreen handling (WebKit, MS, native).
 */
function toggleFullscreen() {
    if (!playerState.refs.container) return;

    if (playerState.isFullscreen) {
        exitFullscreen();
    } else {
        requestFullscreen();
    }
}

async function requestFullscreen() {
    const el = playerState.refs.container;
    try {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        else if (el.msRequestFullscreen) await el.msRequestFullscreen();

        setState({ isFullscreen: true });
        updateFullscreenIcon(true);
    } catch (err) {
        console.warn('[Player] Fullscreen request failed:', err);
    }
}

async function exitFullscreen() {
    try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        else if (document.msExitFullscreen) await document.msExitFullscreen();

        setState({ isFullscreen: false });
        updateFullscreenIcon(false);
    } catch (err) {
        console.warn('[Player] Fullscreen exit failed:', err);
    }
}

/**
 * Update fullscreen button icon.
 */
function updateFullscreenIcon(isFs) {
    const btnIcon = playerState.refs.hud?.querySelector('[data-action="toggle-fullscreen"] i');
    if (!btnIcon) return;
    btnIcon.dataset.lucide = isFs ? 'minimize' : 'maximize';
    refreshLucideIcons();
}



/* -------------------------------------------------------------------------
   HUD BEHAVIOUR – auto‑hide + interaction reset
   ------------------------------------------------------------------------- */
function setupHudBehaviour() {
    resetHudTimer();
}

/**
 * Resets the auto‑hide timer and makes HUD visible.
 */
function resetHudTimer() {
    const hud = playerState.refs.hud;
    if (!hud) return;

    hud.classList.remove('hud-hidden');
    setState({ isHudVisible: true });

    if (playerState.hudTimeout) {
        clearTimeout(playerState.hudTimeout);
    }

    playerState.hudTimeout = setTimeout(() => {
        hud.classList.add('hud-hidden');
        setState({ isHudVisible: false });
    }, HUD_HIDE_DELAY);
}

function handleHudActivity() {
    const now = Date.now();
    if (now - playerState.lastHudActivityAt < 250) {
        return;
    }
    playerState.lastHudActivityAt = now;
    resetHudTimer();
}

/* -------------------------------------------------------------------------
   REMOTE CONTROL (D‑PAD, media keys)
   ------------------------------------------------------------------------- */
/**
 * Handles Arrow keys, Enter, Back/Exit and media shortcuts.
 */
function remoteKeyHandler(e) {
    const container = playerState.refs.container;
    if (!container || !container.classList.contains('active')) return;

    const handledKeys = [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Enter',
        ' ',
        'Backspace',
        'Escape',
        'BrowserBack',
        'GoBack',
        'MediaPlayPause',
        'MediaStop',
        'VolumeUp',
        'VolumeDown',
        'MediaMute'
    ];

    if (handledKeys.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
    }

    // --------------------------------------------------------------
    // Special Case: Error Overlay is visible
    // --------------------------------------------------------------
    const errorVisible =
        playerState.refs.errorOverlay &&
        !playerState.refs.errorOverlay.classList.contains('hidden');

    if (errorVisible) {
        if (e.key === 'Enter' || e.key === ' ') {
            const focused = document.activeElement;
            if (focused?.closest('.player-error') && focused.dataset.action) {
                focused.click();
                return;
            }

            const retryButton =
                playerState.refs.errorOverlay.querySelector('[data-action="retry"]');
            retryButton?.click();
            return;
        }

        if (
            e.key === 'Backspace' ||
            e.key === 'Escape' ||
            e.key === 'BrowserBack' ||
            e.key === 'GoBack'
        ) {
            closePlayer();
            return;
        }
        return; // swallow other keys when error is shown
    }

    // Reset HUD timer on any key press
    resetHudTimer();

    switch (e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            playerState.isHudVisible
                ? navigateHud('prev')
                : switchChannel(-1);
            break;
        case 'ArrowRight':
            e.preventDefault();
            playerState.isHudVisible
                ? navigateHud('next')
                : switchChannel(1);
            break;
        case 'ArrowUp':
        case 'ArrowDown':
            e.preventDefault();
            // Simple HUD reveal
            resetHudTimer();
            break;
        case 'Enter':
            e.preventDefault();

            if (!playerState.hasFirstFrame) {
                showToast('Yayın hazırlanıyor…', 'info');
                nudgePlayback('remote-enter-while-loading');
                syncPlayButton();
                return;
            }

            playerState.isHudVisible
                ? activateFocusedControl()
                : togglePlayPause();
            break;
        case 'Backspace':
        case 'Escape':
        case 'BrowserBack':
        case 'GoBack':
            e.preventDefault();
            closePlayer();
            break;
        case 'MediaPlayPause':
            e.preventDefault();
            togglePlayPause();
            break;
        case 'MediaStop':
            e.preventDefault();
            closePlayer();
            break;
        case 'VolumeUp':
            e.preventDefault();
            adjustVolume(VOLUME_STEP);
            break;
        case 'VolumeDown':
            e.preventDefault();
            adjustVolume(-VOLUME_STEP);
            break;
        case 'MediaMute':
            e.preventDefault();
            toggleMute();
            break;
        default:
            // No‑op for other keys
            break;
    }
}

/**
 * Move focus inside HUD (prev / next).
 */
function navigateHud(direction) {
    const focusables = playerState.refs.hud?.querySelectorAll('.focusable');
    if (!focusables?.length) return;

    const active = document.activeElement;
    const idx = Array.from(focusables).indexOf(active);
    let nextIdx = idx;

    if (direction === 'next') {
        nextIdx = (idx + 1) % focusables.length;
    } else {
        nextIdx = (idx - 1 + focusables.length) % focusables.length;
    }
    
    const target = focusables[nextIdx];
    target?.focus();
    syncHudFocusedClass(target);
}

/**
 * Manually manages the .focused class for better TV D-PAD visibility stability.
 */
function syncHudFocusedClass(target) {
    if (!playerState.refs.hud) return;

    playerState.refs.hud.querySelectorAll('.action-btn').forEach((btn) => {
        btn.classList.toggle('focused', btn === target);
    });
}



/**
 * Simulate a click on the currently focused HUD button.
 */
function activateFocusedControl() {
    const focused = document.activeElement;
    if (focused?.classList.contains('action-btn')) {
        focused.click();
    }
}

/* -------------------------------------------------------------------------
   CONTROL LISTENERS (HUD buttons)
   ------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------
   STALE & ACTION GUARDS
   ------------------------------------------------------------------------- */
let lastPlayerActionAt = 0;
let lastPlayerAction = '';

const PLAYER_ACTION_GUARD_MS = {
    'next-channel': 280,
    'prev-channel': 280,
    'toggle-play': 220,
    'back': 450,
    'toggle-favorite': 250
};

function shouldIgnorePlayerAction(action) {
    const now = performance.now();
    const guardMs = PLAYER_ACTION_GUARD_MS[action] || 120;

    if (action === lastPlayerAction && (now - lastPlayerActionAt < guardMs)) {
        console.debug('[Player] Action ignored by guard:', action);
        return true;
    }

    lastPlayerAction = action;
    lastPlayerActionAt = now;
    return false;
}

function isStalePlayback(token, sessionId) {
    return (
        token !== playerState.renderToken ||
        sessionId !== playerState.playbackSessionId ||
        !playerState.refs?.video
    );
}

function setupControlListeners() {
    const container = playerState.refs.container;

    if (!container) {
        console.error('[Player] setupControlListeners failed: container missing');
        return false;
    }

    if (playerState.playerEventsBound) {
        console.debug('[Player] setupControlListeners: already bound');
        return true;
    }

    container.addEventListener('click', handlePlayerClick);
    container.addEventListener('keydown', handlePlayerKeydown);

    document.addEventListener('keydown', remoteKeyHandler, true);
    document.addEventListener('mousemove', handleHudActivity);
    document.addEventListener('click', handleHudActivity);
    document.addEventListener('touchstart', handleHudActivity);

    playerState.playerEventsBound = true;
    return true;
}

function handlePlayerClick(e) {
    const target = e.target.closest('[data-action]');
    const action = target?.dataset?.action;
    if (!action) return;

    const isLocked =
        target?.classList?.contains('is-loading-locked') ||
        target?.getAttribute?.('aria-disabled') === 'true';
    if (isLocked) {
        e.preventDefault();
        e.stopPropagation();
        return;
    }

    if (shouldIgnorePlayerAction(action)) {
        e.preventDefault();
        e.stopPropagation();
        return;
    }

    console.log('[Player] Action clicked:', action);
    resetHudTimer();
    syncHudFocusedClass(target);

    switch (action) {
        case 'toggle-play':
            if (!playerState.hasFirstFrame) {
                e.preventDefault();
                e.stopPropagation();
                showToast('Yayın hazırlanıyor…', 'info');
                nudgePlayback('click-toggle-while-loading');
                syncPlayButton();
                return;
            }

            togglePlayPause();
            break;

        case 'toggle-favorite':
            handleToggleFavorite(target);
            break;

        case 'prev-channel':
            switchChannel(-1);
            break;

        case 'next-channel':
            switchChannel(1);
            break;

        case 'toggle-mute':
            toggleMute();
            break;

        case 'settings':
            openSettings();
            break;

        case 'toggle-fullscreen':
            toggleFullscreen();
            break;

        case 'retry':
            retryPlayback();
            break;

        case 'back':
            closePlayer();
            break;

        default:
            console.warn('[Player] Bilinmeyen action:', action);
            break;
    }
}

/**
 * Toggles favorite state and updates UI icon
 */
function handleToggleFavorite(button) {
    const channel = playerState.currentChannel;
    if (!channel) return;

    const active = toggleFavorite(channel);

    button.classList.toggle('is-favorite', active);
    button.setAttribute(
        'aria-label',
        active ? 'Favorilerden çıkar' : 'Favorilere ekle'
    );
    button.title = active ? 'Favorilerden çıkar' : 'Favorilere ekle';

    button.innerHTML = '<i data-lucide="heart" aria-hidden="true"></i>';
    refreshLucideIcons();

    showToast(
        active ? 'Favorilere eklendi' : 'Favorilerden çıkarıldı',
        active ? 'success' : 'info'
    );
}

function handlePlayerKeydown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;

    const target = e.target.closest('[data-action]');
    if (!target) return;

    e.preventDefault();
    target.click();
}

/**
 * Open player‑settings modal (custom event, parent can listen).
 */
function openSettings() {
    const ev = new CustomEvent('player:settings', {
        detail: { channel: playerState.currentChannel },
        bubbles: true,
        composed: true
    });
    playerState.refs.container?.dispatchEvent(ev);
}

/* -------------------------------------------------------------------------
   LOADER / BUFFERING / ERROR OVERLAYS
   ------------------------------------------------------------------------- */
function showLoader(message = 'Sinyal alınıyor…', subMessage = '') {
    const container = playerState.refs?.container;

    if (playerState.hasFirstFrame && container?.classList.contains('is-playing')) {
        return;
    }

    if (container) {
        container.classList.add('is-loading');
        container.classList.remove('is-error', 'has-error');
    }

    playerState.hasError = false;
    hideErrorOverlaySafe();

    const loader = playerState.refs.loader;
    if (loader) {
        const titleEl = loader.querySelector('[data-loader-title]');
        const subEl = loader.querySelector('[data-loader-subtitle]');

        if (titleEl) titleEl.textContent = message;

        if (subEl) {
            subEl.textContent = subMessage;
            subEl.classList.toggle('hidden', !subMessage);
        }

        loader.style.display = '';
        loader.classList.remove('hidden');
        loader.setAttribute('aria-hidden', 'false');

        const playButton = playerState.refs?.playButton;
        if (playButton && !playerState.hasFirstFrame) {
            playButton.classList.add('is-loading-locked');
            playButton.setAttribute('aria-disabled', 'true');
        }

        // Disable other non-essential controls during initial load
        const hud = playerState.refs.hud;
        if (hud && !playerState.hasFirstFrame) {
            const extraActions = hud.querySelectorAll('.action-btn[data-action="toggle-favorite"], .action-btn[data-action="settings"], .action-btn[data-action="toggle-fullscreen"]');
            extraActions.forEach(btn => {
                btn.classList.add('is-loading-locked');
                btn.setAttribute('aria-disabled', 'true');
            });
        }
    }
}

function clearLoaderTimers() {
    if (playerState.loaderStageTimer) {
        clearTimeout(playerState.loaderStageTimer);
        playerState.loaderStageTimer = null;
    }
    if (playerState.loaderTimeoutTimer) {
        clearTimeout(playerState.loaderTimeoutTimer);
        playerState.loaderTimeoutTimer = null;
    }
}

function hideLoader() {
    const loader = playerState.refs.loader;
    if (loader) {
        loader.style.display = 'none';
        loader.classList.add('hidden');
        loader.setAttribute('aria-hidden', 'true');
    }
}
function showBuffering() {
    const overlay = playerState.refs.bufferOverlay;
    if (!overlay) return;

    const textEl = overlay.querySelector('span');

    if (playerState.hasFirstFrame) {
        if (textEl) textEl.textContent = 'Sinyal yenileniyor…';
    } else {
        if (textEl) textEl.textContent = 'Yükleniyor…';
    }

    overlay.classList.remove('hidden');
}

function hideBuffering() {
    playerState.refs.bufferOverlay?.classList.add('hidden');
}
function showBufferingSafe() {
    try {
        showBuffering();
    } catch (e) {
        console.warn('[Player] showBuffering failed:', e);
    }
}
function hideBufferingSafe() {
    try {
        hideBuffering();
    } catch (e) {
        console.warn('[Player] hideBuffering failed:', e);
    }
}
function showErrorOverlay(message = 'Yayın yüklenemedi.') {
    playerState.hasError = true;

    const container = playerState.refs?.container;
    if (container) {
        container.classList.add('is-error', 'has-error');
        container.classList.remove('is-loading', 'has-video', 'is-playing');
    }

    hideLoader();
    hideBufferingSafe();

    const video = playerState.refs?.video;
    if (video) {
        video.classList.remove('ready');
        video.style.opacity = '0';
    }

    const overlay = playerState.refs.errorOverlay;
    if (!overlay) return;

    const messageEl = overlay.querySelector('.error-message');
    if (messageEl) {
        messageEl.textContent = message;
    }

    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
}
function hideErrorOverlay() {
    const overlay = playerState.refs.errorOverlay;
    if (!overlay) return;

    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');

    const container = playerState.refs?.container;
    if (container) {
        container.classList.remove('is-error', 'has-error');
    }
}
function hideErrorOverlaySafe() {
    try {
        const errorOverlay = playerState.refs?.errorOverlay;
        if (errorOverlay) {
            errorOverlay.classList.add('hidden');
        }
    } catch (e) {
        console.warn('[Player] hideErrorOverlay failed:', e);
    }
}

/**
 * Force-marks the playback as alive, clearing timeouts and updating UI.
 * This is module-level to be accessible by handleMediaError and other events.
 */
function markPlaybackAlive(reason = 'unknown') {
    const video = playerState.refs?.video;
    const container = playerState.refs?.container || document.getElementById('player-overlay');
    const preview = playerState.refs?.preview;

    if (playerState.mediaTimeoutId) {
        clearTimeout(playerState.mediaTimeoutId);
        playerState.mediaTimeoutId = null;
    }

    clearLoaderTimers();
    clearBufferingTimer();

    if (container) {
        container.classList.add('active', 'has-video', 'is-playing');
        container.classList.remove('is-loading', 'is-error', 'has-error');
    }

    if (video) {
        video.classList.add('ready');

        // Let CSS handle layout, only keep essential overrides for hardware parity
        video.style.opacity = '1';
        video.style.transform = 'translateZ(0)';
    }

    if (preview) {
        preview.classList.add('fade-out');
        preview.style.opacity = '0';
        preview.style.visibility = 'hidden';
        preview.style.pointerEvents = 'none';
        preview.style.display = 'none';
    }

    hideLoader();
    hideBufferingSafe();
    hideErrorOverlaySafe();

    playerState.hasFirstFrame = true;
    saveSuccessfulPlaybackStrategy(reason);

    setControlsEnabled(true);

    const playButton = playerState.refs?.playButton;
    if (playButton) {
        playButton.classList.remove('is-loading-locked');
        playButton.removeAttribute('aria-disabled');
    }

    const hud = playerState.refs.hud;
    if (hud) {
        const extraActions = hud.querySelectorAll('.action-btn.is-loading-locked');
        extraActions.forEach(btn => {
            btn.classList.remove('is-loading-locked');
            btn.removeAttribute('aria-disabled');
        });
    }

    setState({ isPlaying: video ? !video.paused : true });
    syncPlayButton();
    startPlaybackHealthMonitor(reason);

    if (playerState.hlsCompatWatchdogTimer) {
        clearTimeout(playerState.hlsCompatWatchdogTimer);
        playerState.hlsCompatWatchdogTimer = null;
    }

    console.info('[Player] Playback alive:', reason, {
        currentTime: video?.currentTime,
        readyState: video?.readyState,
        videoWidth: video?.videoWidth,
        videoHeight: video?.videoHeight,
        paused: video?.paused
    });
}

function saveSuccessfulPlaybackStrategy(reason = 'unknown') {
    const channel = playerState.currentChannel;
    const strategy = playerState.lastAttemptedStrategy;

    if (!channel || !strategy) return;

    const channelId = channel.uid || channel.id || channel.url;
    if (!channelId) return;

    if (strategy === 'direct-hls-compat') {
        console.info('[Player] Compat strategy succeeded; caching as direct-hls for now.');
        playerState.strategyCache[channelId] = 'direct-hls';
    } else {
        playerState.strategyCache[channelId] = strategy;
    }

    try {
        saveStrategyCache(playerState.strategyCache);
        console.info('[Player] Strategy cached after playback alive:', {
            channel: channel.name,
            strategy,
            reason
        });
    } catch (error) {
        console.warn('[Player] Failed to save successful strategy:', error);
    }
}

function probeVideoVisibility(reason = 'probe') {
    const video = playerState.refs?.video;
    const container = playerState.refs?.container || document.getElementById('player-overlay');

    if (!video || !container) return false;

    const hasProgress = Number(video.currentTime || 0) > 0;
    const hasData = Number(video.readyState || 0) >= 2;
    const hasDimensions = Number(video.videoWidth || 0) > 0 && Number(video.videoHeight || 0) > 0;

    // Metadata/dimension tek başına canlı yayın sayılmaz.
    // En az readyState >= 2 veya currentTime ilerlemesi gerekir.
    const canPromote = hasProgress || hasData;

    if (!canPromote) {
        console.info('[Player] Probe waiting:', reason, {
            currentTime: video.currentTime,
            readyState: video.readyState,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            paused: video.paused,
            networkState: video.networkState
        });
        return false;
    }

    markPlaybackAlive(reason);

    console.info('[Player] Probe promoted playback:', reason, {
        currentTime: video.currentTime,
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        paused: video.paused,
        networkState: video.networkState
    });

    return true;
}

function nudgePlayback(reason = 'nudge') {
    const video = playerState.refs?.video;

    if (!video || playerState.hasFirstFrame || playerState.hasError) {
        return;
    }

    if (video.paused) {
        video.muted = playerState.isMuted === true;
        video.volume = Number.isFinite(playerState.volume) ? playerState.volume : 1;

        video.play?.().catch((error) => {
            console.debug('[Player] Nudge play ignored:', reason, error?.message || error);
        });
    }

    console.debug('[Player] Playback nudged:', reason, {
        paused: video.paused,
        readyState: video.readyState,
        currentTime: video.currentTime,
        networkState: video.networkState
    });
}


function delayedShowBuffering() {
    clearTimeout(playerState.bufferingTimer);
    const delay = playerState.hasFirstFrame ? 2500 : 700;

    playerState.bufferingTimer = setTimeout(() => {
        const video = playerState.refs.video;
        // If video is actually playing, don't show buffering
        if (video && !video.paused && video.readyState >= 3) {
            return;
        }
        showBufferingSafe();
    }, delay);
}

function clearBufferingTimer() {
    clearTimeout(playerState.bufferingTimer);
    playerState.bufferingTimer = null;
}

function startPlaybackHealthMonitor(reason = 'unknown') {
    stopPlaybackHealthMonitor();

    const video = playerState.refs?.video;
    if (!video) return;

    playerState.lastHealthTime = Number(video.currentTime || 0);
    playerState.lastHealthWallClock = Date.now();
    playerState.stallRecoveries = 0;

    playerState.playbackHealthTimer = setInterval(() => {
        checkPlaybackHealth(reason);
    }, 3000);
}

function stopPlaybackHealthMonitor() {
    if (playerState.playbackHealthTimer) {
        clearInterval(playerState.playbackHealthTimer);
        playerState.playbackHealthTimer = null;
    }
}

function checkPlaybackHealth(reason = 'monitor') {
    const video = playerState.refs?.video;
    const container = playerState.refs?.container;

    if (!video || !container?.classList.contains('active')) return;
    if (video.paused || video.ended) return;
    if (playerState.hasError) return;

    const now = Date.now();
    const current = Number(video.currentTime || 0);
    const delta = Math.abs(current - Number(playerState.lastHealthTime || 0));
    const elapsed = now - Number(playerState.lastHealthWallClock || now);

    const hasData = video.readyState >= 2;
    const hasFrame = video.videoWidth > 0 && video.videoHeight > 0;

    if (delta > 0.25) {
        playerState.lastHealthTime = current;
        playerState.lastHealthWallClock = now;
        if (playerState.hasFirstFrame) {
            hideBufferingSafe();
        }
        return;
    }

    if (!playerState.hasFirstFrame) {
        return;
    }

    if (elapsed >= 8000 && hasData && hasFrame) {
        console.warn('[Player] Playback appears stalled:', {
            reason,
            currentTime: current,
            readyState: video.readyState,
            networkState: video.networkState,
            recoveryCount: playerState.stallRecoveries
        });

        showBufferingSafe();

        if (playerState.stallRecoveries < 2) {
            playerState.stallRecoveries += 1;

            try {
                playerState.orchestrator?.activeEngine?.recover?.('network');
            } catch (error) {
                console.warn('[Player] Network recovery failed:', error);
            }

            try {
                video.play?.();
            } catch (error) {
                console.warn('[Player] Re-play after stall failed:', error);
            }

            playerState.lastHealthWallClock = now;
            return;
        }

        handleMediaError({
            type: 'stalled',
            message: 'Yayın akışı durdu. Tekrar deneyebilir veya sonraki kanala geçebilirsiniz.'
        });
    }
}


function isVideoActuallyDead() {
    const video = playerState.refs.video;
    if (!video) return true;

    const hasProgress = video.currentTime > 0;
    const hasData = video.readyState >= 2;
    const hasDimensions = video.videoWidth > 0 && video.videoHeight > 0;

    return !hasProgress && !hasData && !hasDimensions;
}

function hardResetVideoElement(reason = 'hard-reset') {
    const video = playerState.refs?.video;
    if (!video) return;

    try {
        console.warn('[Player] Hard resetting video element:', reason, {
            currentTime: video.currentTime,
            readyState: video.readyState,
            networkState: video.networkState,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight
        });

        video.pause?.();

        video.onplaying = null;
        video.onpause = null;
        video.onended = null;
        video.oncanplay = null;
        video.onloadeddata = null;
        video.onloadedmetadata = null;
        video.onerror = null;
        video.onwaiting = null;
        video.onstalled = null;
        video.ontimeupdate = null;

        video.removeAttribute('src');
        video.srcObject = null;
        video.load?.();

        video.classList.remove('ready');
        video.style.opacity = '0';
    } catch (error) {
        console.warn('[Player] hardResetVideoElement failed:', error);
    }
}

function diagnosePlaybackState() {
    const video = playerState.refs.video;
    const hls = playerState.hls;
    
    const diagnostics = {
        hasVideoRef: !!video,
        readyState: video?.readyState,
        networkState: video?.networkState,
        currentTime: video?.currentTime,
        paused: video?.paused,
        ended: video?.ended,
        videoWidth: video?.videoWidth,
        videoHeight: video?.videoHeight,
        error: video?.error ? { code: video.error.code, message: video.error.message } : null,
        bufferAppendCount: playerState.bufferAppendCount,
        lastBufferAppendedAt: playerState.lastBufferAppendedAt,
        hasHlsInstance: !!hls,
        hlsLevels: hls?.levels?.length,
        currentStrategy: playerState.currentPlaybackStrategy || playerState.lastAttemptedStrategy,
        platform: playerState.lastPlaybackPlan?.platform?.platform,
        isSimulator: playerState.lastPlaybackPlan?.platform?.isSimulatorLike
    };

    console.info('[Player] [U6] Decode Diagnostics:', diagnostics);
    return diagnostics;
}


/* -------------------------------------------------------------------------
   MEDIA ERROR HANDLING
   ------------------------------------------------------------------------- */
function handleMediaError(error) {
    const strategy = playerState.currentPlaybackStrategy || playerState.lastAttemptedStrategy;

    if (
        !playerState.hasFirstFrame &&
        strategy === 'native-probe' &&
        (error?.type === 'native' || error?.type === 'nativeError')
    ) {
        console.warn('[Player] Native probe error suppressed at handleMediaError:', error);
        return;
    }

    if (
        ENABLE_HLS_COMPAT_RETRY &&
        error?.type === 'decodeStall' &&
        !playerState.hlsCompatRetryTried &&
        playerState.currentPlaybackStrategy === 'direct-hls' &&
        playerState.currentChannel?.url
    ) {
        playerState.hlsCompatRetryTried = true;

        console.warn('[Player] DecodeStall after HLS. Retrying with HLS compatibility profile...', {
            channel: playerState.currentChannel?.name,
            bufferAppendCount: playerState.bufferAppendCount,
            lastBufferAppendedAt: playerState.lastBufferAppendedAt
        });

        showLoader('Uyumluluk modu deneniyor…', playerState.currentChannel?.name || '');

        try {
            hardResetVideoElement('before-hls-compat-retry');

            bindVideoLifecycleEvents(playerState.refs.video, playerState.currentChannel.url, {
                sessionId: playerState.playbackSessionId,
                renderToken: playerState.renderToken
            });

            playerState.orchestrator?.hlsEngine?.destroy?.();

            playerState.currentPlaybackStrategy = 'direct-hls-compat';
            playerState.lastAttemptedStrategy = 'direct-hls-compat';

            if (playerState.hlsCompatWatchdogTimer) {
                clearTimeout(playerState.hlsCompatWatchdogTimer);
            }

            playerState.hlsCompatWatchdogTimer = setTimeout(() => {
                if (playerState.hasFirstFrame || playerState.currentPlaybackStrategy !== 'direct-hls-compat') {
                    return;
                }

                console.warn('[Player] HLS compatibility retry timed out without first frame.', {
                    channel: playerState.currentChannel?.name,
                    readyState: playerState.refs?.video?.readyState,
                    currentTime: playerState.refs?.video?.currentTime,
                    videoWidth: playerState.refs?.video?.videoWidth,
                    videoHeight: playerState.refs?.video?.videoHeight,
                    bufferAppendCount: playerState.bufferAppendCount
                });

                handleMediaError({
                    type: 'hlsCompatTimeout',
                    message: 'Uyumluluk modu görüntüyü başlatamadı.'
                });
            }, 8000);

            playerState.orchestrator?.attemptHls?.(playerState.currentChannel.url, {
                sessionId: playerState.playbackSessionId,
                renderToken: playerState.renderToken,
                bufferPreset: 'compat',
                hlsProfile: 'compat',
                onEvent: (name, payload) => {
                    if (
                        name === 'manifest_parsed' ||
                        name === 'level_loaded' ||
                        name === 'frag_loaded' ||
                        name === 'buffer_appended'
                    ) {
                        playerState.lastHlsActivityAt = Date.now();
                        playerState.lastHlsEventName = name;
                    }

                    if (name === 'buffer_appended') {
                        playerState.lastBufferAppendedAt = Date.now();
                        playerState.bufferAppendCount += 1;
                        nudgePlayback('compat-buffer_appended');
                    }

                    if (name === 'manifest_parsed') {
                        nudgePlayback('compat-manifest_parsed');
                    }
                }
            }).then(() => {
                nudgePlayback('hls-compat-retry');
            }).catch((compatError) => {
                console.warn('[Player] HLS compatibility retry failed:', compatError);

                handleMediaError({
                    type: 'decodeStall',
                    message: 'Uyumluluk modu da görüntüyü başlatamadı.',
                    originalError: error,
                    compatError
                });
            });

            return;
        } catch (compatSetupError) {
            console.warn('[Player] HLS compatibility retry setup failed:', compatSetupError);
        }
    }

    if (
        ENABLE_NATIVE_LAST_RESORT &&
        (error?.type === 'decodeStall' || error?.type === 'hlsCompatTimeout') &&
        !playerState.postHlsNativeFallbackTried &&
        (playerState.currentPlaybackStrategy === 'direct-hls' || playerState.currentPlaybackStrategy === 'direct-hls-compat') &&
        playerState.currentChannel?.url
    ) {
        playerState.postHlsNativeFallbackTried = true;

        console.warn('[Player] DecodeStall detected. Trying native last-resort fallback...', {
            channel: playerState.currentChannel?.name,
            strategy: playerState.currentPlaybackStrategy
        });

        showLoader('Yerel oynatıcı ile tekrar deneniyor…', playerState.currentChannel?.name || '');

        try {
            playerState.orchestrator?.hlsEngine?.destroy?.();

            playerState.currentPlaybackStrategy = 'native-last-resort';
            playerState.lastAttemptedStrategy = 'native-last-resort';

            playerState.orchestrator?.attemptNative?.(playerState.currentChannel.url, {
                timeoutMs: 7000,
                successEvents: ['loadedmetadata', 'loadeddata', 'canplay']
            }).then(() => {
                nudgePlayback('native-last-resort');
            }).catch((fallbackError) => {
                console.warn('[Player] Native last-resort fallback failed:', fallbackError);

                handleMediaError({
                    type: 'decodeStallFinal',
                    message: 'Yayın verisi geldi ancak bu cihaz görüntüyü çözemedi.',
                    originalError: error,
                    fallbackError
                });
            });

            return;
        } catch (fallbackSetupError) {
            console.warn('[Player] Native last-resort setup failed:', fallbackSetupError);
        }
    }
    // 1. Timeout suppression if media is alive
    if (error?.type === 'timeout' && !isVideoActuallyDead()) {
        console.warn('[Player] Timeout suppressed: media shows signs of life', {
            currentTime: playerState.refs.video?.currentTime,
            readyState: playerState.refs.video?.readyState,
            videoWidth: playerState.refs.video?.videoWidth,
            videoHeight: playerState.refs.video?.videoHeight
        });
        
        markPlaybackAlive('timeout-suppressed');
        return;
    }

    // Safe-guard: Ignore errors if we are already zapping to a new channel
    // or if the render is stale.
    if (playerState.pendingZapIndex !== null) {
        console.warn('[Player] Media error suppressed during Zap:', error);
        return;
    }

    console.error('[Player] handleMediaError:', error);

    const diagnostics = diagnosePlaybackState();

    try {
        playerState.orchestrator?.stop?.();
    } catch (stopError) {
        console.warn('[Player] Failed to stop orchestrator after media error:', stopError);
    }

    const friendlyMessage = getFriendlyPlaybackError(error);
    showErrorOverlay(friendlyMessage);

    showToast(friendlyMessage, 'error');
    setState({ isPlaying: false });
    syncPlayButton();

    // Focus retry button for remote control
    const errorOverlay = playerState.refs.errorOverlay;
    if (errorOverlay) {
        const retryButton = errorOverlay.querySelector('[data-action="retry"]');
        requestAnimationFrame(() => {
            retryButton?.focus();
        });
    }

    // Emit custom event for analytics / UI
    const ev = new CustomEvent('player:error', {
        detail: { error, channel: playerState.currentChannel },
        bubbles: true,
        composed: true
    });
    document.dispatchEvent(ev);
}

function getFriendlyPlaybackError(error) {
    const details = String(error?.details || error?.message || '').toLowerCase();
    const type = error?.type;
    
    if (type === 'hlsAttachTimeout' || type === 'hlsManifestTimeout') {
        return 'HLS oynatıcı bu yayına bağlanamadı. Tekrar deneyebilir veya sonraki kanala geçebilirsiniz.';
    }

    if (type === 'decodeStallFinal' || type === 'decodeStall') {
        const isSimulator = playerState.lastPlaybackPlan?.platform?.isSimulatorLike;
        
        if (isSimulator) {
            return 'Bu yayın (HLS/TS) simülatör ortamında çözülemedi. Gerçek TV cihazında tekrar test edilmelidir.';
        }
        return 'Yayın verisi geldi ancak bu cihaz görüntüyü çözemedi (Codec/Donanım uyuşmazlığı).';
    }

    if (details.includes('404') || details.includes('not found')) {
        return 'Bu kanal şu anda yanıt vermiyor. Sonraki kanalı deneyebilirsiniz.';
    }

    if (details.includes('401') || details.includes('403') || type === 'authForbidden') {
        return 'Sunucu bu yayına erişime izin vermiyor (Yetki hatası veya süresi dolmuş link).';
    }

    if (details.includes('cors') || details.includes('access')) {
        return 'Sunucu bu yayına erişime izin vermiyor olabilir (CORS/IP Engeli).';
    }

    if (details.includes('m3u')) {
        return 'M3U yayın dosyası alınamadı. Sunucu erişimi veya yetki sorunu olabilir.';
    }

    return 'Yayın yüklenemedi. Tekrar deneyebilir veya sonraki kanala geçebilirsiniz.';
}

/**
 * Manual retry (used by error overlay button).
 */
async function retryPlayback() {
    if (playerState.isResolvingStream) {
        showToast('Yayın zaten deneniyor…', 'info');
        return;
    }

    const channel = playerState.currentChannel;
    if (!channel) return;

    console.log('[Player] Retrying playback for:', channel.name);

    cleanupCurrentPlayback();

    showLoader();
    hideErrorOverlaySafe();

    const mediaReady = await initializeMedia(channel);

    if (mediaReady !== false) {
        await startPlayback();
    }
}

function switchChannel(direction) {
    const list = playerState.channelList || [];

    if (!list.length) {
        showToast('Kanal listesi bulunamadı', 'warning');
        return;
    }

    const now = performance.now();
    
    // Determine target index based on current or pending zap
    const baseIndex = Number.isFinite(playerState.pendingZapIndex)
        ? playerState.pendingZapIndex
        : playerState.currentIndex;

    let nextIndex = baseIndex + direction;

    // Wrap around
    if (nextIndex < 0) nextIndex = list.length - 1;
    if (nextIndex >= list.length) nextIndex = 0;

    const nextChannel = list[nextIndex];
    if (!nextChannel) return;

    playerState.pendingZapIndex = nextIndex;
    playerState.pendingZapChannel = nextChannel;
    playerState.lastZapAt = now;

    // Instantly update metadata on HUD
    showZapPreview(nextChannel);
    showLoader('Kanal seçiliyor...', nextChannel.name || '');

    if (playerState.zapTimer) {
        clearTimeout(playerState.zapTimer);
        playerState.zapTimer = null;
    }

    // 420ms debounce for zapping - the "Last Wins" system
    playerState.zapTimer = setTimeout(async () => {
        const channelToOpen = playerState.pendingZapChannel;
        const targetIndex = playerState.pendingZapIndex;

        playerState.zapTimer = null;
        playerState.pendingZapChannel = null;
        playerState.pendingZapIndex = null;

        if (!channelToOpen) return;

        await commitZap(channelToOpen, targetIndex);
    }, 420);
}

async function commitZap(channel, targetIndex, retryCount = 0) {
    if (playerState.isRendering || playerState.isSwitchingChannel) {
        if (retryCount > 10) {
            console.warn('[Player] commitZap: max retries reached, aborting.');
            return;
        }
        // Retry commit if busy
        playerState.zapTimer = setTimeout(() => commitZap(channel, targetIndex, retryCount + 1), 200);
        return;
    }

    console.info('[Player] Commit zap:', channel.name);

    playerState.isSwitchingChannel = true;
    playerState.switchLock = true;

    try {
        // cleanup only on actual commit
        cleanupCurrentPlayback();
        
        showLoader('Kanal açılıyor...', channel.name || '');

        if (playerState.refs.video) {
            playerState.refs.video.style.opacity = '0';
        }

        await renderPlayerScreen(channel, {
            channelList: playerState.channelList,
            currentIndex: targetIndex,
            skipCleanup: true
        });
    } catch (error) {
        console.error('[Player] commitZap failed:', error);
        showToast('Kanal değiştirilemedi', 'error');
    } finally {
        playerState.isSwitchingChannel = false;
        setTimeout(() => {
            playerState.switchLock = false;
        }, 500);
    }
}

function showZapPreview(channel) {
    if (!channel) return;

    const hud = playerState.refs.hud;
    if (!hud) return;

    const nameEl = hud.querySelector('.hud-channel-name');
    const groupEl = hud.querySelector('.hud-group');
    const logoImg = hud.querySelector('.hud-logo-img');
    const logoWrap = hud.querySelector('.hud-logo');

    if (nameEl) {
        nameEl.textContent = channel.name || 'Kanal';
    }

    if (groupEl) {
        groupEl.textContent = (channel.category || channel.group || 'CANLI').toUpperCase();
    }

    if (logoImg) {
        if (channel.logo) {
            logoImg.src = channel.logo;
            logoImg.classList.remove('hidden');
            logoWrap?.classList.remove('hidden');
        } else {
            logoImg.classList.add('hidden');
            logoWrap?.classList.add('hidden');
        }
    }

    // Update preview too
    updatePreviewLayer(channel);

    // Note: We don't showLoader here anymore to keep zapping fluid
    resetHudTimer();
}

function updatePreviewLayer(channel) {
    const preview = playerState.refs.preview;
    if (!preview) return;

    preview.innerHTML = '';
    const content = document.createElement('div');
    content.className = 'preview-content';

    if (channel.logo) {
        const logo = document.createElement('img');
        logo.src = channel.logo;
        logo.alt = '';
        logo.className = 'preview-logo';
        content.appendChild(logo);
    }

    const title = document.createElement('h2');
    title.className = 'preview-name';
    title.textContent = channel.name || 'Kanal';
    content.appendChild(title);

    const group = document.createElement('span');
    group.className = 'preview-group';
    group.textContent = (channel.category || channel.group || 'CANLI').toUpperCase();
    content.appendChild(group);

    preview.appendChild(content);
}

/* -------------------------------------------------------------------------
   TIME DISPLAY (clock in HUD)
   ------------------------------------------------------------------------- */
function startTimeTicker(el) {
    if (!el) return;
    const tick = () => {
        el.textContent = getCurrentTime();
    };
    tick();
    playerState.timeInterval = setInterval(tick, 1000);
}
function getCurrentTime() {
    return new Date().toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

/* -------------------------------------------------------------------------
   IMAGE LOADER – lazy with skeleton/fade
   ------------------------------------------------------------------------- */
function loadImage(img, src) {
    if (!src) {
        img.removeAttribute('src');
        img.classList.add('hidden');
        return;
    }

    const placeholder = window.location.protocol === 'file:'
        ? './public/assets/placeholders/channel-default.webp'
        : '/assets/placeholders/channel-default.webp';

    img.src = placeholder;
    img.classList.add('loading');

    const real = new Image();

    real.onload = () => {
        img.src = src;
        img.classList.remove('loading');
        img.classList.add('loaded');
        img.style.transition = 'opacity 0.3s ease';
        img.style.opacity = '1';
    };

    real.onerror = () => {
        img.removeAttribute('src');
        img.classList.add('hidden', 'error');
    };

    real.src = src;
}

/* -------------------------------------------------------------------------
   LUCIDE ICON REFRESH (after dynamic changes)
   ------------------------------------------------------------------------- */
function refreshLucideIcons() {
    if (window.lucide?.createIcons) {
        window.lucide.createIcons({
            attrs: { 'stroke-width': 1.5 },
            nameAttr: 'data-lucide'
        });
    }
}

/* -------------------------------------------------------------------------
   CLEANUP – stop playback, destroy HLS, clear timers, remove listeners
   ------------------------------------------------------------------------- */
function cleanupCurrentPlayback() {
    console.log('[Player] cleanupCurrentPlayback');

    playerState.authFailureCount = 0;
    playerState.forbiddenSegmentCount = 0;
    playerState.lastPlaybackError = null;
    playerState.isSwitchingChannel = false;
    playerState.currentPlaybackStrategy = '';
    playerState.postHlsNativeFallbackTried = false;
    playerState.hlsCompatRetryTried = false;
    playerState.finalNudgeTried = false;

    if (playerState.hlsCompatWatchdogTimer) {
        clearTimeout(playerState.hlsCompatWatchdogTimer);
        playerState.hlsCompatWatchdogTimer = null;
    }

    if (playerState.orchestrator) {
        playerState.orchestrator.stop();
    }

    // Ensure listeners are removed and flag is reset to prevent guard blocking new renders
    removePlayerListeners();

    // 1. Clear Timers
    clearLoaderTimers();
    stopPlaybackHealthMonitor();

    if (playerState.zapTimer) {
        clearTimeout(playerState.zapTimer);
        playerState.zapTimer = null;
    }

    playerState.pendingZapChannel = null;
    playerState.pendingZapIndex = null;

    if (playerState.mediaTimeoutId) {
        clearTimeout(playerState.mediaTimeoutId);
        playerState.mediaTimeoutId = null;
    }

    if (playerState.bufferingTimer) {
        clearTimeout(playerState.bufferingTimer);
        playerState.bufferingTimer = null;
    }

    playerState.refs.container?.classList.remove(
        'has-video',
        'is-playing',
        'is-loading',
        'is-error',
        'has-error'
    );

    playerState.playbackSessionId += 1;
    playerState.isResolvingStream = false;

    clearBufferingTimer();

    if (playerState.hudTimeout) {
        clearTimeout(playerState.hudTimeout);
        playerState.hudTimeout = null;
    }

    if (playerState.timeInterval) {
        clearInterval(playerState.timeInterval);
        playerState.timeInterval = null;
    }

    if (playerState.earlyDecodeFallbackTimer) {
        clearTimeout(playerState.earlyDecodeFallbackTimer);
        playerState.earlyDecodeFallbackTimer = null;
    }

    if (playerState.hls) {
        try {
            playerState.hls.stopLoad?.();
            playerState.hls.detachMedia?.();
            playerState.hls.destroy?.();
        } catch (error) {
            console.warn('[Player] HLS cleanup warning:', error);
        }

        playerState.hls = null;
    }

        const video = playerState.refs.video;
        if (video) {
            try {
                video.pause();

                video.onplaying = null;
                video.onpause = null;
                video.onended = null;
                video.oncanplay = null;
                video.onloadeddata = null;
                video.onloadedmetadata = null;
                video.onerror = null;
                video.onwaiting = null;
                video.onstalled = null;
                video.ontimeupdate = null;

                video.removeAttribute('src');
                video.srcObject = null;
                video.load();
            } catch (error) {
                console.warn('[Player] Video cleanup warning:', error);
            }
        }

    hideLoader();
    hideBufferingSafe();
}

/**
 * Close the player (used by back button, remote “Back”, or external navigation).
 */
export function closePlayer() {
    console.info('[Player] Closing player...');

    if (playerState.zapTimer) {
        clearTimeout(playerState.zapTimer);
        playerState.zapTimer = null;
    }
    cleanupCurrentPlayback();
    removePlayerListeners();

    const overlay = playerState.refs.container;
    if (overlay) {
        overlay.innerHTML = '';
        overlay.classList.remove('active', 'fade-in');
        overlay.setAttribute('aria-hidden', 'true');
    }

    setState({
        currentChannel: null,
        currentIndex: 0,
        channelList: [],
        isPlaying: false,
        hasFirstFrame: false,
        isResolvingStream: false,
        playbackStartedToastShown: false,
        authFailureCount: 0,
        forbiddenSegmentCount: 0,
        lastPlaybackError: null,
        isFullscreen: false,
        isHudVisible: true,
        switchLock: false,
        pendingZapIndex: null,
        lastZapAt: 0,
        renderToken: Number.isFinite(playerState.renderToken)
            ? playerState.renderToken
            : 0,
        isRendering: false,
        playerEventsBound: false,
        isSwitchingChannel: false,
        currentPlaybackStrategy: '',
        postHlsNativeFallbackTried: false,
        hlsCompatRetryTried: false,
        finalNudgeTried: false,
        hlsCompatWatchdogTimer: null,
        refs: {
            container: null,
            hud: null,
            loader: null,
            errorOverlay: null,
            bufferOverlay: null,
            playButton: null,
            video: null,
            preview: null
        },
        lastPlaybackPlan: null
    });

    setTimeout(() => {
        routeTo('home');
    }, 80);
}

/**
 * Remove all player event listeners safely
 */
function removePlayerListeners() {
    const container = playerState.refs.container;

    if (container) {
        container.removeEventListener('click', handlePlayerClick);
        container.removeEventListener('keydown', handlePlayerKeydown);
    }

    document.removeEventListener('keydown', remoteKeyHandler, true);
    document.removeEventListener('mousemove', handleHudActivity);
    document.removeEventListener('click', handleHudActivity);
    document.removeEventListener('touchstart', handleHudActivity);

    playerState.playerEventsBound = false;
}

/* -------------------------------------------------------------------------
   PUBLIC STATE GETTER (read‑only copy)
   ------------------------------------------------------------------------- */
export function getPlayerState() {
    // shallow copy – external callers must not mutate directly
    return { ...playerState };
}

/* -------------------------------------------------------------------------
   EXTERNAL REFRESH (e.g., when playlist changes while playing)
   ------------------------------------------------------------------------- */
export async function refreshPlayer(newChannel) {
    // Useful if you need to swap source without destroying the whole UI.
    if (!newChannel) return;
    const { container } = playerState.refs;
    if (!container) return;

    // Preserve existing UI (HUD stays), just reload media
    await initializeMedia(newChannel);
    setState({ currentChannel: newChannel });
    startPlayback();
    showToast(`${newChannel.name} – Yenilendi`, 'success');
}

/* -------------------------------------------------------------------------
   END OF FILE – PLAYER SCREEN (v38.4 – THE LEGENDARY EDITION)
   ------------------------------------------------------------------------- */
