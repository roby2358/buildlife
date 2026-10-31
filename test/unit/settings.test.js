// setSettings is all or nothing: an illegal gap leaves every setting unchanged.
const test = require('node:test');
const assert = require('node:assert');
const { makeGame } = require('../helpers/env');

test('one illegal gap rejects the whole call', () => {
  const { game } = makeGame();
  const before = game.getSettings();
  const r = game.setSettings({ jevGapMs: 0, sonnetGapMs: -1 });
  assert.strictEqual(r.ok, false);
  assert.deepEqual(game.getSettings(), before);
  assert.ok(game.setSettings({ jevGapMs: 0 }).ok);
  assert.strictEqual(game.getSettings().jevGapMs, 0);
});
