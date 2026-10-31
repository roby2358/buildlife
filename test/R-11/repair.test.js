// R-11: a MIAL error pauses ticking and calls repair; REPAIR_MAX failures halt; a good tick resets the streak.
const test = require('node:test');
const assert = require('node:assert');
const { makeGame, flush, sonnetReply } = require('../helpers/env');

const breakTick = (game) => game.applyEdit({ comment: 'oops', source: '# tick\n- state\n- explode state\n' });

test('a broken tick starts a repair with the core repair prompt', () => {
  const { game, api, BL } = makeGame();
  breakTick(game);
  assert.strictEqual(game.tickOnce().ok, false);
  assert.ok(game.isRepairing());
  const call = api.calls.at(-1);
  assert.strictEqual(call.provider, 'sonnet');
  assert.ok(call.body.system[0].text.startsWith(BL.minds.CORE_REPAIR_PROMPT));
  assert.match(call.body.messages[0].content, /explode/);
  assert.strictEqual(game.tickOnce().ok, false, 'ticking paused while repairing');
});

test('missing definitions and wrong return types are MIAL errors too', () => {
  for (const source of ['', '# tick\n- state\n- `42`\n']) {
    const { game, api } = makeGame();
    if (source) game.applyEdit({ comment: 'wrong type', source });
    else game.applyEdit({ comment: 'delete tick', source: '', delete: ['tick'] });
    game.tickOnce();
    assert.ok(game.isRepairing());
    assert.strictEqual(api.calls.length, 1);
  }
});

test('REPAIR_MAX failed repairs halt the world', async () => {
  const { game, api, BL } = makeGame();
  breakTick(game);
  for (let i = 0; i < BL.CONFIG.REPAIR_MAX; i++) {
    game.tickOnce();
    api.calls.at(-1).resolve(sonnetReply({ thought: 'hmm' })); // repair that fixes nothing
    await flush();
  }
  assert.strictEqual(game.isHalted(), false);
  game.tickOnce();
  assert.strictEqual(game.isHalted(), true);
  assert.strictEqual(api.calls.length, BL.CONFIG.REPAIR_MAX, 'no further repair calls once halted');
});

test('a successful repair resumes ticking and resets the streak', async () => {
  const { game, api } = makeGame();
  const good = game.getSource().match(/# tick\n[\s\S]*?(?=\n# )/)[0];
  breakTick(game);
  game.tickOnce();
  api.calls.at(-1).resolve(sonnetReply({ edits: [{ comment: 'restore tick', source: good, delete: [] }] }));
  await flush();
  assert.strictEqual(game.tickOnce().ok, true);
  assert.strictEqual(game.getCounters().repairStreak, 0);
  assert.strictEqual(game.getEditLog().at(-1).author, 'repair');
});

test('a repaired initial-state is retried when there is no state yet', async () => {
  const { BL, game: g0, storage, api } = makeGame();
  const good = g0.getSource().match(/# initial-state\n[\s\S]*?(?=\n# )/)[0];
  g0.applyEdit({ comment: 'break start', source: '# initial-state\n- explode\n' });
  BL.createStore(storage).saveGame({ source: g0.getSource(), version: g0.getVersion(), state: null });

  const game = BL.createGame({ store: BL.createStore(storage), api });
  game.boot();
  assert.ok(game.isRepairing());
  api.calls.at(-1).resolve(sonnetReply({ edits: [{ comment: 'restore initial-state', source: good, delete: [] }] }));
  await flush();
  assert.strictEqual(game.tickOnce().ok, true);
  assert.ok(game.getState());
});
