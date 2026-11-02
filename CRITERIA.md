# CRITERIA.md — BuildLife

How we know BuildLife is correct, readable, and good. Rows cite ONTOLOGY by rule name and stable ID, never by section number. An `automated` R-row owns `test/R-n/`.

## R — Rules (automated)

| ID | Given | Expect | Instrument |
|---|---|---|---|
| R-1 | The interpreter copy with host built-ins | `record`/`get`/`put`/`has?`/`keys` round-trip. `put` doesn't mutate its input. `text` joins with newlines. `let` evaluates its bindings in order. `map`/`filter`/`reduce` call closures | automated |
| R-2 | An entry-point call that recurses forever or loops deeply | Returns a MIAL error (step budget or stack overflow), never hangs or throws out of `world.js` | automated |
| R-3 | The default world, one tick | Every meter drops by its DECAY and is floored at 0. `low` is emitted only on the tick a meter crosses LOW_THRESHOLD | automated |
| R-4 | The default world: none low; each of food, water, rest, wonder low; two low; only wood low | Speed is BASE_SPEED × SLOW_FACTOR when any one of food, water, rest or wonder is low, applied only once; low wood alone leaves BASE_SPEED | automated |
| R-5 | Inhabitant with goal `well` at a distance | It reaches the tile next to the well in ceil(distance / speed) ticks, ± 1. `arrived` fires once and status becomes `using` | automated |
| R-6 | Using a structure | Its meter rises by rate − DECAY per tick. When it reaches METER_MAX: `full`, status `idle`, goal `idle` | automated |
| R-7 | `apply-action` with each action in `actions` | Goal and status are set by the action rule. Neither `actions` nor `apply-action` emits an event | automated |
| R-8 | Default cadence | `jev-trigger?` is true on full/low/recovered/idle events or when idle. `reflective-mind-trigger?` is true when since ≥ REFLECTIVE_MIND_EVERY_N_JEV, or after any Jev decision while wonder is below LOW_THRESHOLD | automated |
| R-9 | Same source, same state, same action sequence, run twice | Identical states (determinism) | automated |
| R-10 | `applyEdit` with a replacing def, a new def, a delete, and a source that doesn't parse | Replace, append, and remove work, and each adds one entry to the version, log, and chat. A source that doesn't parse changes nothing and returns diagnostics | automated |
| R-11 | An edit that breaks `tick` (a runtime error, a missing definition, the wrong return type) | Ticking pauses and the repair call starts with CORE_REPAIR_PROMPT. After REPAIR_MAX consecutive failures the world is halted. One good tick resets the streak | automated |
| R-12 | Jev reply with an action not in `actions`, or JSON that doesn't parse or is cut off | Bad JSON is retried once (built from the current state, inside the same in-flight slot). A second failure, or an unknown action, goes to chat as an error with the state unchanged. No third attempt | automated |
| R-13 | Triggers firing while a call is in flight, or inside the min gap | No second request. The trigger is dropped, except for one pending user turn | automated |
| R-14 | Built requests (headless, with fake fetch) | Jev: system/user come from the MIAL defs and the schema enum equals `actions`. Sonnet: system is CORE_PREAMBLE, the full source, then reflective-mind-system, the last message is reflective-mind-prompt's status, the reply format is the structured-output schema, and no forced tool is sent. An edit to reflective-mind-system can't remove CORE_PREAMBLE | automated |
| R-15 | Save, then load | State, source, versions, edit log, chat, counters, and halted are all restored. Keys aren't in the save blob or the download | automated |
| R-16 | A WorldState missing render-contract fields, or with odd types | The render-data extractor returns partial data plus warnings, never throws | automated |
| R-17 | `revertTo(v)` | Source equals snapshot v and becomes a new version with the comment "revert to vN". `halted` is cleared | automated |
| R-18 | Ticks, Jev decisions, an invalid reply and its retry; a tick that reads and scribbles on `state.core` | `state.core` holds the core's counts after each tick. World code sees the record as it stood before the tick, and anything it writes to `core` is overwritten | automated |
| R-19 | Default world with some meters below LOW_THRESHOLD; a state with no `low-ticks` record | `low-ticks` counts one per tick for each meter below LOW_THRESHOLD, starting from zero (or from nothing for an older state) | automated |
| R-20 | Sonnet replies: a refusal with `stop_details`; a reply with a summary and summarized thinking blocks; the built request | A refusal goes to chat as an error naming its category and explanation, with no change. The summary and the thinking summary appear together as one Sonnet entry. Requests ask for `thinking: {adaptive, summarized}`, and neither the schema nor the core preamble asks for reasoning in the reply text | automated |
| R-21 | Default world: ticks with and without a rise in `core.reflective-mind-edits`; Jev's prompt | Wonder drains by its DECAY. The first tick only notes the edit count. A later rise, from any number of edits, fills wonder to METER_MAX and emits `created`; then it drains again. Jev's needs line doesn't mention wonder | automated |
| R-25 | A reply with a run that adds a pond via the world's `structure`; a reply whose edit defines a helper its run uses; runs that throw, return a non-record, or have no definition; the default world after a Sonnet run vs. another author's run | The pond appears once and stays single over later ticks; the source and version are unchanged; chat shows `run`; `core.reflective-mind-runs` is 1. The run sees the same reply's helper. A failed run is a chat error, leaves the state unchanged, and starts no repair. Only the Sonnet run fills wonder | automated |
| R-29 | A conversation grown past COMPACT_AT_CHARS; a reflection that finishes while the summary is pending; a second compaction; a reply with no summary; no `reflective-mind-compaction` | The compaction request carries the oldest turns (at least COMPACT_CHUNK_CHARS, cut after an assistant turn), the same system blocks, no structured output, and the MIAL instructions. Afterwards the block comes first, followed by the kept turns unchanged, including the one added meanwhile, and a `memory` chat entry shows the summary. A second compaction includes the first block. No summary changes nothing. With no instructions definition, the request is just `{type: summarize}` | automated |
| R-28 | Sonnet calls with and without stored turns: a reply with thinking and an edit, a failed call, a reload, a factory reset with a reply still in flight | Cache breakpoints on the preamble, the source and the newest user turn; the status is a system message last. A reply is stored as a user/assistant pair of plain text, sent back byte for byte, with no thinking. The next user turn carries only new entries (the edit confirmation, the neighbour) and never the mind's own words. A failed call stores nothing and its entries go into the next turn. The conversation survives a reload; a factory reset clears it and drops the late reply | automated |
| R-27 | Sonnet replies with core requests, one empty; `deleteRequest` with a valid and with bad indexes; a reload; a factory reset | Each non-empty request is appended to `getRequests()` with its time and tick. A delete removes exactly that one; a bad index changes nothing. The list survives a reload and a factory reset clears it | automated |
| R-26 | `uploadSource(text, name)` with an edited copy of the source; text with no definitions; an upload into a halted world | It becomes the next version, authored `user` with the comment "upload <name>", snapshotted and revertable; the state is unchanged. Text with no `# definition` is rejected with no change. An upload clears `halted` | automated |
| R-24 | Default world; an EMOJI edit changing one and adding one; a structure with its own `emoji` field; EMOJI not a record, or deleted | Every default place and the inhabitant has an emoji. The edit shows in `getRenderData().emoji`. The structure's emoji reaches render data. A bad or missing EMOJI gives an empty map, never a throw | automated |
| R-23 | Default world: walking 5 tiles to the well vs. an idle twin; walking with food, water and rest near 0 | The walker has paid exactly 5 × MOVE_COST more food, water and rest, and nothing more of wood or wonder. Meters stay ≥ 0 | automated |
| R-22 | The default world, an edit written in expanded form, and literals of every kind | Every stored version (and its snapshot) is the compact form of its source: a bullet's leading atoms share its line. The parsed tree is unchanged | automated |

