// R-12: a Jev reply with an unknown action or bad JSON changes nothing and reports an error;
// bad JSON is retried once first.
const test = require('node:test');
const assert = require('node:assert');
const { makeGame, flush, jevReply } = require('../helpers/env');

const askJev = (game, api) => {
  while (!api.calls.some(c => c.provider === 'jev')) game.tickOnce();
  return api.calls.find(c => c.provider === 'jev');
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

const garbage = { choices: [{ message: { content: '{"thought": "I will go to the' }, finish_reason: 'length' }] };
const jevCalls = (api) => api.calls.filter(c => c.provider === 'jev');

test('invalid JSON is retried once, then rejected', async () => {
  const { game, api, BL } = makeGame();
  const first = askJev(game, api);
  const before = BL.mial.serialize(game.getState());
  first.resolve(garbage);
  await flush();
  assert.strictEqual(jevCalls(api).length, 2, 'one retry');
  assert.match(game.getChat().at(-1).text, /cut off.*Retrying once/);
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
  jevCalls(api)[1].resolve(jevReply('tree'));
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
  askJev(game, api).resolve(jevReply('well', 'thirsty'));
  await flush();
  assert.strictEqual(BL.mial.toJS(game.getState()).inhabitant.goal, 'well');
  assert.strictEqual(game.getChat().at(-1).kind, 'jev');
});
