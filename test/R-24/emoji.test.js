// R-24: the map's emoji come from the world MIAL: the EMOJI record, or a structure's own emoji field (which wins in the renderer).
const test = require('node:test');
const assert = require('node:assert');
const { makeGame } = require('../helpers/env');

test('default EMOJI covers every default place and the inhabitant', () => {
  const { game } = makeGame();
  game.boot();
  const d = game.getRenderData();
  for (const s of d.structures) assert.ok(d.emoji[s.name], `emoji for ${s.name}`);
  assert.ok(d.emoji.inhabitant, 'emoji for the inhabitant');
});

test('an edit to EMOJI changes an existing emoji and adds one for a new place', () => {
  const { game } = makeGame();
  game.boot();
  const r = game.applyEdit({ comment: 'new looks', source: '# EMOJI\n- mial\n  - record\n    - bush `"🍓"`\n    - pond `"🦆"`\n' });
  assert.ok(r.ok);
  const d = game.getRenderData();
  assert.strictEqual(d.emoji.bush, '🍓');
  assert.strictEqual(d.emoji.pond, '🦆');
  assert.strictEqual(d.emoji.well, undefined, 'names left out have no emoji (drawn generic)');
});

test("a structure's own emoji field reaches the render data", () => {
  const { game } = makeGame();
  game.boot();
  game.applyEdit({ comment: 'pond', source: '# tick\n- state\n- put state `"structures"`\n  - append\n    - get state `"structures"`\n    - list\n      - record `"name"` `"pond"` `"x"` `5` `"y"` `9` `"meter"` `"water"` `"rate"` `1` `"emoji"` `"🦆"`\n' });
  game.tickOnce();
  const pond = game.getRenderData().structures.find(s => s.name === 'pond');
  assert.strictEqual(pond.emoji, '🦆');
});

test('a missing or non-record EMOJI gives an empty map, never a throw', () => {
  const { game } = makeGame();
  game.boot();
  game.applyEdit({ comment: 'oops', source: '# EMOJI\n- `5`\n' });
  assert.deepStrictEqual({ ...game.getRenderData().emoji }, {});
  game.applyEdit({ comment: 'gone', source: '', delete: ['EMOJI'] });
  assert.deepStrictEqual({ ...game.getRenderData().emoji }, {});
});