## U — UI / readability

Checked by `node test/browser.js` (Chromium via Playwright, `?fake` minds, file:// URL). It writes screenshots to `test/screenshots/`.

| ID | Criterion | Instrument |
|---|---|---|
| U-1 | Double-clicking `index.html` (file://) loads with no console errors and no server | automated |
| U-2 | The world canvas and the chat sit side by side and each takes a usable share of a 1280px-wide window | automated |
| U-3 | Each meter has a labelled bar, and a meter below the threshold looks distinct. Half speed is visible (a "slow" badge) | automated |
| U-4 | Each chat kind (user, inhabitant, jev, reflective-mind-thought, edit, core-request, error, system) is visually distinct. Core requests are highlighted | automated |
| U-5 | The edit list shows version, author, time, comment, and the names touched, with no diff | automated |
| U-6 | The toolbar has play/pause/step, new game, download MIAL, settings (keys), factory reset, and call counters | automated |
| U-7 | Places and the inhabitant are drawn as their emoji. A structure the models add with no emoji appears as a generic labelled shape, and an EMOJI edit redraws it as its emoji | automated |
| U-8 | The Stats button opens a dialog showing the core stats and each world stats record | automated |
| U-9 | Upload MIAL loads a chosen file as a new version in the edit list. The Requests button shows a count and opens a list of the inhabitant's core requests, each with an ✕ that removes it | automated |

## X — Experience

| ID | Criterion | Linked decision |
|---|---|---|
| X-1 | With default settings, the inhabitant stays mostly above the threshold. Fails if it spends most of a 15-minute session at half speed | D-10 |
| X-2 | Within 30 minutes of play, Sonnet makes at least one edit that changes behavior you can observe. Fails if most of 3 sessions have none | D-7, G-1 |
| X-3 | When Sonnet's edit breaks the world, it's repaired without you. Fails if most breakages end halted | D-8 |
| X-4 | A 30-minute session costs no more than you're comfortable spending (measure dollars per session with the counters) | D-12 |
| X-5 | You can explain any action the inhabitant took from the chat alone | G-4 |

## Status

2026-11-01. `npm test` covers R-1 to R-29, plus the coverage test, an embed check, and a settings unit test. `node test/browser.js` covers U-1 to U-9. Both pass.

**X-rows (playtest only):** X-1 is measured only with stand-in policies (`tools/tune.js`, see D-10). X-2 to X-5 need sessions with real keys.

**Partial coverage, honestly:**
- R-4 checks the `speed` definition directly. It doesn't check that `move` uses it (R-5 covers movement only at full speed).
- R-11 covers a runtime error, a missing definition, and a wrong return type in `tick`. Step-budget and stack-overflow errors reach repair through the same path, but no test drives them through the game.
- R-13 checks the Jev gap and the in-flight rule for Jev, and the Sonnet gap through user messages. It doesn't check a Sonnet trigger from `reflective-mind-trigger?` firing inside the gap.
- R-15 compares one counter (`jevCalls`). It doesn't check that a download excludes keys; downloads contain only the world source, by construction.
- U-1 runs in Chromium only. Firefox and Safari on file:// are unchecked.
- The real network path (`js/api.js`: CORS from file://, headers, the fallbacks beta) has no automated check. The first real-key session is the test.
