import { sanitizeHTML } from '../../utils/sanitize.js';
import { truncate } from '../../utils/textUtils.js';
import { isFavorite } from '../../utils/favoritesStore.js';

const getContentRoot = () => document.getElementById('main-content');

export const createMetricMarkup = (label, value, hint = '') => `
    <article class="metric-block">
        <span class="metric-label">${sanitizeHTML(label)}</span>
        <strong class="metric-value">${sanitizeHTML(String(value))}</strong>
        <small class="metric-hint">${sanitizeHTML(hint)}</small>
    </article>
`;

export const createTagMarkup = (label, value = '') => `
    <div class="tag-chip">
        <span>${sanitizeHTML(label)}</span>
        ${value ? `<strong>${sanitizeHTML(String(value))}</strong>` : ''}
    </div>
`;

export const createCardMarkup = (item, options = {}) => {
    const action = options.action || 'open-player';
    const index = Number.isInteger(options.index) ? options.index : 0;
    const collection = options.collection || options.mode || 'live';
    const mode = options.mode || item.mode || 'live';
    const query = options.query || '';
    const favoriteLabel = isFavorite(item) ? 'Favoriden cikar' : 'Favoriye ekle';

    return `
        <article class="content-card">
            <div class="content-card-topline">
                <span class="content-card-kicker">${sanitizeHTML(item.category || item.group || 'Kategori')}</span>
                <span class="content-card-mode">${sanitizeHTML(mode.toUpperCase())}</span>
            </div>
            <strong>${sanitizeHTML(item.name || 'Icerik')}</strong>
            <small>${sanitizeHTML(truncate(item.description || '', 72))}</small>
            <div class="content-card-actions">
                <button
                    type="button"
                    class="focusable action-pill action-pill-primary"
                    data-action="${action}"
                    data-channel-id="${sanitizeHTML(item.id || '')}"
                    data-channel-name="${sanitizeHTML(item.name || '')}"
                    data-channel-url="${sanitizeHTML(item.url || '')}"
                    data-channel-category="${sanitizeHTML(item.category || '')}"
                    data-channel-mode="${sanitizeHTML(mode)}"
                    data-channel-index="${index}"
                    data-channel-collection="${sanitizeHTML(collection)}"
                    data-channel-query="${sanitizeHTML(query)}"
                >
                    Oynat
                </button>
                <button
                    type="button"
                    class="focusable action-pill"
                    data-action="toggle-favorite"
                    data-channel-id="${sanitizeHTML(item.id || '')}"
                    data-channel-name="${sanitizeHTML(item.name || '')}"
                    data-channel-url="${sanitizeHTML(item.url || '')}"
                    data-channel-category="${sanitizeHTML(item.category || '')}"
                    data-channel-mode="${sanitizeHTML(mode)}"
                >
                    ${sanitizeHTML(favoriteLabel)}
                </button>
            </div>
        </article>
    `;
};

export const createEmptyStateMarkup = (title, description, actionLabel = '', actionName = '') => `
    <section class="empty-state-panel">
        <h3>${sanitizeHTML(title)}</h3>
        <p>${sanitizeHTML(description)}</p>
        ${actionLabel && actionName ? `<button type="button" class="focusable action-pill action-pill-primary" data-action="${sanitizeHTML(actionName)}">${sanitizeHTML(actionLabel)}</button>` : ''}
    </section>
`;

export const renderContent = (markup) => {
    const root = getContentRoot();

    if (!root) {
        return false;
    }

    root.innerHTML = markup;

    const firstFocusable = root.querySelector('.focusable');
    if (firstFocusable instanceof HTMLElement) {
        requestAnimationFrame(() => firstFocusable.focus());
    }

    return true;
};
