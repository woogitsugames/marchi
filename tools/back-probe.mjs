// System back and pause-menu speed probe (D-520..D-522), against a built game.
// Usage: npx vite preview --port 5194 --strictPort; node tools/back-probe.mjs [baseUrl=http://localhost:5194/]
// Flat view (?view=flat): the probe is about the DOM layer, and SwiftShader frames of ~2 s made IndexedDB time out.
// Prints one line per check and `BACK-PROBE bad=N`; exit != 0 on a failed check or a console error.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://localhost:5194/';
let bad = 0;
const check = (name, ok, got) => {
  console.log(`${ok ? 'ok ' : 'BAD'} ${name}${ok ? '' : `  got ${JSON.stringify(got)}`}`);
  if (!ok) bad++;
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 412, height: 915 } })).newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(`${base}?play=m3&debug=1&view=flat&speed=4`);
await page.waitForFunction(() => window.__marchia?.ready);
await page.waitForTimeout(800);
const state = () => page.evaluate(() => {
  const A = window.__marchia.app;
  return { sheets: A.sheets.count, speed: A.loop.speed, key: A.sheets.top?.content.key ?? null };
});
const openCastle = 'const A = window.__marchia.app; A.go("building", A.world.state.mission.contract.castle, true);';
const back = async () => {
  await page.evaluate(() => history.back());
  await page.waitForTimeout(300);
  return page.url().startsWith(base) && page.url().includes('play=');
};

// D-520: a close and an open in one turn — the new sheet keeps its history entry
await page.evaluate(openCastle);
await page.waitForTimeout(300);
await page.evaluate(`document.querySelector('.sheet .close').click(); const B = window.__marchia.app; B.go('building', B.world.state.buildings[1].id, true);`);
await page.waitForTimeout(300);
check('close + open in one turn: a sheet is open', (await state()).sheets === 1, await state());
check('system back stays in the game', await back(), page.url());
check('system back closed that sheet', (await state()).sheets === 0, await state());

// D-521: double tap on the menu button keeps x4
await page.click('.menu-btn');
await page.click('.menu-btn');
await page.waitForTimeout(300);
await page.click('.sheet [data-a="resume"]');
await page.waitForTimeout(300);
check('menu opened twice, resumed: x4 again', (await state()).speed === 4, await state());

// D-522: the Android back hook steps back like Escape
const hook = async () => { const r = await page.evaluate(() => window.__marchiaBack()); await page.waitForTimeout(300); return r; };
check('back hook, nothing open: used', (await hook()) === true, null);
check('... opened the pause menu', (await state()).key === 'gamemenu', await state());
check('back hook, pause menu: used', (await hook()) === true, null);
check('... closed it, x4 again', (await state()).sheets === 0 && (await state()).speed === 4, await state());
await page.evaluate('window.__marchia.app.setTool("road")');
check('back hook, road tool: used', (await hook()) === true, null);
check('... tool away', (await page.evaluate(() => window.__marchia.app.tool)) === 'none', null);

check('no console errors', errs.length === 0, errs);
await browser.close();
console.log(`BACK-PROBE bad=${bad}`);
process.exit(bad ? 1 : 0);
