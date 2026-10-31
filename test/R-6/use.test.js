// R-6: using a structure raises its meter by rate − DECAY per tick; at METER_MAX: full, idle.
const test = require('node:test');
const assert = require('node:assert');
const { defaultWorld } = require('../helpers/world');

const w = defaultWorld();
const MAX = w.constant('METER_MAX');
const DECAY = w.table('DECAY');
const using = (water) => w.withFields(w.fresh(), { inhabitant: { x: 9, y: 3, goal: 'well', status: 'using' }, meters: { water } });

test('meter rises by rate − DECAY per tick', () => {
  const rate = w.js(w.fresh()).structures.find(s => s.name === 'well').rate;
  const after = w.js(w.tick(using(50))).meters.water;
  assert.ok(Math.abs(after - (50 - DECAY.water + rate)) < 1e-9);
});

test('reaching METER_MAX emits full and goes idle', () => {
  const s = w.tick(using(MAX - 0.5));
  const o = w.js(s);
  assert.strictEqual(o.meters.water, MAX);
  assert.deepEqual(w.W.eventsOf(s).filter(e => e.type === 'full'), [{ type: 'full', meter: 'water' }]);
  assert.strictEqual(o.inhabitant.status, 'idle');
  assert.strictEqual(o.inhabitant.goal, 'idle');
});
