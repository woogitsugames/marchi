// Layout check: measures (does not eyeball) every main screen in a real browser and fails on
//   offscreen  — an action control (button, tool, menu item, sheet action) not fully inside the viewport
//                and not inside a scroller that can bring it into view
//   overlap    — two HUD components / the sheet / world bubbles intersect (a component's own badge that
//                hangs over its edge is not a component, so the intended overhang is not counted)
//   small      — a touch target under 48 x 48 CSS px
//   lines      — the tutorial note over 3 lines (from 360 px)
//   overflow   — text that sticks out of its box, or is clipped / ellipsized inside it
//   covered    — a text run or control painted over by another element (tested with every element hit-testable)
//   root-under-dock — the last link of a sheet's cause chain has text under the docked fix (D-146)
//   hscroll    — the page scrolls sideways
//   console    — console errors / page errors
// A positive control runs first: known-bad CSS is injected and each check must turn red, otherwise the
// tool itself is broken and the run fails.
//
// Usage: npm run layout                       full matrix (views x langs x scenes), own Vite server
//        npm run layout -- --quick            412x915 + Flip cover, pl / de / pseudo only
//        npm run layout -- --only 'hud|360'   regex over "scene|view|lang"
//        npm run layout -- --lang pseudo      other language set (comma list)
//        npm run layout -- --shots DIR        also save a PNG per job
//        npm run layout -- --three            over the three.js map instead of the Canvas2D one (slow)
//        LAYOUT_URL=http://127.0.0.1:5173/ npm run layout   use a running server
// Output: docs/layout/layout-report.json for the full default run (partial runs: <tmpdir>/marchia-layout/),
// one line per job on stdout. Exit 1 on any failure.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const QUICK = argv.includes('--quick');
const ONLY = arg('--only');
const SHOTS = arg('--shots');
const NO_CONTROL = argv.includes('--no-control');
const CONC = Number(process.env.CONC ?? 3);

export const VIEWS = [
  { id: '412x915', w: 412, h: 915 },
  { id: '915x412', w: 915, h: 412 },
  { id: '904x1000', w: 904, h: 1000 },
  { id: '360x740', w: 360, h: 740 },
  { id: 'flip360x380', w: 360, h: 380 },
];
const LANGS = (arg('--lang') ?? (QUICK ? 'pl,de,pseudo' : 'pl,de,ru,ar,pseudo')).split(',');
const views = QUICK ? VIEWS.filter((v) => v.id === '412x915' || v.id === 'flip360x380') : VIEWS;

// The HUD, sheets and letters are the same DOM over either map view; the Canvas2D view (?view=flat) is ~10x
// cheaper than three.js under SwiftShader, so it is the default. --three measures over the real 3D map (pins
// then sit where the player sees them; ~40 s per job on 4 cores).
const THREE = argv.includes('--three');
const BASE_Q = 'quality=low&dynres=0&debug=1' + (THREE ? '' : '&view=flat');
const openSettings = async (p) => {
  // the menu re-renders once the save scan is done: click until the sheet is there
  for (let i = 0; i < 20; i++) {
    await p.evaluate(() => { const m = [...document.querySelectorAll('.menu-item')]; m[m.length - 1]?.click(); });
    if (await p.waitForSelector('.sheet', { timeout: 1500 }).then(() => true, () => false)) return;
  }
  throw new Error('settings sheet did not open');
};
const SCENES = [
  { name: 'menu', q: '' },
  { name: 'settings', q: '', act: openSettings },
  { name: 'hud', q: 'play=m1&bot=1&ff=150&speed=0' },
  { name: 'why', q: 'play=m1&ff=90&speed=0&open=bakery' },
  { name: 'wagon', q: 'play=m1&bot=1&ff=150&speed=0&wagon=1' },
  { name: 'build', q: 'play=m1&speed=0&tool=build' },
  { name: 'waybill-m7', q: 'play=m7&speed=0&ff=120' },
  { name: 'end', q: 'play=m1&bot=1&ff=600' },
  { name: 'castle', q: 'play=m5&speed=0&ff=60', act: (p) => p.evaluate(() => { const A = window.__marchia.app; A.go('building', A.world.state.mission.contract.castle, true); }) },
  { name: 'valley', q: 'play=sandbox&speed=0&ff=240&slot=layout' },
  { name: 'market', q: 'play=sandbox&speed=0&market=1&slot=layout' },
  { name: 'opening', q: 'play=m1&tut=1&speed=0' },
  { name: 'tutorial', q: 'play=m1&tut=1&speed=0', act: async (p) => {
    // a DOM click: under SwiftShader the 3D frames are slow enough for Playwright's "stable" wait to time out
    await p.waitForSelector('.letter [data-a="start"]', { timeout: 30000 });
    await p.evaluate(() => document.querySelector('.letter [data-a="start"]').click());
    await p.waitForSelector('.tut-text', { timeout: 30000 });
  } },
  // the short-landscape chain (D-111) folded and unfolded: its root must stand above the fix dock (D-146)
  { name: 'chain', q: 'play=m6&ff=110&speed=0&open=farm' },
  { name: 'chain-open', q: 'play=m6&ff=110&speed=0&open=farm', act: async (p) => {
    await p.evaluate(() => document.querySelector('#sheets .sheet:last-child .c-more-btn')?.click());
  } },
  { name: 'rankup', q: 'play=sandbox&speed=0&slot=layout', act: (p) => p.evaluate(() => window.__marchia.rankUp(2)) },
];

