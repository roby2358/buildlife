// R-18: the core writes a read-only state.core record of its own facts, before and after each tick.
const test = require('node:test');
const assert = require('node:assert');
const { makeGame, flush, jevReply } = require('../helpers/env');

const core = (BL, game) => BL.mial.toJS(game.getState()).core;

test('state.core is present after a tick and counts ticks', () => {
  const { game, BL } = makeGame();
  game.tickOnce();
  game.tickOnce();
  const c = core(BL, game);
  assert.strictEqual(c.ticks, 2);
  assert.strictEqual(c['world-version'], game.getVersion());
  for (const k of ['jev-decisions', 'jev-invalid', 'jev-retries', 'reflective-mind-calls', 'repairs', 'reflective-mind-edits']) assert.strictEqual(typeof c[k], 'number', k);
});

test('world code can read state.core during the tick, and its writes are overwritten', () => {
  const { game, BL } = makeGame();
  // A tick that copies core.ticks into its own field and scribbles on core.
  game.applyEdit({ comment: 'read core', source: [
    '# tick', '- state', '- put',
    '  - put state `"seen"`', '    - get', '      - get state `"core"`', '      - `"ticks"`',
    '  - `"core"`', '  - `"scribble"`',
  ].join('\n') });
  game.tickOnce();
  game.tickOnce();
  const s = BL.mial.toJS(game.getState());
  assert.strictEqual(s.seen, 1, 'saw the count from before this tick');
  assert.strictEqual(s.core.ticks, 2, 'core rewritten after the tick');
  assert.strictEqual(Object.keys(s).at(-1), 'core', 'core is the last field');
});

test('decisions, invalid replies and retries are counted', async () => {
  const { game, api, BL } = makeGame();
  for (let i = 0; i < 100 && !api.calls.length; i++) game.tickOnce();
  assert.strictEqual(api.calls[0].provider, 'jev');
  api.calls[0].resolve({ choices: [{ message: { content: 'nope' } }] });
  await flush();
  api.calls[1].resolve(jevReply('well'));
  await flush();
  game.tickOnce();
  const c = core(BL, game);
  assert.deepEqual([c['jev-decisions'], c['jev-invalid'], c['jev-retries']], [1, 1, 1]);
});
