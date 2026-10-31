// Shortcuts for driving the default world headlessly.
const { loadBL } = require('./env');

const defaultWorld = () => {
  const BL = loadBL();
  const W = BL.world;
  const M = BL.mial;
  const loaded = W.load(BL.DEFAULT_WORLD);
  const constant = (name) => M.callDef(loaded, name, []).value.value;
  const table = (name) => M.toJS(M.callDef(loaded, name, []).value); // a record constant such as DECAY
  const fresh = () => W.initialState(loaded).value;
  const js = (state) => M.toJS(state);
  // Returns a state with the given JS fields merged into the inhabitant / meters.
  const withFields = (state, { inhabitant, meters }) => {
    const o = js(state);
    if (inhabitant) Object.assign(o.inhabitant, inhabitant);
    if (meters) Object.assign(o.meters, meters);
    return M.fromJS(o);
  };
  const tick = (state) => {
    const r = W.tick(loaded, state);
    if (!r.ok) throw new Error(r.error);
    return r.value;
  };
  return { BL, W, M, loaded, constant, table, fresh, js, withFields, tick };
};

module.exports = { defaultWorld };
