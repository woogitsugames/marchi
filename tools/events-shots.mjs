// Valley events card (D-54) screenshots: sandbox with two royal orders (one accepted, mid-delivery), the
// merchant and an announced fair; portrait, landscape, the unfolded Fold, Arabic RTL and the folded card.
// Usage: node tools/events-shots.mjs <baseUrl> <outDir>   (expects `vite preview` running; ?debug=1 handle)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = (process.argv[2] ?? 'http://127.0.0.1:5311/').replace(/\/?$/, '/');
const out = process.argv[3] ?? 'docs/shots';
mkdirSync(out, { recursive: true });
const VIEWS = { p412: { w: 412, h: 915 }, l915: { w: 915, h: 412 }, f904: { w: 904, h: 1000 } };
const PLAN = [['card', 'p412', 'pl'], ['card', 'l915', 'pl'], ['card', 'f904', 'en'], ['card-ar', 'p412', 'ar'], ['card-ar', 'l915', 'ar'], ['fold', 'p412', 'pl']];

/** Forward the valley: accept the first order at 26:40, stop at 29:20 (fair announced, merchant waiting). */
async function stage(page, fold) {
  await page.evaluate((f) => {
    const A = window.__marchia.app;
    const run = (s) => { while (A.world.state.tick < s * 10) A.loop.tickOnce(); };
    run(1600);
    const o = A.world.state.valleyEvents.orders[0];
    if (o) { A.loop.enqueue({ t: 'orderAccept', id: o.id }); A.loop.flushCommands(); }
    run(1760);
    if (f) document.querySelector('.ev-head')?.click();
    // a clean frame: no rank letter or season notice from the fast-forward over the card
    document.querySelectorAll('.rank-letter-wrap, .notice-wrap').forEach((e) => e.remove());
  }, fold);
}

function measure() {
  const ui = document.getElementById('ui');
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const nm = (e) => e.tagName.toLowerCase() + '.' + String(e.className).trim().split(/\s+/).slice(0, 2).join('.') + ' "' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 22) + '"';
  const small = [], clip = [], off = [];
  for (const e of ui.querySelectorAll('button, [role=button], .tool')) {
    if (!vis(e) || e.closest('#markers') || e.closest('.tutorial')) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 47.5 || r.height < 47.5) small.push(`${nm(e)} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
  }
  for (const e of ui.querySelectorAll('#hud *, #sheets *')) {
    if (!vis(e) || e.tagName === 'svg' || e.closest('svg')) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'inline') continue;
    if (cs.clipPath === 'inset(50%)') continue; // visually hidden text kept for screen readers
    if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && cs.overflowX !== 'auto') clip.push(`${nm(e)} ${e.scrollWidth}>${e.clientWidth}`);
    const r = e.getBoundingClientRect();
    if ((r.right > innerWidth + 1 || r.left < -1) && !e.closest('.bs-cards')) off.push(`${nm(e)} ${Math.round(r.left)}..${Math.round(r.right)}`);
  }
  return { small: small.slice(0, 8), clip: clip.slice(0, 8), off: off.slice(0, 8), hscroll: document.documentElement.scrollWidth > innerWidth };
}

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let errors = 0;
for (const [sid, vid, lang] of PLAN) {
  const name = `events-${sid}-${vid}`;
  const v = VIEWS[vid];
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${base}?play=sandbox&speed=0&quality=low&dynres=0&lang=${lang}&debug=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__marchia?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  await stage(page, sid === 'fold');
  await page.waitForTimeout(2500);
  const m = await page.evaluate(measure);
  await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 80 });
  errors += errs.length;
  console.log(name, JSON.stringify(m), errs.length ? 'ERR ' + errs.join(' | ').slice(0, 300) : '');
  await ctx.close();
}
await browser.close();
console.log('console errors:', errors);
