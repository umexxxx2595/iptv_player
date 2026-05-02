import { getCatalogByMode, getCategorySummary, searchCatalog } from '../../data/catalogStore.js';
import { createCardMarkup, createEmptyStateMarkup, createTagMarkup, renderContent } from './screenHelpers.js';

const getTitle = (mode) => {
    switch (mode) {
        case 'movies':
            return 'Filmler';
        case 'series':
            return 'Diziler';
        case 'search':
            return 'Arama';
        default:
            return 'Canli TV';
    }
};

export const renderBrowseScreen = async ({ mode = 'live', query = '' } = {}) => {
    const trimmedQuery = String(query || '').trim();
    const items = mode === 'search' ? searchCatalog(trimmedQuery) : getCatalogByMode(mode);
    const cards = items.length
        ? items.map((item, index) => createCardMarkup(item, {
            mode: item.mode,
            collection: mode === 'search' ? 'search' : mode,
            query: trimmedQuery,
            index
        })).join('')
        : createEmptyStateMarkup(
            mode === 'search' ? 'Sonuc bulunamadi' : 'Bu bolum henuz bos',
            mode === 'search'
                ? 'Arama kelimesini degistir veya yeni bir playlist yukle.'
                : 'Bu mod icin uygun icerik bulunamadi. Playlist kaynagini kontrol et.',
            'Ayarlari ac',
            'open-settings'
        );

    const categories = getCategorySummary(mode === 'search' ? 'all' : mode, 8)
        .map((item) => createTagMarkup(item.label, item.count))
        .join('');
    const description = mode === 'search'
        ? trimmedQuery
            ? `"${trimmedQuery}" icin ${items.length} sonuc bulundu.`
            : 'Tum kutuphanede arama yap.'
        : `${items.length} icerik yuklu. Kategori dagilimini ve oynatma akislarini buradan yonetebilirsin.`;

    return renderContent(`
        <section class="screen-view screen-browse">
            <header class="screen-header">
                <h1>${getTitle(mode)}</h1>
                <p>${description}</p>
            </header>
            <section class="toolbar-band">
                <form class="search-form" data-form="search-form">
                    <input
                        class="focusable text-input"
                        type="search"
                        name="search-query"
                        placeholder="kanal, kategori veya dizi ara"
                        value="${trimmedQuery}"
                    />
                    <button type="submit" class="focusable action-pill action-pill-primary">Ara</button>
                </form>
                <div class="tag-cloud">
                    ${categories}
                </div>
            </section>
            <div class="content-grid">
                ${cards}
            </div>
        </section>
    `);
};
