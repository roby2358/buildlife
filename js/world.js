// The core's view of the world MIAL: loading source, calling entry points with
// type checks, applying edits, and extracting the render contract.
// Headless: no DOM. Nothing here throws; entry-point calls and applyEdit return { ok, ... }.
var BL = window.BL = window.BL || {};

BL.world = (() => {
  const M = BL.mial;

  const load = (source) => M.loadSource(source);

  // A string atom; isStringValue alone would also accept a node with children.
  const isString = (n) => !!n && Array.isArray(n.children) && n.children.length === 0 && M.isStringValue(n.value);
  const child = (r, key) => {
    const f = M.field(r, key);
    return f ? f.children[0] : undefined;
  };

  const typeError = (name, expected, got) =>
    ({ ok: false, definition: name, error: `"# ${name}" should return ${expected}, got: ${M.strOf(got).slice(0, 120)}` });

  // Calls an entry point and checks its return type (ONTOLOGY entry-point contract).
  //   expect: 'record' | 'string' | 'strings' | 'truthy'
  const call = (loaded, name, args, expect) => {
    const r = M.callDef(loaded, name, args);
    if (!r.ok) return { ok: false, definition: name, error: r.error };
    const v = r.value;
    switch (expect) {
      case 'record':
        return M.isRecord(v) ? { ok: true, value: v } : typeError(name, 'a record', v);
      case 'string':
        return isString(v) ? { ok: true, value: v.value.string } : typeError(name, 'a string', v);
      case 'strings': {
        const items = M.isList(v) ? M.toJS(v) || [] : null;
        const valid = items && items.length > 0 && items.every(x => typeof x === 'string');
        return valid ? { ok: true, value: items } : typeError(name, 'a non-empty list of strings', v);
      }
      case 'truthy':
        return { ok: true, value: M.isTruthy(v) };
      default:
        return { ok: true, value: v };
    }
  };

  const str = (s) => M.fromJS(s);

  const entry = {
    initialState: (l) => call(l, 'initial-state', [], 'record'),
    tick: (l, state) => call(l, 'tick', [state], 'record'),
    actions: (l, state) => call(l, 'actions', [state], 'strings'),
    applyAction: (l, state, action) => call(l, 'apply-action', [state, str(action)], 'record'),
    jevSystem: (l) => call(l, 'jev-system', [], 'string'),
    jevPrompt: (l, state, history) => call(l, 'jev-prompt', [state, M.fromJS(history)], 'string'),
    jevTrigger: (l, state, events) => call(l, 'jev-trigger?', [state, events], 'truthy'),
    sonnetSystem: (l) => call(l, 'sonnet-system', [], 'string'),
    sonnetPrompt: (l, state, history) => call(l, 'sonnet-prompt', [state, M.fromJS(history)], 'string'),
    sonnetTrigger: (l, state, events, since) => call(l, 'sonnet-trigger?', [state, events, M.node(since)], 'truthy'),
  };

  // The current tick's events: as MIAL (for trigger calls) and as JS objects ([] when absent or malformed).
  const eventsNode = (state) => child(state, 'events') || M.node(null);
  const eventsOf = (state) => {
    const js = M.toJS(eventsNode(state));
    return Array.isArray(js) ? js.filter(e => e && typeof e === 'object') : [];
  };

  // --- Editing (apply-edit rule) -----------------------------------------

  const headingName = (line) => line.trim().replace(/^#+\s*/, '').trim();

  // Splits source text into the text before the first heading and one block per definition.
  const splitBlocks = (text) => {
    const preamble = [];
    const blocks = [];
    for (const line of text.split('\n')) {
      if (line.trim().startsWith('#')) blocks.push({ name: headingName(line), lines: [line] });
      else if (blocks.length) blocks[blocks.length - 1].lines.push(line);
      else preamble.push(line);
    }
    return {
      preamble: preamble.join('\n').trim(),
      blocks: blocks.map(b => ({ name: b.name, text: b.lines.join('\n').trimEnd() })),
    };
  };

  // Replaces same-named definitions, appends new ones, removes deletions. All or nothing (D-6).
  const applyEdit = (source, edit) => {
    const editText = (edit && edit.source) || '';
    const deletes = (edit && Array.isArray(edit.delete)) ? edit.delete.filter(n => typeof n === 'string' && n.trim()) : [];
    const { diagnostics } = M.parseMarkdown(editText);
    const incoming = splitBlocks(editText).blocks.filter(b => b.name);
    if (incoming.length === 0 && deletes.length === 0) {
      return { ok: false, error: 'the edit has no "# definition" blocks and no deletions', diagnostics };
    }
    const current = splitBlocks(source);
    const blocks = current.blocks.slice();
    for (const b of incoming) {
      const at = blocks.findIndex(x => x.name === b.name);
      if (at === -1) blocks.push(b);
      else blocks[at] = b;
    }
    const missing = deletes.filter(n => !blocks.some(b => b.name === n));
    const kept = blocks.filter(b => !deletes.includes(b.name));
    const text = [current.preamble, ...kept.map(b => b.text)].filter(Boolean).join('\n\n') + '\n';
    return {
      ok: true,
      source: text,
      names: incoming.map(b => b.name),
      deleted: deletes.filter(n => !missing.includes(n)),
      diagnostics: diagnostics.concat(missing.map(n => `delete: no definition named "${n}"`)),
    };
  };

  // --- Render contract ---------------------------------------------------

  const num = (n) => (n && typeof n.value === 'number' ? n.value : undefined);
  // A string literal or a bare symbol.
  const text = (n) => {
    if (!n) return undefined;
    if (M.isStringValue(n.value)) return n.value.string;
    return typeof n.value === 'string' ? n.value : undefined;
  };

  // Reads only the render-contract fields; never throws on any state shape (R-16).
  const renderData = (state, lowThreshold) => {
    const warnings = [];
    const out = { grid: null, structures: [], inhabitant: null, meters: {}, lowThreshold, warnings };
    if (!M.isRecord(state)) {
      warnings.push('state is not a record');
      return out;
    }
    const grid = child(state, 'grid');
    const w = num(child(grid, 'w'));
    const h = num(child(grid, 'h'));
    if (w > 0 && h > 0) out.grid = { w, h };
    else warnings.push('grid.w / grid.h missing');

    const structures = child(state, 'structures');
    for (const s of (M.isList(structures) ? structures.children : [])) {
      const x = num(child(s, 'x'));
      const y = num(child(s, 'y'));
      if (x === undefined || y === undefined) continue;
      out.structures.push({ name: text(child(s, 'name')) || '?', x, y });
    }
    if (!M.isList(structures)) warnings.push('structures missing');

    const inh = child(state, 'inhabitant');
    const ix = num(child(inh, 'x'));
    const iy = num(child(inh, 'y'));
    if (ix !== undefined && iy !== undefined) {
      out.inhabitant = { x: ix, y: iy, goal: text(child(inh, 'goal')) || '', status: text(child(inh, 'status')) || '' };
    } else warnings.push('inhabitant.x / inhabitant.y missing');

    const meters = child(state, 'meters');
    if (M.isRecord(meters)) {
      for (const f of meters.children) {
        const v = num(f.children[0]);
        if (v !== undefined) out.meters[f.value] = v;
      }
    } else warnings.push('meters missing');
    return out;
  };

  // LOW_THRESHOLD is MIAL-owned; the renderer uses it only to shade bars when it is a number.
  const lowThreshold = (loaded) => {
    const r = M.callDef(loaded, 'LOW_THRESHOLD', []);
    return r.ok && typeof r.value.value === 'number' ? r.value.value : undefined;
  };

  return { load, call, ...entry, eventsOf, eventsNode, splitBlocks, applyEdit, renderData, lowThreshold };
})();
