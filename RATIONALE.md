# RATIONALE.md — BuildLife

Why each current choice was made. Decisions describe the present state. Their history is in ARCHITECTURE_LOG.md.

## Architecture

### D-1 World rules, map, cadence, and prompts live in MIAL; core JS is fixed — *Decided*
- **Alternatives:** rules in JS with tunable numbers exposed as MIAL; the models editing JS directly.
- **Why:** G-1. Self-modification is the point, and MIAL is homoiconic, so the models edit the same structure the evaluator runs. Keeping JS fixed gives the experiment a stable floor: the page always renders, saves, and can recover (G-5). The models can still ask for JS changes (D-18).

### D-15 Plain `<script>` tags, with the default world embedded as a JS string — *Decided (scripts) / Proposed (embedding)*
- **Alternatives:** ES modules (blocked on `file://`); fetching `world.md` (also blocked on `file://`); a `<script type="text/markdown">` block in the HTML.
- **Why:** G-3. A JS string in `world_default.js` keeps the world in its own file, diffable and readable, and it loads from `file://`. The live world is stored in localStorage, and the download button exports it as `.md`.

### D-14 Copy the interpreter into the project and add host built-ins plus `let` — *Decided*
- **Alternatives:** load `../yuwakisaweb/markdown_is_a_lisp/interpreter.js` by relative path (that couples the two projects and breaks when this folder is copied elsewhere); write rules using only the existing built-ins.
- **Why:** The existing language has no records, no `let`, no way to call a lambda inline, no multi-line strings, and no step budget. Writing a world in it is possible but painful, and it would be even harder for the models to edit. The additions are built-ins for records, text, lists, numbers and `map`/`filter`/`reduce`, plus one special form, `let`, and a step budget. They're listed in ONTOLOGY under the host built-ins. Everything stays in BuildLife's copy for now. `let` may move upstream to markdown_is_a_lisp once it has proven itself.
- **Rejected along with it:** newlines in string literals (that would break the one-line-per-bullet grammar and parse→render→parse stability; `text` joins lines instead, which also makes each prompt line its own editable node); inline lambda calls (`let` covers the main use); `cond` (nested `if` does the same job).

### D-13 Structured data is MIAL Records (`record` → field → value trees) — *Decided*
- **Alternatives:** JS objects passed as opaque values; data lists of pairs.
- **Why:** G-1, G-4. A Record is a MIAL node, so `str`/`print-mial` can show state to Sonnet in the same syntax as the code, and the save format is the node JSON. Opaque JS objects would make state the one thing the language can't look inside.

### D-16 The core preamble and the repair prompt can't be edited by the models — *Proposed*
- **Alternatives:** keep them in MIAL too.
- **Why:** G-5 > G-1 here. If Sonnet could delete its own instructions for editing, one bad edit could leave it unable to make any more. `sonnet-system` and `sonnet-prompt` remain fully editable, so Sonnet still controls its own voice and attention.

## Minds

### D-3 Jev picks actions fast; Sonnet reflects slowly and can rewrite both models' prompts — *Decided*
- **Alternatives:** Sonnet proposes and Jev judges; both propose and a rule reconciles; equal peers in conversation.
- **Why:** G-2. This matches what Jev is built for (typed, cheap judgments) and gives Sonnet the long-horizon work. Because Sonnet can rewrite Jev's prompt, Sonnet teaches and Jev executes, and the relationship can change over time.