// ------------------------------------------------------------------ in-page measurement
function measure() {
  const vw = innerWidth, vh = innerHeight;
  const R = (r) => ({ l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) });
  const label = (e) => {
    const cls = typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const txt = (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    return `${e.tagName.toLowerCase()}${cls}${txt ? ` "${txt}"` : ''}`;
  };
  const shown = (e) => {
    const r = e.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return false; // 1 px visually-hidden labels (screen readers only)
    const cs = getComputedStyle(e);
    if (cs.visibility !== 'visible') return false;
    let op = 1;
    for (let p = e; p && p !== document.documentElement; p = p.parentElement) {
      const c = getComputedStyle(p);
      if (c.display === 'none') return false;
      // visually hidden on purpose (screen-reader text): a 1 px clipped box or clip-path inset(50%)
      if (c.clipPath.startsWith('inset(50%')) return false;
      if (p !== e && /(hidden|clip)/.test(c.overflow) && (p.offsetWidth <= 2 || p.offsetHeight <= 2)) return false;
      op *= +c.opacity;
    }
    return op > 0.05;
  };
  const scroller = (e) => {
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const c = getComputedStyle(p);
      if ((/(auto|scroll)/.test(c.overflowY) && p.scrollHeight > p.clientHeight + 1) || (/(auto|scroll)/.test(c.overflowX) && p.scrollWidth > p.clientWidth + 1)) return p;
    }
    return null;
  };
  const inView = (r, tol = 1) => r.left >= -tol && r.top >= -tol && r.right <= vw + tol && r.bottom <= vh + tol;
  const FRAMES = 'button, [role=button], .chip, .tool, .ribbon, .wb-panel, .sheet-paper, .letter, .menu-strip, .toast, .notice, .ev-card, .stall-card, .bubble, .eta-tag, .draft-tag';
  const out = { vw, vh, body: document.body.className, offscreen: [], overlap: [], small: [], overflow: [], hscroll: false };

  // a modal letter / scrim covers everything below it on purpose: then only the top layer is checked
  const scrims = [...document.querySelectorAll('.scrim, .rank-letter-wrap')].filter(shown);
  const scope = scrims.length ? scrims[scrims.length - 1] : document.body;
  // world pins (and their timers) follow the camera and are clipped by #markers at the screen edge: only their
  // overlaps with the HUD are checked, below
  const all = [...scope.querySelectorAll('*')].filter((e) => !e.closest('svg') && e.tagName !== 'CANVAS' && !e.closest('.sr-only') && !e.closest('#markers'));
  const vis = all.filter(shown);

  // 1. action controls in view
  const ACTION = 'button, [role=button], a[href], input, select, [data-a], .menu-item, .tool';
  const actions = vis.filter((e) => e.matches(ACTION));
  for (const e of actions) {
    if (e.matches('.bubble')) continue; // world pins follow the camera; #markers clips them at the edge
    const r = e.getBoundingClientRect();
    if (inView(r)) continue;
    const sc = scroller(e);
    if (sc && inView(sc.getBoundingClientRect(), 2)) continue; // reachable by scrolling a scroller that is itself in view
    out.offscreen.push({ el: label(e), ...R(r) });
  }

  // 2. touch targets >= 48 CSS px (the element box; the HUD has no invisible hit expanders)
  for (const e of actions) {
    const r = e.getBoundingClientRect();
    if (r.width >= 47.5 && r.height >= 47.5) continue;
    if (e.matches('input[type=range]') && r.width >= 47.5) { const h = parseFloat(getComputedStyle(e).minHeight) || r.height; if (h >= 47.5) continue; }
    out.small.push({ el: label(e), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
  }

  // 3. component overlaps. Components are the separate floating pieces of the HUD; children (badges, ribbons
  //    hanging over a panel edge) are deliberately not components.
  const COMPONENTS = [
    ['menu-btn', '.hud-top .menu-btn'], ['chips', '.hud-top .chips'], ['speed', '.hud-top .speed'],
    ['waybill', '.waybill-wrap .wb-panel'], ['ribbon', '.waybill-wrap .ribbon'], ['seal', '.waybill-wrap .seal-only'],
    ['events', '.ev-card'], ['stall', '.stall-row'], ['rail', '.rail-tools'], ['sheet', '.sheet-paper'],
    ['toast', '.toast'], ['notice', '.notice'], ['bubble', '#markers .bubble, .bubble'], ['build', '.build-ui > *'],
    ['menu', '.menu-strip'],
  ];
  const comps = [];
  for (const [k, sel] of COMPONENTS) {
    for (const e of document.querySelectorAll(sel)) if ((scope === document.body || scope.contains(e)) && shown(e) && !comps.some((c) => c.e === e)) comps.push({ k, e, r: e.getBoundingClientRect() });
  }
  // a component nested inside another one is part of it (e.g. the ribbon over its own waybill panel)
  const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const SAME = new Set(['waybill|ribbon', 'ribbon|waybill', 'waybill|seal', 'seal|waybill', 'ribbon|seal', 'seal|ribbon']);
  for (let i = 0; i < comps.length; i++) {
    for (let j = i + 1; j < comps.length; j++) {
      const a = comps[i], b = comps[j];
      if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      // the ribbon belongs to the panel directly under it; two waybills (contract + plaque) still count
      if (SAME.has(`${a.k}|${b.k}`) && a.e.closest('.waybill-wrap') === b.e.closest('.waybill-wrap')) continue;
      if (a.k === 'bubble' && b.k === 'bubble') continue; // world bubbles may stack on each other
      if ((a.k === 'menu' && b.k === 'sheet') || (a.k === 'sheet' && b.k === 'menu')) continue; // a menu sheet covers the menu on purpose
      const px = area(a.r, b.r);
      if (px > 4) out.overlap.push({ a: label(a.e), b: label(b.e), px2: Math.round(px), ra: R(a.r), rb: R(b.r) });
    }
  }

  // 4. text overflow: text runs measured against their own box (or clipped / ellipsized inside it)
  for (const e of vis) {
    const own = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own.length) continue;
    const cs = getComputedStyle(e);
    let box = e;
    while (box && /^(inline|contents)$/.test(getComputedStyle(box).display)) box = box.parentElement;
    if (!box) continue;
    const br = box.getBoundingClientRect();
    const rg = document.createRange();
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const n of own) { rg.selectNodeContents(n); for (const q of rg.getClientRects()) { if (q.width < 0.5) continue; l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); } }
    if (!isFinite(l)) continue;
    const bcs = getComputedStyle(box);
    const fs = parseFloat(cs.fontSize) || 16;
    // the text against its own box and against the control / panel that frames it: a label that widens
    // its own span still runs out of the button card around it
    const frame = box.closest(FRAMES);
    const sc = scroller(e);
    let spill = null;
    for (const f of frame && frame !== box ? [box, frame] : [box]) {
      const fr = f.getBoundingClientRect();
      const dx = Math.max(0, fr.left - l - 2, r - fr.right - 2);
      // display faces (Grenze Gotisch) draw ascenders over a tight line box: allow 0.4 em vertically
      const dy = Math.max(0, fr.top - t - 0.4 * fs, b - fr.bottom - 0.4 * fs);
      if ((dx > 0 || dy > 0) && !spill) spill = { el: label(e), kind: 'spill', in: f === box ? 'box' : label(f).slice(0, 30), dx: Math.round(dx), dy: Math.round(dy) };
    }
    if (spill && !sc) out.overflow.push(spill);
    else if (box.scrollWidth > box.clientWidth + 1 && box.clientWidth > 0 && /(hidden|clip)/.test(bcs.overflowX))
      out.overflow.push({ el: label(box), kind: bcs.textOverflow === 'ellipsis' ? 'ellipsis' : 'clipped', sw: box.scrollWidth, cw: box.clientWidth });
    else if (!inView({ left: l, top: t, right: r, bottom: b }, 2) && !sc) out.overflow.push({ el: label(e), kind: 'offscreen-text', ...R({ left: l, top: t, right: r, bottom: b }) });
  }
  // 5. covered: walk everything painted at the middle of each text run / action control, top first; the first
  //    element that paints anything (background, border image, text, image) must be that element or inside it —
  //    else something is drawn over it (a HUD ribbon over a letter, a panel over a label). Empty full-screen
  //    layers and wrappers paint nothing and are passed through.
  const paints = (el) => {
    if (!shown(el)) return false;
    if (/^(IMG|CANVAS)$/.test(el.tagName)) return true;
    const svg = el.closest('svg');
    // an outline drawing (every shape unfilled: the tutorial's highlight frame) paints only its stroke, not over
    // what it frames
    if (svg) return [...svg.querySelectorAll('path, rect, circle, ellipse, polygon')].some((q) => getComputedStyle(q).fill !== 'none');
    const c = getComputedStyle(el);
    if (c.backgroundImage !== 'none' || c.borderImageSource !== 'none') return true;
    if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c.backgroundColor)) return true;
    if (['Top', 'Right', 'Bottom', 'Left'].some((k) => parseFloat(c['border' + k + 'Width']) > 0 && !/rgba\(0, 0, 0, 0\)/.test(c['border' + k + 'Color']))) return true;
    return [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  };
  for (const e of vis) {
    const own = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own.length && !e.matches(ACTION)) continue;
    // every line of the text (a two-line heading can be half under something), or the control's middle
    const pts = [];
    if (own.length) {
      const rg = document.createRange();
      for (const n of own) { rg.selectNodeContents(n); for (const q of rg.getClientRects()) if (q.width > 2) pts.push([q.left + q.width / 2, q.top + q.height / 2]); }
    } else {
      const r = e.getBoundingClientRect();
      pts.push([r.left + r.width / 2, r.top + r.height / 2]);
    }
    const sc = scroller(e);
    if (sc) {
      // partly scrolled out of its list (and into the list's edge fade): the player scrolls to it
      const sr = sc.getBoundingClientRect(), er = e.getBoundingClientRect();
      if (er.top < sr.top + 40 || er.bottom > sr.bottom - 40) continue;
    }
    for (const [x, y] of pts) {
      if (x < 0 || y < 0 || x >= vw || y >= vh) continue;
      // elementsFromPoint ignores pointer-events: none, so hit-testing is forced on for this one read
      const force = document.createElement('style');
      force.textContent = '* { pointer-events: auto !important; }';
      document.head.append(force);
      const stack = document.elementsFromPoint(x, y);
      force.remove();
      // an ancestor listed before e paints over it through a pseudo-element (its own box paints under its children)
      const top = stack.find((el) => el === e || e.contains(el) || el.contains(e) || paints(el));
      if (!top || top === e || e.contains(top)) continue;
      // a sheet's fix dock sticks to the bottom of its scrolling body (D-100): what lies under it while the body can
      // still scroll down is scrolled under it, as in the edge band above; at the end of the scroll it counts
      const dk = top.closest('.fix-dock');
      if (dk && sc && sc.contains(dk) && !dk.contains(e) && sc.scrollTop + sc.clientHeight < sc.scrollHeight - 1) continue;
      // a modal (sheet, letter) over the screen below it covers that screen on purpose
      if (top.closest('.sheet, .scrim, [aria-modal="true"]') && !e.closest('.sheet, .scrim, [aria-modal="true"]')) continue;
      // the point lies in a part of e its scroll box / clip has cut away: not on screen, not covered
      let clipped = false;
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).overflow === 'visible') continue;
        const pr = p.getBoundingClientRect();
        if (x < pr.left || x > pr.right || y < pr.top || y > pr.bottom) { clipped = true; break; }
    }
    if (clipped) continue;
    out.overflow.push({ el: label(e), kind: 'covered', by: label(top).slice(0, 40) });
    break;
    }
  }
  // 6. the tutorial note stays a note: at most 3 lines of text from 360 px up (BACKLOG P2, 140 characters)
  const tut = document.querySelector('.tut-text');
  if (tut && shown(tut) && vw >= 360 && vh >= 600) {
    const rg = document.createRange();
    rg.selectNodeContents(tut);
    const lines = new Set([...rg.getClientRects()].filter((q) => q.width > 2).map((q) => Math.round(q.top / 4)));
    if (lines.size > 3) out.overflow.push({ el: label(tut), kind: 'lines', dx: lines.size, dy: 0, in: '3 max' });
  }
  // 7. the cause chain's root stands above a sheet's docked fix (D-146). Stricter than the covered check, which
  // skips text in the 40 px edge band of a scroller: every line of the root's text must end above the dock's top.
  for (const sh of document.querySelectorAll('#sheets .sheet')) {
    const dock = sh.querySelector('.fix-dock');
    const root = sh.querySelector('.chain > li:last-child .l-text');
    if (!dock || !root || !shown(dock) || !shown(root)) continue;
    const dt = dock.getBoundingClientRect().top;
    const rg = document.createRange();
    rg.selectNodeContents(root);
    const low = Math.max(...[...rg.getClientRects()].filter((q) => q.width > 2).map((q) => q.bottom));
    if (low > dt + 1) out.overflow.push({ el: label(root), kind: 'root-under-dock', dx: 0, dy: Math.round(low - dt), in: 'fix dock' });
  }
  out.hscroll = document.documentElement.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1;
  return out;
}

