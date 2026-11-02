# ARCHITECTURE_LOG.md — BuildLife

Newest first.

### 2026-11-02: Jev's options are functions
`actions` now lists definition names, and the core calls the one Jev chooses with the state (D-42, R-7); `apply-action` is gone. Default world: `go-to` plus `go-bush`, `go-well`, `go-shack`, `go-tree` and `stay`; `jev-system` describes them. A listed name that isn't a one-parameter definition is a MIAL error naming `actions`. A new place needs a function and a list entry before Jev can choose it. Saved worlds whose `actions` still returns place names hit that error and go to repair; a factory reset avoids it.

### 2026-11-02: Jev is Jev: System One choices, no text
`typesafe/jev-router` was a router that forwarded each Jev call to another model (a logged call went to Grok 4.7, about $0.004 each; $1.25 on 2026-11-01). Jev is now `typesafe/jev-1.14` through OpenRouter's `/api/v1/systemone`: one Choice question with `jev-prompt` as the state, `jev-system` as the instructions and `actions` as the options, answered with a choice, a confidence and probabilities (D-41, R-12, R-14). The chat shows `→ well (0.82)`; decisions in the event history carry the confidence instead of a thought. JEV_MAX_TOKENS removed. The default world's `jev-system` is now phrased as the question, and `jev-prompt` lost its "Choose your next action." line. Live worlds keep their old Jev prompts until a factory reset, and those still work as a question and state.

### 2026-11-02: The reflective mind keeps a conversation, condensed by compaction
- Calls to the reflective mind now form one conversation (D-39, R-28): system blocks `[preamble][source][reflective-mind-system]` with cache breakpoints after the first two, then the stored turns, the new user turn (third breakpoint), and the `reflective-mind-prompt` status as a mid-conversation system message that's never stored. User turns carry the new chat entries (your words, edit and run results, errors) instead of the last 20 chat lines. Replies are stored as JSON text; thinking isn't replayed, because edits change `system` and would invalidate it. Repair calls share the first two cached blocks.
- When the conversation passes 20,000 characters, the oldest 10,000 or more are condensed with Anthropic's on-demand compaction (beta `compact-2026-09-04`, now sent on every Anthropic call), keeping the recent turns word for word (D-40, R-29). The summary block goes first; a new `memory` chat kind shows it. The new optional MIAL definition `reflective-mind-compaction` gives the summarizer's instructions, and the default world has one. Its `reflective-mind-system` now says the conversation is kept but condensed.
- CORE_PREAMBLE gained a "Your conversation" section and the new definition in its table. New core constants COMPACT_AT_CHARS, COMPACT_CHUNK_CHARS and COMPACT_MAX_TOKENS; CHAT_HISTORY_N now caps the new entries in one user turn. Saves from before this start with an empty conversation and don't replay the old chat.

### 2026-11-01: Upload MIAL and a Requests list
- New toolbar button Upload MIAL: a chosen file becomes the next version (author `user`, "upload <name>"), revertable, with the state kept (your call; D-37, R-26). New command `uploadSource`.
- New toolbar button Requests (n): the inhabitant's core requests, saved in `requests` and each removable with ✕ (your call; D-38, R-27). New command `deleteRequest`, query `getRequests`, event `requests-changed`. Saves from before this start with an empty list.
- U-9 covers both buttons.

### 2026-11-01: The reflective mind's MIAL names lose "sonnet"
The role runs Claude Haiku, so every name the mind sees now says what it is (your call). Entry points `sonnet-system`, `sonnet-prompt` and `sonnet-trigger?` became `reflective-mind-system`, `reflective-mind-prompt` and `reflective-mind-trigger?`. The core stats `sonnet-calls`, `sonnet-edits` and `sonnet-runs` became `reflective-mind-calls`, `reflective-mind-edits` and `reflective-mind-runs`. The chat kind `sonnet-thought` became `reflective-mind-thought`, the event `sonnet-reply` became `reflective-mind-reply`, and the constant `SONNET_EVERY_N_JEV` became `REFLECTIVE_MIND_EVERY_N_JEV`. JS internals (`SONNET_MODEL`, `buildSonnet`, …) keep the old name. Worlds saved or downloaded before this need those definitions renamed, or a factory reset. Entries below keep the names of their time.

