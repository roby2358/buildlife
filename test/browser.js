// Browser check for the U-criteria. Loads index.html from file:// (as a double-click would)
// with ?fake minds, walks every screen, saves screenshots to test/screenshots/, and fails on
// console errors or a failed check.
// Usage: node test/browser.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const checks = [];
const check = (id, ok, detail) => {
  checks.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`);
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());

  await page.goto('file://' + path.join(ROOT, 'index.html') + '?fake');
  await page.waitForFunction(() => window.BL && BL.app);
  check('U-1', errors.length === 0, 'loads from file:// with no console errors');

  const world = await page.locator('.world-pane').boundingBox();
  const side = await page.locator('.side-pane').boundingBox();
  check('U-2', world.width > 400 && side.width > 320 && Math.abs(world.y - side.y) < 2, `side by side: world ${Math.round(world.width)}px, chat ${Math.round(side.width)}px`);

  const toolbar = ['#playBtn', '#stepBtn', '#newGameBtn', '#downloadBtn', '#uploadBtn', '#requestsBtn', '#settingsBtn', '#resetBtn', '#counters'];
  const visible = await Promise.all(toolbar.map(s => page.locator(s).isVisible()));
  check('U-6', visible.every(Boolean), 'toolbar controls and counters visible');

  // Run the world with fake minds until Jev, Sonnet, an edit and a core request have all appeared.
  await page.click('#playBtn');
  await page.evaluate(() => BL.app.game.setSettings({ jevGapMs: 0, sonnetGapMs: 0 }));
  await page.fill('#chatInput', 'Hello there!');
  await page.click('#chatForm button');
  // A second message prompts the fake Sonnet's second reflection, which files a core request.
  await page.waitForSelector('.msg-inhabitant', { timeout: 15000 }).catch(() => {});
  await page.fill('#chatInput', 'Anything you would like changed in the core?');
  await page.click('#chatForm button');
  const kinds = ['user', 'inhabitant', 'auto-mind', 'reflective-mind-thought', 'edit', 'core-request'];
  await page.waitForFunction((ks) => ks.every(k => document.querySelector(`.msg-${k}`)), kinds, { timeout: 60000 }).catch(() => {});
  const present = await page.evaluate((ks) => ks.filter(k => document.querySelector(`.msg-${k}`)), kinds);
  const styles = await page.evaluate((ks) => ks.map(k => {
    const el = document.querySelector(`.msg-${k}`);
    if (!el) return null;
    const s = getComputedStyle(el);
    return `${s.borderLeftColor}|${s.borderRightColor}|${s.backgroundColor}|${s.fontStyle}|${s.fontSize}`;
  }), kinds);
  check('U-4', present.length === kinds.length && new Set(styles).size === kinds.length, `chat kinds present and distinct: ${present.join(', ')}`);
  await page.screenshot({ path: path.join(SHOTS, 'running.png') });

  // Meters: force one low and check the bar and the slow badge.
  await page.click('#playBtn'); // pause
  await page.evaluate(() => {
    const g = BL.app.game;
    g.applyEdit({ comment: 'test: make water low', source: '# DECAY\n- mial\n  - record\n    - water\n      - `90`\n' });
    g.step();
  });
  await page.waitForTimeout(200);
  const meterCount = await page.locator('.meter').count();
  const lowShown = await page.locator('.meter.low').count();
  const slowBadge = await page.locator('#slowBadge').isVisible();
  const meterNames = await page.evaluate(() => Object.keys(BL.app.game.getRenderData().meters).length);
  check('U-3', meterCount === meterNames && meterCount >= 4 && lowShown >= 1 && slowBadge, `${meterCount} labelled bars, ${lowShown} shown low, slow badge ${slowBadge}`);
  await page.screenshot({ path: path.join(SHOTS, 'low-meter.png') });

  // A structure invented by the models is drawn as a generic labelled shape.
  const before = await page.evaluate(() => document.getElementById('world').toDataURL());
  await page.evaluate(() => {
    const g = BL.app.game;
    g.applyEdit({ comment: 'test: add a pond', source: '# tick\n- state\n- put state `"structures"`\n  - append\n    - get state `"structures"`\n    - list\n      - structure `"pond"` `5` `9` `"water"` `1`\n' });
    g.step();
  });
  await page.waitForTimeout(300);
  const pond = await page.evaluate(() => BL.app.game.getRenderData().structures.some(s => s.name === 'pond'));
  const after = await page.evaluate(() => document.getElementById('world').toDataURL());
  await page.screenshot({ path: path.join(SHOTS, 'new-structure.png') });
  // Giving it an emoji through EMOJI redraws it.
  await page.evaluate(() => {
    const src = BL.app.game.getSource().match(/# EMOJI\n[\s\S]*?(?=\n# |$)/)[0].trimEnd();
    BL.app.game.applyEdit({ comment: 'test: pond emoji', source: src + '\n    - pond `"🦆"`\n' });
  });
  await page.waitForTimeout(300);
  const withEmoji = await page.evaluate(() => document.getElementById('world').toDataURL());
  const pondEmoji = await page.evaluate(() => BL.app.game.getRenderData().emoji.pond);
  check('U-7', pond && before !== after && pondEmoji === '🦆' && withEmoji !== after, 'new "pond" drawn generic, then redrawn as its emoji after an EMOJI edit');
  await page.screenshot({ path: path.join(SHOTS, 'new-structure-emoji.png') });

  // Edit list: version, author, time, comment, names, revert buttons, no diff.
  await page.click('.tab[data-tab="edits"]');
  const editItems = await page.locator('.edit').count();
  const firstHead = await page.locator('.edit .edit-head').first().textContent();
  const hasRevert = await page.locator('.edit .btn:not([disabled])').count();
  check('U-5', editItems >= 3 && /^v\d+ · \w+ · .+ · tick \d+$/.test(firstHead) && hasRevert > 0, `${editItems} edits, head "${firstHead}"`);
  await page.screenshot({ path: path.join(SHOTS, 'edits.png') });

  await page.click('#statsBtn');
  await page.waitForTimeout(100);
  const statsTables = await page.locator('#statsBody table').count();
  const statsText = await page.locator('#statsBody').textContent();
  check('U-8', statsTables >= 2 && /auto-mind-decisions/.test(statsText) && /low-ticks/.test(statsText), `stats dialog shows ${statsTables} tables (core and world)`);
  await page.screenshot({ path: path.join(SHOTS, 'stats.png') });
  await page.keyboard.press('Escape');

  // Requests: the fake mind's core request is listed with a count, and ✕ removes it.
  const reqBefore = await page.evaluate(() => BL.app.game.getRequests().length);
  const countText = await page.locator('#requestCount').textContent();
  await page.click('#requestsBtn');
  await page.waitForTimeout(100);
  const listed = await page.locator('#requestList .request').count();
  await page.screenshot({ path: path.join(SHOTS, 'requests.png') });
  if (listed) await page.locator('#requestList .request-delete').first().click();
  await page.waitForTimeout(100);
  const listedAfter = await page.locator('#requestList .request').count();
  await page.keyboard.press('Escape');

  // Upload: a file goes in as a new version in the edit list.
  const vBefore = await page.evaluate(() => BL.app.game.getVersion());
  const src = await page.evaluate(() => BL.app.game.getSource());
  await page.setInputFiles('#uploadInput', { name: 'my-world.md', mimeType: 'text/markdown', buffer: Buffer.from(src) });
  await page.waitForFunction((v) => BL.app.game.getVersion() === v + 1, vBefore, { timeout: 3000 }).catch(() => {});
  const uploaded = await page.evaluate(() => BL.app.game.getEditLog().at(-1).comment);
  const topEdit = await page.locator('.edit .edit-comment').first().textContent();
  check('U-9', reqBefore >= 1 && countText === `(${reqBefore})` && listed === reqBefore && listedAfter === reqBefore - 1 &&
    uploaded === 'upload my-world.md' && topEdit === uploaded && await page.locator('#uploadBtn').isVisible(),
    `requests ${listed} listed → ${listedAfter} after ✕; upload added "${uploaded}"`);

  await page.click('#settingsBtn');
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(SHOTS, 'settings.png') });
  await page.keyboard.press('Escape');

  check('console', errors.length === 0, errors.length ? errors.join(' | ') : 'no console errors during the walk');
  await browser.close();
  const failed = checks.filter(c => !c.ok);
  console.log(`${checks.length - failed.length}/${checks.length} browser checks passed`);
  process.exit(failed.length ? 1 : 0);
})();