### D-17 Models and transport — *Decided (models) / Proposed (transport)*
- **The reflective mind runs on Claude Haiku 5.5** (`claude-haiku-5-5`), chosen by you as better sized for this job: a small world, short structured replies. It costs a twentieth of Sonnet 5.5's per-token price ($0.10/$0.50 against $2/$10 per million tokens). "Sonnet" stays the role name in the MIAL entry points and code, because existing worlds depend on those names; the UI shows `SONNET_NAME`. It's called with plain `fetch` from the browser (`anthropic-dangerous-direct-browser-access: true`, API version `2026-10-21`). The SDK isn't an option on a file:// page with no bundler.
- **The reply is structured output, not a tool.** It's a JSON object under `output_config.format` (`SONNET_SCHEMA`), so edits arrive as fields rather than prose to parse. *Alternatives:* a forced `act` tool, which Sonnet 5.5 rejected with a 400; an `auto` tool with a prompt instruction, which doesn't guarantee a call. A tool-based design is still worth revisiting if Sonnet ever needs to read definitions on demand (see D-23).
- **No server-side fallback:** Haiku 5.5 doesn't offer one, so a refusal is a chat error naming its category, and the next reflection tries again.
- The system text (sonnet-system + core preamble + world source) is one prompt-cached block. It changes only when the world is edited, so most reflections read it from the cache.
- Jev is `typesafe/jev-router` on OpenRouter, the only Jev slug listed (checked 2026-10-31). It supports `response_format`/structured outputs, so the `actions` list becomes a JSON-schema enum.
- **CORS from file://:** you already have many pages that call OpenRouter this way. Anthropic needs the `anthropic-dangerous-direct-browser-access: true` header, which is expected to work and is checked first during implementation.

### D-19 The chat carries your messages plus model thoughts and decisions — *Decided*
- **Alternatives:** models talk to each other; MIAL diffs in chat.
- **Why:** G-4, G-6. Edits appear as a one-line chat entry and in the edit list (D-11).

### D-18 Core-change requests appear only as highlighted chat messages — *Decided*
- **Why:** You'll read them and bring them to an implementation session. No extra panel is needed.

### D-20 Jev doesn't see the chat directly; Sonnet may pass anything through — *Decided*
- **Alternatives:** include recent chat in every Jev call.
- **Why:** Sonnet is the inhabitant's voice, and it decides what Jev needs to know (including what you said) by editing `jev-prompt` or a definition it references. It also keeps Jev's calls small.

