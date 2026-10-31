// R-3: each meter decays by its DECAY, floors at 0, and `low` fires only on the crossing tick.
const test = require('node:test');
const assert = require('node:assert');
const { defaultWorld } = require('../helpers/world');

const w = defaultWorld();
const DECAY = w.table('DECAY');
const LOW = w.constant('LOW_THRESHOLD');

test('one tick lowers every meter by its DECAY', () => {
  const s0 = w.fresh();
  const before = w.js(s0).meters;
  const after = w.js(w.tick(s0)).meters;
  for (const m of Object.keys(before)) assert.ok(Math.abs(before[m] - DECAY[m] - after[m]) < 1e-9, m);
});

test('meters floor at 0', () => {
  const s = w.withFields(w.fresh(), { meters: { food: 0.01 } });
  assert.strictEqual(w.js(w.tick(s)).meters.food, 0);
});

test('low fires once, on the tick the meter crosses LOW_THRESHOLD', () => {
  let s = w.withFields(w.fresh(), { meters: { water: LOW + DECAY.water * 1.5 } });
  const lows = [];
  for (let i = 0; i < 5; i++) {
    s = w.tick(s);
    lows.push(w.W.eventsOf(s).filter(e => e.type === 'low' && e.meter === 'water').length);
  }
  assert.deepEqual(lows, [0, 1, 0, 0, 0]);
});
