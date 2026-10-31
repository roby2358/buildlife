// js/world_default.js must be regenerated whenever world/default_world.md changes.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadBL, ROOT } = require('../helpers/env');

test('embedded default world matches world/default_world.md (run npm run embed)', () => {
  assert.strictEqual(loadBL().DEFAULT_WORLD, fs.readFileSync(path.join(ROOT, 'world/default_world.md'), 'utf8'));
});
