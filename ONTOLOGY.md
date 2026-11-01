# ONTOLOGY.md — BuildLife

The implementation reference. It covers what exists, what each thing carries, the rules, and the interface between the core JS and the world MIAL. Everything here describes the current design. History lives in ARCHITECTURE_LOG.md.

**Tags:** **[D]** decided by the designer · **[P]** proposed by Claude, pending review · **[T]** tunable number · **[D, unbuilt]** decided but not yet built. **Serves:** names the goal (G-n), quality, or DYNAMICS driver that an item exists for. IDs (G/D/Q/R/U/X) are never reused.

---

## §0 Purpose [D]

A tiny world (a bush, a shack, a well, a tree, and one inhabitant) whose **rules and minds are written in MarkdownIsALisp (MIAL) and rewritten by the minds themselves**. Two models drive the inhabitant: Jev makes fast choices and Claude Sonnet reflects more slowly. Sonnet can edit any part of the world MIAL, including both models' prompts. You watch, chat with the inhabitant, and see what the inhabitant turns its world into.

**Qualities**
- **Legible minds**: you can always see *why* the inhabitant did something (Jev's thought, Sonnet's reflection).
- **Alive**: the world keeps running in real time and doesn't wait politely for the models.
- **Tinkering**: rule changes are visible events with a stated reason, and they take effect right away.
- **Recoverable**: a bad rewrite is a setback, not the end of the world.

**Goals** (in priority order)
- **G-1 Self-modifying world** [D]: the rules, map, cadence, and prompts are MIAL that Sonnet can edit one definition at a time. Edits take effect on the next tick.
- **G-2 Two-mind control** [D]: Jev picks actions often and cheaply. Sonnet plans, talks to you, edits MIAL, and requests core changes.
- **G-3 Zero-install** [D]: you double-click `index.html` (on `file://`, with plain `<script>` tags and no ES modules), and everything persists in localStorage.
- **G-4 Legibility** [D]: the chat shows model thoughts and decisions. An edit list shows a commit comment for each MIAL change.
- **G-5 Survivable rewrites** [D]: edits are applied without validation. When the MIAL breaks, a fixed repair call (not editable by the models) asks Sonnet to fix it.
- **G-6 Conversation** [D]: you can send messages that Sonnet sees and answers as the inhabitant.

**When goals conflict** [P]: G-3 > G-1 > G-5 > G-2 > G-4 > G-6. Zero-install is a hard constraint. Self-modification is the point. Recoverability protects self-modification.

**Non-goals (for now)**
- Death, damage, or any penalty other than half speed [D].
- Validating or approving edits before they're applied [D].
- Models editing core JS. They can only *request* changes, as a highlighted chat message [D].
- Diff views of MIAL edits [D].
- Hand-editing MIAL in the UI. You get a download button [D].
- More than one inhabitant, multiplayer, or a server.
- Protecting API keys beyond localStorage on your own machine.

---

## §1 Entities

### 1.1 Node (MIAL value) [D]
*Serves:* G-1. This is the one data shape shared by code and data, as in MarkdownIsALisp.

| Field | Type | Notes |
|---|---|---|
| value | number \| boolean \| null \| `{string}` \| symbol-string \| `{error}` | The label or atom |
| children | Node[] | Empty for an atom |

### 1.2 Record [D]
*Serves:* G-1, G-4. Structured data stays MIAL, so `print-mial` shows world state to Sonnet in the same syntax as the code.

A Record is a Node tagged `record` whose children are field nodes. Each field node is tagged with the field name and has exactly one child, the value:
```markdown
- record
  - food
    - `80`
  - water
    - `65`
```
Lists are ordinary MIAL data lists (a node with `null` value and children). They're accessed with the host built-ins `get`, `put`, `has?`, and `keys` (see the host built-ins rule).

### 1.3 WorldState [P]: a Record, owned by the MIAL
*Serves:* G-1, G-2. The world MIAL creates this record (`initial-state`) and transforms it (`tick`, `apply-action`). JS keeps it, saves it, and reads only the **render contract** fields. The MIAL may add fields freely.

