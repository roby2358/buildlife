// R-4: speed halves when any meter is low, and the factor applies only once.
const test = require('node:test');
const assert = require('node:assert');
const { defaultWorld } = require('../helpers/world');

const w = defaultWorld();
const BASE = w.constant('BASE_SPEED');
const SLOW = w.constant('SLOW_FACTOR');
const LOW = w.constant('LOW_THRESHOLD');
const speed = (meters) => w.M.callDef(w.loaded, 'speed', [w.M.fromJS(meters)]).value.value;
const ok = LOW + 10;

test('no low meter: BASE_SPEED', () => {
  assert.strictEqual(speed({ food: ok, water: ok, rest: ok, wood: ok }), BASE);
});

test('one low meter: BASE_SPEED × SLOW_FACTOR', () => {
  assert.strictEqual(speed({ food: LOW - 1, water: ok, rest: ok, wood: ok }), BASE * SLOW);
});

test('two low meters: still BASE_SPEED × SLOW_FACTOR (not compounded)', () => {
  assert.strictEqual(speed({ food: LOW - 1, water: LOW - 1, rest: ok, wood: ok }), BASE * SLOW);
});
