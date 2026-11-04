// Why-sheet fix visibility (D-100): opens a building sheet and reports whether the fix button is inside the
// sheet body's visible box without scrolling; screenshots to <outdir>.
// Usage: node tools/fix-shots.mjs <outdir> [WxH ...]  (server: npx vite preview --port 5196 --strictPort)
// Env: URL0 (default http://127.0.0.1:5196/), LANG_Q (pl), CASES (comma list of case ids)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL0 = process.env.URL0 ?? 'http://127.0.0.1:5196/';
const lang = process.env.LANG_Q ?? 'pl';
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const sizes = (process.argv.slice(3).length ? process.argv.slice(3) : ['412x915', '915x412']).map((s) => s.split('x').map(Number));
const cases = [
  { id: 'm1-bakery', query: 'play=m1&ff=90&speed=0&open=bakery' },
  { id: 'm1-mill', query: 'play=m1&ff=10&speed=0&open=mill' },
  { id: 'm4-woodcutter', query: 'play=m4&ff=108&speed=0&open=woodcutter' },
].filter((c) => !process.env.CASES || process.env.CASES.split(',').includes(c.id));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let errors = 0;
for (const [w, h] of sizes) {
  for (const c of cases) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { errors++; console.log('PAGEERROR', e.message); });
    page.on('console', (m) => { if (m.type() === 'error') { errors++; console.log('CONSOLE', m.text()); } });
    await page.goto(`${URL0}?debug=1&lang=${lang}&quality=low&dynres=0&${c.query}`);
    await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
    const start = page.locator('.letter [data-a="start"]');
    if (await start.count()) { await start.first().click(); await page.waitForTimeout(800); }
    await page.waitForSelector('#sheets .sheet', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const body = document.querySelector('#sheets .sheet:last-child .sheet-body');
      const btn = document.querySelector('#sheets .sheet:last-child .fix-btn, #sheets .sheet:last-child .fix .s-hint');
      if (!body) return { sheet: false };
      const b = body.getBoundingClientRect();
      const r = btn?.getBoundingClientRect();
      return {
        body: [Math.round(b.top), Math.round(b.bottom)],
        fix: r ? [Math.round(r.top), Math.round(r.bottom), Math.round(r.height)] : null,
        fixVisible: r ? r.top >= b.top - 1 && r.bottom <= b.bottom + 1 : null,
        scrollH: body.scrollHeight, clientH: body.clientHeight,
      };
    });
    const tag = `${w}x${h}${lang === 'pl' ? '' : '-' + lang}`;
    console.log(tag, c.id, JSON.stringify(info));
    await page.screenshot({ path: `${out}/fix-${c.id}-${tag}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
    await ctx.close();
  }
}
await browser.close();
console.log('ERRORS', errors);
