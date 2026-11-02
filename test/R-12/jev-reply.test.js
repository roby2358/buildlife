// R-12: a Jev reply with an unknown action or no choice changes nothing and reports an error;
// a reply with no choice is retried once first.
const test = require('node:test');
const assert = require('node:assert');
const { makeGame, flush, jevReply } = require('../helpers/env');

const askJev = (game, api) => {
  for (let i = 0; i < 100 && !api.calls.some(c => c.provider === 'jev'); i++) game.tickOnce();
  const call = api.calls.find(c => c.provider === 'jev');
  assert.ok(call, 'Jev was asked within 100 ticks');
  return call;
};

test('an action outside actions is rejected', async () => {
  const { game, api, BL } = makeGame();
  const call = askJev(game, api);
  const before = BL.mial.serialize(game.getState());
  call.resolve(jevReply('volcano'));
  await flush();
  assert.strictEqual(BL.mial.serialize(game.getState()), before);
  assert.match(game.getChat().at(-1).text, /volcano/);
  assert.strictEqual(game.getChat().at(-1).kind, 'error');
});

const garbage = { answers: {} };
const jevCalls = (api) => api.calls.filter(c => c.provider === 'jev');

test('a reply with no choice is retried once, then rejected', async () => {
  const { game, api, BL } = makeGame();
  const first = askJev(game, api);
  const before = BL.mial.serialize(game.getState());
  first.resolve(garbage);
  await flush();
  assert.strictEqual(jevCalls(api).length, 2, 'one retry');
  assert.match(game.getChat().at(-1).text, /no choice.*Retrying once/);
  assert.ok(game.getCounters().inFlight.jev, 'still in flight during the retry');
  jevCalls(api)[1].resolve(garbage);
  await flush();
  assert.strictEqual(jevCalls(api).length, 2, 'no second retry');
  assert.strictEqual(BL.mial.serialize(game.getState()), before);
  assert.strictEqual(game.getChat().at(-1).kind, 'error');
  assert.strictEqual(game.getCounters().jevInvalid, 2);
  assert.strictEqual(game.getCounters().inFlight.jev, false);
});

test('a valid retry is applied', async () => {
  const { game, api, BL } = makeGame();
  askJev(game, api).resolve(garbage);
  await flush();
  jevCalls(api)[1].resolve(jevReply('go-tree'));
  await flush();
  assert.strictEqual(BL.mial.toJS(game.getState()).inhabitant.goal, 'tree');
  assert.strictEqual(game.getChat().at(-1).kind, 'jev');
});

test('an unknown action is not retried', async () => {
  const { game, api } = makeGame();
  askJev(game, api).resolve(jevReply('volcano'));
  await flush();
  assert.strictEqual(jevCalls(api).length, 1);
});

test('a valid action is applied and logged', async () => {
  const { game, api, BL } = makeGame();
  askJev(game, api).resolve(jevReply('go-well', 0.823, { 'go-bush': 0.1, stay: 0.02, 'go-well': 0.83, 'go-tree': 0.05 }));
  await flush();
  assert.strictEqual(BL.mial.toJS(game.getState()).inhabitant.goal, 'well');
  assert.strictEqual(game.getChat().at(-1).kind, 'jev');
  assert.strictEqual(game.getChat().at(-1).text, '→ go-well 0.83 · go-bush 0.10 · go-tree 0.05', 'top 3, highest first');
  const decision = game.getEventHistory().at(-1);
  assert.strictEqual(decision.confidence, 0.82);
  assert.strictEqual(decision.thought, undefined, 'Jev writes no text');
});
