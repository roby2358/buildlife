# ARCHITECTURE_LOG.md — BuildLife

Newest first.

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
