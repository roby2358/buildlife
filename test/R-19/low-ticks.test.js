// R-19: the default world counts, per meter, the ticks it spends below LOW_THRESHOLD.
const test = require('node:test');
const assert = require('node:assert');
const { defaultWorld } = require('../helpers/world');

const w = defaultWorld();
const LOW = w.constant('LOW_THRESHOLD');

test('starts at zero and counts only low meters', () => {
  let s = w.fresh();
  assert.deepEqual(w.js(s)['low-ticks'], { food: 0, water: 0, rest: 0, wood: 0 });
  s = w.withFields(s, { meters: { food: LOW - 5, rest: LOW - 5, water: LOW + 20, wood: LOW + 20 } });
  for (let i = 0; i < 3; i++) s = w.tick(s);
  assert.deepEqual(w.js(s)['low-ticks'], { food: 3, water: 0, rest: 3, wood: 0 });
});

test('a state without the record (an older save) starts counting from nothing', () => {
  const o = w.js(w.fresh());
  delete o['low-ticks'];
  o.meters.water = LOW - 5;
  const s = w.tick(w.M.fromJS(o));
  assert.deepEqual(w.js(s)['low-ticks'], { water: 1 });
});
