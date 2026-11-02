// R-13: at most one call per model in flight, and none inside the minimum gap.
const test = require('node:test');
const assert = require('node:assert');
const { makeGame, flush, jevReply, sonnetReply } = require('../helpers/env');

// Make Jev's trigger always true so gating is the only thing limiting calls.
const eager = (game) => game.applyEdit({ comment: 'always ask', source: '# auto-mind-trigger?\n- *\n  - state\n  - events\n- `true`\n' });
const callsTo = (api, provider) => api.calls.filter(c => c.provider === provider).length;
const jevCalls = (api) => callsTo(api, 'jev');
const sonnetCalls = (api) => callsTo(api, 'sonnet');

test('no second Jev call while one is in flight', () => {
  const { game, api, clock } = makeGame();
  eager(game);
  game.tickOnce();
  clock.t += 60_000;
  game.tickOnce();
  assert.strictEqual(jevCalls(api), 1);
});

test('no Jev call inside the minimum gap', async () => {
  const { game, api, clock } = makeGame();
  eager(game);
  game.tickOnce();
  api.calls[0].resolve(jevReply('stay'));
  await flush();
  clock.t += game.getSettings().jevGapMs - 1;
  game.tickOnce();
  assert.strictEqual(jevCalls(api), 1);
  clock.t += 1;
  game.tickOnce();
  assert.strictEqual(jevCalls(api), 2);
});

test('a user message inside the Sonnet gap waits, then is answered once', async () => {
  const { game, api, clock } = makeGame();
  game.sendUserMessage('hello');
  game.sendUserMessage('are you there?');
  assert.strictEqual(sonnetCalls(api), 1);
  api.calls[0].resolve(sonnetReply({ say: 'hi' }));
  await flush();
  game.sendUserMessage('again');
  game.pump();
  assert.strictEqual(sonnetCalls(api), 1, 'held by the gap');
  clock.t += game.getSettings().sonnetGapMs;
  game.pump();
  game.pump();
  assert.strictEqual(sonnetCalls(api), 2, 'one pending user turn, sent once');
});
