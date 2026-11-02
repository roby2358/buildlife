# BuildLife

A very small world: a bush, a well, a shack, a tree, and one inhabitant. The inhabitant gets
hungry, thirsty, tired, short on wood, and short on *wonder*. If any one of those except wood
runs low, it trudges at half speed. Walking makes it hungrier, thirstier and more tired. Wood is optional. Nothing worse ever happens. We're not monsters.

The twist is that the world's rules aren't fixed. They're written in
[MarkdownIsALisp](https://github.com/roby2358/yuwakisaweb/tree/main/markdown_is_a_lisp), a Lisp
whose syntax is Markdown bullets, and the inhabitant's own minds can rewrite them while it runs.

- **Jev** (`typesafe/jev-1.14`, TypeSafe's System One model, through OpenRouter) is the fast mind. It decides where to walk next, as a pure choice with probabilities and no words.
- **Claude Haiku** is the slow mind. It reflects, chats with you, edits the world, and rewrites
  both minds' prompts.
- **Wonder** refills only when the inhabitant makes or improves something. Chopping wood forever
  won't do it.

The JavaScript core is fixed. If the inhabitant wants a core change, it asks you nicely in chat.
In its first trial run, it built itself a storehouse. Everything on the map is an emoji, and the
inhabitant picks the emoji for whatever it builds (or restyles the ones it has).

## Run it

Double-click `index.html`. There's no server or build step. Open **Settings**, paste in an
Anthropic key and an OpenRouter key, then press **Play**. Keys stay in your browser.

No keys? Open `index.html?fake` to watch stand-in minds bumble about.

Use **Download MIAL** to keep the world as it currently stands. Each edit has a **revert** button
if things go sideways.

## Tinker

| Command | What it does |
|---|---|
| `npm test` | Headless rule tests, one folder per rule in `test/R-n/` |
| `node test/browser.js` | UI check in headless Chromium, with screenshots |
| `node tools/tune.js --policy smart` | Soak test: how often a sensible inhabitant is slowed |
| `npm run embed` | Rebuilds `js/world_default.js` after you edit `world/default_world.md` |

The design docs explain the rest. [ONTOLOGY](ONTOLOGY.md) says what it is,
[RATIONALE](RATIONALE.md) why it's that way, [CRITERIA](CRITERIA.md) how it's checked,
[DYNAMICS](DYNAMICS.md) why it's fun to watch, and [ARCHITECTURE_LOG](ARCHITECTURE_LOG.md) what
changed and when.

MIT licensed.
