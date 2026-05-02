const SETTINGS_KEY = 'fonex_settings_v3';
const FAVORITES_KEY = 'fonex_favorites_v1';

const defaultSettings = {
  autoPlay: true,
  language: 'tr',
  quality: 'auto',
  volume: 80
};

const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export const loadSettings = () => {
  const stored = safeParse(localStorage.getItem(SETTINGS_KEY), defaultSettings);
  return { ...defaultSettings, ...stored };
};

export const saveSettings = (nextSettings) => {
  const merged = { ...defaultSettings, ...nextSettings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  return merged;
};

export const getFavorites = () => {
  const stored = safeParse(localStorage.getItem(FAVORITES_KEY), []);
  return Array.isArray(stored) ? stored : [];
};

export const isFavorite = (item) => {
  return getFavorites().some((favorite) => favorite.id === item.id);
};

export const toggleFavorite = (item) => {
  const current = getFavorites();
  const exists = current.some((favorite) => favorite.id === item.id);
  const next = exists
    ? current.filter((favorite) => favorite.id !== item.id)
    : [item, ...current];

  localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return next;
};

export const createInitialState = () => ({
  route: 'home',
  playerItem: null,
  settings: loadSettings(),
  favorites: getFavorites()
});
