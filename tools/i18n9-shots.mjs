// i18n day 9 screenshots: the watch-mode tempo line under the folded seal on the Flip cover (D-155) and the
// pace / rank cards translated in this round.
// Built game: npm run build; npx vite preview --port 5194 --strictPort.
//   node tools/i18n9-shots.mjs [baseUrl] [case ...] [lang=xx] -> docs/shots/i18n9-<case>-<w>x<h>-<lang>.jpg
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5194/';
const langs = (args.find((a) => a.startsWith('lang=')) ?? 'lang=pl').slice(5).split(',');
const ALL = {
  // XI at 5:00 (D-127): every wagon on the road -> "tempo: kup wóz" under the seal; then the tap opens the farm's sheet
  'flip-fleet': { q: 'play=m11&ff=300&speed=0', w: 360, h: 380 },
  'flip-fleet-tap': { q: 'play=m11&ff=300&speed=0', w: 360, h: 380, tap: true },
  // VII at 1:30: one fisher too slow -> "tempo: za mało ryb"
  'flip-producer': { q: 'play=m7&ff=90&speed=0', w: 360, h: 380 },
  // the HUD cards on a phone
  'card-fleet': { q: 'play=m11&ff=300&speed=0', w: 412, h: 915 },
  'card-producer': { q: 'play=m7&ff=90&speed=0', w: 412, h: 915 },
  'card-rank': { q: 'play=sandbox&speed=0', w: 412, h: 915, ticks: 200 },
};
const pick = args.filter((a) => ALL[a]);
const cases = pick.length ? pick : Object.keys(ALL);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const lang of langs) for (const id of cases) {
  const c = ALL[id];
  const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => errors.push(`${id} ${lang}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${id} ${lang}: ${m.text()}`); });
  await page.goto(`${base}?${c.q}&quality=low&dynres=0&debug=1&lang=${lang}`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  if (c.ticks) {
    await page.evaluate((n) => {
      const A = window.__marchia.app;
      while (A.world.state.tick < n) A.loop.tickOnce();
    }, c.ticks);
  }
  await page.evaluate(() => document.querySelectorAll('.rank-letter-wrap, .notice-wrap').forEach((e) => e.remove()));
  await page.waitForTimeout(1500);
  if (c.tap) { await page.evaluate(() => document.querySelector('.seal-tempo:not([hidden])')?.click()); await page.waitForTimeout(1500); }
  const info = await page.evaluate(() => ({
    tempo: document.querySelector('.seal-tempo:not([hidden])')?.textContent?.trim() ?? null,
    card: document.querySelector('.stall-row:not([hidden]) .stall-card')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    sheet: document.querySelector('#sheets .sheet:last-child .fix-btn')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
  }));
  console.log(`${id} ${lang}`, JSON.stringify(info));
  await page.screenshot({ path: `docs/shots/i18n9-${id}-${c.w}x${c.h}-${lang}.jpg`, type: 'jpeg', quality: 70, timeout: 120000 });
  await ctx.close();
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
