// R-7: apply-action sets goal and status for every action and emits nothing.
const test = require('node:test');
const assert = require('node:assert');
const { defaultWorld } = require('../helpers/world');

const w = defaultWorld();

test('every action in actions sets goal and status', () => {
  const s0 = w.fresh();
  const acts = w.W.actions(w.loaded, s0).value;
  assert.deepEqual(acts, ['bush', 'well', 'shack', 'tree', 'idle']);
  for (const a of acts) {
    const s = w.W.applyAction(w.loaded, s0, a).value;
    const inh = w.js(s).inhabitant;
    if (a === 'idle') assert.deepEqual([inh.goal, inh.status], ['idle', 'idle']);
    else assert.deepEqual([inh.goal, inh.status, inh.progress], [a, 'walking', 0]);
    assert.deepEqual(w.W.eventsOf(s), [], `${a} emits no events`);
  }
});

test('an unknown place leaves the state unchanged', () => {
  const s0 = w.fresh();
  assert.deepEqual(w.js(w.W.applyAction(w.loaded, s0, 'volcano').value), w.js(s0));
});
