// The core controller: tick loop, model triggers, edits, repair, persistence.
// Headless: the store, the API and the clock are injected (ONTOLOGY §7 commands and events).
// No world rule lives here (invariant: core JS never encodes a world rule).
var BL = window.BL = window.BL || {};

BL.createGame = ({ store, api, now = () => Date.now() }) => {
  const C = BL.CONFIG;
  const M = BL.mial;
  const W = BL.world;
  const minds = BL.minds;

  const listeners = [];
  const emit = (type, payload) => listeners.forEach(fn => fn(type, payload));

  const freshCounters = () => ({ jevCalls: 0, sonnetCalls: 0, jevSinceSonnet: 0, repairStreak: 0, lastJevAt: -Infinity, lastSonnetAt: -Infinity });

  const g = {
    source: '',
    version: 0,
    loaded: null,
    state: null,
    versions: [],      // VersionSnapshot {version, text}
    editLog: [],       // Edit
    chat: [],          // ChatEntry
    eventHistory: [],  // recent events and decisions (JS objects)
    counters: freshCounters(),
    halted: false,
    running: false,
    repairing: false,
    userWaiting: false,
    inFlight: { jev: false, sonnet: false, repair: false },
    settings: { jevGapMs: C.JEV_MIN_GAP_MS, sonnetGapMs: C.SONNET_MIN_GAP_MS },
    warnedMissingKey: {},
  };

  const tickNow = () => {
    const f = g.state && M.field(g.state, 'tick');
    return f && typeof f.children[0].value === 'number' ? f.children[0].value : 0;
  };
  const stamp = () => ({ at: new Date(now()).toISOString(), tick: tickNow() });

  const addChat = (kind, text) => {
    const entry = { kind, text, ...stamp() };
    g.chat.push(entry);
    if (g.chat.length > C.MAX_CHAT) g.chat.splice(0, g.chat.length - C.MAX_CHAT);
    emit('chat', entry);
    return entry;
  };

  const save = () => store.saveGame({
    source: g.source,
    version: g.version,
    state: g.state ? JSON.parse(M.serialize(g.state)) : null,
    versions: g.versions,
    editLog: g.editLog,
    chat: g.chat,
    counters: g.counters,
    eventHistory: g.eventHistory,
    halted: g.halted,
  });

  const pushHistory = (items) => {
    g.eventHistory.push(...items);
    if (g.eventHistory.length > C.EVENT_HISTORY_N) g.eventHistory.splice(0, g.eventHistory.length - C.EVENT_HISTORY_N);
  };

  const snapshot = (version, text) => {
    g.versions.push({ version, text });
    if (g.versions.length > C.MAX_VERSIONS) g.versions.splice(1, g.versions.length - C.MAX_VERSIONS); // keep v1
  };

  const setSource = (text, logEntry) => {
    g.source = text;
    g.version += 1;
    g.loaded = W.load(text);
    snapshot(g.version, text);
    const entry = { version: g.version, ...logEntry, ...stamp() };
    g.editLog.push(entry);
    return entry;
  };

  // --- Repair rule (D-8) ---------------------------------------------------

  const mialError = (r) => {
    const where = r.definition ? ` in "# ${r.definition}"` : '';
    addChat('error', `World error${where}: ${r.error}`);
    emit('mial-error', { message: r.error, definition: r.definition });
    if (g.repairing || g.inFlight.repair) return; // a revert can clear repairing while the repair call is still out
    if (g.counters.repairStreak >= C.REPAIR_MAX) {
      g.halted = true;
      addChat('system', `Halted after ${C.REPAIR_MAX} failed repairs. Revert to an earlier version, start a new game, or factory reset.`);
      emit('halted', { streak: g.counters.repairStreak });
      save();
      return;
    }
    g.counters.repairStreak += 1;
    g.repairing = true;
    startRepair(r);
  };

  const startRepair = (r) => {
    addChat('system', `Asking Sonnet to repair the world (attempt ${g.counters.repairStreak} of ${C.REPAIR_MAX}).`);
    emit('repair-started', { streak: g.counters.repairStreak });
    if (!api.canCall('sonnet')) {
      g.repairing = false;
      g.halted = true;
      addChat('system', 'Halted: repair needs an Anthropic API key (open settings).');
      emit('halted', { streak: g.counters.repairStreak });
      save();
      return;
    }
    const req = minds.buildRepair({ source: g.source, version: g.version, error: r.error, definition: r.definition });
    g.inFlight.repair = true;
    g.counters.sonnetCalls += 1;
    api.sonnet(req.body)
      .then(resp => handleSonnetReply(resp, 'repair'))
      .catch(err => apiError('sonnet', err))
      .finally(() => {
        g.inFlight.repair = false;
        g.repairing = false; // the next tick retries; another failure counts toward REPAIR_MAX
        emit('changed');
      });
  };

  const apiError = (provider, err) => {
    const message = String(err && err.message ? err.message : err);
    addChat('error', `${provider === 'jev' ? 'Jev' : 'Sonnet'} call failed: ${message}`);
    emit('api-error', { provider, message });
  };

  const needsKey = (provider) => {
    if (api.canCall(provider)) return false;
    if (!g.warnedMissingKey[provider]) {
      g.warnedMissingKey[provider] = true;
      addChat('system', `No ${provider === 'jev' ? 'OpenRouter' : 'Anthropic'} API key set. Open settings to add one.`);
    }
    return true;
  };

  // --- Jev call rule ---------------------------------------------------------

  const maybeCallJev = () => {
    if (g.inFlight.jev || now() - g.counters.lastJevAt < g.settings.jevGapMs) return false;
    if (needsKey('jev')) return false;
    const req = minds.buildJev(g.loaded, g.state, g.eventHistory);
    if (!req.ok) { mialError(req); return false; }
    g.inFlight.jev = true;
    g.counters.lastJevAt = now();
    g.counters.jevCalls += 1;
    emit('changed');
    api.jev(req.body)
      .then(handleJevReply)
      .catch(err => apiError('jev', err))
      .finally(() => { g.inFlight.jev = false; emit('changed'); });
    return true;
  };

  // Applied to the state as it is when the reply arrives.
  const handleJevReply = (resp) => {
    if (g.halted || g.repairing) return;
    const acts = W.actions(g.loaded, g.state);
    if (!acts.ok) { mialError(acts); return; }
    const parsed = minds.parseJev(resp, acts.value);
    if (!parsed.ok) { addChat('error', parsed.error); return; }
    const next = W.applyAction(g.loaded, g.state, parsed.action);
    if (!next.ok) { mialError(next); return; }
    g.state = next.value;
    pushHistory([{ type: 'decision', action: parsed.action, thought: parsed.thought }]);
    addChat('jev', `→ ${parsed.action}${parsed.thought ? ` · ${parsed.thought}` : ''}`);
    emit('jev-decision', parsed);
    g.counters.jevSinceSonnet += 1;
    const trig = W.sonnetTrigger(g.loaded, g.state, W.eventsNode(g.state), g.counters.jevSinceSonnet);
    if (!trig.ok) { mialError(trig); return; }
    if (trig.value) maybeCallSonnet();
  };

  // --- Sonnet call rule ------------------------------------------------------

  const maybeCallSonnet = () => {
    if (g.inFlight.sonnet || g.inFlight.repair || g.repairing || g.halted) return false;
    if (now() - g.counters.lastSonnetAt < g.settings.sonnetGapMs) return false;
    if (needsKey('sonnet')) return false;
    const req = minds.buildSonnet({
      loaded: g.loaded, state: g.state, history: g.eventHistory, chat: g.chat,
      source: g.source, version: g.version, userWaiting: g.userWaiting,
    });
    if (!req.ok) { mialError(req); return false; }
    g.inFlight.sonnet = true;
    g.userWaiting = false;
    g.counters.lastSonnetAt = now();
    g.counters.sonnetCalls += 1;
    g.counters.jevSinceSonnet = 0;
    emit('changed');
    api.sonnet(req.body)
      .then(resp => handleSonnetReply(resp, 'sonnet'))
      .catch(err => apiError('sonnet', err))
      .finally(() => { g.inFlight.sonnet = false; emit('changed'); });
    return true;
  };

  const handleSonnetReply = (resp, author) => {
    const parsed = minds.parseSonnet(resp);
    if (!parsed.ok) { addChat('error', parsed.error); return; }
    if (parsed.thought) addChat('sonnet-thought', parsed.thought);
    if (parsed.say) addChat('inhabitant', parsed.say);
    emit('sonnet-reply', { thought: parsed.thought, say: parsed.say });
    for (const edit of parsed.edits) applyEdit({ ...edit, author });
    if (parsed.coreRequest) {
      addChat('core-request', parsed.coreRequest);
      emit('core-request', { text: parsed.coreRequest });
    }
    save();
  };

  // --- Commands ----------------------------------------------------------

  const tickOnce = () => {
    if (g.halted) return { ok: false, reason: 'halted' };
    if (g.repairing) return { ok: false, reason: 'repairing' };
    if (!g.state) {
      // initial-state failed earlier (boot or factory reset); retry it now that repair has run.
      const init = W.initialState(g.loaded);
      if (!init.ok) { mialError(init); return { ok: false, reason: 'mial-error' }; }
      g.state = init.value;
    }
    const r = W.tick(g.loaded, g.state);
    if (!r.ok) { mialError(r); return { ok: false, reason: 'mial-error' }; }
    g.state = r.value;
    const events = W.eventsOf(g.state);
    pushHistory(events);
    for (const e of events) {
      if (e.type === 'low' || e.type === 'recovered') addChat('system', `${e.meter || 'a need'} is ${e.type === 'low' ? 'running low' : 'back up'}`);
    }
    emit('ticked', { state: g.state, events });
    const trig = W.jevTrigger(g.loaded, g.state, W.eventsNode(g.state));
    if (!trig.ok) { mialError(trig); return { ok: false, reason: 'mial-error' }; }
    g.counters.repairStreak = 0; // one good tick resets the streak
    if (trig.value) maybeCallJev();
    if (g.userWaiting) maybeCallSonnet();
    if (tickNow() % C.SAVE_EVERY_TICKS === 0) save();
    return { ok: true, events };
  };

  // Called on a timer even while paused, so a waiting user message still gets an answer.
  const pump = () => {
    if (g.userWaiting) maybeCallSonnet();
  };

  const applyEdit = (edit) => {
    if (!edit || !String(edit.comment || '').trim()) return { ok: false, reason: 'an edit needs a comment' };
    const r = W.applyEdit(g.source, edit);
    if (!r.ok) {
      addChat('error', `Edit "${edit.comment}" rejected: ${r.error}${r.diagnostics.length ? ` (${r.diagnostics.join('; ')})` : ''}`);
      return { ok: false, reason: r.error, diagnostics: r.diagnostics };
    }
    const entry = setSource(r.source, { author: edit.author || 'sonnet', comment: edit.comment, names: r.names, deleted: r.deleted });
    const touched = [...r.names, ...r.deleted.map(n => `−${n}`)].join(', ');
    addChat('edit', `v${entry.version} · ${edit.comment} (${touched})`);
    emit('edit-applied', entry);
    save();
    return { ok: true, events: [entry], diagnostics: r.diagnostics };
  };

  const revertTo = (version) => {
    const snap = g.versions.find(v => v.version === version);
    if (!snap) return { ok: false, reason: `no snapshot for v${version}` };
    const entry = setSource(snap.text, { author: 'user', comment: `revert to v${version}`, names: [], deleted: [] });
    g.halted = false;
    g.repairing = false;
    g.counters.repairStreak = 0;
    addChat('edit', `v${entry.version} · revert to v${version}`);
    emit('edit-applied', entry);
    save();
    return { ok: true, events: [entry] };
  };

  const newGame = () => {
    const r = W.initialState(g.loaded);
    g.halted = false;
    g.repairing = false;
    g.counters.repairStreak = 0;
    g.eventHistory = [];
    if (!r.ok) { mialError(r); return { ok: false, reason: r.error }; }
    g.state = r.value;
    addChat('system', 'New game started.');
    emit('ticked', { state: g.state, events: [] });
    save();
    return { ok: true, events: [] };
  };

  const factoryReset = () => {
    store.clearGame();
    Object.assign(g, {
      source: '', version: 0, versions: [], editLog: [], chat: [], eventHistory: [],
      halted: false, repairing: false, userWaiting: false, state: null,
    });
    g.counters = freshCounters();
    setSource(BL.DEFAULT_WORLD, { author: 'system', comment: 'default world', names: [], deleted: [] });
    emit('edit-applied', g.editLog[0]);
    return newGame();
  };

  const sendUserMessage = (text) => {
    const t = String(text || '').trim();
    if (!t) return { ok: false, reason: 'empty message' };
    addChat('user', t);
    g.userWaiting = true;
    maybeCallSonnet();
    save();
    return { ok: true, events: [] };
  };

  const start = () => {
    if (g.halted) return { ok: false, reason: 'halted' };
    g.running = true;
    emit('changed');
    return { ok: true, events: [] };
  };
  const pause = () => {
    g.running = false;
    save();
    emit('changed');
    return { ok: true, events: [] };
  };
  const step = () => (g.running ? { ok: false, reason: 'running' } : tickOnce());

  // Validates every gap before applying any, so an illegal call changes nothing.
  const setSettings = (s = {}) => {
    const gaps = {};
    for (const k of ['jevGapMs', 'sonnetGapMs']) {
      if (s[k] === undefined) continue;
      const v = Number(s[k]);
      if (!(v >= 0)) return { ok: false, reason: `${k} must be a number ≥ 0` };
      gaps[k] = v;
    }
    Object.assign(g.settings, gaps);
    g.warnedMissingKey = {};
    return { ok: true, events: [] };
  };

  // Restores a save, or starts fresh from the default world.
  const boot = () => {
    const saved = store.loadGame();
    if (saved && saved.source) {
      Object.assign(g, {
        source: saved.source,
        version: saved.version,
        versions: saved.versions || [],
        editLog: saved.editLog || [],
        chat: saved.chat || [],
        eventHistory: saved.eventHistory || [],
        halted: !!saved.halted,
        state: saved.state,
      });
      g.counters = { ...g.counters, ...saved.counters, lastJevAt: -Infinity, lastSonnetAt: -Infinity };
      g.loaded = W.load(g.source);
      if (!g.state) return newGame();
      return { ok: true, events: [] };
    }
    return factoryReset();
  };

  return {
    boot, start, pause, step, tickOnce, pump, sendUserMessage, applyEdit, revertTo, newGame, factoryReset, setSettings,
    on: (fn) => listeners.push(fn),
    getState: () => g.state,
    getSource: () => g.source,
    getVersion: () => g.version,
    getEditLog: () => g.editLog,
    getVersions: () => g.versions,
    getChat: () => g.chat,
    getCounters: () => ({ ...g.counters, inFlight: { ...g.inFlight } }),
    getSettings: () => ({ ...g.settings }),
    getEventHistory: () => g.eventHistory,
    getRenderData: () => W.renderData(g.state, g.loaded ? W.lowThreshold(g.loaded) : undefined),
    isHalted: () => g.halted,
    isRunning: () => g.running,
    isRepairing: () => g.repairing,
    save,
  };
};
