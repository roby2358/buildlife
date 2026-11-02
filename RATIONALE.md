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
- **Why:** G-5 > G-1 here. If Sonnet could delete its own instructions for editing, one bad edit could leave it unable to make any more. `reflective-mind-system` and `reflective-mind-prompt` remain fully editable, so Sonnet still controls its own voice and attention.

## Minds

### D-42 Jev's options are functions: `actions` lists definition names and the chosen one is called — *Decided*
- **Intent:** your call: a choice should literally be a function, kept in a list of names the inhabitant can edit.
- **Shape:** `actions(state)` returns names; each must be a definition taking the state and returning a state record. Jev's Choice options are those names, and the core calls the chosen definition. `apply-action` is gone. The default world has `go-bush`, `go-well`, `go-shack`, `go-tree` (each `go-to` its place) and `stay`.
- **Checked before asking Jev:** a listed name that isn't a one-parameter definition makes the request a MIAL error naming `actions`, so the repair rule fixes the list instead of Jev picking something uncallable.
- **Cost:** a new place no longer becomes an option by itself; the mind writes a function for it and lists it (the preamble says so). The gain is that options can be anything, not only walking somewhere.
- **Alternatives:** every `act-*` definition is an option, found by the core (not chosen: you wanted an explicit list); fall back to `apply-action` for names that aren't definitions (rejected: a place named like a definition would call it).

### D-41 Jev is TypeSafe's System One model, asked one Choice question per decision — *Decided*
- **Intent:** your call: Jev makes choices and writes no text. `typesafe/jev-router`, used until now, turned out to be a router that uses Jev to pick another model per request. OpenRouter's log showed a Jev call answered by Grok 4.7 with reasoning, at about $0.004 a decision; about $1.25 on 2026-11-01. The "thought" text in Jev's chat lines came from those models.
- **Shape:** `~typesafe/jev-latest` (Jev 1.14 on 2026-11-02) through OpenRouter's System One endpoint (`/api/v1/systemone`, same OpenRouter key, CORS open to the page). `jev-prompt` is the state, `jev-system` the instructions, and `actions` the Choice options (each described by its own name; the instructions explain them). The reply is the choice, a confidence and probabilities; the chat shows the three likeliest options, highest first (`→ go-well 0.83 · go-bush 0.10 · go-tree 0.05`) and the event history keeps the confidence, so the reflective mind sees how sure Jev was.
- **Cost:** $0.042 per million prompt tokens and nothing for output (OpenRouter, 2026-11-02): a few hundredths of a cent per thousand decisions.
- **Latest, not pinned (your call, 2026-11-02):** `~typesafe/jev-latest` follows each new Jev release, so behavior can change without a code change. Pinning a version such as `typesafe/jev-1.14` is the way back if a release behaves differently.
- **Alternatives:** TypeSafe's own API (rejected: its CORS refuses browser origins, so it needed a local relay); a fixed cheap text model on OpenRouter (rejected: still writes text, not Jev).
- **D-28's retry** now covers a reply with no choice; JEV_MAX_TOKENS is gone (Jev has no output tokens to cap).

### D-39 The reflective mind keeps a conversation; the prompt is laid out for the cache — *Decided*
- **Intent:** your call. It used to see only the last 20 chat lines, rebuilt each call, so it forgot anything older and nothing in the user part could be cached.
- **Shape:** system blocks `[CORE_PREAMBLE][world source][reflective-mind-system]`, with breakpoints after the first two: the preamble never changes, and the source changes only on an edit (you said "periodically, but not often"). Then the conversation, the new user turn (third breakpoint), and the status from `reflective-mind-prompt` as a mid-conversation system message, last. Putting `reflective-mind-system` after the source rather than in the same block as it caches the same way for reflections, and lets repair calls share both breakpoints.
- **User turns are what reached the mind:** your words and the results of its edits and runs, errors and notices, since its last reply. Its own words are already in its turns, and Jev's decisions are in the status.
- **No thinking in the history:** the API keeps replayed thinking valid only while `system` stays the same, and ours changes with every edit. Replaying it would make each edit drop it anyway (or fail with a 400 on newer accounts). Assistant turns are the reply's JSON text; the summarized thinking still shows in the chat.
- **The status isn't stored:** it sits after the last breakpoint, so leaving it out of the next call costs no cache. That avoids the `clear_at` beta.
- **Alternatives:** stateless calls with a longer chat window (rejected: no cache and a hard memory cliff); storing thinking with `prefix_mismatch_behavior: drop_block` (rejected: needs another beta and drops it on most edits anyway).

