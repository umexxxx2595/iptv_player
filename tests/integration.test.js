import { describe, expect, test, beforeEach } from 'vitest';
import { createInitialState, getFavorites, loadSettings, saveSettings, toggleFavorite } from '../src/store.js';

describe('store helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('returns sane defaults', () => {
    const state = createInitialState();
    expect(state.route).toBe('home');
    expect(state.settings.volume).toBe(80);
    expect(state.favorites).toEqual([]);
  });

  test('persists settings', () => {
    const updated = saveSettings({ quality: '1080p', volume: 50 });
    expect(updated.quality).toBe('1080p');
    expect(loadSettings().volume).toBe(50);
  });

  test('toggles favorites by id', () => {
    const item = { id: 'channel-1', title: 'Channel 1' };

    expect(toggleFavorite(item)).toHaveLength(1);
    expect(getFavorites()).toHaveLength(1);
    expect(toggleFavorite(item)).toHaveLength(0);
  });
});
