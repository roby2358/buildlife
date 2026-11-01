// R-27: core requests are kept in a list, saved, and removed one at a time by the user.
const test = require('node:test');
const assert = require('node:assert');
const { makeGame, flush, sonnetReply } = require('../helpers/env');

const ask = async (ctx, text) => {
  ctx.game.sendUserMessage('hi');
  ctx.api.calls.at(-1).resolve(sonnetReply({ core_request: text }));
  await flush();
  ctx.clock.t += 60_000;
};
// Copied into this realm: arrays from the game's vm context aren't deepStrictEqual to local ones.
const texts = (game) => [...game.getRequests().map(r => r.text)];

test('each core request is added to the list; an empty one is not', async () => {
  const ctx = makeGame();
  await ask(ctx, 'raise the token limit');
  await ask(ctx, '');
  await ask(ctx, 'add a sound');
  const reqs = ctx.game.getRequests();
  assert.deepStrictEqual(texts(ctx.game), ['raise the token limit', 'add a sound']);
  assert.ok(reqs.every(r => typeof r.at === 'string' && typeof r.tick === 'number'));
});

test('deleteRequest removes exactly that one; a bad index changes nothing', async () => {
  const ctx = makeGame();
  for (const t of ['a', 'b', 'c']) await ask(ctx, t);
  assert.ok(ctx.game.deleteRequest(1).ok);
  assert.deepStrictEqual(texts(ctx.game), ['a', 'c']);
  for (const bad of [-1, 2, 0.5, undefined]) assert.strictEqual(ctx.game.deleteRequest(bad).ok, false);
  assert.deepStrictEqual(texts(ctx.game), ['a', 'c']);
});

test('the list survives a reload, and a factory reset clears it', async () => {
  const ctx = makeGame();
  await ask(ctx, 'keep me');
  const reloaded = makeGame({ storage: ctx.storage });
  assert.deepStrictEqual(texts(reloaded.game), ['keep me']);
  reloaded.game.factoryReset();
  assert.strictEqual(reloaded.game.getRequests().length, 0);
});