### 2026-11-01: One-time runs
The reflective mind's reply gains `run`: one-time MIAL functions on the live state, called after the reply's edits and then forgotten (your call, to lower the barrier to building). Prompted by the v11 world: Haiku instances had asked for restarts or invented per-tick `ensure-*` wrappers because `initial-state` only runs on a new game. New core stat `sonnet-runs`; the default world's wonder counts it like an edit; the preamble and `sonnet-system` say when to use run vs. edit `initial-state`. The fake mind does one run (D-36, R-25).

### 2026-11-01: JEV_MAX_TOKENS 400 → 1024
The inhabitant asked for it in chat: a Jev decision was cut off mid-JSON at 400 tokens, so the retry had to fire. Raised to 1024 (your call, over the first 600); the retry stays (D-28).

### 2026-11-01: Emoji on the map
Places and the inhabitant are now drawn as emoji instead of canvas shapes (your call). New MIAL record EMOJI (bush 🫐, well 🪣, shack 🛖, tree 🌳, inhabitant 🧑); a structure's own `emoji` field wins over it. The core reads it through `BL.world.emojiMap`, and `getRenderData()` carries `emoji`. Anything without an emoji keeps the generic square. The reflective mind's prompt tells it to give new places an emoji and that it may change any (D-35, R-24, U-7).

### 2026-11-01: Walking costs food, water and rest
Each tile walked now takes MOVE_COST (0.2 each) from food, water and rest, on top of decay (your call). New MIAL record MOVE_COST and definition `pay-move`; `move` charges for the tiles actually stepped that tick, floored at 0. Per tile, so half speed doesn't double the cost. Jev's and Sonnet's prompts mention it. Tuned with `tools/tune.js`: the smart stand-in goes from 0% to about 6% at half speed (D-34, R-23).

### 2026-11-01: Wood no longer slows
Half speed now applies when any one of food, water, rest or wonder is below LOW_THRESHOLD (30); wood is optional and never slows (your call). New MIAL record SLOWING_METERS lists the slowing meters; `any-low?` checks only those. The "slow" badge reads it through `BL.world.slowingMeters`, and Jev's prompt says wood never slows. `tools/tune.js` measures half speed with the world's own `speed` definition, so it stays correct if the set changes (D-2, R-4).

