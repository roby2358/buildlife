# ARCHITECTURE_LOG.md — BuildLife

Newest first.

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
