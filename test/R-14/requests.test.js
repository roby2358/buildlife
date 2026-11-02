// R-14: request bodies come from the MIAL definitions plus the fixed core text.
const test = require('node:test');
const assert = require('node:assert');
const { makeGame } = require('../helpers/env');

test('Jev request: MIAL system/user text and actions as the schema enum', () => {
  const { BL, game } = makeGame();
  const W = BL.world;
  const loaded = W.load(game.getSource());
  const state = game.getState();
  const req = BL.minds.buildJev(loaded, state, []);
  assert.ok(req.ok);
  assert.strictEqual(req.body.model, BL.CONFIG.JEV_MODEL);
  assert.strictEqual(req.body.messages[0].content, W.jevSystem(loaded).value);
  assert.strictEqual(req.body.messages[1].content, W.jevPrompt(loaded, state, []).value);
  assert.deepEqual(req.body.response_format.json_schema.schema.properties.action.enum, W.actions(loaded, state).value);
});

test('Sonnet request: core preamble, full source, then reflective-mind-system; JSON output schema', () => {
  const { BL, game } = makeGame();
  const W = BL.world;
  const loaded = W.load(game.getSource());
  const req = BL.minds.buildSonnet({
    loaded, state: game.getState(), history: [], source: game.getSource(), version: game.getVersion(), userWaiting: false,
  });
  assert.ok(req.ok);
  const [pre, src, role] = req.body.system;
  assert.strictEqual(pre.text, BL.minds.CORE_PREAMBLE);
  assert.ok(src.text.includes(game.getSource()));
  assert.strictEqual(role.text, W.sonnetSystem(loaded).value);
  assert.strictEqual(req.body.messages.at(-1).content, W.sonnetPrompt(loaded, game.getState(), []).value, 'the status comes from reflective-mind-prompt');
  assert.strictEqual(req.body.model, BL.CONFIG.SONNET_MODEL);
  assert.deepEqual(req.body.output_config.format.schema, BL.minds.SONNET_SCHEMA);
  assert.strictEqual(req.body.tool_choice, undefined, 'no forced tool use (rejected by Sonnet 5.5)');
  assert.strictEqual(req.body.fallbacks, undefined, 'Haiku 5.5 has no server-side fallback');
});

test('the core preamble survives an edit that rewrites reflective-mind-system', () => {
  const { BL, game } = makeGame();
  game.applyEdit({ comment: 'terse', source: '# reflective-mind-system\n- `"be terse"`\n' });
  const loaded = BL.world.load(game.getSource());
  const req = BL.minds.buildSonnet({ loaded, state: game.getState(), history: [], source: game.getSource(), version: 1 });
  assert.strictEqual(req.body.system[2].text, 'be terse');
  assert.strictEqual(req.body.system[0].text, BL.minds.CORE_PREAMBLE);
});