### D-40 Old turns are condensed by Anthropic's on-demand compaction, keeping the recent half — *Decided (mechanism) / Proposed (numbers)*
- **Intent:** your design: when the turns reach about 20,000 characters, summarize the oldest 10,000 out of band and drop them. On-demand compaction with kept recent turns (beta `compact-2026-09-04`) does exactly that, and the summary is written server-side and returned as a signed block.
- **Shape:** the core decides when (COMPACT_AT_CHARS = 20000 counting the summary and turns, COMPACT_CHUNK_CHARS = 10000, cut after an assistant turn). The request reuses the conversation's system blocks, so it hits the cache. The optional MIAL definition `reflective-mind-compaction` supplies the summarizer's instructions, so the inhabitant decides how it forgets, while the core makes sure it does. The default world ships one.
- **Shown:** each summary appears in the chat as a `memory` entry.
- **Alternatives:** threshold compaction inside ordinary requests (rejected: it can't keep recent turns' thinking and the docs prefer on-demand); asking the mind for a `memory` field (rejected: more code for the same thing); letting the MIAL own the threshold too (rejected: a world that never compacts would grow until saves fail).
- **Numbers:** a first guess. COMPACT_AT_CHARS ≈ 5k tokens, small next to the source; revisit with live sessions.

### D-36 Sonnet can run a one-time function on the live state — *Decided*
- **Intent:** lower the barrier to building (your call). `initial-state` only runs on a new game, so changing the running world meant either asking for a restart or writing a permanent `tick` wrapper that adds the thing if it's missing. Two Haiku instances each asked for a restart; two others each tried `initial-state`, saw it do nothing, and invented `ensure-*` wrappers.
- **Shape:** a `run` list in the reply, each `{comment, source}`, where the first definition takes the state and returns the new one. It's called once after the reply's edits with the world's definitions in scope, then discarded. A field in the structured reply, not a real tool call, because the reply is already one JSON object (4.9) and a tool round trip would add a turn.
- **Failure:** a chat error and no change. Not the repair rule: the world source isn't broken, and the error reaches Sonnet in its next user turn.
- **Wonder:** in the default world a successful Sonnet run counts like an edit (`core.reflective-mind-runs`), so building through a run is still creating. That's world MIAL and the models may change it.
- **Alternatives:** a hint in the preamble only (rejected: still a per-tick wrapper forever); a `migrate` entry point called after each edit (rejected: still an edit-and-delete dance for a one-off); letting edits carry a state patch (rejected: mixes two kinds of change in the edit list).
- **Not reverted:** `revertTo` restores source, not state, so a run stays. Same as any tick.

### D-3 Jev picks actions fast; Sonnet reflects slowly and can rewrite both models' prompts — *Decided*
- **Alternatives:** Sonnet proposes and Jev judges; both propose and a rule reconciles; equal peers in conversation.
- **Why:** G-2. This matches what Jev is built for (typed, cheap judgments) and gives Sonnet the long-horizon work. Because Sonnet can rewrite Jev's prompt, Sonnet teaches and Jev executes, and the relationship can change over time.

### D-17 Models and transport — *Decided (models) / Proposed (transport)*
- **The reflective mind runs on Claude Haiku 5.5** (`claude-haiku-5-5`), chosen by you as better sized for this job: a small world, short structured replies. It costs a twentieth of Sonnet 5.5's per-token price ($0.10/$0.50 against $2/$10 per million tokens). "Sonnet" stays the role name in the MIAL entry points and code, because existing worlds depend on those names; the UI shows `SONNET_NAME`. It's called with plain `fetch` from the browser (`anthropic-dangerous-direct-browser-access: true`, API version `2026-10-21`). The SDK isn't an option on a file:// page with no bundler.
- **The reply is structured output, not a tool.** It's a JSON object under `output_config.format` (`SONNET_SCHEMA`), so edits arrive as fields rather than prose to parse. *Alternatives:* a forced `act` tool, which Sonnet 5.5 rejected with a 400; an `auto` tool with a prompt instruction, which doesn't guarantee a call. A tool-based design is still worth revisiting if Sonnet ever needs to read definitions on demand (see D-23).
- **No server-side fallback:** Haiku 5.5 doesn't offer one, so a refusal is a chat error naming its category, and the next reflection tries again.
- The system text (reflective-mind-system + core preamble + world source) is one prompt-cached block. It changes only when the world is edited, so most reflections read it from the cache.
- Jev was first `typesafe/jev-router` on OpenRouter, taken for Jev itself (checked 2026-10-31). It's a router that forwards each request to another model; replaced by Jev itself in D-41.
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

