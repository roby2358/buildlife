// R-23: each tile walked costs MOVE_COST from food, water and rest, on top of decay; standing still costs nothing extra.
const test = require('node:test');
const assert = require('node:assert');
const { defaultWorld } = require('../helpers/world');

const w = defaultWorld();
const COST = w.js(w.M.callDef(w.loaded, 'MOVE_COST', []).value);
const meters = (s) => w.js(s).meters;

test('MOVE_COST covers food, water and rest only', () => {
  assert.deepStrictEqual(Object.keys(COST).sort(), ['food', 'rest', 'water']);
});

test('walking 5 tiles costs 5 × MOVE_COST beyond an idle twin', () => {
  // Well at (9,2); (9,3) is 5 tiles from (9,8). Run exactly until arrival, then compare with an idle twin.
  const start = w.withFields(w.fresh(), { inhabitant: { x: 9, y: 8 } });
  let walker = w.W.callAction(w.loaded, start, 'go-well').value;
  let idle = start;
  for (let t = 0; t < 100 && w.js(walker).inhabitant.status !== 'using'; t++) {
    walker = w.tick(walker);
    idle = w.tick(idle);
  }
  assert.strictEqual(w.js(walker).inhabitant.status, 'using');
  const a = meters(walker), b = meters(idle);
  for (const m of Object.keys(a)) {
    const expected = COST[m] ? 5 * COST[m] : 0;
    assert.ok(Math.abs((b[m] - a[m]) - expected) < 1e-9, `${m}: paid ${b[m] - a[m]}, expected ${expected}`);
  }
});

test('move cost floors meters at 0', () => {
  let s = w.withFields(w.fresh(), { inhabitant: { x: 9, y: 8 }, meters: { food: 0.01, water: 0.01, rest: 0.01, wood: 50, wonder: 50 } });
  s = w.W.callAction(w.loaded, s, 'go-well').value;
  for (let t = 0; t < 30; t++) s = w.tick(s);
  for (const m of ['food', 'water', 'rest']) assert.ok(meters(s)[m] >= 0, m);
});
