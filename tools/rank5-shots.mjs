// D-250 screenshots: the rank card names the rank-5 goods' producers. A staged state (speed 0): the free valley at 1:00
// lifted to rank 4 with the seven goods of ranks 1-4 sold (wood, planks, grain, flour, bread, fish, stone) — rank 5
// still lacks two of charcoal, malt and beer, so:
//   rank5-hud-<w>x<h>.jpg    — the calm slot's rank card: "Ranga 5 (…) brakuje towaru — zbuduj: Węglarz";
//   rank5-sheet-<w>x<h>.jpg  — its eye: the castle's sheet with "Postaw: Węglarz";
//   rank5-ghost-<w>x<h>.jpg  — the button pressed: the build tool with the charcoal burner's ghost by the castle.
// Built game: npm run build; npx vite preview --port 5194 --strictPort.
//   node tools/rank5-shots.mjs [baseUrl] [WxH ...] [--lang pl]   (SHOTS_DIR=dir overrides docs/shots)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const li = args.indexOf('--lang');
const lang = li >= 0 ? args[li + 1] : 'pl';
const suffix = lang === 'pl' ? '' : `-${lang}`;
const OUT = process.env.SHOTS_DIR ?? 'docs/shots';
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5194/';
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
  await page.goto(`${base}?play=sandbox&ff=60&speed=0&quality=low&dynres=0&debug=1&lang=${lang}`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const app = window.__marchia.app, st = app.world.state;
    st.town.rank = 4;
    st.coins = Math.max(st.coins, 900);
    for (const g of ['wood', 'planks', 'grain', 'flour', 'bread', 'fish', 'stone']) st.ledger.sold[g] = Math.max(1, st.ledger.sold[g]);
    st.netVersion++;
    app.sheets.closeAll();
  });
  // the rank-up letter (rank 4 staged): dismissed as a player would (one gesture)
  await page.waitForTimeout(3000);
  await page.evaluate(() => document.querySelector('.rank-letter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(8000);
  console.log(`${w}x${h} hud`, tx(await page.evaluate(() => document.querySelector('.stall-row')?.textContent)));
  await page.screenshot({ path: `${OUT}/rank5-hud${suffix}-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  await page.click('.stall-row .stall-eye');
  await page.waitForTimeout(6000);
  console.log(`${w}x${h} sheet`, tx(await page.evaluate(() => document.querySelector('#sheets .sheet:last-child .fix-btn')?.textContent)));
  await page.screenshot({ path: `${OUT}/rank5-sheet${suffix}-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  await page.click('#sheets .sheet:last-child .fix-btn[data-act^="rank:"]');
  await page.waitForTimeout(8000);
  console.log(`${w}x${h} ghost`, JSON.stringify(await page.evaluate(() => ({ tool: window.__marchia.app.tool ?? null, sheets: document.querySelectorAll('#sheets .sheet').length }))));
  await page.screenshot({ path: `${OUT}/rank5-ghost${suffix}-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  await ctx.close();
}
await browser.close();
if (errors.length) { console.log('ERRORS\n' + errors.join('\n')); process.exitCode = 1; }
