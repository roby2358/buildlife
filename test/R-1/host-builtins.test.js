// R-1: host built-ins on the interpreter copy.
const test = require('node:test');
const assert = require('node:assert');
const { loadBL } = require('../helpers/env');

const M = loadBL().mial;
const run = (src, name = 'f', args = []) => {
  const r = M.callDef(M.loadSource(src), name, args);
  assert.ok(r.ok, r.error);
  return r.value;
};

test('record / get / put / has? / keys round-trip, and put does not mutate', () => {
  const loaded = M.loadSource([
    '# base', '- record `"a"` `1` `"b"` `2`',
    '# f', '- r', '- put r `"a"` `9`',
    '# g', '- *', '  - r', '  - k', '- get r k',
    '# h', '- r', '- keys r',
    '# has', '- r', '- has? r `"zz"`',
  ].join('\n'));
  const base = M.callDef(loaded, 'base').value;
  const updated = M.callDef(loaded, 'f', [base]).value;
  assert.deepEqual(M.toJS(updated), { a: 9, b: 2 });
  assert.deepEqual(M.toJS(base), { a: 1, b: 2 }, 'input unchanged');
  assert.strictEqual(M.callDef(loaded, 'g', [base, M.fromJS('b')]).value.value, 2);
  assert.strictEqual(M.callDef(loaded, 'g', [base, M.fromJS('missing')]).value.value, null);
  assert.deepEqual(M.toJS(M.callDef(loaded, 'h', [base]).value), ['a', 'b']);
  assert.strictEqual(M.callDef(loaded, 'has', [base]).value.value, false);
});

test('text joins lines and expands list arguments', () => {
  const v = run(['# f', '- text', '  - `"one"`', '  - list `"two"` `"three"`', '  - `4`'].join('\n'));
  assert.strictEqual(v.value.string, 'one\ntwo\nthree\n4');
});

test('let binds in order', () => {
  const v = run(['# f', '- let', '  - vars', '    - a', '      - `2`', '    - b', '      - * a `5`', '  - + a b'].join('\n'));
  assert.strictEqual(v.value, 12);
});

test('map / filter / reduce call closures', () => {
  const src = [
    '# f', '- reduce',
    '  - lambda', '    - *', '      - acc', '      - x', '    - + acc x',
    '  - `0`',
    '  - map',
    '    - lambda', '      - x', '      - * x `10`',
    '    - filter', '      - lambda', '        - x', '        - > x `1`', '      - list `1` `2` `3`',
  ].join('\n');
  assert.strictEqual(run(src).value, 50);
});

test('eq and != compare strings by content and never throw on null', () => {
  const loaded = M.loadSource(['# e', '- *', '  - a', '  - b', '- eq a b', '# n', '- *', '  - a', '  - b', '- != a b'].join('\n'));
  const call = (name, a, b) => M.callDef(loaded, name, [a, b]);
  assert.strictEqual(call('e', M.fromJS('x'), M.fromJS('x')).value.value, true);
  assert.strictEqual(call('n', M.node(null), M.node(3)).value.value, true);
  assert.strictEqual(call('e', M.node(null), M.node(null)).value.value, true);
  assert.strictEqual(call('e', M.node(null), M.fromJS('x')).value.value, false);
});