| Field | Type | Notes |
|---|---|---|
| tick | number | Tick count since the new game |
| grid | Record `{w, h}` | Size in tiles |
| structures | list of Structure | |
| inhabitant | Inhabitant | |
| meters | Record, name → number | Starts as `food water rest wood wonder`. **Render contract:** every key gets a bar |
| seen-edits | number | In the default world: the `core.sonnet-edits` count the wonder rule last saw |
| events | list of Event | **This tick's** events only. `tick` replaces the list each call |
| low-ticks | Record, meter → number | In the default world: ticks each meter has spent below `LOW_THRESHOLD` (the low-ticks rule). World-owned, so it follows the world's rules |
| core | CoreStats | **Reserved, core-owned, always the last field.** Written by the core before and after every tick; anything the MIAL writes there is overwritten [D] |
| *(anything else)* | any | Room for the models to invent new state |

**Render contract** [P]: `grid.w`, `grid.h`, `structures[].name/x/y`, `inhabitant.x/y/goal`, `meters.*`. JS reads these with the same `get` built-in. A missing field is skipped and shows a warning badge, so it never crashes the page.

### 1.3a CoreStats [D]
*Serves:* G-1, G-4. These are facts only the core knows, so a reflection can judge changes by numbers. The inhabitant asked for this through a core request. World facts (such as time spent low) are deliberately not here, because what counts as "low" is a world rule (D-29).

| Field | Type | Notes |
|---|---|---|
| ticks | number | Ticks run by the core since the counters started |
| jev-decisions | number | Jev decisions applied |
| jev-invalid | number | Jev replies that were malformed or cut off |
| jev-retries | number | Retries sent after a malformed reply |
| sonnet-calls | number | Sonnet calls, reflections and repairs alike |
| repairs | number | Repair attempts |
| sonnet-edits | number | Applied edits authored by Sonnet |
| world-version | number | Current WorldSource version |

### 1.4 Structure [P]
*Serves:* G-1. It's a template: the bush, shack, well, and tree are all the same shape.

| Field | Type | Notes |
|---|---|---|
| name | string | `bush` `shack` `well` `tree` at the start |
| x, y | number | Tile position |
| meter | string | The meter it refills: bush→food, well→water, shack→rest, tree→wood [D] |
| rate | number | Refill per tick while in use [T] |

### 1.5 Inhabitant [P]
*Serves:* G-2.

| Field | Type | Notes |
|---|---|---|
| x, y | number | Current tile |
| goal | string | A structure name, or `idle` |
| progress | number | Fractional movement accumulated toward the next tile |
| status | string | `walking` \| `using` \| `idle` |

### 1.6 Event [P]
A Record with at least `type` (string). Types the default MIAL emits: `arrived`, `full` (a meter reached `METER_MAX` while in use), `low` (a meter crossed `LOW_THRESHOLD` going down), `recovered` (it crossed back up), and `idle` (the goal names no existing place). The `events` field persists until `tick` replaces it, so a `tick` that forgets to reset it reports the same events every tick.

### 1.7 WorldSource (the world MIAL) [D]
*Serves:* G-1, G-5. This is the full Markdown text of the world. It is a sequence of `# definition` blocks, and **its unit of edit is the definition** [D].

| Field | Type | Notes |
|---|---|---|
| text | string | The current source |
| version | number | +1 on every applied edit |

### 1.8 Edit [D]
*Serves:* G-1, G-4.

| Field | Type | Notes |
|---|---|---|
| comment | string | Required, like a commit message |
| source | string | Markdown with one or more `# name` blocks. Each one replaces the definition with that name, or is appended if the name is new |
| delete | string[] | Names of definitions to remove |
| author | `sonnet` \| `repair` \| `user` \| `system` | `user` for reverts, `system` for the default world (v1) |
| at | ISO time + world tick | |
| version | number | The WorldSource version this edit produced |

### 1.9 VersionSnapshot [P]
`{version, text}`, one per applied edit, kept so any version can be reverted to (D-22). The world is small, so full snapshots are cheap. At most `MAX_VERSIONS` are kept; v1 (the default world) is never dropped.

### 1.10 ChatEntry [D]
*Serves:* G-4, G-6.

| Field | Type | Notes |
|---|---|---|
| kind | `user` \| `inhabitant` \| `jev` \| `sonnet-thought` \| `edit` \| `core-request` \| `error` \| `system` | `inhabitant` is Sonnet's `say` text, shown as the inhabitant talking. `core-request` is highlighted [D] |
| text | string | |
| at | time + tick | |

### 1.11 Counters [P]
`jevCalls`, `sonnetCalls`, `jevSinceSonnet`, `repairStreak`, `lastJevAt`, `lastSonnetAt`. They exist for cadence, the cost display, and the repair limit.

