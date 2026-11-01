// Core-owned constants (ONTOLOGY §6, core table). MIAL-owned numbers live in the world source.
// EVAL_STEP_LIMIT lives in mial.js next to the evaluator it limits.
var BL = window.BL = window.BL || {};

BL.CONFIG = {
  TICK_MS: 250,
  JEV_MIN_GAP_MS: 2000,        // default; adjustable in settings (D-12)
  SONNET_MIN_GAP_MS: 10000,    // default; adjustable in settings (D-12)
  REPAIR_MAX: 3,
  EVENT_HISTORY_N: 30,
  CHAT_HISTORY_N: 20,
  SAVE_EVERY_TICKS: 20,
  MAX_CHAT: 500,
  MAX_VERSIONS: 200,
  JEV_MODEL: 'typesafe/jev-router',
  JEV_MAX_TOKENS: 1024,
  // "Sonnet" is the role name of the reflective mind (sonnet-system, sonnet-prompt, ...);
  // the model filling the role, and the name the UI shows, are these two (D-17).
  SONNET_MODEL: 'claude-haiku-5-5',
  SONNET_NAME: 'Haiku',
  SONNET_MAX_TOKENS: 16000,
};
