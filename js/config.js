// Core-owned constants (ONTOLOGY §6, core table). MIAL-owned numbers live in the world source.
// EVAL_STEP_LIMIT lives in mial.js next to the evaluator it limits.
var BL = window.BL = window.BL || {};

BL.CONFIG = {
  TICK_MS: 250,
  JEV_MIN_GAP_MS: 2000,        // default; adjustable in settings (D-12)
  SONNET_MIN_GAP_MS: 10000,    // default; adjustable in settings (D-12)
  REPAIR_MAX: 3,
  EVENT_HISTORY_N: 30,
  CHAT_HISTORY_N: 20,          // most new chat entries carried into one user turn
  COMPACT_AT_CHARS: 20000,     // conversation size (summary + turns) that triggers compaction (D-40)
  COMPACT_CHUNK_CHARS: 10000,  // at least this much of the oldest conversation is summarized
  COMPACT_MAX_TOKENS: 8000,
  SAVE_EVERY_TICKS: 20,
  MAX_CHAT: 500,
  MAX_VERSIONS: 200,
  JEV_MODEL: '~typesafe/jev-latest', // System One alias for the newest Jev: a choice and probabilities, never text (D-41)
  // "Sonnet" is the role name of the reflective mind (reflective-mind-system, reflective-mind-prompt, ...);
  // the model filling the role, and the name the UI shows, are these two (D-17).
  // The reflective mind's model, chosen in Settings (D-43). Each runs with the least thinking it
  // allows: Haiku off, Sonnet 5.5 between_tools (it rejects "disabled"; with no tools that's none),
  // Opus 5.5 can't turn thinking off, so low effort. Opus opts into server-side refusal fallback.
  REFLECTIVE_MODELS: {
    'claude-haiku-5-5': { name: 'Haiku', thinking: { type: 'disabled' }, perReflection: '≈ $0.001' },
    'claude-sonnet-5-5': { name: 'Sonnet', thinking: { type: 'between_tools' }, perReflection: '≈ $0.015' },
    'claude-opus-5-5': { name: 'Opus', thinking: { type: 'adaptive', display: 'summarized' }, effort: 'low', fallbacks: 'default', perReflection: '≈ $0.04' },
  },
  SONNET_MODEL: 'claude-haiku-5-5', // the default choice
  SONNET_MAX_TOKENS: 16000,
};
