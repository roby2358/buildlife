// R-5: walking reaches the tile next to the goal in about distance / speed ticks; arrived fires once.
const test = require('node:test');
const assert = require('node:assert');
const { defaultWorld } = require('../helpers/world');

const w = defaultWorld();
const BASE = w.constant('BASE_SPEED');

test('walks to the well and arrives once', () => {
  // Well at (9,2). From (9,8) the tile next to it, (9,3), is 5 steps away.
  let s = w.withFields(w.fresh(), { inhabitant: { x: 9, y: 8 } });
  s = w.W.callAction(w.loaded, s, 'go-well').value;
  const expected = Math.ceil(5 / BASE);
  let arrivedAt = null;
  let arrivals = 0;
  for (let t = 1; t <= expected + 10; t++) {
    s = w.tick(s);
    const n = w.W.eventsOf(s).filter(e => e.type === 'arrived').length;
    arrivals += n;
    if (n && arrivedAt === null) arrivedAt = t;
  }
  assert.ok(Math.abs(arrivedAt - expected) <= 1, `arrived at ${arrivedAt}, expected ${expected} ± 1`);
  assert.strictEqual(arrivals, 1);
  const inh = w.js(s).inhabitant;
  assert.ok(Math.abs(inh.x - 9) <= 1 && Math.abs(inh.y - 2) <= 1, 'adjacent to the well');
});

test('status becomes using on arrival', () => {
  let s = w.withFields(w.fresh(), { inhabitant: { x: 9, y: 4 } });
  s = w.W.callAction(w.loaded, s, 'go-well').value;
  for (let t = 0; t < 10 && w.js(s).inhabitant.status !== 'using'; t++) s = w.tick(s);
  assert.strictEqual(w.js(s).inhabitant.status, 'using');
});