### 1.12 SaveGame [P]
The localStorage key `buildlife.save.v1` holds `{schema:1, state, source, versions[], editLog[], chat[], counters, eventHistory[], halted}`. API keys are stored separately under `buildlife.keys` and are never included in the download.

---

## §2 Relations and invariants

- **Core JS never encodes a world rule** [D]. Decay, movement, refilling, slowdown, which actions exist, and when the models are called are all decided by MIAL. JS only renders, stores, schedules, and calls.
- **The core writes exactly one field of the state, `core`, and always as the last field** [D]. Everything else in the state belongs to the MIAL. Keeping the volatile numbers last means a prompt that renders the state puts them at the end.
- **MIAL never performs I/O** [P]. Every entry point is a pure function of its arguments and returns a value. `print` goes to the browser console.
- **Same source + same state + same action sequence → same state** [P]. The default MIAL uses no randomness. Any later randomness has to come from a seeded host built-in.
- **Only one call per model is in flight at a time** [P]. A trigger that fires while a call is in flight is dropped, not queued.
- **An edit is applied in full or not at all** [P]. If the edit's `source` fails to parse into at least one definition, nothing changes and Sonnet sees the error. That's a parse check, not validation of behavior, so G-5 still holds.
- **The core preamble and the core repair prompt can't be edited by the models** [P]. They are what make editing and recovery possible.
- **Meters stay in [0, METER_MAX]** in the default MIAL. This invariant belongs to the MIAL, and the models may change it.
- **The render contract is read defensively** [P]. No WorldState the MIAL produces can crash the page.
- **Every applied edit adds exactly one entry each** to the edit log, the version snapshots, and the chat [P].

---

## §3 Architecture [P]

Plain `<script>` tags that load in order and share one global namespace, `BL` [D: no ES modules].

| File | Role | Editable by models |
|---|---|---|
| `index.html` | Layout: canvas on the left, chat/edits tabs on the right, toolbar, Settings and Stats dialogs | no |
| `css/style.css` | | no |
| `js/mial.js` | Copy of the MIAL interpreter plus host built-ins and an evaluation step budget | no |
| `world/default_world.md` | The starting world MIAL, the factory reset point | no |
| `js/world_default.js` | `BL.DEFAULT_WORLD`, generated from `world/default_world.md` by `tools/embed_world.js`. `file://` blocks fetching `.md`, so the page loads it as a JS string | no (generated) |
| `js/config.js` | Core constants (`BL.CONFIG`) | no |
| `js/store.js` | localStorage save/load, keys, settings | no |
| `js/game.js` | The core controller: tick loop, triggers, call gating, edits, versions, repair, persistence. Headless (store, API and clock injected) | no |
| `js/world.js` | Loads the source and calls the MIAL entry points. Headless, no DOM | no |
| `js/api.js` | Calls to Anthropic and OpenRouter (plain `fetch`). Logs each exchange (request body, response or error, time) as a collapsed console group while `BL.logApi` is on, a Settings checkbox stored with the settings (default on). Headers and keys are never logged | no |
| `js/fake_api.js` | Stand-in minds for `?fake` in the URL: no keys, in-memory storage. Used by the browser test | no |
| `js/minds.js` | Builds Jev, Sonnet and repair requests and parses replies. Holds `CORE_PREAMBLE` and `CORE_REPAIR_PROMPT` | no |
| `js/render.js` | Canvas drawing | no |
| `js/chat.js` | Chat and edit-list UI | no |
| `js/main.js` | Wiring and the tick loop | no |

Everything except `api.js`, `fake_api.js`, `render.js`, `chat.js` and `main.js` loads in Node through `vm` for headless tests. `tools/tune.js` is the soak harness for X-1; `test/browser.js` checks the U-criteria in Chromium.

### 3.1 MIAL entry-point contract [P]
These are the definitions JS calls. They're all ordinary definitions, and all of them can be edited (G-1). If a definition is missing or returns the wrong type, that's a **MIAL error** and the repair rule handles it. Zero-parameter definitions can be called only by the core: MIAL has no syntax for calling a function with no arguments, so world code uses constants (a literal, or a `mial`-quoted Record like `DECAY`) instead.

