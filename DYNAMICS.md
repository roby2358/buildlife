# DYNAMICS.md — BuildLife

Why it's worth watching. Numbers are referred to by name. Their values are in ONTOLOGY §6.

## Theme
A small creature in a small world, guided by two minds, that is allowed to rewrite the rules of its own world. You're a neighbour who can talk to it over the fence.

## Drivers

1. **Two minds, one body.** Jev's quick choices against Sonnet's slower intentions. The interesting moments are when they disagree, or when Sonnet rewrites Jev's prompt to fix something it keeps doing.
   *Key mechanic:* the Jev call and Sonnet call rules, plus Sonnet's ability to edit `jev-system`/`jev-prompt`.
2. **The world drifts.** The starting rules are a seed, not a law. Every edit is a small story with a reason attached.
   *Key mechanic:* the apply-edit rule and the commented edit list.
3. **You have influence, not control.** You can persuade the inhabitant, but you can't edit its world.
   *Key mechanic:* the chat (`sendUserMessage`) reaching Sonnet, who decides what to change.

## Secondary mechanics, woven in
- **The half-speed penalty** makes neglect visible without ending the game. A low meter is a soft prompt for both minds.
- **Real time** means latency matters. A slow decision costs something.
- **Repair** turns a broken world into a drama (break → fix) rather than a dead end.

## Phases of a session
1. **Routine:** Jev cycles through structures on default rules.
2. **First reflection:** Sonnet notices patterns (for example, oscillating between the bush and the well) and tunes Jev's prompt or the cadence.
3. **Reinterpretation:** wood gets a meaning, structures get new behaviour, and notes definitions appear.
4. **Experiments and accidents:** breakages, repairs, reverts.

## Anti-strategies

| Anti-strategy | Prevention | Criteria |
|---|---|---|
| Sonnet triggers itself every tick (cost runaway) | Core JEV_MIN_GAP_MS and SONNET_MIN_GAP_MS floors and a single in-flight call per model (D-12) | R-13 |
| Repair loop that never succeeds | REPAIR_MAX, then halt (D-8) | R-11 |
| Infinite recursion freezing the tab | EVAL_STEP_LIMIT and stack-overflow capture (D-8) | R-2 |
| An edit erases Sonnet's knowledge of how to edit | CORE_PREAMBLE is core and not editable (D-16) | R-14 |
| State reshaped so the canvas can't draw it | Defensive render contract (ONTOLOGY render contract) | R-16 |
| Jev invents an action | Schema enum plus a check against `actions` on arrival | R-12 |
| Jev is never asked again (cadence broken to always-false) | **Not prevented** (D-24): you see the idle inhabitant and can chat, which triggers Sonnet | — |
| Decay set to 0, so the world becomes trivial | **Not prevented** by design (D-24): it's a legitimate outcome, logged as an edit | X-2 |

## Strategy ↔ mechanic cross-check
- Routine uses decay, movement, use, action, and cadence.
- Reflection uses the Sonnet call, apply edit, and editable prompts.
- Reinterpretation uses apply edit, host built-ins, Records, and the defensive render contract for new structures.
- Accidents use repair, revert (D-22), and persistence.
- Every rule is used. Slowdown is used by routine (it creates the urgency that makes cadence matter).
