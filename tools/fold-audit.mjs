// Fold / small-screen UI audit (docs/research/2026-11-02-fold-audit.md). Measures DOM rects in Playwright.
// Usage: node tools/fold-audit.mjs <baseUrl> [outJson] [shotDir]   (expects `vite preview` already running)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:5201/';
const outJson = process.argv[3] ?? '/tmp/fold-audit.json';
const shotDir = process.argv[4] ?? '/tmp/fold-shots';
mkdirSync(shotDir, { recursive: true });

const VIEWS = [
  { id: 'ref412', w: 412, h: 915 },
  { id: 'phone360', w: 360, h: 740 },
  { id: 'fold904', w: 904, h: 1000 },
  { id: 'fold1000', w: 1000, h: 904 },
  { id: 'flip360', w: 360, h: 380 },
  { id: 'foldflex', w: 904, h: 1000, hinge: { y: 490, h: 20 } },
];
const LOW = 'quality=low&dynres=0';
const fake = () => {
  const A = window.__marchia.app;
  A.unfinished.set('m3', { missionId: 'm3', tick: 12 * 600 + 400, slot: 'auto-m3', savedAt: Date.now() - 3600e3 });
  A.renderMenu();
};
const openCastle = () => { const A = window.__marchia.app; A.go('building', A.world.state.mission.contract.castle, true); };
const SCENES = [
  { name: 'menu', q: '', act: (p) => p.evaluate(fake) },
  { name: 'savesheet', q: '', act: async (p) => { await p.evaluate(fake); await p.evaluate(() => window.__marchia.app.pickMission('m3')); } },
  { name: 'saveask', q: '', act: async (p) => { await p.evaluate(fake); await p.evaluate(() => window.__marchia.app.pickMission('m3')); await p.waitForTimeout(1200); await p.click('.sheet [data-a="ask"]'); } },
  { name: 'pauseask', q: 'play=m3&speed=0', act: async (p) => { await p.evaluate(() => { const A = window.__marchia.app; A.world.state.tick = 7400; A.openGameMenu(); }); await p.waitForTimeout(1200); await p.click('.sheet [data-a="ask"]'); } },
  { name: 'waybill-m7', q: 'play=m7&speed=0&ff=120' },
  { name: 'castle-m7', q: 'play=m7&speed=0&ff=120', act: (p) => p.evaluate(openCastle) },
  { name: 'sawmill-m9', q: 'play=m9&speed=0&ff=120&open=sawmill' },
  { name: 'sawmill-shared', q: 'play=m9&speed=0', act: (p) => p.evaluate(() => {
    const A = window.__marchia.app; const st = A.world.state;
    for (let i = 0; i < 30000; i++) {
      A.loop.tickOnce();
      if (i % 20) continue;
      const b = st.buildings.find((q) => q.type === 'sawmill');
      if (b && ['WAITING_DELIVERY', 'NO_WAGON', 'WAITING_UPSTREAM', 'NO_INPUT'].includes(b.status.k) && st.tick > 1200) { A.go('building', b.id, true); window.__sawTick = st.tick; window.__sawK = b.status.k; return; }
    }
  }) },
];

