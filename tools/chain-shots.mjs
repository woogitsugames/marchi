// Short-landscape cause chain (D-111): opens a "Dlaczego stoi?" sheet and reports whether the chain's subject and
// root are inside the visible body above the fix dock; optionally taps "+N" and shoots the unfolded chain.
// Usage: node tools/chain-shots.mjs <outdir> [WxH ...]  (server: npx vite preview --port 5211 --strictPort)
// Env: URL0 (default http://127.0.0.1:5211/), LANG_Q (pl), CASES (comma list), HINGE (flex|book), PREFIX (chain)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL0 = process.env.URL0 ?? 'http://127.0.0.1:5211/';
const lang = process.env.LANG_Q ?? 'pl';
const hinge = process.env.HINGE ?? '';
const prefix = process.env.PREFIX ?? 'chain';
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const sizes = (process.argv.slice(3).length ? process.argv.slice(3) : ['412x915', '915x412']).map((s) => s.split('x').map(Number));
const cases = [
  { id: 'm1-bakery', query: 'play=m1&ff=90&speed=0&open=bakery' },
  { id: 'm6-farm', query: 'play=m6&ff=110&speed=0&open=farm', unfold: true },
  { id: 'm13-castle', query: 'play=m13&ff=10&speed=0&open=castle', unfold: true },
  { id: 'm9-castle', query: 'play=m9&ff=10&speed=0&open=castle', unfold: true },
].filter((c) => !process.env.CASES || process.env.CASES.split(',').includes(c.id));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let errors = 0;
const measure = () => {
  const s = document.querySelector('#sheets .sheet:last-child');
  const body = s?.querySelector('.sheet-body');
  if (!body) return { sheet: false };
  const b = body.getBoundingClientRect();
  const dock = s.querySelector('.fix-dock');
  const floor = dock ? dock.getBoundingClientRect().top : b.bottom;
  const vis = (e) => e && e.getClientRects().length > 0;
  const lis = [...s.querySelectorAll('.chain > li')].filter(vis);
  const r = (e) => { const q = e.getBoundingClientRect(); return [Math.round(q.top), Math.round(q.bottom)]; };
  const first = lis[0], last = lis[lis.length - 1];
  const inside = (e) => { const q = e.getBoundingClientRect(); return q.top >= b.top - 1 && q.bottom <= floor + 1; };
  const more = s.querySelector('.c-more-btn');
  return {
    body: [Math.round(b.top), Math.round(b.bottom)], dockTop: Math.round(floor), scrollTop: body.scrollTop,
    links: lis.map((e) => e.className + r(e).join('-')).join(' '),
    subjectVisible: first ? inside(first) : null, rootVisible: last ? inside(last) : null,
    more: vis(more) ? { h: Math.round(more.getBoundingClientRect().height), text: more.textContent.trim() } : null,
  };
};
for (const [w, h] of sizes) {
  for (const c of cases) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { errors++; console.log('PAGEERROR', e.message); });
    page.on('console', (m) => { if (m.type() === 'error') { errors++; console.log('CONSOLE', m.text()); } });
    await page.goto(`${URL0}?debug=1&lang=${lang}&quality=low&dynres=0&${c.query}`);
    await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
    if (hinge) {
      await page.evaluate((k) => {
        window.__marchiaFold = k === 'flex'
          ? { state: 'HALF_OPENED', orientation: 'HORIZONTAL', x: 0, y: Math.round(innerHeight / 2) - 10, w: innerWidth, h: 20 }
          : { state: 'HALF_OPENED', orientation: 'VERTICAL', x: Math.round(innerWidth / 2) - 10, y: 0, w: 20, h: innerHeight };
        window.dispatchEvent(new Event('marchia:fold'));
      }, hinge);
    }
    const start = page.locator('.letter [data-a="start"]');
    if (await start.count()) { await start.first().click(); await page.waitForTimeout(800); }
    await page.waitForSelector('#sheets .sheet', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const tag = `${w}x${h}${hinge ? '-' + hinge : ''}${lang === 'pl' ? '' : '-' + lang}`;
    console.log(tag, c.id, JSON.stringify(await page.evaluate(measure)));
    await page.screenshot({ path: `${out}/${prefix}-${c.id}-${tag}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
    const more = page.locator('#sheets .sheet:last-child .c-more-btn');
    if (c.unfold && await more.isVisible().catch(() => false)) {
      await more.tap();
      await page.waitForTimeout(1500);
      console.log(tag, c.id + ' unfolded', JSON.stringify(await page.evaluate(measure)));
      await page.screenshot({ path: `${out}/${prefix}-${c.id}-open-${tag}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
    }
    await ctx.close();
  }
}
await browser.close();
console.log('ERRORS', errors);
