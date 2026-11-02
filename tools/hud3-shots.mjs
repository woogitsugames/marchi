// HUD v3 (D-43) screenshots: contract HUD, why sheet, pace rows, valley, RTL and foldables.
// Usage: node tools/hud3-shots.mjs <baseUrl> <outDir> [prefix] [filter]   (expects `vite preview` running)
// Prints console errors and a few layout measurements (clipped text, small targets) per shot.
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = (process.argv[2] ?? 'http://127.0.0.1:5311/').replace(/\/?$/, '/');
const out = process.argv[3] ?? '/tmp/hud3';
const prefix = process.argv[4] ?? 'hud3';
const filter = process.argv[5] ?? '';
mkdirSync(out, { recursive: true });

const LOW = 'quality=low&dynres=0';
const VIEWS = {
  p412: { w: 412, h: 915 },
  l915: { w: 915, h: 412 },
  f904: { w: 904, h: 1000 },
  n360: { w: 360, h: 740 },
  flip: { w: 360, h: 380 },
  flex: { w: 904, h: 1000, hinge: { y: 490, h: 20 } },
};
const SCENES = [
  { id: 'm1', q: 'play=m1&bot=1&ff=170&speed=0' },
  { id: 'm1-why', q: 'play=m1&bot=1&ff=170&speed=0', act: 'worst' },
  { id: 'm1-ar', q: 'play=m1&bot=1&ff=170&speed=0&lang=ar' },
  { id: 'm1-why-ar', q: 'play=m1&bot=1&ff=170&speed=0&lang=ar', act: 'worst' },
  { id: 'm1-start', q: 'play=m1&speed=0' },
  { id: 'm7', q: 'play=m7&ff=120&speed=0' },
  { id: 'm7-ar', q: 'play=m7&ff=120&speed=0&lang=ar' },
  { id: 'm7-castle', q: 'play=m7&ff=120&speed=0', act: 'castle' },
  { id: 'm7-castle-ar', q: 'play=m7&ff=120&speed=0&lang=ar', act: 'castle' },
  { id: 'm9', q: 'play=m9&ff=150&speed=0' },
  { id: 'sandbox', q: 'play=sandbox&ff=240&speed=0' },
  { id: 'market', q: 'play=sandbox&ff=240&speed=0&market=1' },
  { id: 'build', q: 'play=sandbox&speed=0&tool=build' },
  { id: 'wagon', q: 'play=m1&bot=1&ff=150&speed=0&wagon=1' },
  { id: 'pause', q: 'play=m3&speed=0', act: 'pause' },
  { id: 'menu', q: '' },
  { id: 'end', q: 'play=m1&bot=1&ff=900&speed=0' },
  { id: 'tut', q: 'play=m1&tut=1&speed=0' },
  { id: 'left', q: 'play=m1&bot=1&ff=170&speed=0', act: 'left' },
  { id: 'left-why', q: 'play=m1&bot=1&ff=170&speed=0', act: 'leftwhy' },
  { id: 'open', q: 'play=m1&speed=0', act: 'opening' },
  { id: 'deadend', q: 'play=m1&speed=0', act: 'deadend' },
  { id: 'end-ar', q: 'play=m1&bot=1&ff=900&speed=0&lang=ar' },
  { id: 'tutnote', q: 'play=m1&tut=1&speed=0', act: 'tutnote' },
  { id: 'rank', q: 'play=sandbox&speed=0', act: 'rank' },
  { id: 'settings', q: 'play=m1&bot=1&ff=170&speed=0', act: 'settings' },
  { id: 'gamemenu', q: 'play=m1&bot=1&ff=170&speed=0', act: 'pause' },
];
const PLAN = [
  ['m1', 'p412'], ['m1', 'l915'], ['m1', 'f904'], ['m1', 'n360'], ['m1', 'flip'], ['m1', 'flex'],
  ['m1-why', 'p412'], ['m1-why', 'l915'], ['m1-why', 'f904'], ['m1-why', 'n360'],
  ['m1-ar', 'p412'], ['m1-ar', 'l915'], ['m1-why-ar', 'p412'],
  ['m1-start', 'p412'],
  ['m7', 'p412'], ['m7', 'n360'], ['m7', 'l915'], ['m7-ar', 'p412'], ['m7-castle', 'p412'], ['m7-castle', 'flip'], ['m7-castle', 'n360'], ['m7-castle', 'flex'], ['m7-castle', 'l915'],
  ['m9', 'p412'], ['sandbox', 'p412'], ['sandbox', 'l915'], ['sandbox', 'flip'], ['market', 'p412'], ['build', 'p412'], ['build', 'l915'],
  ['wagon', 'p412'], ['pause', 'p412'], ['pause', 'flip'], ['menu', 'flip'], ['menu', 'p412'], ['end', 'p412'], ['tut', 'p412'], ['tut', 'l915'],
  ['left', 'l915'], ['left', 'p412'], ['left-why', 'l915'], ['m7-castle-ar', 'l915'],
  ['open', 'p412'], ['open', 'l915'], ['deadend', 'p412'], ['deadend', 'l915'], ['end', 'l915'], ['end', 'n360'], ['end-ar', 'p412'],
  ['gamemenu', 'l915'], ['tut', 'n360'], ['tutnote', 'p412'], ['tutnote', 'l915'], ['tutnote', 'n360'],
  ['rank', 'p412'], ['settings', 'p412'], ['open', 'n360'], ['open', 'flip'], ['end', 'flip'], ['deadend', 'f904'], ['m7', 'flip'],
];

