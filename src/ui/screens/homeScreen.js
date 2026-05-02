import { getDashboardModel } from '../../data/catalogStore.js';
import { createCardMarkup, createMetricMarkup, createTagMarkup, renderContent, createEmptyStateMarkup } from './screenHelpers.js';

export const renderHomeScreen = async () => {
    const dashboard = getDashboardModel();
    const sourceLabel = dashboard.source.sourceLabel || 'Hazir katalog';
    const recentMarkup = dashboard.highlights.recent.length
        ? dashboard.highlights.recent.map((item, index) => createCardMarkup(item, {
            mode: item.mode,
            collection: 'recent',
            index
        })).join('')
        : createEmptyStateMarkup(
            'Izleme gecmisi hazir degil',
            'Bir icerik oynattiginda son izlenenler burada listelenecek.',
            'Canli TV ac',
            'watch-live'
        );

    const categoryMarkup = dashboard.categories.length
        ? dashboard.categories.map((item) => createTagMarkup(item.label, item.count)).join('')
        : createTagMarkup('Kategori', '0');

    return renderContent(`
        <section class="screen-view screen-home">
            <header class="hero-band">
                <div class="hero-copy-group">
                    <p class="hero-kicker">FONEX IPTV control room</p>
                    <h1>Canli TV, VOD ve dizi kutuphanesini tek merkezden yonet.</h1>
                    <p class="hero-description">
                        Playlist kaynagini degistir, favorileri yonet, arama yap ve son izlenenleri kaybetmeden devam et.
                    </p>
                    <div class="hero-actions">
                        <button type="button" class="focusable action-pill action-pill-primary" data-action="watch-live">Canli TV</button>
                        <button type="button" class="focusable action-pill" data-action="open-settings">Playlist ekle</button>
                        <button type="button" class="focusable action-pill" data-action="use-demo-playlist">Demo katalog</button>
                    </div>
                </div>
                <div class="hero-meta">
                    ${createTagMarkup('Kaynak', sourceLabel)}
                    ${createTagMarkup('Toplam', dashboard.counts.all)}
                    ${createTagMarkup('Favori', dashboard.counts.favorites)}
                </div>
            </header>

            <section class="metric-grid">
                ${createMetricMarkup('Canli', dashboard.counts.live, 'kanal')}
                ${createMetricMarkup('Film', dashboard.counts.movies, 'kutuphane')}
                ${createMetricMarkup('Dizi', dashboard.counts.series, 'seri')}
                ${createMetricMarkup('Kaynak', dashboard.source.sourceType, 'aktif mod')}
            </section>

            <section class="content-split">
                <div class="stack-panel">
                    <div class="section-heading">
                        <h2>Son izlenenler</h2>
                        <p>Kaldigin yerden devam etmen icin en son oynatilan icerikler.</p>
                    </div>
                    <div class="content-grid recent-grid">
                        ${recentMarkup}
                    </div>
                </div>

                <aside class="stack-panel stack-panel-narrow">
                    <div class="section-heading">
                        <h2>Kategori dagilimi</h2>
                        <p>Liste icindeki baskin alanlar.</p>
                    </div>
                    <div class="tag-cloud">
                        ${categoryMarkup}
                    </div>
                </aside>
            </section>
        </section>
    `);
};
