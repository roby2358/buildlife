// Soak harness for X-1: runs the default world headlessly with a scripted stand-in for Jev
// (no API calls) and reports how much of the session the inhabitant spends at half speed.
//
// Usage: node tools/tune.js [--minutes 15] [--runs 5] [--latency 1.5] [--policy lowest|smart|random]
//                           [--set NAME=value ...]   (overrides a MIAL constant, e.g. --set LOW_THRESHOLD=25)
//                           [--decay-scale 1]        (multiplies every DECAY entry)
//                           [--create-every 60]      (seconds between simulated Sonnet edits that feed wonder; 0 = never)
// Policies: lowest (always the lowest meter), smart (need weighed against distance),
//           random (a careless mind: any place, chosen by a fixed pseudo-random sequence).
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};
const sets = args.flatMap((a, i) => (a === '--set' ? [args[i + 1]] : []));

const ROOT = path.join(__dirname, '..');
const ctx = vm.createContext({ console });
ctx.window = ctx;
for (const f of ['js/mial.js', 'js/world_default.js', 'js/config.js', 'js/world.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const { world: W, mial: M, CONFIG } = ctx.BL;

let source = ctx.BL.DEFAULT_WORLD;
for (const s of sets) {
  const at = s.indexOf('=');
  if (at < 1) throw new Error(`--set expects NAME=value, got "${s}"`);
  const [name, value] = [s.slice(0, at), s.slice(at + 1)];
  const r = W.applyEdit(source, { source: `# ${name}\n- \`${value}\`\n` });
  if (!r.ok) throw new Error(r.error);
  source = r.source;
}
const scale = Number(opt('decay-scale', 1));
if (scale !== 1) {
  const decay = M.toJS(M.callDef(W.load(source), 'DECAY', []).value);
  const fields = Object.entries(decay).map(([k, v]) => `    - ${k}\n      - \`${+(v * scale).toFixed(4)}\``).join('\n');
  const r = W.applyEdit(source, { source: `# DECAY\n- mial\n  - record\n${fields}\n` });
  if (!r.ok) throw new Error(r.error);
  source = r.source;
}
const loaded = W.load(source);
const constant = (n) => M.callDef(loaded, n, []).value.value;
const LOW = constant('LOW_THRESHOLD');

const minutes = Number(opt('minutes', 15));
const runs = Number(opt('runs', 5));
const latencyTicks = Math.round(Number(opt('latency', 1.5)) * 1000 / CONFIG.TICK_MS);
const gapTicks = Math.ceil(CONFIG.JEV_MIN_GAP_MS / CONFIG.TICK_MS);
const policy = opt('policy', 'lowest');
const ticks = Math.round(minutes * 60 * 1000 / CONFIG.TICK_MS);
const createEvery = Math.round(Number(opt('create-every', 60)) * 1000 / CONFIG.TICK_MS);

// Stand-in for Jev (policies in the header). 'random' uses a fixed LCG so runs are repeatable.
let rng = 12345;
const random = () => (rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648;
const choose = (o) => {
  if (policy === 'random') return o.structures[Math.floor(random() * o.structures.length)].name;
  const byMeter = Object.fromEntries(o.structures.map(s => [s.meter, s]));
  const meters = Object.entries(o.meters).filter(([m]) => byMeter[m]);
  if (policy === 'lowest') return byMeter[meters.sort((a, b) => a[1] - b[1])[0][0]].name;
  const dist = (s) => Math.max(Math.abs(s.x - o.inhabitant.x), Math.abs(s.y - o.inhabitant.y));
  const score = ([m, v]) => v + dist(byMeter[m]) * 2;
  return byMeter[meters.sort((a, b) => score(a) - score(b))[0][0]].name;
};

const one = (seedOffset) => {
  let s = W.initialState(loaded).value;
  let pendingAt = null;
  let lastAsk = -Infinity;
  let slow = 0;
  let minMeter = Infinity;
  let decisions = 0;
  for (let t = 0; t < ticks; t++) {
    const edits = createEvery ? Math.floor(t / createEvery) : 0;
    s = W.tick(loaded, W.withCoreStats(s, { 'sonnet-edits': edits })).value;
    const o = M.toJS(s);
    const vals = Object.values(o.meters);
    if (vals.some(v => v < LOW)) slow++;
    minMeter = Math.min(minMeter, ...vals);
    // jitter latency by ±1 tick so runs differ (deterministic per run)
    const lat = latencyTicks + ((t + seedOffset) % 3) - 1;
    if (pendingAt !== null && t >= pendingAt) {
      s = W.applyAction(loaded, s, choose(M.toJS(s))).value;
      pendingAt = null;
      decisions++;
    }
    if (pendingAt === null && t - lastAsk >= gapTicks && W.jevTrigger(loaded, s, W.eventsNode(s)).value) {
      pendingAt = t + Math.max(1, lat);
      lastAsk = t;
    }
  }
  const low = M.toJS(s)['low-ticks'] || {};
  return { slowPct: (100 * slow) / ticks, minMeter, decisions, low };
};

const results = Array.from({ length: runs }, (_, i) => one(i));
const fmt = (n) => n.toFixed(1);
console.log(`decay-scale=${scale} policy=${policy} minutes=${minutes} runs=${runs} latency=${latencyTicks} ticks gap=${gapTicks} ticks ${sets.length ? `set=${sets.join(',')}` : ''}`);
const lowText = (low) => Object.entries(low).filter(([, v]) => v > 0).map(([m, v]) => `${m} ${fmt((100 * v) / ticks)}%`).join(', ') || 'none';
for (const r of results) console.log(`  half-speed ${fmt(r.slowPct)}%  lowest meter ${fmt(r.minMeter)}  decisions ${r.decisions}  low: ${lowText(r.low)}`);
const failing = results.filter(r => r.slowPct > 50).length;
console.log(`X-1: ${failing}/${runs} runs spent most of the session at half speed → ${failing > runs / 2 ? 'FAIL' : 'pass'}`);
