// R-9: same source, state and actions give the same state.
const test = require('node:test');
const assert = require('node:assert');
const { defaultWorld } = require('../helpers/world');

const run = () => {
  const w = defaultWorld();
  let s = w.fresh();
  const plan = { 0: 'go-well', 60: 'go-bush', 140: 'go-tree', 230: 'go-shack' };
  for (let t = 0; t < 300; t++) {
    if (plan[t]) s = w.W.callAction(w.loaded, s, plan[t]).value;
    s = w.tick(s);
  }
  return w.M.serialize(s);
};

test('two runs end identical', () => {
  assert.strictEqual(run(), run());
});
