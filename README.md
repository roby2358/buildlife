# BuildLife

A tiny world, with a bush, a shack, a well, a tree and one inhabitant, whose rules are written in
[MarkdownIsALisp](../yuwakisaweb/markdown_is_a_lisp) and rewritten by the minds that drive it.
Jev (`typesafe/jev-router` on OpenRouter) picks moment-to-moment actions. Claude Sonnet reflects,
talks with you, and edits the world MIAL, including both models' prompts.

## Run

Double-click `index.html` (it works from `file://`; no server, no build). Open **Settings** and add
an Anthropic key (Sonnet) and an OpenRouter key (Jev), then press **Play**.

To look around without keys, open `index.html?fake`. That uses stand-in minds and doesn't touch
your real save.

## Develop

| Command | What it does |
|---|---|
| `npm test` | Headless tests: one directory per rule in `test/R-n/` (see CRITERIA.md), plus the coverage test |
| `node test/browser.js` | Checks the UI criteria in Chromium and writes screenshots to `test/screenshots/` (needs `npm install`) |
| `node tools/tune.js [--decay-scale 2.5] [--policy lowest\|smart\|random] [--set NAME=value]` | Soak harness: time spent at half speed with stand-in minds |
| `npm run embed` | Regenerates `js/world_default.js` after editing `world/default_world.md` |

## Docs

- [ONTOLOGY.md](ONTOLOGY.md): the implementation reference (entities, rules, the MIAL contract, commands and events, numbers)
- [CRITERIA.md](CRITERIA.md): rule, UI and experience criteria, and their coverage
- [RATIONALE.md](RATIONALE.md): why each decision was made, with evidence
- [DYNAMICS.md](DYNAMICS.md): why it's worth watching
- [ARCHITECTURE_LOG.md](ARCHITECTURE_LOG.md): what changed and when