### D-21 Sonnet's only long-term memory is MIAL definitions it writes — *Proposed*
- **Alternatives:** a core-managed memory field.
- **Why:** G-1. Memory becomes part of the world it rewrites, and you can see it (it's in the downloaded MIAL).

## World

### D-2 The penalty is half speed while any meter is below the threshold, applied once — *Decided (half speed) / Proposed (once, not compounding)*
- **Alternatives:** compound per low meter (¼ speed with two low).
- **Why:** You said "half speed with no other adverse effects." Compounding would be a second penalty.

### D-5 Wood starts as a fourth decaying meter, and the models may redefine it — *Decided*
- **Why:** It keeps the four structures symmetric (one template) and gives Sonnet an obvious first thing to reinterpret.

### D-4 Real time, with async model calls — *Decided*
- **Alternatives:** turn-based; turn-based with manual steps.
- **Why:** The alive quality. Slow thinking costs something real. A `step()` command exists for debugging while paused.

### D-9 Canvas with simple shapes, 12×12 grid — *Decided (canvas) / Proposed (size)*
- **Why:** Small enough that walking from one structure to another takes seconds, not minutes.

### D-10 Pressure numbers — *Decided (pressure level) / tuned by X-1*
- **Intent:** a sensible mind should be able to keep every need up, but only just, and a careless one should visibly pay with half speed. Decision quality has to matter (DYNAMICS, "two minds, one body"), and you asked for more pressure without cruelty.
- **Current:** refill rates are half what they were for the bush, well and shack (tree unchanged). Decay is 1.2× the earlier values for food, water and rest, while wood stays at 0.1. The share of time needed for refilling, the sum of DECAY ÷ RATE, is 0.15 + 0.24 + 0.18 + 0.05 = 0.62, before walking.
- **Alternatives measured** with halved rates and a scaled decay, using `node tools/tune.js --policy smart|lowest|random --decay-scale S` (S relative to the doubled decay you first asked for; the stand-ins replace Jev):
  - 2× decay (as first asked): the sum is 1.0, which is infeasible. Even `smart` is at half speed 91% of the time.
  - 1.5×: `smart` is slow 74%. 1.2×: `smart` 0%, lowest need ≈ 42; `random` 70–88%. 1×: `smart` 0%, lowest ≈ 56; `random` 54–68%.
  - There's a cliff between 1.2× and 1.5×. 1.2× was chosen as tight but survivable.
- **Evidence for the current values:** `Measured by: node tools/tune.js --runs 3 --policy smart|lowest|random` → smart: 0% at half speed, lowest need ≈ 42; lowest: about 1% (water); random: 80–89%. With `--create-every 600` (a creation only every 10 minutes), `smart` is slow 72% because wonder runs out and half speed drags every need down.
- **Not measured:** the real Jev's latency and choices, and how often the real Sonnet creates.
- The other numbers (TICK_MS, BASE_SPEED, LOW_THRESHOLD, grid size) are unmeasured first guesses.

### D-6 Edits replace, add, or delete whole definitions, with no validation; parsing is all or nothing — *Decided (unit, no validation) / Proposed (all or nothing)*
- **Alternatives:** whole-file rewrite; validate with a dry-run tick and roll back; your approval.
- **Why:** G-1. You chose "apply anything." The only check is that the edit text parses into definitions, which rejects mangled output without judging behavior.

### D-8 A fixed repair call on MIAL error, REPAIR_MAX consecutive attempts, then halt — *Decided*
- **Why:** G-5. Without a limit, a model that can't fix the world would loop on paid calls. The step budget turns runaway recursion into an ordinary, repairable error instead of a frozen tab.

### D-11 Persistence and the edit list — *Decided*
- Everything is saved in localStorage. A button downloads the current MIAL. The edit list shows commit-style comments with no diff and no in-UI editor.

### D-25 `actions` takes the state — *Proposed*
- **Alternatives:** a zero-argument constant list.
- **Why:** G-1. When Sonnet adds a structure, Jev's choices follow from the state without a second edit. Zero-argument definitions also can't be called from MIAL code, so a constant list would be reachable only by the core.

### D-26 Idle re-ask every IDLE_RECHECK_TICKS, not every tick — *Proposed*
- **Alternatives:** ask on every idle tick and let JEV_MIN_GAP_MS throttle it.
- **Why:** If Jev chooses `idle`, re-asking at the gap floor would be a Jev call every 2 s for doing nothing. Every 5 s keeps the inhabitant from being stranded at a fifth of that cost.

### D-27 `?fake` runs the page with stand-in minds and in-memory storage — *Proposed*
- **Why:** You can try the page without keys, and the browser test can walk every chat kind deterministically. In-memory storage means a fake session never overwrites a real save.

### D-28 Retry a malformed or cut-off Jev reply once — *Decided*
- **Alternatives:** no retry (the original rule), which costs a decision; retry until valid, which loops on a persistent fault; raising JEV_MAX_TOKENS instead (the error now says when a reply was cut off at the limit, so that can be judged from evidence).
- **Why:** The inhabitant asked for it after losing a decision. One retry recovers transient faults, and a second failure is reported, never looped. An unknown action isn't retried, because the schema enum makes it a model error, not noise.

### D-29 Stats are split by who knows them: core facts in `state.core`, world facts in MIAL — *Decided*
- **Alternatives:** the core also counts ticks below LOW_THRESHOLD by reading the MIAL constant; only core facts, leaving world stats entirely to Sonnet.
- **Why:** "Below the threshold" is a world rule, and the core never encodes world rules (§2). If the core counted it, the number would silently go wrong the moment Sonnet redefined "low." So the core reports what only it can see (decisions, invalid replies, retries, calls, repairs, edits). The default world shows the world-side half with a `low-ticks` record, and the core preamble tells Sonnet that world stats belong in its MIAL.

### D-30 `state.core` is always the last field — *Decided*
- **Why:** Volatile numbers go at the end of anything that renders the state into a prompt. Today it doesn't affect caching: the only cache breakpoint is the end of Sonnet's system block, and the state sits after it in the user message. It keeps the rule easy to follow, and it starts to matter if part of the state is ever cached.

### D-31 Sonnet's reasoning comes from summarized thinking blocks; the reply carries only a short summary — *Decided*
- **Alternatives:** a `thought` field in the JSON reply holding its "private reflection", which is what the docs first used.
- **Why:** Sonnet 5.5 declines requests that ask the model to reproduce its internal reasoning in the response text, under the `reasoning_extraction` category. Server-side fallback doesn't retry those.
- **Evidence:** `Measured by:` a live session's console log. Refusals were frequent, and the response `msg_011CgbFMdgYXktba9SucKhcg` had `stop_details.category: "reasoning_extraction"`, on a request whose schema asked for `thought: your private reflection (shown to the neighbour as your thinking)`. The fix's effect on the refusal rate hasn't been measured yet.
- G-4 legibility is kept: the chat shows the reply's `summary` plus the summarized thinking.

### D-32 Wonder: a fifth need that only creating or improving refills — *Decided*
- **Alternatives:** aspirations in `sonnet-system` only (a prompt the mind can edit away silently); world pressure only (seasons, decay of structures), which gives problems but no drive to make things; challenges from you in chat, which depend on you; a core-fixed goal or score, which cuts against the rules belonging to the inhabitant.
- **Why:** In a stable world, Sonnet had no reason to change anything: "chop wood, carry water." Making creativity a need puts making things inside the survival loop it already understands. It's measured by a core fact (`core.sonnet-edits`), so the world doesn't trust its own say-so, and it needs no core change.
- **Any creation tops wonder off** (your choice, over a fixed increment per creation). The rule becomes one plain deadline, "make something at least every few minutes," instead of bookkeeping. How much it made doesn't matter, only that it made something.
- **Gaming:** trivial edits refill it as well as good ones. That's deliberately not prevented (D-24); whether the inhabitant keeps inventing or games the meter shows up in the edit log, and either is worth seeing.
- **Numbers:** DECAY.wonder 0.05 drains a full meter to the threshold in about 5.8 minutes. `Measured by: node tools/tune.js --policy smart --create-every S` → every 60 s or 300 s: never slow after the start; 420 s: slow 66%; 600 s: slow 72%, as half speed cascades into the other needs. Sonnet reflects roughly every 2 minutes at the current cadence, and earlier when wonder is low. Unmeasured with the real Sonnet.

### D-7 Event-driven cadence, defined in MIAL — *Decided (event-driven) / Proposed (specific triggers and numbers)*
- **Why:** G-2 and cost. Jev is asked when something happens. Sonnet is asked every SONNET_EVERY_N_JEV decisions or when you talk. Sonnet can retune all of it.

### D-12 Core-enforced minimum gaps between calls, adjustable in settings — *Decided*
- **Alternatives:** no floor (the MIAL is fully in charge); fixed constants.
- **Why:** With "apply anything," Sonnet could set `sonnet-trigger?` to always true, which would mean a paid call on every tick. With the defaults, the JEV_MIN_GAP_MS and SONNET_MIN_GAP_MS floors cap the worst case at 30 Jev and 6 Sonnet calls per minute, whatever the MIAL says.

### D-22 Each edit-list entry has "revert to here" — *Decided*
- **Why:** G-5. It's the manual way out of a halted world short of a factory reset. A revert is itself a new version with a comment, so history is never rewritten.

### D-23 Every Sonnet call includes the whole world source — *Decided*
- **Alternatives:** send only the relevant definitions; send an index plus on-request reads.
- **Why:** Sonnet can't edit what it can't see, and the world is small. Partitioning is a future design question once the source grows (around 20 KB).

### D-24 Nothing stops the models from trivializing or breaking the game on purpose — *Decided*
- **Why:** If Sonnet wants to Kobayashi Maru the game (decay 0, no needs at all), that's a legitimate result of the experiment. It shows up as a commented edit.

## Open questions

None open. Partitioning the world source for Sonnet (D-23) is a known future question.

## Deliberately left out
- Edit validation, dry runs, approval gates (D-6).
- In-UI MIAL editor, diffs (D-11).
- Newlines in string literals, inline lambda calls, `cond` (D-14).
- Randomness in the default world (it keeps R-9 simple; a seeded built-in can be added later).
