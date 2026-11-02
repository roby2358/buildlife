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

  const freshCounters = () => ({ ticks: 0, jevCalls: 0, jevDecisions: 0, jevInvalid: 0, jevRetries: 0, sonnetCalls: 0, sonnetRuns: 0, repairs: 0, jevSinceSonnet: 0, repairStreak: 0, lastJevAt: -Infinity, lastSonnetAt: -Infinity });

  const g = {
    source: '',
    version: 0,
    loaded: null,
    state: null,
    versions: [],      // VersionSnapshot {version, text}
    editLog: [],       // Edit
    chat: [],          // ChatEntry
    requests: [],      // CoreRequest {text, at, tick}, until the user deletes them
    conversation: { block: null, turns: [] }, // the reflective mind's history (D-39, D-40)
    chatSeq: 0,        // every chat entry gets the next seq
    lastSeenSeq: 0,    // chat entries up to this seq are already in a user turn
    convEpoch: 0,      // bumped when the conversation is cleared, so late replies are discarded
    eventHistory: [],  // recent events and decisions (JS objects)
    counters: freshCounters(),
    halted: false,
    running: false,
    repairing: false,
    userWaiting: false,
    inFlight: { jev: false, sonnet: false, repair: false, compact: false },
    settings: { jevGapMs: C.JEV_MIN_GAP_MS, sonnetGapMs: C.SONNET_MIN_GAP_MS },
    warnedMissingKey: {},
  };

  const tickNow = () => {
    const f = g.state && M.field(g.state, 'tick');
    return f && typeof f.children[0].value === 'number' ? f.children[0].value : 0;
  };
  const stamp = () => ({ at: new Date(now()).toISOString(), tick: tickNow() });

  const addChat = (kind, text) => {
    g.chatSeq += 1;
    const entry = { kind, text, seq: g.chatSeq, ...stamp() };
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
    requests: g.requests,
    conversation: g.conversation,
    chatSeq: g.chatSeq,
    lastSeenSeq: g.lastSeenSeq,
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

  // Every new version is stored in compact form (D-33).
  const setSource = (raw, logEntry) => {
    const text = M.compactSource(raw);
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
    g.counters.repairs += 1;
    g.repairing = true;
    startRepair(r);
  };

  const startRepair = (r) => {
    addChat('system', `Asking ${C.SONNET_NAME} to repair the world (attempt ${g.counters.repairStreak} of ${C.REPAIR_MAX}).`);
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
    addChat('error', `${provider === 'jev' ? 'Jev' : C.SONNET_NAME} call failed: ${message}`);
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
    g.inFlight.jev = true;
    emit('changed');
    requestJev(false)
      .catch(err => apiError('jev', err))
      .finally(() => { g.inFlight.jev = false; emit('changed'); });
    return true;
  };

  // One Jev request. A retry is built from the current state and skips the gap: it
  // stands in for the same decision. The in-flight flag covers both attempts.
  const requestJev = (isRetry) => {
    const req = minds.buildJev(g.loaded, g.state, g.eventHistory);
    if (!req.ok) { mialError(req); return Promise.resolve(); }
    g.counters.lastJevAt = now();
    g.counters.jevCalls += 1;
    return api.jev(req.body).then(resp => handleJevReply(resp, isRetry));
  };

  // The chat line: the three likeliest options, highest first ("go-well 0.82 · go-bush 0.10 · stay 0.05").
  // Without probabilities, just the choice and its confidence.
  const jevTop3 = (parsed, conf) => {
    const top = Object.entries(parsed.probabilities || {}).filter(([, p]) => typeof p === 'number')
      .sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (!top.length) return `${parsed.action}${conf === undefined ? '' : ` ${conf.toFixed(2)}`}`;
    return top.map(([a, p]) => `${a} ${p.toFixed(2)}`).join(' · ');
  };

  // Applied to the state as it is when the reply arrives.
  const handleJevReply = (resp, isRetry) => {
    if (g.halted || g.repairing) return undefined;
    const acts = W.actions(g.loaded, g.state);
    if (!acts.ok) { mialError(acts); return undefined; }
    const parsed = minds.parseJev(resp, acts.value);
    if (!parsed.ok) {
      g.counters.jevInvalid += 1;
      if (parsed.retryable && !isRetry) {
        g.counters.jevRetries += 1;
        addChat('system', `${parsed.error}. Retrying once.`);
        return requestJev(true);
      }
      addChat('error', parsed.error);
      return undefined;
    }
    const next = W.callAction(g.loaded, g.state, parsed.action);
    if (!next.ok) { mialError(next); return undefined; }
    g.state = next.value;
    const conf = parsed.confidence === undefined ? undefined : Math.round(parsed.confidence * 100) / 100;
    pushHistory([{ type: 'decision', action: parsed.action, ...(conf === undefined ? {} : { confidence: conf }) }]);
    addChat('jev', `→ ${jevTop3(parsed, conf)}`);
    emit('jev-decision', parsed);
    g.counters.jevSinceSonnet += 1;
    g.counters.jevDecisions += 1;
    const trig = W.sonnetTrigger(g.loaded, g.state, W.eventsNode(g.state), g.counters.jevSinceSonnet);
    if (!trig.ok) { mialError(trig); return undefined; }
    if (trig.value) maybeCallSonnet();
    return undefined;
  };

  // --- Sonnet call rule ------------------------------------------------------

  const maybeCallSonnet = () => {
    if (g.inFlight.sonnet || g.inFlight.repair || g.repairing || g.halted) return false;
    if (now() - g.counters.lastSonnetAt < g.settings.sonnetGapMs) return false;
    if (needsKey('sonnet')) return false;
    const seqAtSend = g.chatSeq;
    const req = minds.buildSonnet({
      loaded: g.loaded, state: g.state, history: g.eventHistory,
      source: g.source, version: g.version, userWaiting: g.userWaiting,
      conversation: g.conversation, entries: g.chat.filter(e => e.seq > g.lastSeenSeq),
    });
    if (!req.ok) { mialError(req); return false; }
    const sent = { turn: req.turn, seqAtSend, epoch: g.convEpoch };
    g.inFlight.sonnet = true;
    g.userWaiting = false;
    g.counters.lastSonnetAt = now();
    g.counters.sonnetCalls += 1;
    g.counters.jevSinceSonnet = 0;
    emit('changed');
    api.sonnet(req.body)
      .then(resp => handleSonnetReply(resp, 'sonnet', sent))
      .catch(err => apiError('sonnet', err))
      .finally(() => { g.inFlight.sonnet = false; emit('changed'); });
    return true;
  };

  const handleSonnetReply = (resp, author, sent) => {
    const parsed = minds.parseSonnet(resp);
    if (!parsed.ok) { addChat('error', parsed.error); return; } // the turn isn't stored; its entries go in the next one
    if (sent && sent.epoch === g.convEpoch) {
      g.conversation.turns.push({ role: 'user', content: sent.turn }, { role: 'assistant', content: parsed.text });
      g.lastSeenSeq = sent.seqAtSend;
    }
    const reflection = [parsed.summary, parsed.thinking && `Thinking: ${parsed.thinking}`].filter(Boolean).join('\n\n');
    if (reflection) addChat('reflective-mind-thought', reflection);
    if (parsed.say) addChat('inhabitant', parsed.say);
    emit('reflective-mind-reply', { summary: parsed.summary, thinking: parsed.thinking, say: parsed.say });
    for (const edit of parsed.edits) applyEdit({ ...edit, author });
    for (const run of parsed.runs) runOnce({ ...run, author });
    if (parsed.coreRequest) {
      addChat('core-request', parsed.coreRequest);
      g.requests.push({ text: parsed.coreRequest, ...stamp() });
      emit('core-request', { text: parsed.coreRequest });
      emit('requests-changed', g.requests);
    }
    save();
    maybeCompact();
  };

  // --- Compaction rule (D-40) ----------------------------------------------

  const conversationChars = () => (g.conversation.block ? String(g.conversation.block.content || '').length : 0) +
    g.conversation.turns.reduce((n, t) => n + String(t.content).length, 0);

  // The cut falls after an assistant turn, once the summary plus the turns before it reach COMPACT_CHUNK_CHARS.
  const compactionCut = () => {
    let chars = g.conversation.block ? String(g.conversation.block.content || '').length : 0;
    const turns = g.conversation.turns;
    for (let i = 1; i < turns.length; i += 2) {
      chars += String(turns[i - 1].content).length + String(turns[i].content).length;
      if (chars >= C.COMPACT_CHUNK_CHARS) return i + 1;
    }
    return turns.length;
  };

  const maybeCompact = () => {
    if (g.inFlight.compact || conversationChars() <= C.COMPACT_AT_CHARS || !api.canCall('sonnet')) return false;
    const cut = compactionCut();
    const req = minds.buildCompaction({ loaded: g.loaded, source: g.source, version: g.version, conversation: g.conversation, cut });
    if (!req.ok) { addChat('error', `Compaction skipped: ${req.error}`); return false; }
    const epoch = g.convEpoch;
    g.inFlight.compact = true;
    g.counters.compactions = (g.counters.compactions || 0) + 1;
    api.sonnet(req.body)
      .then(resp => {
        if (epoch !== g.convEpoch) return; // cleared meanwhile
        const r = minds.parseCompaction(resp);
        if (!r.ok) { addChat('error', r.error); return; }
        // Turns only ever append, so the first `cut` are exactly the ones summarized.
        g.conversation = { block: r.block, turns: g.conversation.turns.slice(cut) };
        addChat('memory', `Condensed ${cut / 2} earlier exchange${cut === 2 ? '' : 's'} into a summary:\n${r.block.content || ''}`);
        emit('compacted', { block: r.block, turns: cut });
        save();
      })
      .catch(err => apiError('sonnet', err))
      .finally(() => { g.inFlight.compact = false; emit('changed'); });
    return true;
  };

  // --- Commands ----------------------------------------------------------

  const coreStats = () => ({
    ticks: g.counters.ticks,
    'jev-decisions': g.counters.jevDecisions,
    'jev-invalid': g.counters.jevInvalid,
    'jev-retries': g.counters.jevRetries,
    'reflective-mind-calls': g.counters.sonnetCalls,
    repairs: g.counters.repairs,
    'reflective-mind-edits': g.editLog.filter(e => e.author === 'sonnet').length,
    'reflective-mind-runs': g.counters.sonnetRuns || 0,
    'world-version': g.version,
  });
  const stampCore = (state) => W.withCoreStats(state, coreStats());

  const tickOnce = () => {
    if (g.halted) return { ok: false, reason: 'halted' };
    if (g.repairing) return { ok: false, reason: 'repairing' };
    if (!g.state) {
      // initial-state failed earlier (boot or factory reset); retry it now that repair has run.
      const init = W.initialState(g.loaded);
      if (!init.ok) { mialError(init); return { ok: false, reason: 'mial-error' }; }
      g.state = init.value;
    }
    // state.core is stamped before the tick (so world code can read it) and after
    // (so prompts see it even if the tick dropped it).
    const r = W.tick(g.loaded, stampCore(g.state));
    if (!r.ok) { mialError(r); return { ok: false, reason: 'mial-error' }; }
    g.counters.ticks += 1;
    g.state = stampCore(r.value);
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

  // Run rule: a one-time function on the live state; the world source is unchanged.
  const runOnce = (run) => {
    const comment = String((run && run.comment) || '').trim() || '(no comment)';
    if (g.halted || g.repairing || !g.state) {
      addChat('error', `Run "${comment}" skipped: the world is ${g.halted ? 'halted' : 'not running'}`);
      return { ok: false, reason: 'not-running' };
    }
    const r = W.runOnce(g.source, run.source, stampCore(g.state));
    if (!r.ok) {
      addChat('error', `Run "${comment}" failed${r.definition ? ` in "# ${r.definition}"` : ''}: ${r.error}. The state is unchanged.`);
      return { ok: false, reason: r.error };
    }
    if ((run.author || 'sonnet') === 'sonnet') g.counters.sonnetRuns += 1;
    g.state = stampCore(r.value);
    addChat('run', comment);
    emit('run-applied', { comment });
    save();
    return { ok: true, events: [] };
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

  // Upload rule: a whole world source from a file becomes the next version; the state is kept.
  const uploadSource = (text, name) => {
    const raw = String(text || '');
    if (!W.splitBlocks(raw).blocks.some(b => b.name)) return { ok: false, reason: 'the file has no "# definition" blocks' };
    const comment = `upload ${String(name || '').trim() || 'file'}`;
    const entry = setSource(raw, { author: 'user', comment, names: [], deleted: [] });
    g.halted = false;
    g.repairing = false;
    g.counters.repairStreak = 0;
    addChat('edit', `v${entry.version} · ${comment}`);
    emit('edit-applied', entry);
    save();
    return { ok: true, events: [entry] };
  };

  const deleteRequest = (index) => {
    if (!Number.isInteger(index) || index < 0 || index >= g.requests.length) return { ok: false, reason: `no request at ${index}` };
    g.requests.splice(index, 1);
    emit('requests-changed', g.requests);
    save();
    return { ok: true, events: [] };
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
      source: '', version: 0, versions: [], editLog: [], chat: [], requests: [], eventHistory: [],
      conversation: { block: null, turns: [] }, chatSeq: 0, lastSeenSeq: 0, convEpoch: g.convEpoch + 1,
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
        requests: saved.requests || [],
        conversation: saved.conversation || { block: null, turns: [] },
        // Saves from before the conversation start it fresh: none of the old chat is replayed.
        chatSeq: saved.chatSeq || 0,
        lastSeenSeq: saved.conversation ? saved.lastSeenSeq || 0 : saved.chatSeq || 0,
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
    boot, start, pause, step, tickOnce, pump, sendUserMessage, applyEdit, runOnce, revertTo, uploadSource, deleteRequest, newGame, factoryReset, setSettings,
    on: (fn) => listeners.push(fn),
    getState: () => g.state,
    getSource: () => g.source,
    getVersion: () => g.version,
    getEditLog: () => g.editLog,
    getVersions: () => g.versions,
    getChat: () => g.chat,
    getRequests: () => g.requests,
    getConversation: () => g.conversation,
    getCounters: () => ({ ...g.counters, inFlight: { ...g.inFlight } }),
    getSettings: () => ({ ...g.settings }),
    getEventHistory: () => g.eventHistory,
    getStatsData: () => W.statsData(g.state),
    getRenderData: () => ({ ...W.renderData(g.state, g.loaded ? W.lowThreshold(g.loaded) : undefined), slowingMeters: g.loaded ? W.slowingMeters(g.loaded) : undefined, emoji: g.loaded ? W.emojiMap(g.loaded) : {} }),
    isHalted: () => g.halted,
    isRunning: () => g.running,
    isRepairing: () => g.repairing,
    save,
  };
};
