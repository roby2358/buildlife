// R-15: a save restores everything, and never contains API keys.
const test = require('node:test');
const assert = require('node:assert');
const { makeGame, makeStorage, loadBL } = require('../helpers/env');

test('save then load restores state, source, versions, log, chat, counters and halted', () => {
  const storage = makeStorage();
  const { game, BL } = makeGame({ storage });
  BL.createStore(storage).saveKeys({ anthropic: 'sk-ant-SECRET', openrouter: 'sk-or-SECRET' });
  game.applyEdit({ comment: 'remember', source: '# notes\n- `"hi"`\n' });
  game.sendUserMessage('hello');
  for (let i = 0; i < 7; i++) game.tickOnce();
  game.save();

  const BL2 = loadBL();
  const game2 = BL2.createGame({ store: BL2.createStore(storage), api: { canCall: () => false } });
  game2.boot();
  assert.strictEqual(BL2.mial.serialize(game2.getState()), BL.mial.serialize(game.getState()));
  assert.strictEqual(game2.getSource(), game.getSource());
  assert.strictEqual(game2.getVersion(), game.getVersion());
  assert.deepEqual(game2.getVersions(), game.getVersions());
  assert.deepEqual(game2.getEditLog(), game.getEditLog());
  assert.deepEqual(game2.getChat(), game.getChat());
  assert.strictEqual(game2.getCounters().jevCalls, game.getCounters().jevCalls);
  assert.strictEqual(game2.isHalted(), game.isHalted());

  const blob = storage.getItem('buildlife.save.v1');
  assert.doesNotMatch(blob, /SECRET/);
});
