// R-2: runaway evaluation becomes a MIAL error, never a hang or a throw.
const test = require('node:test');
const assert = require('node:assert');
const { loadBL } = require('../helpers/env');

const M = loadBL().mial;

test('infinite recursion reports a stack overflow', () => {
  const r = M.callDef(M.loadSource('# loop\n- n\n- loop n\n'), 'loop', [M.node(1)]);
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /recursed too deeply/);
});

test('long but shallow work hits the step budget', () => {
  const saved = M.budget.limit;
  M.budget.limit = 500;
  try {
    const src = '# count\n- n\n- if\n  - <= n `0`\n  - `0`\n  - count\n    - - n `1`\n';
    const r = M.callDef(M.loadSource(src), 'count', [M.node(400)]);
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /step budget/);
  } finally {
    M.budget.limit = saved;
  }
});

test('the budget resets between calls', () => {
  const loaded = M.loadSource('# f\n- n\n- + n `1`\n');
  for (let i = 0; i < 5; i++) assert.ok(M.callDef(loaded, 'f', [M.node(i)]).ok);
});
