// R-20: Sonnet replies: refusals name their category; the summary and summarized thinking reach the chat.
const test = require('node:test');
const assert = require('node:assert');
const { makeGame, flush, sonnetReply } = require('../helpers/env');

test('a refusal is reported with its category and explanation, and changes nothing', async () => {
  const { game, api } = makeGame();
  const v = game.getVersion();
  game.sendUserMessage('hello');
  api.calls[0].resolve({
    stop_reason: 'refusal', content: [],
    stop_details: { type: 'refusal', category: 'reasoning_extraction', explanation: 'Blocked.' },
  });
  await flush();
  const last = game.getChat().at(-1);
  assert.strictEqual(last.kind, 'error');
  assert.match(last.text, /\(refusal: reasoning_extraction\)\. Blocked\./);
  assert.strictEqual(game.getVersion(), v);
});

test('summary and summarized thinking are shown together', async () => {
  const { game, api } = makeGame();
  game.sendUserMessage('hello');
  const reply = sonnetReply({ summary: 'Water runs low fastest.', say: 'Hi!' });
  reply.content.unshift({ type: 'thinking', thinking: 'The well is far from the shack.', signature: 'x' });
  api.calls[0].resolve(reply);
  await flush();
  const thought = game.getChat().find(e => e.kind === 'reflective-mind-thought');
  assert.strictEqual(thought.text, 'Water runs low fastest.\n\nThinking: The well is far from the shack.');
  assert.strictEqual(game.getChat().at(-1).text, 'Hi!');
});

test('requests never ask for reasoning in the reply text; the default model runs with thinking off', () => {
  const { BL, game } = makeGame();
  const loaded = BL.world.load(game.getSource());
  const req = BL.minds.buildSonnet({ loaded, state: game.getState(), history: [], source: game.getSource(), version: 1 });
  assert.deepEqual({ ...req.body.thinking }, { type: 'disabled' }, 'Haiku: the least thinking it allows (D-43)');
  assert.deepEqual(Object.keys(req.body.output_config.format.schema.properties), ['summary', 'say', 'edits', 'run', 'core_request']);
  assert.doesNotMatch(BL.minds.CORE_PREAMBLE, /private reflection|your thinking/i);
});
