// R-30: the reflective mind's model is a setting; each model runs with the least thinking it allows (D-43).
const test = require('node:test');
const assert = require('node:assert');
const { makeGame, flush, sonnetReply } = require('../helpers/env');

const local = (v) => JSON.parse(JSON.stringify(v));
const EXPECT = {
  'claude-haiku-5-5': { name: 'Haiku', thinking: { type: 'disabled' }, effort: undefined, fallbacks: undefined },
  'claude-sonnet-5-5': { name: 'Sonnet', thinking: { type: 'between_tools' }, effort: undefined, fallbacks: undefined },
  'claude-opus-5-5': { name: 'Opus', thinking: { type: 'adaptive', display: 'summarized' }, effort: 'low', fallbacks: 'default' },
};

test('each model: the reflection request carries its id, least-thinking setting, effort and fallback', () => {
  for (const [id, e] of Object.entries(EXPECT)) {
    const { game, api } = makeGame();
    assert.ok(game.setSettings({ reflectiveModel: id }).ok);
    assert.strictEqual(game.getModelName(), e.name);
    game.sendUserMessage('hi');
    const body = api.calls.at(-1).body;
    assert.strictEqual(body.model, id);
    assert.deepStrictEqual(local(body.thinking), e.thinking, id);
    assert.strictEqual(body.output_config.effort, e.effort, id);
    assert.ok(body.output_config.format, 'still a structured reply');
    assert.strictEqual(body.fallbacks, e.fallbacks, id);
  }
});

test('repair and compaction use the chosen model and thinking too; compaction has no structured output', async () => {
  const { game, api, clock } = makeGame();
  game.setSettings({ reflectiveModel: 'claude-sonnet-5-5' });
  game.applyEdit({ comment: 'break', source: '# tick\n- state\n- explode\n' });
  game.tickOnce();
  const repair = api.calls.at(-1).body;
  assert.strictEqual(repair.model, 'claude-sonnet-5-5');
  assert.deepStrictEqual(local(repair.thinking), { type: 'between_tools' });
  assert.match(game.getChat().find(e => /repair/.test(e.text)).text, /Asking Sonnet to repair/);
  api.calls.at(-1).resolve(sonnetReply({}));
  await flush();
  game.revertTo(1);
  for (let i = 0; i < 40; i++) {
    clock.t += 60_000;
    game.sendUserMessage(`m${i}`);
    api.calls.at(-1).resolve(sonnetReply({ say: 'x'.repeat(3000) }));
    await flush();
    if (api.calls.at(-1).body.compaction) break;
  }
  const compact = api.calls.at(-1).body;
  assert.ok(compact.compaction);
  assert.strictEqual(compact.model, 'claude-sonnet-5-5');
  assert.deepStrictEqual(local(compact.thinking), { type: 'between_tools' });
  assert.strictEqual(compact.output_config, undefined);
});

test('an unknown model is rejected and changes nothing; the default is Haiku', () => {
  const { game } = makeGame();
  assert.strictEqual(game.getSettings().reflectiveModel, 'claude-haiku-5-5');
  assert.strictEqual(game.setSettings({ reflectiveModel: 'gpt-9', jevGapMs: 5000 }).ok, false);
  assert.strictEqual(game.getSettings().reflectiveModel, 'claude-haiku-5-5');
  assert.strictEqual(game.getSettings().jevGapMs, 2000, 'nothing applied');
});