| Definition | Params | Returns | Called when |
|---|---|---|---|
| `initial-state` | — | WorldState | New game |
| `tick` | state | WorldState (with this tick's `events`) | Every `TICK_MS` while running |
| `actions` | state | non-empty list of strings | Building Jev's response schema, and validating Jev's choice |
| `apply-action` | state, action | WorldState | A Jev decision arrives |
| `jev-system` | — | string | Every Jev call |
| `jev-prompt` | state, history | string | Every Jev call |
| `jev-trigger?` | state, events | boolean | After every tick |
| `sonnet-system` | — | string | Every Sonnet call |
| `sonnet-prompt` | state, history | string | Every Sonnet call |
| `sonnet-trigger?` | state, events, since | boolean | After every Jev decision (`since` = `jevSinceSonnet`) |

`history` is a list of recent event Records (the last `EVENT_HISTORY_N`) plus the decisions made, so prompts can describe recent life.

### 3.2 Host built-ins added to the interpreter [D]
*Serves:* G-1. Without these, the MIAL can't handle records, text, or lists in practice.

| Built-in | Meaning |
|---|---|
| `record` k1 v1 k2 v2 … | Builds a Record (keys are string literals) |
| `get` r k | The field's value, or `null` |
| `put` r k v | A new Record with the field set (no mutation) |
| `has?` r k / `keys` r | |
| `length` l, `nth` l i, `append` l1 l2 … | List helpers (`length` also counts string characters) |
| `map` f l, `filter` f l, `reduce` f init l | Higher-order helpers (these call closures) |
| `min` `max` `abs` `floor` `round` `clamp` | Number helpers |
| `str` x | Any value to a string. Records and lists are rendered as MIAL Markdown |
| `text` s1 s2 … | Joins with newline; a list argument contributes one line per item. This is how prompts get multiple lines, because literals can't contain newlines or backticks |
| `join` l sep | Joins a list's items into one string |
| `and` / `or` | Take any number of arguments (the original took two) |
| `let` (special form) | `let` / bindings `- name` `- expr` … / body. The only change at the language level. The interpreter can only call named functions, so without `let` the world logic would repeat accessors or split into many tiny helpers |

Each evaluation (one entry-point call) gets an **evaluation step budget**, `EVAL_STEP_LIMIT`. Going over it is a MIAL error, and so is a JS stack overflow.

---

## §4 Rules

Rules marked *(MIAL)* are the **initial** content of `world_default.js`, and the models may rewrite them. Rules marked *(core)* are fixed JS.

### 4.1 Decay *(MIAL)* [D]
*Serves:* G-1, the alive quality.
```
each tick, for each meter m:
  meters[m] = max(0, meters[m] - DECAY[m])
  if it crossed below LOW_THRESHOLD this tick: emit low{meter: m}
```

### 4.2 Speed and slowdown *(MIAL)* [D]
*Serves:* G-1. The **only** penalty for neglect.
```
speed = BASE_SPEED
if any meter < LOW_THRESHOLD: speed = speed * SLOW_FACTOR   # once, not per meter
```

### 4.3 Movement *(MIAL)* [P]
*Serves:* G-2. The open grid has no obstacles, so movement is a straight-line step.
```
if status = walking:
  progress += speed
  while progress >= 1 and not adjacent-or-on(goal):
    step one tile toward goal (larger axis gap first); progress -= 1
  if adjacent-or-on(goal): status = using; emit arrived{goal}
```

### 4.4 Use *(MIAL)* [D]
*Serves:* G-1, G-2.
```
if status = using:
  s = structure named goal
  meters[s.meter] = min(METER_MAX, meters[s.meter] + s.rate)
  if meters[s.meter] = METER_MAX: status = idle; goal = idle; emit full{meter}
```
Decay of the meter being refilled still applies, so the net refill rate is `rate - DECAY`.

### 4.5 Action *(MIAL)* [P]
*Serves:* G-2.
```
actions(state) = names of state.structures + "idle"
apply-action(state, a):
  if a = idle: status = idle; goal = idle
  else if a names a structure: goal = a; status = walking; progress = 0
  else: state unchanged
# walking re-checks adjacency on the next tick, so an adjacent goal becomes `using` + arrived then
```

### 4.6 Cadence *(MIAL)* [D: event-driven]
*Serves:* G-2. The models can tune it.
```
jev-trigger?(state, events)  = any event in events has type in {full, low, recovered, idle}
                               or (status = idle and tick % IDLE_RECHECK_TICKS = 1)
                               # never left idle without asking, but not every tick
sonnet-trigger?(state, events, since) = since >= SONNET_EVERY_N_JEV
                                        or (since >= 1 and wonder < LOW_THRESHOLD)
```

### 4.5a Wonder *(MIAL)* [D]
*Serves:* the motivation to create (DYNAMICS, "the world drifts"). Wonder is the fifth need. It decays like the others and counts toward the half-speed penalty. No place refills it, and Jev's needs list omits it because Jev can't act on it.
```
tick(state) = feed-wonder(base-tick(state))      # base-tick is decay, act, crossings, low-ticks
feed-wonder(state):
  edits = state.core.sonnet-edits                # a core fact (CoreStats)
  if seen-edits is set and edits > seen-edits:   # any creation, however small or many
    wonder = METER_MAX; emit created              # tops it off; then it drains again
  seen-edits = edits
```
`sonnet-system` tells Sonnet that only creating or improving something, through an edit, refills wonder.

### 4.6a Low-ticks *(MIAL)* [D]
*Serves:* G-4 (judging changes by numbers).
```
each tick, after acting: for each meter m below LOW_THRESHOLD: low-ticks[m] += 1
# a state without the record (an older save) starts counting from nothing
```

### 4.7 Tick loop *(core)* [P]
*Serves:* G-3, the alive quality.
```
every TICK_MS while running and not halted:
  state = stamp-core(call tick(stamp-core(state)))  # MIAL error → repair rule
  eventHistory.push(state.events) (keep EVENT_HISTORY_N)
  repairStreak = 0                               # the tick and the trigger both succeeded
  if call jev-trigger?(state, state.events) and jev idle and now - lastJevAt >= JEV_MIN_GAP_MS:
    start Jev call (async)
  if a user message is waiting: try the Sonnet call
  every SAVE_EVERY_TICKS ticks: save
```

### 4.8 Jev call *(core)* [D: Jev drives fast choices]
*Serves:* G-2, G-4.
```
acts = call actions(state)
request: system = jev-system(), user = jev-prompt(state, history),
         response_format = json_schema {thought: string, action: enum acts}
on reply: if the JSON is malformed or cut off and this is the first attempt:
            jev-invalid += 1; jev-retries += 1; chat system; resend, built from the current state
            (no gap check; the in-flight slot covers both attempts)
          if malformed again: jev-invalid += 1; chat error, no change; no third attempt
          if action ∉ call actions(state): chat error, no change (not retried)
          else state = call apply-action(state, action); chat jev{thought, action}
          jevSinceSonnet += 1
          if call sonnet-trigger?(state, lastEvents, jevSinceSonnet): request Sonnet call
on network/API error: chat error; the next trigger retries
```
The reply is applied to the state *as it is when the reply arrives*, not the state when the request was sent.

### 4.9 Sonnet call *(core)* [D: Sonnet reflects, edits, talks, requests]
*Serves:* G-1, G-2, G-6.
```
allowed when: no Sonnet or repair call in flight, not repairing or halted,
              and now - lastSonnetAt >= SONNET_MIN_GAP_MS
  (a user chat message skips sonnet-trigger? but still respects in-flight and the gap,
   queueing at most one pending user turn)
system = sonnet-system() + CORE_PREAMBLE + full WorldSource      # one block, prompt-cached
user   = sonnet-prompt(state, history) + last CHAT_HISTORY_N chat entries
         (+ "the neighbour is waiting" when a user message is pending)
thinking = {adaptive, display: summarized}
output_config.format = json_schema {summary, say, edits[{comment, source, delete}], core_request}
on send:  jevSinceSonnet = 0; the waiting-user flag clears
on reply: chat sonnet-thought (summary, then the summarized thinking); if say: chat inhabitant;
          for each edit: apply-edit (author sonnet)
          if core_request: chat core-request (highlighted)
```
`CORE_PREAMBLE` is core text that the models can't edit. It explains MIAL syntax, the entry-point contract, the host built-ins, the render contract, and the reply format. The reply is a JSON object under structured output rather than a tool call. There is no server-side fallback (Haiku 5.5 has none), so a refusal (reported with its `stop_details` category and explanation), a truncated reply, or invalid JSON is a chat error with no change. Nothing in the request asks for reasoning in the reply text: the reasoning comes back as summarized thinking blocks (D-31).

### 4.10 Apply edit *(core)* [D: per definition, no validation]
*Serves:* G-1, G-4.
```
parsed = parse(edit.source)
if parsed has 0 defs and edit.delete is empty: reject, tell Sonnet the parse diagnostics
text = WorldSource with each parsed def replacing its same-named def (or appended),
       and each name in delete removed
text = compact(text)        # every stored version, including the default world and reverts (D-33)
version += 1; snapshot; editLog.push; chat edit{comment, names}; save
reload definitions before the next tick
```
`compact` reprints the parsed definitions with each bullet's leading atoms on its line, breaking out at the first compound child (the upstream interpreter's compact printer). The tree is unchanged; lines the parser ignores are dropped. There's no behavior check. A broken world is the repair rule's job (G-5).

