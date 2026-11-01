// Wiring: DOM ↔ game commands and events, the tick timer, and the draw loop.
// The UI uses only the command/query/event contract (ONTOLOGY §7).
(() => {
  const C = BL.CONFIG;
  const $ = (id) => document.getElementById(id);
  const fake = new URLSearchParams(location.search).has('fake');

  // ?fake runs on an in-memory store so it never touches a real save.
  const memoryStorage = () => {
    const m = new Map();
    return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
  };
  const storage = (() => {
    if (fake) return memoryStorage();
    try { return window.localStorage; } catch { return memoryStorage(); }
  })();
  const store = BL.createStore(storage);

  let keys = store.loadKeys();
  const api = fake ? BL.createFakeApi() : BL.createApi(() => keys);
  const game = BL.createGame({ store, api });
  const renderer = BL.createRenderer($('world'));
  const chat = BL.createChatView({
    log: $('chatLog'),
    editList: $('editList'),
    editCount: $('editCount'),
    onRevert: (v) => {
      if (confirm(`Revert the world MIAL to v${v}? This adds a new version; nothing is lost.`)) game.revertTo(v);
    },
  });

  const renderEdits = () => chat.renderEdits(game.getEditLog(), game.getVersion(), new Set(game.getVersions().map(v => v.version)));

  const updateControls = () => {
    const running = game.isRunning();
    const halted = game.isHalted();
    $('playBtn').textContent = running ? '❚❚ Pause' : '▶ Play';
    $('playBtn').disabled = halted;
    $('stepBtn').disabled = running || halted;
    $('haltBadge').hidden = !halted;
    const c = game.getCounters();
    const busy = [c.inFlight.jev && 'Jev', (c.inFlight.sonnet || c.inFlight.repair) && 'Sonnet'].filter(Boolean);
    $('counters').textContent = `v${game.getVersion()} · Jev ${c.jevCalls} · Sonnet ${c.sonnetCalls}${busy.length ? ` · thinking: ${busy.join(', ')}` : ''}${fake ? ' · FAKE MINDS' : ''}`;
    $('worldStatus').textContent = halted ? 'Halted' : game.isRepairing() ? 'Repairing…' : running ? 'Running' : 'Paused';
  };

  const renderMeters = (data) => {
    const box = $('meters');
    const names = Object.keys(data.meters);
    if (box.dataset.names !== names.join(',')) {
      box.replaceChildren(...names.map(name => {
        const m = document.createElement('div');
        m.className = 'meter';
        m.dataset.meter = name;
        m.innerHTML = '<div class="meter-label"><span></span><span></span></div><div class="meter-bar"><div class="meter-fill"></div></div>';
        m.querySelector('.meter-label span').textContent = name;
        return m;
      }));
      box.dataset.names = names.join(',');
    }
    const max = Math.max(100, ...Object.values(data.meters));
    let anyLow = false;
    for (const m of box.children) {
      const v = data.meters[m.dataset.meter];
      const low = data.lowThreshold !== undefined && v < data.lowThreshold;
      anyLow = anyLow || low;
      m.classList.toggle('low', low);
      m.querySelector('.meter-label span:last-child').textContent = Math.round(v);
      m.querySelector('.meter-fill').style.width = `${Math.max(0, Math.min(100, (100 * v) / max))}%`;
    }
    $('slowBadge').hidden = !anyLow;
    $('warnings').hidden = data.warnings.length === 0;
    $('warnings').textContent = data.warnings.length ? `Can't fully draw the state: ${data.warnings.join('; ')}` : '';
  };

  // Stats dialog: rebuilt on open and on every tick while open.
  const renderStats = () => {
    const { core, world } = game.getStatsData();
    const section = (title, obj) => {
      const h = document.createElement('h3');
      h.textContent = title;
      const table = document.createElement('table');
      for (const [k, v] of Object.entries(obj)) {
        const tr = table.insertRow();
        tr.insertCell().textContent = k;
        tr.insertCell().textContent = Number.isInteger(v) ? v : v.toFixed(1);
      }
      return [h, table];
    };
    const parts = [];
    if (core) parts.push(...section('Core', core));
    for (const [name, obj] of Object.entries(world)) parts.push(...section(`World: ${name}`, obj));
    if (!parts.length) parts.push(Object.assign(document.createElement('p'), { className: 'hint', textContent: 'No stats yet. Run a tick.' }));
    $('statsBody').replaceChildren(...parts);
  };

  let latest; // the render data the draw loop shows; refreshed on ticks and decisions
  game.on((type, payload) => {
    if (type === 'chat') chat.appendMessage(payload);
    if (type === 'edit-applied') renderEdits();
    if (type === 'ticked' || type === 'jev-decision') latest = game.getRenderData();
    if (type === 'ticked' && $('statsDialog').open) renderStats();
    updateControls();
  });

  game.boot();
  const savedSettings = store.loadSettings();
  game.setSettings(savedSettings);
  BL.logApi = savedSettings.logApi !== false;
  chat.renderChat(game.getChat());
  renderEdits();
  latest = game.getRenderData();
  updateControls();

  setInterval(() => { if (game.isRunning()) game.tickOnce(); }, C.TICK_MS);
  setInterval(() => game.pump(), 500);
  const frame = () => {
    renderer.draw(latest);
    renderMeters(latest);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // --- Controls ------------------------------------------------------------

  $('playBtn').addEventListener('click', () => (game.isRunning() ? game.pause() : game.start()));
  $('stepBtn').addEventListener('click', () => game.step());
  $('newGameBtn').addEventListener('click', () => {
    if (confirm('Start a new game? The current rules (MIAL) and edit history are kept.')) game.newGame();
  });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm('Factory reset? This restores the default world and clears the chat, edits and save. API keys are kept.')) return;
    game.pause();
    game.factoryReset();
    chat.renderChat(game.getChat());
    renderEdits();
    latest = game.getRenderData();
  });
  $('downloadBtn').addEventListener('click', () => {
    const blob = new Blob([game.getSource()], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `world-v${game.getVersion()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (game.sendUserMessage($('chatInput').value).ok) $('chatInput').value = '';
  });

  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `${tab.dataset.tab}Panel`));
  }));

  $('statsBtn').addEventListener('click', () => {
    renderStats();
    $('statsDialog').showModal();
  });

  $('settingsBtn').addEventListener('click', () => {
    const s = game.getSettings();
    $('anthropicKey').value = keys.anthropic;
    $('openrouterKey').value = keys.openrouter;
    $('jevGap').value = s.jevGapMs / 1000;
    $('sonnetGap').value = s.sonnetGapMs / 1000;
    $('logApi').checked = BL.logApi;
    $('settingsDialog').showModal();
  });
  $('settingsDialog').addEventListener('close', () => {
    if ($('settingsDialog').returnValue !== 'save') return;
    keys = { anthropic: $('anthropicKey').value.trim(), openrouter: $('openrouterKey').value.trim() };
    store.saveKeys(keys);
    const settings = { jevGapMs: Number($('jevGap').value) * 1000, sonnetGapMs: Number($('sonnetGap').value) * 1000 };
    BL.logApi = $('logApi').checked;
    if (game.setSettings(settings).ok) store.saveSettings({ ...settings, logApi: BL.logApi });
    updateControls();
  });

  window.addEventListener('beforeunload', () => game.save());
  BL.app = { game }; // for the browser test and console poking
})();
