// R-17: revertTo restores a snapshot as a new version and clears halted.
const test = require('node:test');
const assert = require('node:assert');
const { makeGame, flush, sonnetReply } = require('../helpers/env');

test('revert restores v1 as a new version with a comment', () => {
  const { game } = makeGame();
  const v1 = game.getSource();
  game.applyEdit({ comment: 'change', source: '# BASE_SPEED\n- `1`\n' });
  const r = game.revertTo(1);
  assert.ok(r.ok);
  assert.strictEqual(game.getSource(), v1);
  assert.strictEqual(game.getVersion(), 3);
  assert.strictEqual(game.getEditLog().at(-1).comment, 'revert to v1');
});

test('revert clears halted', async () => {
  const { game, api, BL } = makeGame();
  game.applyEdit({ comment: 'break', source: '# tick\n- state\n- explode\n' });
  for (let i = 0; i < BL.CONFIG.REPAIR_MAX; i++) {
    game.tickOnce();
    api.calls.at(-1).resolve(sonnetReply({}));
    await flush();
  }
  game.tickOnce();
  assert.ok(game.isHalted());
  game.revertTo(1);
  assert.strictEqual(game.isHalted(), false);
  assert.strictEqual(game.tickOnce().ok, true);
});

test('an unknown version is refused', () => {
  const { game } = makeGame();
  assert.strictEqual(game.revertTo(99).ok, false);
});