### 2026-11-01: Compact MIAL everywhere
`world/default_world.md` was rewritten in compact form (each bullet's leading atoms on its line) by the interpreter's own printer; the parsed tree is identical. The core now stores every version compact: `setSource` runs `BL.mial.compactSource` on the default world, each applied edit and each revert (D-33, R-22). `CORE_PREAMBLE` names compact as house style. Existing saves keep their text until their next version.

### 2026-11-01: The reflective mind runs on Claude Haiku 5.5
`SONNET_MODEL` changed from `claude-sonnet-5-5` to `claude-haiku-5-5` (your call: better sized for the job, at a twentieth of the price). Removed `fallbacks: "default"` and its beta header, because Haiku 5.5 has no server-side fallback. "Sonnet" stays the role name in the MIAL entry points and code, so existing worlds keep working; the UI shows the new `SONNET_NAME` ("Haiku") (D-17).

### 2026-11-01: Wonder and more pressure
- New fifth need, wonder, refilled only by creating or improving through an edit. It's measured by a rise in `core.sonnet-edits`. Any creation tops it off to METER_MAX, after which it drains again (D-32, R-21). The default `tick` became `feed-wonder` around the old body, now `base-tick`. Jev's needs list omits wonder. `sonnet-trigger?` also fires after any Jev decision while wonder is low (R-8). `sonnet-system` explains wonder.
- More pressure (D-10): refill rates for the bush, well and shack were halved, from 2/2/1 to 1/1/0.5; decay for food, water and rest went from 0.125/0.2/0.075 to 0.15/0.24/0.09. The first request, 2× decay plus halved rates, measured as permanent half speed even with good play, so the decay increase was cut to 1.2×.
- Fixed a bug in the copied interpreter: `eq` and `!=` threw on null (`'string' in null`). It surfaced through `feed-wonder`'s `!= seen null`. Test loops that wait for a Jev call are now bounded, so a broken world fails a test instead of hanging the suite.
- `tools/tune.js` gained `--create-every` (simulated Sonnet edits that feed wonder) and per-meter low percentages.

### 2026-11-01: Fix reasoning_extraction refusals
Live Sonnet calls were often refused with `stop_details.category: "reasoning_extraction"`. The reply schema's `thought` field asked for Sonnet's "private reflection … your thinking" in the response text. It was replaced by `summary` (what it noticed and decided), and requests now set `thinking: {type: "adaptive", display: "summarized"}`. The chat shows the summary plus the summarized thinking (D-31, R-20). Refusal errors now include the category and explanation.

### 2026-11-01: Jev retry and stats (from the inhabitant's core request)
- A malformed or cut-off Jev reply is now retried once (D-28). R-12 was reworded. A `jev-invalid` counter was added.
- New reserved `state.core` record of core facts, stamped before and after every tick and always the last field (D-29, D-30, R-18).
- The default world's `tick` keeps `low-ticks` per meter (R-19). The world-side half of the request stays out of the core because "low" is a world rule.
- `CORE_PREAMBLE` now describes `state.core`. It says the field is read-only, and that world stats belong in the MIAL.
- New Stats button and dialog (`getStatsData()`, U-8).
- Live worlds keep their own source, so an existing world gets `state.core` right away but `low-ticks` only if Sonnet adds it, or after a factory reset or a revert to v1.

### 2026-10-31: Console logging of API exchanges
Each Jev and Sonnet exchange, real or fake, is logged to the browser console as a collapsed group: the request body, then the response or the error, with the time taken. A Settings checkbox controls it; it's on by default and stored with the other settings. Headers are never logged, so keys stay out of the console.

### 2026-10-31: First implementation
Built the core (`js/`), the default world (`world/default_world.md`, embedded by `tools/embed_world.js`), tests for R-1 to R-17 (`test/R-n/`, plus a coverage test), the browser check for U-1 to U-7 (`test/browser.js`), and the soak harness (`tools/tune.js`). Changes from the docs as first written:
- Sonnet replies through structured output (`output_config.format`), not a forced `act` tool. Sonnet 5.5 rejects forced `tool_choice` with a 400 (D-17). Added `fallbacks: "default"` and prompt caching of the system block. R-14 was reworded to match.
- `actions` takes the state (D-25), because zero-argument definitions can't be called from MIAL.
- Added the MIAL constant IDLE_RECHECK_TICKS (D-26); `jev-trigger?` no longer fires on every idle tick.
- DECAY went from 0.05 / 0.08 / 0.03 / 0.04 to 0.125 / 0.2 / 0.075 / 0.1 (×2.5). With the first values, no meter dropped below about 39 even under a random policy, so half speed never engaged. The scale was compared one variable at a time with `tools/tune.js` (evidence in D-10).
- The `using` event isn't emitted. `idle` is emitted when the goal names no existing place.
- Host built-ins gained `round` and `join`; `text` expands list arguments; `and`/`or` are variadic.
- SONNET_MAX_TOKENS went from 4000 to 16000, following the API guidance not to cap low for non-streaming calls. Added JEV_MAX_TOKENS, MAX_CHAT, MAX_VERSIONS, JEV_MODEL and SONNET_MODEL to the core constants.
- Edit authors also include `user` (reverts) and `system` (v1).
- `?fake` stand-in minds (D-27).
- Review fixes, with regression tests in R-11 and `test/unit/settings.test.js`:
  - `tickOnce` retries `initial-state` when there is no state, so a failed new game recovers after repair.
  - `setSettings` checks every value before applying any.
  - A Sonnet call can't start while a repair call is in flight.
  - `api-error` events carry the real message.

### 2026-10-31: Open questions settled
Q-1 was settled by D-12 (core call-gap floors, adjustable in settings; SONNET_MIN_GAP_MS was set to 10000 instead of the proposed 20000). Q-2 by D-22 (revert). Q-3 by D-20 (Sonnet only, may relay). Q-4 by D-23 (whole source). Q-5 by D-24 (trivializing allowed). Q-6 by D-8 (REPAIR_MAX 3 accepted). D-13 and D-14 were accepted. `cond` was dropped from the proposed host built-ins, and newlines in literals and inline lambda calls were rejected. The CORS note in D-17 now reflects your experience with OpenRouter from file://.

### 2026-10-31: Initial design doc set
Created ONTOLOGY, CRITERIA, RATIONALE, DYNAMICS, and this log from the design interview. The decided items (D-1, D-3, D-4, D-5, D-6, D-8, D-11, D-18, D-19, plus the decided parts of D-2, D-7, D-9, D-15, D-17) come from the interview answers. Everything else is proposed. Open: Q-1 to Q-6. No code exists yet, and all criteria are `not yet covered`.