// ------------------------------------------------------------------ runner
async function ensureServer() {
  if (process.env.LAYOUT_URL) return { url: process.env.LAYOUT_URL, close: async () => {} };
  const { createServer } = await import('vite');
  const server = await createServer({ root, server: { port: 5176, strictPort: false, host: '127.0.0.1', hmr: false }, logLevel: 'warn' });
  await server.listen();
  const addr = server.httpServer.address();
  return { url: `http://127.0.0.1:${addr.port}/`, close: () => server.close() };
}

async function run(browser, url, v, lang, sc, css) {
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const tag = `${sc.name}|${v.id}|${lang}`;
  const errors = [];
  try {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${url}?${sc.q ? sc.q + '&' : ''}${BASE_Q}&lang=${lang}`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 180000 });
    await page.waitForTimeout(600);
    if (sc.act) { await sc.act(page); await page.waitForTimeout(400); }
    if (css) await page.addStyleTag({ content: css });
    // settle: fonts, sheet slide-in, letter fade (all 100-250 ms) and two layout frames
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(900); // the app refreshes pin occlusion 4x a second
    await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => 0))));
    await page.waitForTimeout(300);
    const m = await page.evaluate(measure);
    if (SHOTS && !css) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${sc.name}-${v.id}-${lang}.png`, timeout: 180000 }); }
    return { tag, ...m, console: errors };
  } catch (e) {
    return { tag, error: String(e.message).split('\n')[0], console: errors };
  } finally { await ctx.close().catch(() => {}); }
}

