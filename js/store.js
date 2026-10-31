// localStorage persistence (persistence rule). The storage object is injected so
// tests can use an in-memory stand-in. API keys and settings are stored apart from
// the save, so they never appear in it or in a download.
var BL = window.BL = window.BL || {};

BL.createStore = (storage) => {
  const SAVE_KEY = 'buildlife.save.v1';
  const KEYS_KEY = 'buildlife.keys';
  const SETTINGS_KEY = 'buildlife.settings';

  const read = (key) => {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('buildlife: save failed', e);
      return false;
    }
  };

  return {
    loadGame: () => {
      const s = read(SAVE_KEY);
      return s && s.schema === 1 ? s : null;
    },
    saveGame: (snapshot) => write(SAVE_KEY, { schema: 1, ...snapshot }),
    clearGame: () => { try { storage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ } },
    loadKeys: () => ({ anthropic: '', openrouter: '', ...(read(KEYS_KEY) || {}) }),
    saveKeys: (keys) => write(KEYS_KEY, keys),
    loadSettings: () => read(SETTINGS_KEY) || {},
    saveSettings: (settings) => write(SETTINGS_KEY, settings),
  };
};
