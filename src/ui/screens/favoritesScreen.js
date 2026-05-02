import { getFavorites } from '../../utils/favoritesStore.js';
import { createCardMarkup, createEmptyStateMarkup, renderContent } from './screenHelpers.js';

export const renderFavoritesScreen = async () => {
    const favorites = getFavorites();
    const cards = favorites.length
        ? favorites.map((item, index) => createCardMarkup(item, {
            mode: item.mode || 'live',
            collection: 'favorites',
            index
        })).join('')
        : createEmptyStateMarkup(
            'Favori listesi bos',
            'Kutuphaneden favori ekleyerek hizli erisim paneli olusturabilirsin.',
            'Canli TV ac',
            'watch-live'
        );

    return renderContent(`
        <section class="screen-view screen-favorites">
            <header class="screen-header">
                <h1>Favoriler</h1>
                <p>Kaydedilen kanallar ve icerikler burada listelenir. Toplam ${favorites.length} kayit var.</p>
            </header>
            <div class="content-grid">
                ${cards}
            </div>
        </section>
    `);
};