export function failures(m) {
  const f = [];
  if (m.error) f.push(`error: ${m.error}`);
  for (const x of m.offscreen ?? []) f.push(`offscreen ${x.el} [${x.l},${x.t},${x.r},${x.b}]`);
  for (const x of m.overlap ?? []) f.push(`overlap ${x.a} x ${x.b} ${x.px2}px2`);
  for (const x of m.small ?? []) f.push(`small ${x.el} ${x.w}x${x.h}`);
  for (const x of m.overflow ?? []) {
    if (x.kind === 'covered') f.push(`covered ${x.el} by ${x.by}`);
    else f.push(`overflow(${x.kind}) ${x.el}${x.dx != null ? ` in ${x.in} dx=${x.dx} dy=${x.dy}` : x.sw ? ` ${x.sw}>${x.cw}` : ''}`);
  }
  if (m.hscroll) f.push('hscroll');
  for (const c of m.console ?? []) f.push(`console ${c.slice(0, 120)}`);
  return f;
}

// Positive control: each injected fault must be caught by the check named next to it.
const CONTROLS = [
  { check: 'overlap', css: '.hud-top .speed { transform: translateY(-50px) !important; }' },
  { check: 'small', css: '.hud-top .menu-btn { width: 30px !important; height: 30px !important; min-width: 0 !important; min-height: 0 !important; }' },
  { check: 'overflow', css: '.tool .tl { font-size: 34px !important; white-space: nowrap !important; max-width: none !important; }' },
  { check: 'offscreen', css: '.rail { transform: translateY(70px) !important; }' },
  { check: 'covered', css: '.rail-tools::after { content: ""; position: absolute; inset: 0; z-index: 5; background: rgb(0 0 0 / .3); }' },
];

