// R-7: actions lists function names; choosing one calls that definition. The defaults set goal
// and status and emit nothing; a name that isn't a one-parameter definition is a MIAL error.
const test = require('node:test');
const assert = require('node:assert');
const { defaultWorld } = require('../helpers/world');
const { makeGame } = require('../helpers/env');

const w = defaultWorld();

test('every default action is a function that sets goal and status', () => {
  const s0 = w.fresh();
  const acts = w.W.actions(w.loaded, s0).value;
  assert.deepEqual([...acts], ['go-bush', 'go-well', 'go-shack', 'go-tree', 'stay']);
  for (const a of acts) {
    const s = w.W.callAction(w.loaded, s0, a).value;
    const inh = w.js(s).inhabitant;
    if (a === 'stay') assert.deepEqual([inh.goal, inh.status], ['idle', 'idle']);
    else assert.deepEqual([inh.goal, inh.status, inh.progress], [a.slice(3), 'walking', 0]);
    assert.deepEqual(w.W.eventsOf(s), [], `${a} emits no events`);
  }
});

test('a new function added to actions becomes callable', () => {
  const { BL, game } = makeGame();
  game.applyEdit({ comment: 'dance', source: '# dance\n- state\n- set-inhabitant state `"status"` `"dancing"`\n\n# actions\n- state\n- list `"stay"` `"dance"`\n' });
  const loaded = BL.world.load(game.getSource());
  const s = BL.world.callAction(loaded, game.getState(), 'dance');
  assert.ok(s.ok);
  assert.strictEqual(BL.mial.toJS(s.value).inhabitant.status, 'dancing');
  assert.deepEqual([...Object.keys(BL.minds.buildJev(loaded, game.getState(), []).body.questions.action.criteria)], ['stay', 'dance']);
});

test('a listed name that is not a one-parameter definition is a MIAL error naming actions', () => {
  const { BL, game } = makeGame();
  game.applyEdit({ comment: 'typo', source: '# actions\n- state\n- list `"stay"` `"go-pond"` `"METER_MAX"`\n' });
  const loaded = BL.world.load(game.getSource());
  const req = BL.minds.buildJev(loaded, game.getState(), []);
  assert.strictEqual(req.ok, false);
  assert.strictEqual(req.definition, 'actions');
  assert.match(req.error, /"go-pond", "METER_MAX"/);
  assert.strictEqual(BL.world.callAction(loaded, game.getState(), 'go-pond').ok, false);
});
