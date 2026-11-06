// D-264 screenshots: the grow card when the next rank lacks silver flow. A staged state (speed 0): the free valley at
// 1:00 lifted to rank 3 with renown past rank 4's 7 200 and the seven goods of ranks 1-3 sold, but the best flow at
// 100 of the 120 silver a minute rank 4 needs, so:
//   fame-hud-<w>x<h>.jpg    — the calm slot's grow card: "Do rangi 4 (…) brakuje przepływu srebra — postaw jeszcze: …";
//   fame-sheet-<w>x<h>.jpg  — its eye: the subject's sheet with "Postaw: …" and the flow line.
// Built game: npm run build; npx vite preview --outDir dist --port 5202 --strictPort.
//   node tools/fame-shots.mjs [baseUrl] [WxH ...]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5202/';
const picked = args.filter((a) => /^\d+x\d+$/.test(a)).map((s) => s.split('x').map(Number));
const sizes = picked.length ? picked : [[412, 915], [915, 412]];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const tx = (s) => s?.replace(/\s+/g, ' ').trim() ?? null;
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => errors.push(`${w}x${h}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${w}x${h}: ${m.text()}`); });
  await page.goto(`${base}?play=sandbox&ff=60&speed=0&quality=low&dynres=0&debug=1&lang=pl`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const app = window.__marchia.app, st = app.world.state;
    st.town.rank = 3;
    st.town.renown = Math.max(st.town.renown, 8000);
    st.town.bestFlow = 100;
    st.coins = Math.max(st.coins, 900);
    for (const g of ['wood', 'planks', 'grain', 'flour', 'bread', 'fish', 'stone']) st.ledger.sold[g] = Math.max(1, st.ledger.sold[g]);
    st.netVersion++;
    app.sheets.closeAll();
  });
  // the rank-up letter (rank 3 staged): dismissed as a player would (one gesture)
  await page.waitForTimeout(3000);
  await page.evaluate(() => document.querySelector('.rank-letter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(8000);
  console.log(`${w}x${h} hud`, tx(await page.evaluate(() => document.querySelector('.stall-row')?.textContent)));
  await page.screenshot({ path: `docs/shots/fame-hud-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  await page.click('.stall-row .stall-eye');
  await page.waitForTimeout(6000);
  console.log(`${w}x${h} sheet`, tx(await page.evaluate(() => document.querySelector('#sheets .sheet:last-child .fix-dock')?.textContent)));
  await page.screenshot({ path: `docs/shots/fame-sheet-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  await ctx.close();
}
await browser.close();
if (errors.length) { console.log('ERRORS\n' + errors.join('\n')); process.exitCode = 1; }
