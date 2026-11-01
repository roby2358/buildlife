// R-8: default jev-trigger? and sonnet-trigger?.
const test = require('node:test');
const assert = require('node:assert');
const { defaultWorld } = require('../helpers/world');

const w = defaultWorld();
const N = w.constant('SONNET_EVERY_N_JEV');
const RECHECK = w.constant('IDLE_RECHECK_TICKS');
const walking = (tick) => w.withFields(w.M.fromJS({ ...w.js(w.fresh()), tick }), { inhabitant: { status: 'walking', goal: 'well' } });
const jev = (state, events) => w.W.jevTrigger(w.loaded, state, w.M.fromJS(events)).value;

test('jev-trigger? fires on full, low, recovered and idle events', () => {
  for (const type of ['full', 'low', 'recovered', 'idle']) assert.strictEqual(jev(walking(5), [{ type }]), true, type);
  assert.strictEqual(jev(walking(5), [{ type: 'arrived' }]), false);
  assert.strictEqual(jev(walking(5), []), false);
});

test('jev-trigger? fires while idle every IDLE_RECHECK_TICKS', () => {
  const idle = (tick) => w.M.fromJS({ ...w.js(w.fresh()), tick });
  assert.strictEqual(jev(idle(1), []), true);
  assert.strictEqual(jev(idle(2), []), false);
  assert.strictEqual(jev(idle(1 + RECHECK), []), true);
});

test('sonnet-trigger? fires when since ≥ SONNET_EVERY_N_JEV', () => {
  const s = w.fresh();
  const t = (since) => w.W.sonnetTrigger(w.loaded, s, w.M.node(null), since).value;
  assert.strictEqual(t(N - 1), false);
  assert.strictEqual(t(N), true);
});

test('sonnet-trigger? fires after any Jev decision while wonder is low', () => {
  const low = w.withFields(w.fresh(), { meters: { wonder: w.constant('LOW_THRESHOLD') - 1 } });
  const t = (since) => w.W.sonnetTrigger(w.loaded, low, w.M.node(null), since).value;
  assert.strictEqual(t(0), false);
  assert.strictEqual(t(1), true);
});
