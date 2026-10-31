// Loads the plain-script core into a fresh vm context, the way the browser would.
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CORE = ['js/mial.js', 'js/world_default.js', 'js/config.js', 'js/world.js', 'js/minds.js', 'js/store.js', 'js/game.js'];

const loadBL = () => {
  const ctx = vm.createContext({ console });
  ctx.window = ctx;
  for (const f of CORE) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx.BL;
};

const makeStorage = () => {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
};

// A fake API whose calls stay pending until the test resolves them.
const makeApi = ({ keys = true } = {}) => {
  const calls = [];
  const pending = (provider) => (body) => new Promise((resolve, reject) => calls.push({ provider, body, resolve, reject }));
  return { calls, canCall: () => keys, jev: pending('jev'), sonnet: pending('sonnet') };
};

const flush = () => new Promise(r => setImmediate(r));

const jevReply = (action, thought = 'test') => ({ choices: [{ message: { content: JSON.stringify({ thought, action }) } }] });
const sonnetReply = (obj) => ({
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify({ thought: '', say: '', edits: [], core_request: '', ...obj }) }],
});

// A game booted on the default world with a fake clock.
const makeGame = (opts = {}) => {
  const BL = loadBL();
  const storage = opts.storage || makeStorage();
  const api = opts.api || makeApi();
  const clock = { t: 1_000_000 };
  const game = BL.createGame({ store: BL.createStore(storage), api, now: () => clock.t });
  game.boot();
  return { BL, game, api, storage, clock };
};

module.exports = { loadBL, makeStorage, makeApi, makeGame, flush, jevReply, sonnetReply, ROOT };
