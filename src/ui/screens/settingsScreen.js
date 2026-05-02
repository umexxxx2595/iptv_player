import { AppConfig } from '../../app.js';
import { getPlaylistState, getRecentItems } from '../../data/catalogStore.js';
import { createTagMarkup, renderContent } from './screenHelpers.js';

export const renderSettingsScreen = async () => {
    const settings = AppConfig.settings;
    const playlistState = getPlaylistState();
    const recentCount = getRecentItems().length;
    const sourceDate = playlistState.importedAt
        ? new Date(playlistState.importedAt).toLocaleString('tr-TR')
        : 'Demo katalog';

    return renderContent(`
        <section class="screen-view screen-settings">
            <header class="screen-header">
                <h1>Ayarlar</h1>
                <p>Playlist kaynagini, oynatma tercihlerini ve uygulama bakimini buradan yonet.</p>
            </header>

            <section class="settings-dashboard">
                ${createTagMarkup('Kaynak', playlistState.sourceLabel)}
                ${createTagMarkup('Icerik', playlistState.items.length)}
                ${createTagMarkup('Son guncelleme', sourceDate)}
                ${createTagMarkup('Son izlenen', recentCount)}
            </section>

            <section class="settings-workspace">
                <form class="settings-form-panel" data-form="import-url-form">
                    <div class="section-heading">
                        <h2>Playlist URL ekle</h2>
                        <p>M3U veya M3U8 baglantisini yapistirarak listeyi dogrudan cek.</p>
                    </div>
                    <input
                        class="focusable text-input"
                        type="url"
                        name="playlist-url"
                        placeholder="https://ornek.com/list.m3u"
                        value="${playlistState.sourceUrl || ''}"
                    />
                    <button type="submit" class="focusable action-pill action-pill-primary">URL'den yukle</button>
                </form>

                <form class="settings-form-panel" data-form="import-text-form">
                    <div class="section-heading">
                        <h2>M3U metni yapistir</h2>
                        <p>OTTPlayer benzeri sistemlerde kullanilan ham playlist metnini direkt ice aktar.</p>
                    </div>
                    <textarea
                        class="focusable text-area"
                        name="playlist-text"
                        rows="8"
                        placeholder="#EXTM3U&#10;#EXTINF:-1 group-title=&quot;Spor&quot;,Spor Kanal&#10;https://ornek.com/canli.m3u8"
                    ></textarea>
                    <input class="focusable text-input" type="text" name="playlist-label" placeholder="Kaynak etiketi" />
                    <button type="submit" class="focusable action-pill">Metni ice aktar</button>
                </form>
            </section>

            <section class="settings-workspace">
                <div class="settings-form-panel">
                    <div class="section-heading">
                        <h2>Oynatma tercihleri</h2>
                        <p>Uygulamanin otomatik oynatma ve kalite davranisini belirle.</p>
                    </div>
                    <label class="settings-field">
                        <span>Otomatik oynat</span>
                        <input class="focusable toggle-input" type="checkbox" data-setting="autoPlay" ${settings.autoPlay ? 'checked' : ''} />
                    </label>
                    <label class="settings-field">
                        <span>Dusuk gecikme</span>
                        <input class="focusable toggle-input" type="checkbox" data-setting="lowLatency" ${settings.lowLatency ? 'checked' : ''} />
                    </label>
                    <label class="settings-field">
                        <span>Ses seviyesi</span>
                        <input class="focusable range-input" type="range" min="0" max="100" data-setting="volume" value="${settings.volume}" />
                    </label>
                    <label class="settings-field">
                        <span>Kalite</span>
                        <select class="focusable select-input" data-setting="quality">
                            <option value="auto" ${settings.quality === 'auto' ? 'selected' : ''}>Otomatik</option>
                            <option value="1080p" ${settings.quality === '1080p' ? 'selected' : ''}>1080p</option>
                            <option value="720p" ${settings.quality === '720p' ? 'selected' : ''}>720p</option>
                            <option value="540p" ${settings.quality === '540p' ? 'selected' : ''}>540p</option>
                        </select>
                    </label>
                </div>

                <div class="settings-form-panel">
                    <div class="section-heading">
                        <h2>Bakim islemleri</h2>
                        <p>Demo katalogu geri getir veya son izlenenleri temizle.</p>
                    </div>
                    <div class="settings-action-group">
                        <button type="button" class="focusable action-pill" data-action="use-demo-playlist">Demo katalogu geri yukle</button>
                        <button type="button" class="focusable action-pill" data-action="clear-recent">Son izlenenleri temizle</button>
                        <button type="button" class="focusable action-pill" data-action="watch-live">Canli TV'ye git</button>
                    </div>
                </div>
            </section>
        </section>
    `);
};
