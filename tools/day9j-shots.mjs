// Day 9j screenshots (D-174 follow-up, D-178): the calm "rynek nasycony" line on a full granary in the free valley.
// A staged state (no ticks run at speed 0): the sandbox at 1:00, its granary filled with wood, the castle's wood
// price on the floor and the trading post's wood in flight at its limit — the saturated market of D-174 without
// playing the 60-minute card-only run that produces it.
// Built game: npm run build; npx vite preview --port 5194 --strictPort.
//   node tools/day9j-shots.mjs [baseUrl] [WxH ...] -> docs/shots/day9j-market-full-<w>x<h>.jpg
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5194/';
const picked = args.filter((a) => /^\d+x\d+$/.test(a)).map((s) => s.split('x').map(Number));
const sizes = picked.length ? picked : [[412, 915], [915, 412]];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => errors.push(`${w}x${h}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${w}x${h}: ${m.text()}`); });
  await page.goto(`${base}?play=sandbox&ff=60&speed=0&quality=low&dynres=0&debug=1&lang=pl&view=flat`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const app = window.__marchia.app, st = app.world.state;
    const wh = st.buildings.find((b) => b.type === 'warehouse');
    for (const g of Object.keys(wh.stock)) { wh.stock[g] = 0; wh.reservedOut[g] = 0; }
    wh.stock.wood = 60;
    wh.status = { k: 'STORAGE_FULL' };
    wh.stalledTicks = 900;
    st.market.saturation.wood = 24; // MARKET.cap: price at the floor
    for (const m of st.buildings) if (m.type === 'tradePost') m.incoming.wood = Math.max(m.incoming.wood, 40);
    st.netVersion++;
    app.go('building', wh.id, true);
  });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const sh = document.querySelector('#sheets .sheet:last-child');
    const calm = sh?.querySelector('.calm-hint');
    return {
      calm: calm?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      calmColor: calm ? getComputedStyle(calm).color : null,
      fix: sh?.querySelector('.fix-btn')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      status: sh?.querySelector('.status-line, .chain .l-text')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    };
  });
  console.log(`${w}x${h}`, JSON.stringify(info));
  await page.screenshot({ path: `docs/shots/day9j-market-full-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  await ctx.close();
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
