// R-12: a Jev reply with an unknown action or bad JSON changes nothing and reports an error.
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

test('invalid JSON is rejected', async () => {
  const { game, api, BL } = makeGame();
  const call = askJev(game, api);
  const before = BL.mial.serialize(game.getState());
  call.resolve({ choices: [{ message: { content: 'I think I will go to the well' } }] });
  await flush();
  assert.strictEqual(BL.mial.serialize(game.getState()), before);
  assert.strictEqual(game.getChat().at(-1).kind, 'error');
});

test('a valid action is applied and logged', async () => {
  const { game, api, BL } = makeGame();
  askJev(game, api).resolve(jevReply('well', 'thirsty'));
  await flush();
  assert.strictEqual(BL.mial.toJS(game.getState()).inhabitant.goal, 'well');
  assert.strictEqual(game.getChat().at(-1).kind, 'jev');
});
