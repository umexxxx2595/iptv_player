import { routeTo, showToast } from '../../bootstrap.js';
import { playlistEngine } from '../../content/playlistEngine.js';

const STORAGE_TEXT_KEY = 'fonex_playlist_m3u';
const STORAGE_URL_KEY = 'fonex_playlist_url';
const FETCH_TIMEOUT_MS = 15000;
const MAX_PERSISTED_M3U_BYTES = 2 * 1024 * 1024; // 2MB for safe localStorage on TV

function isValidPlaylistUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function validateM3UText(text) {
    if (!text || !text.includes('#EXTM3U')) {
        throw new Error('Gelen veri M3U formatında değil');
    }
}

async function fetchPlaylistText(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();
        validateM3UText(text);

        return text;
    } finally {
        clearTimeout(timeout);
    }
}

export async function renderSettingsScreen() {
    const root = document.getElementById('main-content');
    if (!root) return;

    root.innerHTML = `
        <div class="settings-screen screen-fade-in">
            <div class="settings-content">
                <header class="settings-header">
                    <p class="settings-kicker">AYARLAR</p>
                    <h1 class="settings-title">Playlist Yönetimi</h1>
                    <p class="settings-description">
                        M3U URL girerek veya M3U içeriği yapıştırarak yayın listenizi yükleyin.
                    </p>
                </header>

                <section class="settings-card">
                    <div class="input-group">
                        <label class="input-label" for="m3u-url">
                            M3U URL
                        </label>

                        <input
                            id="m3u-url"
                            class="settings-input focusable"
                            type="url"
                            inputmode="url"
                            autocomplete="off"
                            spellcheck="false"
                            placeholder="http://site.com/get.php?username=...&password=...&type=m3u_plus"
                        />
                    </div>

                    <div class="settings-divider">
                        veya
                    </div>

                    <div class="input-group">
                        <label class="input-label" for="m3u-textarea">
                            M3U içeriği
                        </label>

                        <textarea
                            id="m3u-textarea"
                            class="settings-input settings-textarea focusable"
                            rows="10"
                            spellcheck="false"
                            placeholder="#EXTM3U&#10;#EXTINF:-1 group-title=&quot;Haberler&quot;,BBC World News&#10;https://example.com/live.m3u8"
                        ></textarea>
                    </div>

                    <div class="settings-actions">
                        <button class="hero-btn focusable" id="load-playlist-btn">
                            <span>PLAYLIST YÜKLE</span>
                        </button>

                        <button class="hero-btn focusable" id="back-home-btn">
                            <span>ANA SAYFAYA DÖN</span>
                        </button>
                    </div>
                </section>
            </div>
        </div>
    `;

    const urlInput = document.getElementById('m3u-url');
    const textarea = document.getElementById('m3u-textarea');
    const loadBtn = document.getElementById('load-playlist-btn');
    const backBtn = document.getElementById('back-home-btn');

    const savedUrl = localStorage.getItem(STORAGE_URL_KEY);
    const savedText = localStorage.getItem(STORAGE_TEXT_KEY);

    if (savedUrl && urlInput) {
        urlInput.value = savedUrl;
    }

    if (savedText && textarea) {
        textarea.value = savedText;
    }

    loadBtn?.addEventListener('click', async () => {
        const m3uUrl = urlInput?.value?.trim();
        const pastedText = textarea?.value?.trim();

        try {
            loadBtn.disabled = true;
            loadBtn.classList.add('is-loading');
            loadBtn.setAttribute('aria-busy', 'true');

            let m3uText = '';

            if (m3uUrl) {
                if (!isValidPlaylistUrl(m3uUrl)) {
                    showToast('Geçerli bir http/https M3U URL girin', 'error');
                    return;
                }

                showToast('Playlist URL üzerinden çekiliyor...', 'info');

                m3uText = await fetchPlaylistText(m3uUrl);
                
                localStorage.setItem(STORAGE_URL_KEY, m3uUrl);

                try {
                    if (m3uText.length < MAX_PERSISTED_M3U_BYTES) {
                        localStorage.setItem(STORAGE_TEXT_KEY, m3uText);
                    } else {
                        localStorage.removeItem(STORAGE_TEXT_KEY);
                        console.warn('[Settings] M3U too large for localStorage. Using memory-only mode.', {
                            length: m3uText.length
                        });
                    }
                } catch (storageError) {
                    localStorage.removeItem(STORAGE_TEXT_KEY);
                    console.warn('[Settings] Could not persist M3U text. Continuing memory-only.', storageError);
                }
            } else if (pastedText) {
                validateM3UText(pastedText);
                m3uText = pastedText;

                localStorage.removeItem(STORAGE_URL_KEY);
                
                try {
                    if (m3uText.length < MAX_PERSISTED_M3U_BYTES) {
                        localStorage.setItem(STORAGE_TEXT_KEY, m3uText);
                    } else {
                        localStorage.removeItem(STORAGE_TEXT_KEY);
                        console.warn('[Settings] M3U too large for localStorage. Using memory-only mode.', {
                            length: m3uText.length
                        });
                    }
                } catch (storageError) {
                    localStorage.removeItem(STORAGE_TEXT_KEY);
                    console.warn('[Settings] Could not persist pasted M3U text. Continuing memory-only.', storageError);
                }
            } else {
                showToast('M3U URL veya M3U içeriği girin', 'error');
                return;
            }

            playlistEngine.clear();
            const ok = playlistEngine.loadPlaylist(m3uText);

            console.info('[Settings] Playlist load result:', {
                ok,
                textLength: m3uText.length,
                channelCount: playlistEngine.getAllChannels().length
            });

            if (!ok) {
                showToast('Playlist çözümlenemedi (Geçersiz M3U veya 0 kanal)', 'error');
                return;
            }

            const channelCount = playlistEngine.getAllChannels().length;
            showToast(`Playlist başarıyla yüklendi (${channelCount} kanal)`, 'success');

            setTimeout(() => {
                routeTo('home');
            }, 700);

        } catch (error) {
            console.error('[Settings] Playlist yükleme hatası:', error);

            if (error.name === 'AbortError') {
                showToast('Playlist isteği zaman aşımına uğradı', 'error');
            } else if (String(error.message).includes('Failed to fetch') || String(error.message).includes('NetworkError')) {
                showToast('M3U URL çekilemedi. Sunucu CORS/IP engeli veriyor olabilir.', 'error');
            } else {
                showToast(`Playlist yüklenemedi: ${error.message}`, 'error');
            }
        } finally {
            loadBtn.disabled = false;
            loadBtn.classList.remove('is-loading');
            loadBtn.removeAttribute('aria-busy');
        }
    });

    backBtn?.addEventListener('click', () => {
        routeTo('home');
    });

    if (window.lucide?.createIcons) {
        window.lucide.createIcons();
    }
}

export default renderSettingsScreen;