### 4.11 Repair *(core)* [D]
*Serves:* G-5.
```
on MIAL error (parse diagnostics that prevent loading, missing entry point, wrong return type,
               runtime error, step budget, stack overflow):
  pause ticking; chat error{message, definition}
  if repairStreak >= REPAIR_MAX: halted = true; chat system "halted"; stop
  repairStreak += 1
  if no Anthropic key: halted = true; stop
  call Sonnet with CORE_REPAIR_PROMPT (fixed, ignores sonnet-system) + CORE_PREAMBLE + full source,
       error in the user message, same reply format; apply its edits with author repair
  when the call finishes (any outcome): resume ticking; a tick with no error sets repairStreak = 0
```
A halted world stays halted until you revert (D-22), start a new game, or do a factory reset.

### 4.12 Persistence *(core)* [D]
*Serves:* G-3.
```
save on: every SAVE_EVERY_TICKS ticks, every applied edit, every chat entry, pause, page unload
load on start: if a save exists, restore it; else source = DEFAULT_WORLD; state = initial-state()
new game: state = initial-state() from the current source; source and edit log are kept
factory reset: source = DEFAULT_WORLD; clear all game data (keys kept)
download: saves the current WorldSource as world-v<version>.md
```

---

## §5 Agents

### 5.1 Jev [D]
*Serves:* G-2. Model: `typesafe/jev-router` on OpenRouter (chat completions with JSON-schema structured output).
- **Sees:** only what `jev-system` and `jev-prompt` choose to show. It never sees the chat directly. Sonnet controls what Jev knows and may pass information, including what you said, through those definitions [D].
- **Can do:** choose one item from `actions`. Nothing else.
- **Commits to:** a goal until the next trigger. The world keeps running while the call is in flight.

