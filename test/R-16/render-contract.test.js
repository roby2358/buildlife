// R-16: the render extractor never throws, whatever shape the state takes.
const test = require('node:test');
const assert = require('node:assert');
const { loadBL } = require('../helpers/env');

const BL = loadBL();
const { fromJS, node } = BL.mial;

test('odd states give partial data and warnings', () => {
  const cases = [
    null,
    node(5),
    fromJS({}),
    fromJS({ grid: 'big', structures: [1, 'x', { name: 'well' }], inhabitant: { x: 'left' }, meters: [1, 2] }),
    fromJS({ grid: { w: 4, h: 4 }, structures: [{ name: 'hut', x: 1, y: 1 }], inhabitant: { x: 2, y: 2 }, meters: { joy: 50, mood: 'ok' } }),
  ];
  for (const s of cases) {
    const d = BL.world.renderData(s, 30);
    assert.ok(Array.isArray(d.warnings));
  }
  const good = BL.world.renderData(cases[4], 30);
  assert.deepEqual(good.grid, { w: 4, h: 4 });
  assert.deepEqual(good.structures, [{ name: 'hut', x: 1, y: 1 }]);
  assert.deepEqual(good.meters, { joy: 50 });
  assert.strictEqual(good.warnings.length, 0);
  assert.ok(BL.world.renderData(cases[3], 30).warnings.length >= 3);
});
