// R-22: every saved version is the compact form of its source, with the same parsed tree.
const test = require('node:test');
const assert = require('node:assert');
const { makeGame, loadBL } = require('../helpers/env');

const tree = (M, text) => JSON.stringify(M.parseMarkdown(text).defs, (k, v) => (k === '_indent' ? undefined : v));

test('the default world is stored compact', () => {
  const { game, BL } = makeGame();
  const M = BL.mial;
  assert.strictEqual(game.getSource(), M.compactSource(game.getSource()));
  assert.strictEqual(tree(M, game.getSource()), tree(M, BL.DEFAULT_WORLD));
});

test('an expanded edit is saved compact, in the snapshot too, with the same meaning', () => {
  const { game, BL } = makeGame();
  const M = BL.mial;
  const expanded = '# double\n- x\n- *\n  - x\n  - `2`\n';
  assert.ok(game.applyEdit({ comment: 'expanded', source: expanded }).ok);
  assert.match(game.getSource(), /# double\n- x\n- \* x `2`\n$/);
  const snap = game.getVersions().find(v => v.version === game.getVersion());
  assert.strictEqual(snap.text, game.getSource());
  assert.strictEqual(tree(M, '# double\n- x\n- * x `2`\n'), tree(M, expanded), 'same tree');
});

test('compactSource round-trips literals of every kind', () => {
  const M = loadBL().mial;
  const src = '# k\n- list\n  - `"a b"`\n  - `\'q\'`\n  - `"say "hi""`\n  - `1e3`\n  - `-0.5`\n  - `null`\n  - `true`\n  - sym\n';
  assert.strictEqual(tree(M, M.compactSource(src)), tree(M, src));
});
