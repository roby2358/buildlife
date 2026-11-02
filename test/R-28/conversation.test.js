// R-28: the reflective mind's calls form one append-only conversation (D-39).
const test = require('node:test');
const assert = require('node:assert');
const { makeGame, flush, sonnetReply } = require('../helpers/env');

const reply = (obj, thinking) => {
  const r = sonnetReply(obj);
  if (thinking) r.content.unshift({ type: 'thinking', thinking, signature: 'sig' });
  return r;
};
const roles = (body) => body.messages.map(m => m.role).join(',');
const text = (m) => (typeof m.content === 'string' ? m.content : m.content.map(b => b.text || '').join(''));

test('the first call: cached preamble and source, the role prompt, the new turn (cached), then the status', () => {
  const { BL, game, api } = makeGame();
  game.sendUserMessage('hello there');
  const body = api.calls[0].body;
  assert.deepStrictEqual([...body.system.map(b => !!b.cache_control)], [true, true, false]);
  assert.strictEqual(roles(body), 'user,system');
  const [turn, status] = body.messages;
  assert.ok(turn.content[0].cache_control, 'breakpoint on the newest user turn');
  assert.match(text(turn), /\[neighbour\] hello there/);
  const W = BL.world;
  assert.match(status.content, new RegExp(W.sonnetPrompt(W.load(game.getSource()), game.getState(), game.getEventHistory()).value.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(status.content, /waiting for a reply/);
});

test('a reply is stored as a user/assistant pair of plain text; the next turn has only what is new', async () => {
  const { game, api, clock } = makeGame();
  game.sendUserMessage('build something');
  const json = { say: 'On it!', summary: 'I will add notes.', edits: [{ comment: 'notes', source: '# notes\n- `"hi"`\n', delete: [] }] };
  api.calls[0].resolve(reply(json, 'secret reasoning'));
  await flush();
  clock.t += 60_000;
  game.sendUserMessage('thanks');
  const body = api.calls.at(-1).body;
  assert.strictEqual(roles(body), 'user,assistant,user,system');
  const [u1, a1, u2] = body.messages;
  assert.match(text(u1), /build something/);
  assert.strictEqual(JSON.parse(text(a1)).say, 'On it!');
  assert.doesNotMatch(JSON.stringify(body.messages), /secret reasoning/, 'thinking is never replayed');
  assert.match(text(u2), /\[world edit\] v2 · notes/);
  assert.match(text(u2), /\[neighbour\] thanks/);
  assert.doesNotMatch(text(u2), /build something|On it!|I will add notes/, 'its own words and old entries are not repeated');
  assert.strictEqual(text(u1), game.getConversation().turns[0].content, 'history is sent byte for byte');
});

test('a failed call stores nothing; its chat entries go into the next turn', async () => {
  const { game, api, clock } = makeGame();
  game.sendUserMessage('first');
  api.calls[0].reject(new Error('network down'));
  await flush();
  clock.t += 60_000;
  game.sendUserMessage('second');
  const body = api.calls.at(-1).body;
  assert.strictEqual(roles(body), 'user,system');
  assert.match(text(body.messages[0]), /first[\s\S]*network down[\s\S]*second/);
  assert.strictEqual(game.getConversation().turns.length, 0);
});

test('auto-mind (Jev) lines stay out of turns; an empty turn says the world prompted it', () => {
  const { BL } = makeGame();
  assert.match(BL.minds.turnText([{ kind: 'auto-mind', text: '→ well' }, { kind: 'inhabitant', text: 'hi' }]), /Nothing new in the chat/);
});

test('the conversation survives a reload; a factory reset clears it and a late reply is discarded', async () => {
  const ctx = makeGame();
  ctx.game.sendUserMessage('remember me');
  ctx.api.calls[0].resolve(reply({ say: 'I will.' }));
  await flush();
  const again = makeGame({ storage: ctx.storage });
  assert.strictEqual(again.game.getConversation().turns.length, 2);
  again.clock.t += 60_000;
  again.game.sendUserMessage('late');
  again.game.factoryReset();
  again.api.calls.at(-1).resolve(reply({ say: 'too late' }));
  await flush();
  assert.strictEqual(again.game.getConversation().turns.length, 0);
});
