// Builds requests to Jev and Sonnet from the world MIAL, and parses their replies.
// Pure: no fetch, no DOM. The text in CORE_PREAMBLE and CORE_REPAIR_PROMPT is core
// and can't be edited by the models (D-16).
var BL = window.BL = window.BL || {};

BL.minds = (() => {
  const C = BL.CONFIG;
  const W = BL.world;

  const CORE_PREAMBLE = `## How your world works (core instructions; you cannot edit these)

Your world is written in MarkdownIsALisp (MIAL), a Lisp whose syntax is Markdown:
- "# name" starts a definition. Bullets under it form the code tree; 2 spaces of indentation = one level deeper.
- A bullet's first word is the operator; its sub-bullets (or further words on the same line) are arguments.
- House style is compact: put a bullet's leading atom arguments on its line ("- + a \`1\`", "- * state event"), and break out to sub-bullets from the first compound argument on. The core rewrites every saved version this way, so match it.
- Backticks make literals: \`12\`, \`0.5\`, \`"text"\`, \`true\`, \`false\`, \`null\`. Bare words are symbols.
- A literal cannot contain a backtick or a newline. Use the text built-in to make multi-line strings.
- A definition whose first child is a bare symbol (one parameter), or "- *" with symbol children (several parameters), followed by a body, is a function. A single literal child is a constant. A single "- mial" child is a quoted data constant.
- Zero-argument definitions are only called by the core; MIAL code cannot call them. Use constants or give the function a parameter.
- An atom by itself is a value: "- list" alone is the list function, not an empty list. Use \`null\` for an empty list.
- Special forms: if (test, then, else), let (first child holds bindings "- name" with one expression each, evaluated in order; the rest is the body), lambda (parameter spec, body), mial (quote), eval.
- Built-ins: + - * / % (+ also joins strings), < <= > >= eq !=, and or not, null? atom? list? error?, car cdr cons list, tag children make-mial mial-of parse-mial print,
  record (key/value pairs) get put has? keys, length nth append map filter reduce, min max abs floor round clamp, str (any value to string), text (joins arguments as lines; a list argument gives one line per item), join (list, separator).
- Data is immutable: put returns a new record.

The core calls these definitions (keep their names and parameters, or the world breaks):
| definition | parameters | must return |
|---|---|---|
| initial-state | none | a record (used only when this game started; to change the running world, use run) |
| tick | state | the next state record; its "events" field holds this tick's events |
| actions | state | a list of function names: Jev's options. Each must be a definition taking the state and returning a state record; the one Jev chooses is called. To give Jev a new option, write such a function and add its name here |
| jev-system | none | the question Jev answers, as instructions (string) |
| jev-prompt | state, history | the state Jev reads before choosing (string) |
| jev-trigger? | state, events | true to ask Jev now |
| reflective-mind-system | none | your own system prompt (string) |
| reflective-mind-prompt | state, history | your own prompt (string) |
| reflective-mind-trigger? | state, events, since | true to ask you now (since = Jev decisions since your last reflection) |
| reflective-mind-compaction | none | optional: instructions for condensing your oldest conversation turns into a summary (string, at most 16384 characters) |

The canvas draws state fields grid (w, h), structures (each with name, x, y), inhabitant (x, y, goal), and every number in meters. Everything else in the state is yours to invent, except the "core" field: before every tick the core writes a read-only "core" record of facts only it knows (ticks, jev-decisions, jev-invalid, jev-retries, reflective-mind-calls, repairs, reflective-mind-edits, reflective-mind-runs, world-version). Anything you write there is overwritten.
Keep statistics about the world itself in your own MIAL, for example a record counting the ticks each need spends below the low threshold, so they follow your rules if you change them.
The core ticks every ${C.TICK_MS} ms. It never asks Jev more often than every few seconds or you more often than every few seconds, whatever your triggers say.

## Your conversation
Your reflections form one conversation. Each user turn holds what reached you since your last reply: the neighbour's words, the results of your edits and runs, errors and other notices. The system message after the newest user turn is your reflective-mind-prompt, the world as it is now; it is shown once and not kept. Your earlier replies are kept as your turns, as the JSON you sent. When the conversation grows long, the core condenses its oldest turns into a summary that comes first, using reflective-mind-compaction as instructions if you define it. Only the summary and the turns after it remain, so write anything you must not lose into your MIAL.

## How to reply
Reply with one JSON object:
- summary: one or two sentences on what you noticed and what you decided (shown to the neighbour).
- say: what you say aloud to the neighbour, or "" for nothing.
- edits: a list of world edits, each {comment, source, delete}. source is Markdown holding one or more complete "# name" definitions; each replaces the definition with that name or is added if new. delete lists definition names to remove. comment says why, like a commit message. Use [] for no edits.
- run: one-time commands on the running world, each {comment, source}. source is Markdown whose first "# name" definition takes the state and returns the new state record; any further definitions are helpers. The core calls it once, right after your edits, with your world's definitions in scope, then forgets it: the world source does not change. Use it to change the world as it is now, for example to add a structure, move something or set a meter. If it fails, the error appears in the chat and the state is left as it was. Use [] for none.
- core_request: a change you would like made to the core JavaScript (which you cannot edit), or "" for none.
Edits apply immediately and without checks. If the world breaks, you will be asked to repair it.`;

  const CORE_REPAIR_PROMPT = `You are repairing a small simulated world written in MarkdownIsALisp. The world just failed with an error and has stopped.
Your only job is to make it load and tick again with as little change as possible. Reply with the same JSON object as always, putting the fix in edits; say may be "".`;

  const SONNET_SCHEMA = {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      say: { type: 'string' },
      edits: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            comment: { type: 'string' },
            source: { type: 'string' },
            delete: { type: 'array', items: { type: 'string' } },
          },
          required: ['comment', 'source', 'delete'],
          additionalProperties: false,
        },
      },
      run: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            comment: { type: 'string' },
            source: { type: 'string' },
          },
          required: ['comment', 'source'],
          additionalProperties: false,
        },
      },
      core_request: { type: 'string' },
    },
    required: ['summary', 'say', 'edits', 'run', 'core_request'],
    additionalProperties: false,
  };

  const fail = (r) => ({ ok: false, error: r.error, definition: r.definition });

  // Jev call rule (D-41): one System One Choice question. jev-prompt is the state Jev reads,
  // jev-system the question it answers, and `actions` the options. Jev returns no text.
  const buildJev = (loaded, state, history) => {
    const acts = W.actions(loaded, state);
    if (!acts.ok) return fail(acts);
    const missing = W.uncallableActions(loaded, acts.value);
    if (missing.length) return { ok: false, definition: 'actions', error: `actions lists ${missing.map(n => `"${n}"`).join(', ')}, which ${missing.length === 1 ? "isn't a definition" : "aren't definitions"} taking the state` };
    const system = W.jevSystem(loaded);
    if (!system.ok) return fail(system);
    const prompt = W.jevPrompt(loaded, state, history);
    if (!prompt.ok) return fail(prompt);
    return {
      ok: true,
      actions: acts.value,
      body: {
        model: C.JEV_MODEL,
        state: prompt.value,
        questions: {
          action: { type: 'choice', instructions: system.value, criteria: Object.fromEntries(acts.value.map(a => [a, a])) },
        },
      },
    };
  };

  const parseJev = (resp, actions) => {
    const answer = resp && resp.answers && resp.answers.action;
    if (!answer || typeof answer.choice !== 'string') {
      // retryable: a malformed reply is worth one more try; a wrong action is not.
      return { ok: false, retryable: true, error: `Jev's reply had no choice: ${JSON.stringify(resp).slice(0, 200)}` };
    }
    if (!actions.includes(answer.choice)) return { ok: false, error: `Jev chose "${answer.choice}", which is not one of: ${actions.join(', ')}` };
    const confidence = typeof answer.confidence === 'number' ? answer.confidence : undefined;
    return { ok: true, action: answer.choice, confidence, probabilities: answer.probabilities || {} };
  };

  // Models sometimes wrap JSON in a code fence even under a schema; accept that.
  const parseJSON = (text) => {
    const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    try { return JSON.parse(t); } catch { return undefined; }
  };


  // Reasoning comes back as summarized thinking blocks. Asking for it in the reply text
  // gets requests declined as reasoning_extraction (D-31).
  const sonnetBody = (system) => ({
    model: C.SONNET_MODEL,
    max_tokens: C.SONNET_MAX_TOKENS,
    thinking: { type: 'adaptive', display: 'summarized' },
    system,
    output_config: { format: { type: 'json_schema', schema: SONNET_SCHEMA } },
  });

  const sourceSection = (source, version) => `## Current world source (version ${version})\n\n${source}`;

  // Cache layout (D-39): the preamble never changes and the source changes only on an edit,
  // so each ends a cached prefix. The role prompt follows; the repair call shares both breakpoints.
  const cached = (text) => ({ type: 'text', text, cache_control: { type: 'ephemeral' } });
  const systemBlocks = (source, version, rolePrompt) =>
    [cached(CORE_PREAMBLE), cached(sourceSection(source, version)), { type: 'text', text: rolePrompt }];

  // Conversation rule: the stored history is the latest summary block (if any), then complete
  // user/assistant pairs of plain text. Thinking is never replayed (D-39).
  const historyMessages = (conversation) => [
    ...(conversation && conversation.block ? [{ role: 'assistant', content: [conversation.block] }] : []),
    ...((conversation && conversation.turns) || []).map(t => ({ role: t.role, content: t.content })),
  ];

  // The user turn: chat entries that reached the mind since its last reply, minus its own words and Jev's.
  const TURN_KINDS = { user: 'neighbour', edit: 'world edit', run: 'run once', error: 'error', system: 'system' };
  const turnText = (entries) => {
    const lines = entries.filter(e => TURN_KINDS[e.kind]).slice(-C.CHAT_HISTORY_N).map(e => `[${TURN_KINDS[e.kind]}] ${e.text}`);
    return lines.length ? lines.join('\n') : '(Nothing new in the chat. The world prompted this reflection.)';
  };

  // Sonnet call rule: three system blocks, the conversation, the new user turn (cached), and the
  // world status as a system message that is shown once and not stored.
  const buildSonnet = ({ loaded, state, history, source, version, userWaiting, conversation, entries }) => {
    const system = W.sonnetSystem(loaded);
    if (!system.ok) return fail(system);
    const prompt = W.sonnetPrompt(loaded, state, history);
    if (!prompt.ok) return fail(prompt);
    const turn = turnText(entries || []);
    const status = prompt.value + (userWaiting ? '\n\nThe neighbour has just spoken to you and is waiting for a reply.' : '');
    return {
      ok: true,
      turn,
      body: {
        ...sonnetBody(systemBlocks(source, version, system.value)),
        messages: [
          ...historyMessages(conversation),
          { role: 'user', content: [cached(turn)] },
          { role: 'system', content: status },
        ],
      },
    };
  };

  // Compaction rule (D-40): summarize the oldest `cut` turns (and any earlier summary) with the
  // same system blocks as the conversation, so the summarizer reads the same world and hits the cache.
  const buildCompaction = ({ loaded, source, version, conversation, cut }) => {
    const system = W.sonnetSystem(loaded);
    if (!system.ok) return fail(system);
    const instr = W.compactionInstructions(loaded);
    if (instr && !instr.ok) return fail(instr);
    const body = {
      model: C.SONNET_MODEL,
      max_tokens: C.COMPACT_MAX_TOKENS,
      thinking: { type: 'adaptive', display: 'summarized' },
      system: systemBlocks(source, version, system.value),
      messages: historyMessages({ block: conversation.block, turns: conversation.turns.slice(0, cut) }),
      compaction: { type: 'summarize', ...(instr && instr.value.trim() ? { instructions: instr.value } : {}) },
    };
    return { ok: true, body };
  };

  const parseCompaction = (resp) => {
    const block = resp && Array.isArray(resp.content) && resp.content.find(b => b && b.type === 'compaction');
    if (!resp || resp.stop_reason !== 'compaction' || !block) {
      return { ok: false, error: `Compaction returned no summary (stop_reason: ${resp && resp.stop_reason})` };
    }
    return { ok: true, block };
  };

  // Repair rule: fixed prompt instead of reflective-mind-system (which may be what broke).
  const buildRepair = ({ source, version, error, definition }) => ({
    ok: true,
    body: {
      ...sonnetBody(systemBlocks(source, version, CORE_REPAIR_PROMPT)),
      messages: [{ role: 'user', content: `The world failed${definition ? ` in "# ${definition}"` : ''} with this error:\n${error}\n\nFix it.` }],
    },
  });

  const parseSonnet = (resp) => {
    if (!resp || !Array.isArray(resp.content)) return { ok: false, error: `${C.SONNET_NAME} returned no content` };
    if (resp.stop_reason === 'refusal') {
      const d = resp.stop_details || {};
      return { ok: false, error: `${C.SONNET_NAME} declined this request (refusal${d.category ? `: ${d.category}` : ''})${d.explanation ? `. ${d.explanation}` : ''}` };
    }
    if (resp.stop_reason === 'max_tokens') return { ok: false, error: `${C.SONNET_NAME} ran out of tokens before finishing its reply` };
    const text = resp.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const data = parseJSON(text);
    if (!data || typeof data !== 'object') return { ok: false, error: `${C.SONNET_NAME}'s reply was not valid JSON: ${text.slice(0, 200)}` };
    const edits = Array.isArray(data.edits) ? data.edits.filter(e => e && typeof e === 'object').map(e => ({
      comment: String(e.comment || '').trim() || '(no comment)',
      source: String(e.source || ''),
      delete: Array.isArray(e.delete) ? e.delete.map(String) : [],
    })) : [];
    const runs = Array.isArray(data.run) ? data.run.filter(r => r && typeof r === 'object').map(r => ({
      comment: String(r.comment || '').trim() || '(no comment)',
      source: String(r.source || ''),
    })) : [];
    const thinking = resp.content.filter(b => b.type === 'thinking' && b.thinking).map(b => b.thinking).join('\n\n');
    return {
      ok: true,
      summary: String(data.summary || ''),
      thinking,
      say: String(data.say || ''),
      text, // the reply as sent, kept as the assistant turn
      edits,
      runs,
      coreRequest: String(data.core_request || ''),
    };
  };

  return { CORE_PREAMBLE, CORE_REPAIR_PROMPT, SONNET_SCHEMA, buildJev, parseJev, turnText, buildSonnet, buildCompaction, parseCompaction, buildRepair, parseSonnet };
})();