async function main() {
  const { url, close } = await ensureServer();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let bad = 0;
  try {
    if (!NO_CONTROL) {
      const hud = SCENES.find((s) => s.name === 'hud');
      const v = VIEWS[0];
      const clean = await run(browser, url, v, 'pl', hud, null);
      const base = new Set(failures(clean));
      for (const c of CONTROLS) {
        const m = await run(browser, url, v, 'pl', hud, c.css);
        const caught = failures(m).filter((f) => !base.has(f) && f.startsWith(c.check));
        console.log(`control ${c.check.padEnd(9)} ${caught.length ? 'caught' : 'MISSED'}${caught.length ? '  e.g. ' + caught[0] : ''}`);
        if (!caught.length) bad++;
      }
      if (bad) { console.log(`positive control failed (${bad}) — the checker does not see injected faults`); }
    }
    const jobs = [];
    for (const sc of SCENES) for (const v of views) for (const lang of LANGS) jobs.push([v, lang, sc]);
    const list = ONLY ? jobs.filter(([v, l, s]) => new RegExp(ONLY).test(`${s.name}|${v.id}|${l}`)) : jobs;
    const res = [];
    let i = 0;
    await Promise.all(Array.from({ length: CONC }, async () => {
      while (i < list.length) {
        const [v, l, s] = list[i++];
        const m = await run(browser, url, v, l, s, null);
        const f = failures(m);
        res.push({ ...m, fail: f });
        console.log(`${f.length ? 'FAIL' : 'ok  '} ${m.tag}${f.length ? '\n      ' + f.join('\n      ') : ''}`);
      }
    }));
    res.sort((a, b) => a.tag.localeCompare(b.tag));
    // the committed report is the full default matrix only; partial runs report next to the OS temp files
    const full = !ONLY && !QUICK && !THREE && !arg('--lang');
    const outDir = full ? resolve(root, 'docs/layout') : resolve(tmpdir(), 'marchia-layout');
    mkdirSync(outDir, { recursive: true });
    console.log(`report ${resolve(outDir, 'layout-report.json')}`);
    writeFileSync(resolve(outDir, 'layout-report.json'), JSON.stringify(res.map(({ tag, vw, vh, body, fail }) => ({ tag, vw, vh, body, fail })), null, 1) + '\n');
    const failed = res.filter((r) => r.fail.length);
    console.log(`LAYOUT jobs=${res.length} failed=${failed.length} control=${NO_CONTROL ? 'skipped' : bad ? 'BROKEN' : 'ok'}`);
    if (failed.length || bad) process.exitCode = 1;
  } finally {
    await browser.close();
    await close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
