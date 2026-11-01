// R-25: a reply's run calls its first definition once on the live state; the source is unchanged.
const test = require('node:test');
const assert = require('node:assert');
const { makeGame, flush, sonnetReply } = require('../helpers/env');

const ADD_POND = '# add-pond\n- state\n- put state `"structures"`\n  - append\n    - get state `"structures"`\n    - list\n      - structure `"pond"` `5` `6` `"water"` `0.8`\n';
const names = (game) => game.getRenderData().structures.map(s => s.name);

const reply = async (obj) => {
  const ctx = makeGame();
  ctx.game.sendUserMessage('hello');
  ctx.api.calls[0].resolve(sonnetReply(obj));
  await flush();
  return ctx;
};

test('a run changes the live state once, using world definitions, and leaves the source alone', async () => {
  const before = makeGame().game;
  const { game } = await reply({ run: [{ comment: 'dig a pond', source: ADD_POND }] });
  assert.strictEqual(game.getSource(), before.getSource());
  assert.strictEqual(game.getVersion(), before.getVersion());
  assert.ok(names(game).includes('pond'));
  game.tickOnce();
  game.tickOnce();
  assert.strictEqual(names(game).filter(n => n === 'pond').length, 1, 'not run again on later ticks');
  assert.strictEqual(game.getChat().find(e => e.kind === 'run').text, 'dig a pond');
  assert.strictEqual(game.getCounters().sonnetRuns, 1);
  assert.strictEqual(game.getStatsData().core['reflective-mind-runs'], 1);
});

test('runs see the edits from the same reply', async () => {
  const helper = '# pond-at\n- * x y\n- structure `"pond"` x y `"water"` `0.8`\n';
  const run = '# add\n- state\n- put state `"structures"`\n  - append\n    - get state `"structures"`\n    - list\n      - pond-at `3` `4`\n';
  const { game } = await reply({ edits: [{ comment: 'pond helper', source: helper, delete: [] }], run: [{ comment: 'use it', source: run }] });
  assert.ok(names(game).includes('pond'));
});

test('a failing run, or one that returns a non-record, reports in chat and leaves the state unchanged', async () => {
  for (const source of ['# boom\n- state\n- nth state `"x"`\n', '# notrec\n- state\n- `5`\n', 'no definition here']) {
    const ref = makeGame().game;
    const { game } = await reply({ run: [{ comment: 'oops', source }] });
    assert.deepEqual(game.getRenderData(), ref.getRenderData());
    assert.match(game.getChat().find(e => e.kind === 'error').text, /^Run "oops" failed/);
    assert.strictEqual(game.getCounters().sonnetRuns, 0);
    assert.strictEqual(game.isRepairing(), false, 'a failed run is not a world error');
  }
});

test('the default world fills wonder after a successful run', async () => {
  const { game } = await reply({});
  game.tickOnce(); // the world notes the starting counts
  const lower = '# lower\n- state\n- put state `"meters"`\n  - put\n    - get state `"meters"`\n    - `"wonder"`\n    - `10`\n';
  game.runOnce({ comment: 'lower wonder', source: lower, author: 'test' });
  game.tickOnce();
  assert.ok(game.getRenderData().meters.wonder < 10, 'a run not by Sonnet does not count');
  game.runOnce({ comment: 'dig a pond', source: ADD_POND, author: 'sonnet' });
  game.tickOnce();
  assert.strictEqual(game.getRenderData().meters.wonder, 100);
});
