# CLAUDE.md

BuildLife: a browser simulation whose world rules and model prompts are MIAL (MarkdownIsALisp), editable by the
models at runtime; the core JS is fixed. ONTOLOGY.md is the implementation reference. Cite stable IDs (G-n, D-n,
R-n), never section numbers.

- Plain `<script>` tags sharing the global `BL`. No ES modules, no bundler: the page must work from `file://`.
- No world rule in core JS. Rules, cadence and prompts live in `world/default_world.md`.
- After editing `world/default_world.md`, run `npm run embed` (`js/world_default.js` is generated).
- `js/mial.js` is a copy of `../yuwakisaweb/markdown_is_a_lisp/interpreter.js` with BuildLife additions listed in its header.
- Core modules (`mial`, `world`, `minds`, `store`, `game`) stay DOM-free so tests can load them through `vm`.
- Tests: `npm test`. Each automated R-row in CRITERIA.md owns `test/R-n/`, with one rule per test. UI: `node test/browser.js`.
- Changing a rule or number: update ONTOLOGY, RATIONALE (with evidence), CRITERIA and the tests together, and add a dated ARCHITECTURE_LOG entry.
