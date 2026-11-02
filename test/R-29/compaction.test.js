// R-29: once the conversation passes COMPACT_AT_CHARS, its oldest part is summarized on demand (D-40).
const test = require('node:test');
const assert = require('node:assert');
const { makeGame, flush, sonnetReply } = require('../helpers/env');

const summary = (content) => ({ stop_reason: 'compaction', content: [{ type: 'compaction', content, signature: 'sig' }] });
const big = (n) => 'x'.repeat(n);
// Copied into this realm: values from the game's vm context aren't deepStrictEqual to local ones.
const local = (v) => JSON.parse(JSON.stringify(v));

// Grows the conversation with exchanges of about `size` chars each until a compaction request appears.
const growUntilCompaction = async (ctx, size = 3000) => {
  for (let i = 0; i < 40; i++) {
    ctx.clock.t += 60_000;
    ctx.game.sendUserMessage(`message ${i}`);
    ctx.api.calls.at(-1).resolve(sonnetReply({ say: big(size) }));
    await flush();
    const c = ctx.api.calls.at(-1);
    if (c.body.compaction) return c;
  }
  throw new Error('no compaction request');
};

test('crossing the threshold sends the oldest turns (at least the chunk) to be summarized with the same system blocks', async () => {
  const ctx = makeGame();
  const { BL, game } = ctx;
  const C = BL.CONFIG;
  const call = await growUntilCompaction(ctx);
  const turns = game.getConversation().turns;
  const chars = turns.reduce((n, t) => n + t.content.length, 0);
  assert.ok(chars > C.COMPACT_AT_CHARS);
  const sent = call.body.messages;
  assert.strictEqual(sent.length % 2, 0, 'the cut falls after an assistant turn');
  assert.ok(sent.reduce((n, m) => n + m.content.length, 0) >= C.COMPACT_CHUNK_CHARS);
  assert.ok(sent.length < turns.length, 'recent turns are kept out of the request');
  assert.deepStrictEqual(local(sent.map(m => m.content)), local(turns.slice(0, sent.length).map(t => t.content)));
  assert.strictEqual(call.body.output_config, undefined, 'no structured output on a compaction request');
  assert.strictEqual(call.body.system[0].text, BL.minds.CORE_PREAMBLE);
  assert.match(call.body.compaction.instructions, /Summarize the earlier conversation/, 'instructions come from reflective-mind-compaction');
});

test('the summary block goes first, followed by the kept turns unchanged, including ones added meanwhile', async () => {
  const ctx = makeGame();
  const { game, api, clock } = ctx;
  const call = await growUntilCompaction(ctx);
  const cut = call.body.messages.length;
  const before = game.getConversation().turns.slice(cut).map(t => t.content);
  clock.t += 60_000;
  game.sendUserMessage('while summarizing');
  const reflection = api.calls.at(-1);
  reflection.resolve(sonnetReply({ say: 'still here' }));
  await flush();
  call.resolve(summary('We talked about many x.'));
  await flush();
  const conv = game.getConversation();
  assert.strictEqual(conv.block.content, 'We talked about many x.');
  assert.deepStrictEqual(local(conv.turns.slice(0, before.length).map(t => t.content)), local(before));
  assert.match(conv.turns.at(-1).content, /still here/);
  assert.match(game.getChat().find(e => e.kind === 'memory').text, /We talked about many x/);
  clock.t += 60_000;
  game.sendUserMessage('next');
  const body = api.calls.at(-1).body;
  assert.deepStrictEqual(local(body.messages[0]), { role: 'assistant', content: [{ type: 'compaction', content: 'We talked about many x.', signature: 'sig' }] });
  assert.strictEqual(body.messages[1].role, 'user');
});

test('a second compaction summarizes the old summary too; a missing summary changes nothing', async () => {
  const ctx = makeGame();
  const first = await growUntilCompaction(ctx);
  first.resolve(summary('first summary'));
  await flush();
  const second = await growUntilCompaction(ctx);
  assert.strictEqual(second.body.messages[0].content[0].content, 'first summary');
  const before = JSON.stringify(ctx.game.getConversation());
  second.resolve({ stop_reason: 'end_turn', content: [] });
  await flush();
  assert.strictEqual(JSON.stringify(ctx.game.getConversation()), before);
  assert.match(ctx.game.getChat().at(-1).text, /no summary/);
});

test('without reflective-mind-compaction the API default summary prompt is used', async () => {
  const ctx = makeGame();
  ctx.game.applyEdit({ comment: 'forget how', source: '', delete: ['reflective-mind-compaction'] });
  const call = await growUntilCompaction(ctx);
  assert.deepStrictEqual(local(call.body.compaction), { type: 'summarize' });
});
