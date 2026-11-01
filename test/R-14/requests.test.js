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

test('Sonnet request: reflective-mind-system, core preamble and full source; JSON output schema', () => {
  const { BL, game } = makeGame();
  const W = BL.world;
  const loaded = W.load(game.getSource());
  const req = BL.minds.buildSonnet({
    loaded, state: game.getState(), history: [], chat: [], source: game.getSource(), version: game.getVersion(), userWaiting: false,
  });
  assert.ok(req.ok);
  const system = req.body.system[0].text;
  assert.ok(system.startsWith(W.sonnetSystem(loaded).value));
  assert.ok(system.includes(BL.minds.CORE_PREAMBLE));
  assert.ok(system.includes(game.getSource()));
  assert.strictEqual(req.body.model, BL.CONFIG.SONNET_MODEL);
  assert.deepEqual(req.body.output_config.format.schema, BL.minds.SONNET_SCHEMA);
  assert.strictEqual(req.body.tool_choice, undefined, 'no forced tool use (rejected by Sonnet 5.5)');
  assert.strictEqual(req.body.fallbacks, undefined, 'Haiku 5.5 has no server-side fallback');
});

test('the core preamble survives an edit that rewrites reflective-mind-system', () => {
  const { BL, game } = makeGame();
  game.applyEdit({ comment: 'terse', source: '# reflective-mind-system\n- `"be terse"`\n' });
  const loaded = BL.world.load(game.getSource());
  const req = BL.minds.buildSonnet({ loaded, state: game.getState(), history: [], chat: [], source: game.getSource(), version: 1 });
  assert.ok(req.body.system[0].text.startsWith('be terse'));
  assert.ok(req.body.system[0].text.includes(BL.minds.CORE_PREAMBLE));
});