async function act(page, kind) {
  if (!kind) return;
  await page.evaluate((k) => {
    const A = window.__marchia.app;
      if (k === "worst") { const e = document.querySelector(".stall-eye"); if (e) e.click(); else A.go("building", A.world.state.buildings.find((b) => b.type === "mill").id, true); }
    if (k === 'castle') A.go('building', A.world.state.mission.contract.castle, true);
    if (k === 'pause') { A.world.state.tick = 7400; A.openGameMenu(); }
    if (k === 'opening') { A.debugStart = false; A.newGame('m1'); }
    if (k === 'deadend') { A.world.state.coins = 0; A.checkDeadEnd(); }
    if (k === 'tutnote') document.querySelector('.letter [data-a="start"]')?.click();
    if (k === 'rank') window.__marchia.rankUp(1);
    if (k === 'settings') { A.openGameMenu(); document.querySelector('.sheet [data-a="settings"]')?.click(); }
    if (k === 'left' || k === 'leftwhy') { A.prefs.leftHanded = true; A.applyHand(); }
    if (k === 'leftwhy') { const e = document.querySelector('.stall-eye'); if (e) e.click(); }
  }, kind);
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
    // a tool card's cost badge hangs over its corner on purpose: judge the card by its label instead
    if (e.classList.contains('tool')) {
      const l = e.querySelector('.tl'), br = e.getBoundingClientRect();
      const lr = l?.getBoundingClientRect();
      if (lr && (lr.left < br.left - 0.5 || lr.right > br.right + 0.5 || lr.bottom > br.bottom + 0.5)) clip.push(`${nm(e)} label ${Math.round(lr.width)}>${Math.round(br.width)}`);
      const k = e.querySelector('.cost')?.getBoundingClientRect();
      if (lr && k && k.bottom > lr.top && k.top < lr.bottom && k.right > lr.left && k.left < lr.right) clip.push(`${nm(e)} badge over label`);
    } else if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && cs.overflowX !== 'auto') clip.push(`${nm(e)} ${e.scrollWidth}>${e.clientWidth}`);
    const r = e.getBoundingClientRect();
    if ((r.right > innerWidth + 1 || r.left < -1) && !e.closest('.bs-cards')) off.push(`${nm(e)} ${Math.round(r.left)}..${Math.round(r.right)}`);
  }
  return { small: small.slice(0, 8), clip: clip.slice(0, 8), off: off.slice(0, 8), hscroll: document.documentElement.scrollWidth > innerWidth };
}

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let errors = 0;
for (const [sid, vid] of PLAN) {
  const name = `${prefix}-${sid}-${vid}`;
  if (filter && !filter.split(',').some((f) => name.includes(f))) continue;
  const s = SCENES.find((x) => x.id === sid), v = VIEWS[vid];
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  if (v.hinge) await page.addInitScript((hg) => { window.__marchiaFold = { state: 'HALF_OPENED', orientation: 'HORIZONTAL', x: 0, y: hg.y, w: 904, h: hg.h }; }, v.hinge);
  const lang = /lang=/.test(s.q) ? '' : '&lang=pl';
  await page.goto(`${base}?${s.q}${s.q ? '&' : ''}${LOW}${lang}&debug=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__marchia?.ready, null, { timeout: 60000 });
  if (v.hinge) await page.evaluate(() => window.dispatchEvent(new Event('marchia:fold')));
  await page.waitForTimeout(1500);
  await act(page, s.act);
  await page.waitForTimeout(3000);
  const m = await page.evaluate(measure);
  await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 82 });
  errors += errs.length;
  console.log(name, JSON.stringify(m), errs.length ? 'ERR ' + errs.join(' | ').slice(0, 300) : '');
  await ctx.close();
}
await browser.close();
console.log('console errors:', errors);
