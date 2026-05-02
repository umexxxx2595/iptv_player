import './styles.css';
import { library, navigationItems } from './data.js';
import { createInitialState, saveSettings, toggleFavorite, isFavorite } from './store.js';

const app = document.getElementById('app');
const state = createInitialState();

const routeTitles = {
  home: 'FONEX IPTV',
  live: 'Canli TV',
  movies: 'Filmler',
  series: 'Diziler',
  favorites: 'Favoriler',
  settings: 'Ayarlar'
};

const getItemsForRoute = (route) => {
  if (route === 'favorites') {
    return state.favorites;
  }

  if (route === 'live' || route === 'movies' || route === 'series') {
    return library[route];
  }

  return [];
};

const createCard = (item) => {
  const favoriteLabel = isFavorite(item) ? 'Favoriden cikar' : 'Favoriye ekle';

  return `
    <article class="card">
      <div class="card-meta">${item.category}</div>
      <h3>${item.title}</h3>
      <p>${item.description}</p>
      <div class="card-actions">
        <button class="button button-primary" data-action="play" data-id="${item.id}">Oynat</button>
        <button class="button" data-action="favorite" data-id="${item.id}">${favoriteLabel}</button>
      </div>
    </article>
  `;
};

const renderSidebar = () => {
  return `
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">FONEX</span>
        <span class="brand-subtitle">IPTV</span>
      </div>
      <nav class="nav">
        ${navigationItems
          .map((item) => `
            <button
              class="nav-item ${state.route === item.route ? 'is-active' : ''}"
              data-route="${item.route}"
            >
              ${item.label}
            </button>
          `)
          .join('')}
      </nav>
    </aside>
  `;
};

const renderHome = () => {
  return `
    <section class="hero">
      <p class="eyebrow">webOS ve tarayici icin temiz baslangic</p>
      <h1>IPTV sistemini ayaga kaldiran sade ve duzgun temel.</h1>
      <p class="hero-copy">Bu surum; calisan ekran akisi, yerel favoriler, ayar saklama ve acilir video oynatici ile gelir.</p>
      <div class="hero-actions">
        <button class="button button-primary" data-route="live">Canli TV</button>
        <button class="button" data-route="movies">Filmler</button>
      </div>
    </section>
  `;
};

const renderCatalog = () => {
  const items = getItemsForRoute(state.route);

  if (!items.length) {
    return '<section class="panel"><p>Bu bolumde gosterilecek icerik yok.</p></section>';
  }

  return `
    <section class="catalog-grid">
      ${items.map(createCard).join('')}
    </section>
  `;
};

const renderSettings = () => {
  return `
    <section class="panel settings-panel">
      <div>
        <label for="quality">Kalite</label>
        <select id="quality" data-setting="quality">
          <option value="auto" ${state.settings.quality === 'auto' ? 'selected' : ''}>Otomatik</option>
          <option value="1080p" ${state.settings.quality === '1080p' ? 'selected' : ''}>1080p</option>
          <option value="720p" ${state.settings.quality === '720p' ? 'selected' : ''}>720p</option>
        </select>
      </div>
      <div>
        <label for="volume">Ses</label>
        <input id="volume" type="range" min="0" max="100" value="${state.settings.volume}" data-setting="volume" />
      </div>
      <label class="checkbox-row">
        <input type="checkbox" data-setting="autoPlay" ${state.settings.autoPlay ? 'checked' : ''} />
        Otomatik oynat
      </label>
    </section>
  `;
};

const renderPlayer = () => {
  if (!state.playerItem) {
    return '';
  }

  return `
    <div class="player-overlay is-open">
      <div class="player-dialog">
        <div class="player-header">
          <div>
            <p class="eyebrow">${state.playerItem.category}</p>
            <h2>${state.playerItem.title}</h2>
          </div>
          <button class="button" data-action="close-player">Kapat</button>
        </div>
        <video controls playsinline autoplay src="${state.playerItem.streamUrl}"></video>
      </div>
    </div>
  `;
};

const renderMain = () => {
  const title = routeTitles[state.route] || routeTitles.home;
  const body = state.route === 'home'
    ? renderHome()
    : state.route === 'settings'
      ? renderSettings()
      : renderCatalog();

  return `
    <main class="content">
      <header class="content-header">
        <div>
          <p class="eyebrow">Durum: calisiyor</p>
          <h2>${title}</h2>
        </div>
      </header>
      ${body}
    </main>
  `;
};

const render = () => {
  app.innerHTML = `
    <div class="layout">
      ${renderSidebar()}
      ${renderMain()}
      ${renderPlayer()}
    </div>
  `;
};

const findItemById = (id) => {
  const allItems = [...library.live, ...library.movies, ...library.series, ...state.favorites];
  return allItems.find((item) => item.id === id) || null;
};

const updateSetting = (key, value) => {
  const normalized = key === 'volume' ? Number(value) : value;
  state.settings = saveSettings({ ...state.settings, [key]: normalized });
  render();
};

app.addEventListener('click', (event) => {
  const routeTarget = event.target.closest('[data-route]');
  if (routeTarget) {
    state.route = routeTarget.dataset.route;
    render();
    return;
  }

  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) {
    return;
  }

  const { action, id } = actionTarget.dataset;
  const item = id ? findItemById(id) : null;

  if (action === 'play' && item) {
    state.playerItem = item;
    render();
    return;
  }

  if (action === 'favorite' && item) {
    state.favorites = toggleFavorite(item);
    render();
    return;
  }

  if (action === 'close-player') {
    state.playerItem = null;
    render();
  }
});

app.addEventListener('change', (event) => {
  const settingKey = event.target.dataset.setting;
  if (!settingKey) {
    return;
  }

  const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
  updateSetting(settingKey, value);
});

render();

export { getItemsForRoute, routeTitles };