function measure() {
  const vw = innerWidth, vh = innerHeight;
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const name = (e) => (e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + (e.dataset && e.dataset.a ? `[${e.dataset.a}]` : '') + ' "' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24) + '"');
  const R = (e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; };
  const out = { vw, vh, offscreen: [], small: [], overflow: [], overlaps: [], panels: {}, safe: {} };
  const ui = document.getElementById('ui');
  const all = [...ui.querySelectorAll('*')].filter(vis);
  // off-screen / clipped (skip transient transform-hidden stuff, scroll children inside a scroller)
  const scrollers = (e) => { for (let p = e.parentElement; p && p !== ui; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 1) return true; } return false; };
  for (const e of all) {
    if (e.closest('svg') && e.tagName !== 'svg') continue;
    const r = e.getBoundingClientRect();
    if (e.tagName === 'svg' || e.tagName === 'SPAN' || e.tagName === 'I') continue;
    if ((r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1) && !scrollers(e)) out.offscreen.push({ el: name(e), ...R(e) });
  }
  // touch targets
  const sel = 'button, a[href], [data-a], .hit, .tool, .menu-item, .btn, input, select, [role=button], [role=tab], .rail-stat, .wb-pace-eta, .wb-pace-sup, .wb-row';
  for (const e of ui.querySelectorAll(sel)) {
    if (!vis(e) || scrollers(e) && false) continue;
    // use the hit-area: element rect (pseudo-expanders not measured)
    const r = e.getBoundingClientRect();
    if (r.width < 47.5 || r.height < 47.5) {
      if (e.closest('.waybill') && !e.matches('button,[data-a],.wb-pace-eta,.wb-pace-sup')) continue;
      out.small.push({ el: name(e), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
    }
  }
  // text overflow
  for (const e of all) {
    if (e.tagName === 'svg') continue;
    const cs = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && cs.display !== 'inline') out.overflow.push({ el: name(e), sw: e.scrollWidth, cw: e.clientWidth, ov: cs.overflowX });
  }
  // panels + overlaps
  const P = {
    waybill: '.waybill-wrap', rail: '.rail', sheet: '.sheet', toasts: '.toasts', notice: '.notice-wrap', menu: '.menu-strip', perf: '.perf',
  };
  const rects = {};
  for (const [k, s] of Object.entries(P)) { const e = ui.querySelector(s); if (e && vis(e)) { rects[k] = R(e); } }
  const bubbles = [...document.querySelectorAll('#markers .bubble.is-shown, #markers .bubble')].filter(vis);
  out.panels = rects; out.bubbles = bubbles.length;
  const ov = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  const keys = Object.keys(rects);
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) { const a = ov(rects[keys[i]], rects[keys[j]]); if (a > 40) out.overlaps.push({ a: keys[i], b: keys[j], px2: a }); }
  const ctrl = [...ui.querySelectorAll('.rail-tools, .rail-line')].filter(vis).map(R);
  for (const bb of bubbles) { const br = R(bb); for (const [k, r] of Object.entries(rects)) if (['waybill', 'sheet', 'rail', 'menu'].includes(k) && ov(br, r) > 200) out.overlaps.push({ a: 'bubble@' + br.l + ',' + br.t, b: k, px2: ov(br, r) }); for (const c of ctrl) if (ov(br, c) > 200) out.overlaps.push({ a: 'bubble@' + br.l + ',' + br.t, b: 'railpad', px2: ov(br, c) }); }
  // sheet inner pieces vs waybill (sheet is inside rect check above); scrollable sheet?
  const sh = ui.querySelector('.sheet'); if (sh && vis(sh)) { const sc = [...sh.querySelectorAll('*')].find((e) => ['auto', 'scroll'].includes(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1) || (sh.scrollHeight > sh.clientHeight + 1 ? sh : null); out.sheetScroll = sc ? { sh: sc.scrollHeight, ch: sc.clientHeight } : null; }
  const st = getComputedStyle(document.documentElement);
  out.safe = { b: st.getPropertyValue('--safe-b'), t: st.getPropertyValue('--safe-t') };
  out.body = document.body.className.replace(/mode-\w+|left-handed/g, '').trim();
  out.hscroll = document.documentElement.scrollWidth > vw || document.body.scrollWidth > vw;
  out.paceRows = ui.querySelectorAll('.wb-pace, .pace-fc').length;
  out.shared = ui.querySelectorAll('.shared-hint').length; out.sawTick = window.__sawTick; out.sawK = window.__sawK;
  out.menuItems = ui.querySelectorAll('.menu-item').length;
  return out;
}

const res = [];
const errors = [];
async function job(v, lang, sc) {
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const tag = `${sc.name}|${v.id}|${lang}`;
  try {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`); });
    await page.goto(`${base}?${sc.q ? sc.q + '&' : ''}${LOW}&lang=${lang}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 180000 });
    if (v.hinge) {
      await page.evaluate((h) => { window.__marchiaFold = { state: 'HALF_OPENED', orientation: 'HORIZONTAL', x: 0, y: h.y, w: innerWidth, h: h.h }; window.dispatchEvent(new Event('marchia:fold')); }, v.hinge);
    }
    await page.waitForTimeout(1200);
    if (sc.act) await sc.act(page);
    await page.waitForTimeout(1500);
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => 0))));
    await page.waitForTimeout(800);
    const m = await page.evaluate(measure);
    m.tag = tag; m.scene = sc.name; m.view = v.id; m.lang = lang;
    await page.screenshot({ path: `${shotDir}/${sc.name}-${v.id}-${lang}.png`, timeout: 180000 });
    res.push(m); writeFileSync(outJson, JSON.stringify({ res, errors }, null, 1));
    console.log('ok', tag);
  } catch (e) {
    res.push({ tag, scene: sc.name, view: v.id, lang, error: String(e.message).split('\n')[0] });
    console.log('ERR', tag, String(e.message).split('\n')[0]);
  } finally { await ctx.close(); }
}
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const jobs = [];
for (const sc of SCENES) for (const v of VIEWS) for (const lang of ['pl', 'ar']) jobs.push([v, lang, sc]);
const only = process.env.ONLY;
const list = only ? jobs.filter(([v, l, s]) => new RegExp(only).test(`${s.name}|${v.id}|${l}`)) : jobs;
let i = 0;
await Promise.all(Array.from({ length: Number(process.env.CONC ?? 4) }, async () => { while (i < list.length) { const j = list[i++]; await job(...j); } }));
await browser.close();
writeFileSync(outJson, JSON.stringify({ res, errors }, null, 1));
console.log('done', res.length, 'errors', errors.length);