### 5.2 Sonnet [D]
*Serves:* G-1, G-2, G-6. "Sonnet" is the role name of the reflective mind, used in the MIAL entry points (`sonnet-system`, `sonnet-prompt`, `sonnet-trigger?`) and in code. The model filling the role is `SONNET_MODEL` (Claude Haiku 5.5), shown in the UI as `SONNET_NAME`, and it's called directly from the browser.
- **Sees:** `sonnet-system`, `sonnet-prompt`, the core preamble, the full WorldSource, and recent chat.
- **Can do:** speak as the inhabitant, edit any definition (including the prompts and cadence of both models), and request core changes.
- **Can't do:** edit core JS, the core preamble, or the repair prompt. Can't change the core call-gap floors.
- **Sees the whole world source on every call** [D]. Partitioning it is a future question once the source grows.
- **Persistent memory:** none outside of MIAL. If it wants to remember something, it writes a definition (for example `# notes`) and refers to it from its own prompt [P].

### 5.3 Repair [D]
This is Sonnet under the fixed repair prompt. Its only job is to make the world load and tick again.

---

## §6 Numbers [T]

**MIAL-owned**: initial values in `world/default_world.md`. The models may change them.

| Name | Value | Unit | Decision |
|---|---|---|---|
| GRID_W, GRID_H | 12, 12 | tiles | D-9 |
| METER_MAX | 100 | | D-10 |
| LOW_THRESHOLD | 30 | meter units | D-10 |
| DECAY.food | 0.15 | per tick | D-10 |
| DECAY.water | 0.24 | per tick | D-10 |
| DECAY.rest | 0.09 | per tick | D-10 |
| DECAY.wood | 0.1 | per tick | D-10 |
| DECAY.wonder | 0.05 | per tick | D-32 |
| BASE_SPEED | 0.25 | tiles per tick | D-10 |
| SLOW_FACTOR | 0.5 | × speed | D-2 |
| RATE (bush, well) | 1 | per tick | D-10 |
| RATE (shack) | 0.5 | per tick | D-10 |
| RATE (tree) | 2 | per tick | D-10 |
| SONNET_EVERY_N_JEV | 5 | Jev decisions | D-7 |
| IDLE_RECHECK_TICKS | 20 | ticks | D-7 |

