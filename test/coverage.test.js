// Coverage: every `automated` R-row in CRITERIA.md owns test/R-n/ with a test in it, and vice versa.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./helpers/env');

const FORMS = [/^automated$/, /^manual — .+/, /^not yet covered$/, /^retired$/];

const rows = () => fs.readFileSync(path.join(ROOT, 'CRITERIA.md'), 'utf8').split('\n')
  .filter(l => /^\| R-\d+ \|/.test(l))
  .map(l => {
    const cells = l.split('|').map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
    return { id: cells[0], instrument: cells.at(-1) };
  });

test('every Instrument cell is one of the four forms', () => {
  for (const r of rows()) assert.ok(FORMS.some(f => f.test(r.instrument)), `${r.id}: "${r.instrument}"`);
});

test('automated rows and test/R-n directories match', () => {
  const testDir = path.join(ROOT, 'test');
  const dirs = fs.readdirSync(testDir).filter(d => /^R-\d+$/.test(d));
  const withTests = new Set(dirs.filter(d => fs.readdirSync(path.join(testDir, d)).some(f => f.endsWith('.test.js'))));
  const automated = new Set(rows().filter(r => r.instrument === 'automated').map(r => r.id));
  for (const id of automated) assert.ok(withTests.has(id), `${id} is automated but test/${id}/ has no test`);
  for (const d of dirs) assert.ok(automated.has(d), `test/${d}/ exists but ${d} is not automated in CRITERIA.md`);
});
