// Day 9a screenshots: the pace card's fleet kind (D-127), mission XI: the farm waits for a wagon while all three are on the road.
// Built game: npm run build; npx vite preview --port 5194 --strictPort.
//   node tools/day9a-shots.mjs [baseUrl] [case ...] [WxH ...] [lang=xx] -> docs/shots/day9a-<case>-<w>x<h>[-xx].jpg
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5194/';
const sizes = args.filter((a) => /^\d+x\d+$/.test(a)).map((s) => s.split('x').map(Number));
const lang = (args.find((a) => a.startsWith('lang=')) ?? 'lang=pl').slice(5);
const ALL = {
  // XI at 5:00: the farm's yard has waited ~40 s, all three wagons on the road, the forecast misses 3 seals
  'm11-card': { q: 'play=m11&ff=300&speed=0' },
  'm11-sheet': { q: 'play=m11&ff=300&speed=0', eye: true },
  // I lost (two wagons, no crossing): the loss letter's action line for the #1 cause (D-130)
  'm1-lost': { q: 'play=m1&ff=730&speed=0' },
};
const pick = args.filter((a) => ALL[a]);
const cases = pick.length ? pick : Object.keys(ALL);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const [w, h] of sizes.length ? sizes : [[412, 915], [915, 412]]) for (const id of cases) {
  const c = ALL[id];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => errors.push(`${id} ${w}x${h}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${id} ${w}x${h}: ${m.text()}`); });
  await page.goto(`${base}?${c.q}&quality=low&dynres=0&debug=1&lang=${lang}`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  if (c.pre === 'wagon') {
    // buy one wagon first (the "scan" player's first tap), so the next one would cost the stone bridge
    await page.evaluate(() => { const a = window.__marchia.app; a.buyWagonFromRail(); a.buyWagonFromRail(); a.loop.flushCommands(); });
  }
  await page.waitForTimeout(1500);
  if (c.eye) { await page.evaluate(() => document.querySelector('.stall-eye')?.click()); await page.waitForTimeout(1500); }
  if (c.fix) { await page.evaluate(() => document.querySelector('#sheets .sheet:last-child .fix-btn')?.click()); await page.waitForTimeout(1500); }
  const info = await page.evaluate(() => ({
    card: document.querySelector('.stall-row:not([hidden]) .stall-card')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    fix: document.querySelector('#sheets .sheet:last-child .fix-btn')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    hint: document.querySelector('#sheets .sheet:last-child .fix-note, #sheets .sheet:last-child .fix-why')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
  }));
  console.log(`${id} ${w}x${h}`, JSON.stringify(info));
  await page.screenshot({ path: `docs/shots/day9a-${id}-${w}x${h}${lang === 'pl' ? '' : '-' + lang}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  await ctx.close();
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