**Core-owned**: fixed JS constants in `js/config.js` (`EVAL_STEP_LIMIT` in `js/mial.js`).

| Name | Value | Unit | Decision |
|---|---|---|---|
| TICK_MS | 250 | ms | D-10 |
| JEV_MIN_GAP_MS | 2000 | ms (default; adjustable in settings) | D-12 |
| SONNET_MIN_GAP_MS | 10000 | ms (default; adjustable in settings) | D-12 |
| REPAIR_MAX | 3 | consecutive attempts | D-8 |
| EVAL_STEP_LIMIT | 200000 | evaluation steps per entry-point call | D-8 |
| EVENT_HISTORY_N | 30 | events | D-7 |
| CHAT_HISTORY_N | 20 | entries | D-7 |
| SAVE_EVERY_TICKS | 20 | ticks | D-11 |
| SONNET_MAX_TOKENS | 16000 | tokens | D-7 |
| JEV_MAX_TOKENS | 400 | tokens | D-7 |
| MAX_CHAT | 500 | chat entries kept | D-11 |
| MAX_VERSIONS | 200 | snapshots kept (v1 always) | D-22 |
| JEV_MODEL | `typesafe/jev-router` | | D-17 |
| SONNET_MODEL | `claude-haiku-5-5` | | D-17 |
| SONNET_NAME | `Haiku` | the reflective mind's name in the UI | D-17 |

---

## §7 Commands and events

### Commands (core API, `BL.game.*`)
Every command checks that it's legal. An illegal command returns `{ok:false, reason}` and changes nothing. A legal one returns `{ok:true, events}`.

| Command | Legal when | Effect |
|---|---|---|
| `start()` / `pause()` | Not halted (for start) | Turns ticking on or off. Pausing also stops model triggers. In-flight calls finish and are applied |
| `step()` | Paused, not halted, not repairing | Runs one tick, including triggers |
| `pump()` | Always | Sends a waiting user turn to Sonnet once the gap allows. Called on a timer even while paused |
| `sendUserMessage(text)` | Text isn't empty | Adds a chat entry and requests a Sonnet turn (skips `sonnet-trigger?`) |
| `applyEdit(edit)` | Edit has a comment and parses (see the apply-edit rule) | Applies it, versions it, and logs it |
| `revertTo(version)` | Always [D] | Restores that snapshot as a new version with the comment "revert to vN"; clears `halted` |
| `newGame()` | Always | Recreates state from the current source |
| `factoryReset()` | You confirm | Restores the default world |
| `setSettings({jevGapMs, sonnetGapMs})` | Gaps ≥ 0 | Sets the call-gap floors. The UI stores them, and the API keys, through the store (never in the save) |

Downloading the MIAL is a UI action over `getSource()` and `getVersion()`; it saves `world-v<version>.md`.

### Read-only queries
`getState()`, `getSource()`, `getVersion()`, `getEditLog()`, `getVersions()`, `getChat()`, `getCounters()` (with in-flight flags), `getSettings()`, `getEventHistory()`, `getRenderData()`, `getStatsData()` (the `core` record, plus every top-level record of plain numbers in the state except `grid` and `meters`), `isHalted()`, `isRunning()`, `isRepairing()`. `getRenderData()` reads the render contract through the same Record field lookup the MIAL's `get` uses.

### Events (core → UI)

| Event | Fields | Shown |
|---|---|---|
| `ticked` | state, events | Canvas redraw |
| `chat` | ChatEntry | Appended to the chat log. `low` and `recovered` world events become `system` entries [P] |
| `jev-decision` | thought, action | Chat (`jev`) |
| `sonnet-reply` | thought, say | Chat (`sonnet-thought`, `inhabitant`) |
| `edit-applied` | Edit | Chat (`edit`) and the edit list |
| `core-request` | text | Chat, highlighted |
| `mial-error` | message, definition | Chat (`error`) |
| `repair-started` / `halted` | streak | Chat (`system`) |
| `api-error` | provider, message | Chat (`error`) |
| `changed` | — | Toolbar, counters and status refresh |

### Client contract
The UI calls only commands and queries and listens to events. It never calls MIAL entry points directly and never writes to `state`. The Stats button shows `getStatsData()` and refreshes on each tick while it's open.
