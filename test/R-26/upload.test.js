// R-26: uploading a MIAL file makes it the next version and keeps the running state.
const test = require('node:test');
const assert = require('node:assert');
const { makeGame, flush, sonnetReply } = require('../helpers/env');

test('an upload becomes a new version by the user, revertable, with the state kept', () => {
  const { game } = makeGame();
  game.tickOnce();
  const state = JSON.stringify(game.getState());
  const v1 = game.getSource();
  const text = v1.replace(/# BASE_SPEED\n- `[^`]+`/, '# BASE_SPEED\n- `2`');
  assert.notStrictEqual(text, v1);
  const r = game.uploadSource(text, 'world-v11.md');
  assert.ok(r.ok);
  assert.strictEqual(game.getVersion(), 2);
  assert.match(game.getSource(), /# BASE_SPEED\n- `2`/);
  assert.strictEqual(JSON.stringify(game.getState()), state);
  const entry = game.getEditLog().at(-1);
  assert.strictEqual(entry.author, 'user');
  assert.strictEqual(entry.comment, 'upload world-v11.md');
  assert.match(game.getChat().at(-1).text, /^v2 · upload world-v11\.md$/);
  assert.ok(game.getVersions().some(v => v.version === 2));
  assert.ok(game.revertTo(1).ok);
  assert.strictEqual(game.getSource(), v1);
});

test('a file with no definitions is rejected and changes nothing', () => {
  const { game } = makeGame();
  const before = game.getSource();
  for (const text of ['', 'just some notes\n- a bullet']) {
    const r = game.uploadSource(text, 'notes.md');
    assert.strictEqual(r.ok, false);
  }
  assert.strictEqual(game.getSource(), before);
  assert.strictEqual(game.getVersion(), 1);
});

test('an upload clears halted, like a revert', async () => {
  const { game, api, BL } = makeGame();
  const good = game.getSource();
  game.applyEdit({ comment: 'break', source: '# tick\n- state\n- explode\n' });
  for (let i = 0; i < BL.CONFIG.REPAIR_MAX; i++) {
    game.tickOnce();
    api.calls.at(-1).resolve(sonnetReply({}));
    await flush();
  }
  game.tickOnce();
  assert.ok(game.isHalted());
  assert.ok(game.uploadSource(good, 'good.md').ok);
  assert.strictEqual(game.isHalted(), false);
  assert.strictEqual(game.tickOnce().ok, true);
});