### D-2 The penalty is half speed while any one of food, water, rest or wonder is below the threshold, applied once — *Decided (half speed, wood exempt) / Proposed (once, not compounding)*
- **Alternatives:** compound per low meter (¼ speed with two low); every meter counts (the first version, which included wood); bodily needs only (food, water, rest), which took the teeth out of wonder.
- **Why:** You said "half speed with no other adverse effects." Compounding would be a second penalty. You later made wood optional: it's a resource, not a need. Wonder still slows, so a missed creation deadline costs something. The set is a MIAL record, SLOWING_METERS, so the models can change it.

### D-5 Wood starts as a fourth decaying meter, and the models may redefine it — *Decided*
- **Why:** It keeps the four structures symmetric (one template) and gives Sonnet an obvious first thing to reinterpret.

### D-4 Real time, with async model calls — *Decided*
- **Alternatives:** turn-based; turn-based with manual steps.
- **Why:** The alive quality. Slow thinking costs something real. A `step()` command exists for debugging while paused.

### D-9 Canvas, 12×12 grid — *Decided (canvas) / Proposed (size)*
- Places and the inhabitant are drawn as emoji (D-35); hand-drawn shapes remain only as the fallback.
- **Why:** Small enough that walking from one structure to another takes seconds, not minutes.

### D-10 Pressure numbers — *Decided (pressure level) / tuned by X-1*
- **Intent:** a sensible mind should be able to keep every need up, but only just, and a careless one should visibly pay with half speed. Decision quality has to matter (DYNAMICS, "two minds, one body"), and you asked for more pressure without cruelty.
- **Current:** refill rates are half what they were for the bush, well and shack (tree unchanged). Decay is 1.2× the earlier values for food, water and rest, while wood stays at 0.1. The share of time needed for refilling, the sum of DECAY ÷ RATE, is 0.15 + 0.24 + 0.18 + 0.05 = 0.62, before walking.
- **Alternatives measured** with halved rates and a scaled decay, using `node tools/tune.js --policy smart|lowest|random --decay-scale S` (S relative to the doubled decay you first asked for; the stand-ins replace Jev):
  - 2× decay (as first asked): the sum is 1.0, which is infeasible. Even `smart` is at half speed 91% of the time.
  - 1.5×: `smart` is slow 74%. 1.2×: `smart` 0%, lowest need ≈ 42; `random` 70–88%. 1×: `smart` 0%, lowest ≈ 56; `random` 54–68%.
  - There's a cliff between 1.2× and 1.5×. 1.2× was chosen as tight but survivable.
- **Evidence for the current values:** `Measured by: node tools/tune.js --runs 3 --policy smart|lowest|random` → smart: 0% at half speed, lowest need ≈ 42; lowest: about 1% (water); random: 80–89% (74–89% after 2026-11-01, when wood stopped slowing). With `--create-every 600` (a creation only every 10 minutes), `smart` is slow 72% because wonder runs out and half speed drags every need down.
- **Not measured:** the real Jev's latency and choices, and how often the real Sonnet creates.
- The other numbers (TICK_MS, BASE_SPEED, LOW_THRESHOLD, grid size) are unmeasured first guesses.

