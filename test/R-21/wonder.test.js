// R-21: wonder drains, and a rise in core.sonnet-edits fills it to METER_MAX.
const test = require('node:test');
const assert = require('node:assert');
const { defaultWorld } = require('../helpers/world');

const w = defaultWorld();
const MAX = w.constant('METER_MAX');
const DECAY = w.table('DECAY');
const withEdits = (state, n) => w.W.withCoreStats(state, { 'sonnet-edits': n });
const wonder = (state) => w.js(state).meters.wonder;

test('wonder drains like the other needs', () => {
  const s0 = withEdits(w.fresh(), 0);
  assert.ok(Math.abs(wonder(s0) - DECAY.wonder - wonder(w.tick(s0))) < 1e-9);
});

test('the first tick only notes the count; a rise fills wonder to the top and emits created', () => {
  let s = w.tick(withEdits(w.withFields(w.fresh(), { meters: { wonder: 20 } }), 3));
  assert.ok(wonder(s) < 20, 'no refill for edits made before the world started counting');
  s = w.tick(withEdits(s, 7)); // several edits from one reflection
  assert.strictEqual(wonder(s), MAX);
  assert.deepEqual(w.W.eventsOf(s).filter(e => e.type === 'created'), [{ type: 'created' }]);
  s = w.tick(withEdits(s, 7));
  assert.ok(Math.abs(wonder(s) - (MAX - DECAY.wonder)) < 1e-9, 'then it drains again until the next edit');
});

test('Jev is not shown wonder', () => {
  const prompt = w.W.jevPrompt(w.loaded, w.fresh(), []).value;
  assert.doesNotMatch(prompt.split('\n')[0], /wonder/);
});
