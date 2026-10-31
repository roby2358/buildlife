// R-10: edits replace, append and delete definitions; an edit with no definitions changes nothing.
const test = require('node:test');
const assert = require('node:assert');
const { makeGame } = require('../helpers/env');

test('replace, append and delete each add one version, log entry and chat entry', () => {
  const { game } = makeGame();
  const v0 = game.getVersion();
  const log0 = game.getEditLog().length;
  const chat0 = game.getChat().length;

  let r = game.applyEdit({ comment: 'faster', source: '# BASE_SPEED\n- `0.5`\n' });
  assert.ok(r.ok);
  assert.match(game.getSource(), /# BASE_SPEED\n- `0\.5`/);
  assert.strictEqual((game.getSource().match(/# BASE_SPEED/g) || []).length, 1, 'replaced, not duplicated');

  r = game.applyEdit({ comment: 'remember', source: '# notes\n- `"hello"`\n' });
  assert.ok(r.ok);
  assert.match(game.getSource(), /# notes\n- `"hello"`\n$/);

  r = game.applyEdit({ comment: 'forget', source: '', delete: ['notes'] });
  assert.ok(r.ok);
  assert.doesNotMatch(game.getSource(), /# notes/);

  assert.strictEqual(game.getVersion(), v0 + 3);
  assert.strictEqual(game.getEditLog().length, log0 + 3);
  assert.strictEqual(game.getVersions().length, log0 + 3);
  assert.strictEqual(game.getChat().slice(chat0).filter(e => e.kind === 'edit').length, 3);
});

test('an edit with no definitions and no deletions changes nothing', () => {
  const { game } = makeGame();
  const before = game.getSource();
  const v = game.getVersion();
  const r = game.applyEdit({ comment: 'garbage', source: 'just some prose\n- a bullet\n' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.diagnostics.length > 0, 'returns parse diagnostics');
  assert.strictEqual(game.getSource(), before);
  assert.strictEqual(game.getVersion(), v);
});

test('the new definitions take effect on the next tick', () => {
  const { game, BL } = makeGame();
  game.applyEdit({ comment: 'no decay', source: '# DECAY\n- mial\n  - record\n    - food\n      - `0`\n' });
  const before = BL.mial.toJS(game.getState()).meters;
  game.tickOnce();
  assert.strictEqual(BL.mial.toJS(game.getState()).meters.food, before.food);
});
