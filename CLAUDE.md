# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

BuildLife: a browser simulation whose world rules and model prompts are MIAL (MarkdownIsALisp), editable by the
models at runtime; the core JS is fixed. ONTOLOGY.md is the implementation reference. Cite stable IDs (G-n, D-n,
R-n, U-n, X-n), never section numbers.

## Commands

- `npm test`: all headless tests (`node --test "test/**/*.test.js"`). One rule: `node --test test/R-10/`.
- `node test/browser.js`: UI criteria (U-rows) in headless Chromium against `index.html?fake`. If Chromium fails to
  launch with missing shared libraries, the container lost them: `sudo apt-get update && sudo npx playwright install-deps chromium`.
- `npm run embed`: regenerate `js/world_default.js` after editing `world/default_world.md` (a test fails if stale).
- `node tools/tune.js --policy smart [--set NAME=value] [--create-every S]`: soak harness, time at half speed. Evidence
  for number changes in RATIONALE comes from here.
- Run the app: open `index.html` (works from `file://`); `?fake` uses stand-in minds and in-memory storage.

## Rules

- Plain `<script>` tags sharing the global `BL`. No ES modules, no bundler: the page must work from `file://`.
- No world rule in core JS. Rules, cadence and prompts live in `world/default_world.md`.
- `js/mial.js` is a copy of `../yuwakisaweb/markdown_is_a_lisp/interpreter.js` with BuildLife additions listed in its header.
- Core modules (`mial`, `world`, `minds`, `store`, `game`) stay DOM-free so tests can load them through `vm`.
- Each automated R-row in CRITERIA.md owns `test/R-n/`, with one rule per test; `test/coverage.test.js` fails if rows
  and directories disagree.
- Changing a rule or number: update ONTOLOGY, RATIONALE (with evidence), CRITERIA and the tests together, and add a dated ARCHITECTURE_LOG entry.

## Architecture

- Script order (index.html) is the dependency order: `mial` → `world_default` → `config` → `world` → `minds` →
  `store` → `game` → then browser-only `api`, `fake_api`, `render`, `chat`, `main`. `test/helpers/env.js` loads the
  first seven into a `vm` context; `makeGame` gives a game with a fake clock and an API whose calls stay pending until
  the test resolves them.
- `game.js` (`BL.createGame({store, api, now})`) is the controller: tick loop, model call gating, edits, repair,
  saves. It talks to the world only through MIAL entry points (`initial-state`, `tick`, `actions`, `apply-action`,
  `jev-system`/`jev-prompt`/`jev-trigger?`, `reflective-mind-system`/`reflective-mind-prompt`/`reflective-mind-trigger?`), wrapped with type
  checks in `world.js`. The UI (`main.js`) uses only game commands, queries and events.
- Two minds: Jev (OpenRouter, JSON schema with an action enum) picks actions; the reflective mind replies with
  `{summary, say, edits, run, core_request}` via structured output. In MIAL its names are `reflective-mind-*`; JS still calls it "Sonnet" but it runs
  `BL.CONFIG.SONNET_MODEL` (currently Claude Haiku); `SONNET_NAME` is the UI label. Request building and parsing,
  plus the uneditable `CORE_PREAMBLE`, are in `minds.js`; network calls in `api.js`.
- Edits replace/append/delete whole `# definitions` with no validation; every stored version is reprinted in compact
  form (`compactSource`) and snapshotted for revert. A reply's `run` instead calls its first definition once on the live
  state (after the edits) and leaves the source alone. A MIAL error triggers the fixed repair call, halting after REPAIR_MAX.
- MIAL values are trees: records are `node('record', [node(key, [value])])`, data lists are `node(null, children)`.
  `state.core` is a reserved core-written stats record, always the last field.