### D-35 Map icons are emoji the models choose — *Decided*
- **Intent:** you asked for emoji on the map, with the inhabitant picking one for anything it adds and free to change existing ones. That gives creation a visible signature (G-2) at no cost to the "core encodes no world rule" invariant.
- **Where it lives:** a MIAL constant `EMOJI` (name → emoji), read by the core like SLOWING_METERS. A structure record may also carry its own `emoji` field, which wins. A constant rather than only a state field so an edit takes effect at once, without rewriting the running state or starting a new game.
- **Guard:** the renderer draws only the first grapheme, so an emoji field can't spill text across the map. No other validation (D-6).
- **Fallback:** no emoji means the old generic grey square, so a forgetful edit still shows the place.
- **Alternatives:** keep the bespoke canvas shapes (rejected: the models couldn't restyle them without a core change); add an emoji argument to `structure` (rejected: breaks every existing call and model-written world).

### D-34 Walking costs food, water and rest per tile — *Decided (costs those three) / tuned by X-1 (0.2)*
- **Intent:** you asked that moving cost rest, food and water. Before this, walking was free apart from time, so the bush, well and shack being far apart only mattered as decay during the trip.
- **Per tile, not per tick:** charging per tick would make a slowed inhabitant pay double for the same trip, compounding the only penalty (D-2). Per tile keeps the cost proportional to distance. It's taken from the tiles actually stepped in `move`, so an edited `walk` or `step-toward` is still charged correctly.
- **Alternatives measured** (`node tools/tune.js --runs 2 --policy smart|lowest`, half-speed share): 0 → smart 0%, lowest 1% (lowest need ≈ 41 / 25). 0.1 → 0% / 2%. 0.15 → 0.1% / 0% (lowest need ≈ 30, right at the threshold). 0.2 → 6.5% / 6%, water the low one. 0.3 → 26% / 7%.
- **Chosen 0.2:** walking now visibly matters (the smart stand-in occasionally runs water low on long trips) without making half speed the normal state. `random` stays at 77–92%.
- **Not measured:** how the real Jev weighs distance once its prompt mentions the cost.

### D-6 Edits replace, add, or delete whole definitions, with no validation; parsing is all or nothing — *Decided (unit, no validation) / Proposed (all or nothing)*
- **Alternatives:** whole-file rewrite; validate with a dry-run tick and roll back; your approval.
- **Why:** G-1. You chose "apply anything." The only check is that the edit text parses into definitions, which rejects mangled output without judging behavior.

### D-8 A fixed repair call on MIAL error, REPAIR_MAX consecutive attempts, then halt — *Decided*
- **Why:** G-5. Without a limit, a model that can't fix the world would loop on paid calls. The step budget turns runaway recursion into an ordinary, repairable error instead of a frozen tab.

### D-11 Persistence and the edit list — *Decided*
- Everything is saved in localStorage. A button downloads the current MIAL. The edit list shows commit-style comments with no diff and no in-UI editor.

### D-25 `actions` takes the state — *Proposed* (since D-42 it lists function names, so new places no longer follow automatically)
- **Alternatives:** a zero-argument constant list.
- **Why:** G-1. When Sonnet adds a structure, Jev's choices follow from the state without a second edit. Zero-argument definitions also can't be called from MIAL code, so a constant list would be reachable only by the core.

### D-26 Idle re-ask every IDLE_RECHECK_TICKS, not every tick — *Proposed*
- **Alternatives:** ask on every idle tick and let JEV_MIN_GAP_MS throttle it.
- **Why:** If Jev chooses `idle`, re-asking at the gap floor would be a Jev call every 2 s for doing nothing. Every 5 s keeps the inhabitant from being stranded at a fifth of that cost.

### D-27 `?fake` runs the page with stand-in minds and in-memory storage — *Proposed*
- **Why:** You can try the page without keys, and the browser test can walk every chat kind deterministically. In-memory storage means a fake session never overwrites a real save.

### D-28 Retry a malformed or cut-off Jev reply once — *Decided* (since D-41: a reply with no choice)
- **Alternatives:** no retry (the original rule), which costs a decision; retry until valid, which loops on a persistent fault; raising JEV_MAX_TOKENS instead (the error now says when a reply was cut off at the limit, so that can be judged from evidence).
- **JEV_MAX_TOKENS 400 → 1024 (2026-11-01):** a live Jev decision was cut off mid-JSON at 400 and needed the retry. The inhabitant asked for a little more; you chose 1024 for comfortable headroom. The retry stays as the backstop.
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

### D-33 Every stored version is canonical compact MIAL — *Decided*
- **Alternatives:** keep whatever text the models write (mixed styles accumulate); compact only the default world (edits drift back to expanded); a style rule in the preamble alone (nothing enforces it).
- **Why:** Your call. One style keeps the source uniform for the minds and for you, and it's shorter: the default world went from 646 to 553 lines and 11,567 to 10,990 characters, with an identical parsed tree (`compactSource` round-trip, R-22). The preamble names compact as house style so edits arrive in it, and the core reprints every version regardless.
- **Cost:** comments or prose lines in an edit are dropped (the parser ignored them anyway). The first save after the switch rewrites the cached system block once.

### D-32 Wonder: a fifth need that only creating or improving refills — *Decided*
- **Alternatives:** aspirations in `reflective-mind-system` only (a prompt the mind can edit away silently); world pressure only (seasons, decay of structures), which gives problems but no drive to make things; challenges from you in chat, which depend on you; a core-fixed goal or score, which cuts against the rules belonging to the inhabitant.
- **Why:** In a stable world, Sonnet had no reason to change anything: "chop wood, carry water." Making creativity a need puts making things inside the survival loop it already understands. It's measured by a core fact (`core.reflective-mind-edits`), so the world doesn't trust its own say-so, and it needs no core change.
- **Any creation tops wonder off** (your choice, over a fixed increment per creation). The rule becomes one plain deadline, "make something at least every few minutes," instead of bookkeeping. How much it made doesn't matter, only that it made something.
- **Gaming:** trivial edits refill it as well as good ones. That's deliberately not prevented (D-24); whether the inhabitant keeps inventing or games the meter shows up in the edit log, and either is worth seeing.
- **Numbers:** DECAY.wonder 0.05 drains a full meter to the threshold in about 5.8 minutes. `Measured by: node tools/tune.js --policy smart --create-every S` → every 60 s or 300 s: never slow after the start; 420 s: slow 66%; 600 s: slow 72%, as half speed cascades into the other needs. Sonnet reflects roughly every 2 minutes at the current cadence, and earlier when wonder is low. Unmeasured with the real Sonnet.

### D-7 Event-driven cadence, defined in MIAL — *Decided (event-driven) / Proposed (specific triggers and numbers)*
- **Why:** G-2 and cost. Jev is asked when something happens. Sonnet is asked every REFLECTIVE_MIND_EVERY_N_JEV decisions or when you talk. Sonnet can retune all of it.

### D-12 Core-enforced minimum gaps between calls, adjustable in settings — *Decided*
- **Alternatives:** no floor (the MIAL is fully in charge); fixed constants.
- **Why:** With "apply anything," Sonnet could set `reflective-mind-trigger?` to always true, which would mean a paid call on every tick. With the defaults, the JEV_MIN_GAP_MS and SONNET_MIN_GAP_MS floors cap the worst case at 30 Jev and 6 Sonnet calls per minute, whatever the MIAL says.

### D-22 Each edit-list entry has "revert to here" — *Decided*
- **Why:** G-5. It's the manual way out of a halted world short of a factory reset. A revert is itself a new version with a comment, so history is never rewritten.

### D-37 You can upload a world MIAL file into the running world — *Decided*
- **Intent:** your call, the counterpart to Download. A downloaded or hand-edited world goes back in without a factory reset.
- **Shape:** the file's whole text becomes the next version, authored `user` with the comment "upload <file name>", so it shows in the edit list and can be reverted (D-22). The state is kept, as with any edit; `initial-state` only matters for the next new game. Like a revert, it clears `halted`.
- **Check:** only that the file has at least one `# definition`, to catch picking the wrong file. Nothing else is checked, the same as model edits (D-6): a world that breaks goes to repair.

### D-38 Core requests are kept in their own list until you delete them — *Decided*
- **Intent:** your call. Requests scroll away in the chat (and the chat is capped at MAX_CHAT), and they're your to-do list for the core.
- **Shape:** every non-empty `core_request` is also appended to `requests` in the save, shown by the Requests button with a count. Each has an ✕ that deletes it. Deleting is UI bookkeeping only: the inhabitant isn't told, and the chat entry stays. A factory reset clears the list; a new game keeps it.

### D-23 Every Sonnet call includes the whole world source — *Decided* (as its own cached system block since D-39)
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
