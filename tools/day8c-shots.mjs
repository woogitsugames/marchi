// Day 8c screenshots: the pace card (VII: one fisher too slow), the mud line (III), the ice-ahead warning (IV).
// Built game: npm run build; npx vite preview --port 5211.
//   node tools/day8c-shots.mjs [baseUrl] [case ...] [WxH ...] [lang=xx] -> docs/shots/day8c-<case>-<w>x<h>[-xx].jpg
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5211/';
const sizes = args.filter((a) => /^\d+x\d+$/.test(a)).map((s) => s.split('x').map(Number));
const lang = (args.find((a) => a.startsWith('lang=')) ?? 'lang=pl').slice(5);
const ALL = {
  // VII: the card names the lone fisher; the eye opens its sheet with "Postaw jeszcze: Rybak"
  'm7-card': { q: 'play=m7&ff=90&speed=0' },
  'm7-sheet': { q: 'play=m7&ff=90&speed=0', eye: true },
  'm7-ghost': { q: 'play=m7&ff=90&speed=0', eye: true, fix: true },
  'm3-card': { q: 'play=m3&ff=40&speed=0' },
  'm3-sheet': { q: 'play=m3&ff=170&speed=0', eye: true },
  'm4-card': { q: 'play=m4&ff=40&speed=0&bot=0', pre: 'wagon' },
  'm4-sheet': { q: 'play=m4&ff=40&speed=0', pre: 'wagon', eye: true },
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
    await page.evaluate(() => { const a = window.__marchia.app; a.hud ? a.buyWagon?.() : null; });
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
  await page.screenshot({ path: `docs/shots/day8c-${id}-${w}x${h}${lang === 'pl' ? '' : '-' + lang}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  await ctx.close();
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
