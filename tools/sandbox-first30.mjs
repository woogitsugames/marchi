// Free valley, first 30 game minutes in the browser (research day 9b, docs/research/2026-11-05-sandbox-first-30.md).
// Cold start -> menu -> "Wolna dolina" -> new ledger -> game. Then game time advances in 10 s chunks through the
// app's own loop (window.__marchia.app.loop.tickOnce, the debug handle; onTick runs, so toasts, notices, chronicle
// and events fire as in play) with the HUD rendering between chunks. The player: the minimal build order of
// tools/sandbox-first30.ts (farm at 0:30, mill + bakery at rank 1, road + fisher at rank 2; enqueued as commands)
// and every 30 s of game time one look at the worst-stall card through the UI (tap the card's eye, read the sheet,
// tap "Naprawa" when there is one, close the sheet with its close button).
// Logs: every distinct stall-card text, toast, notice, event-card header and rank letter with its game time;
// per look the sheet's text and fix; audits (tap targets < 48 px, overlaps, covered) at the milestones; console
// errors. Shots (JPEG) to docs/research/shots-sandbox30/.
//   npx vite preview --port 5195 --strictPort   (after npm run build)
//   node tools/sandbox-first30.mjs 412x915 915x412   -> JSON per size next to the shots
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = resolve(root, process.env.SB30_SHOTDIR ?? 'docs/research/shots-sandbox30');
mkdirSync(shotDir, { recursive: true });
const URL0 = process.env.SB30_URL ?? 'http://127.0.0.1:5195/';
const MINUTES = Number(process.env.SB30_MIN ?? 30);
const sizes = (process.argv.slice(2).length ? process.argv.slice(2) : ['412x915']).map((s) => s.split('x').map(Number));

// in-page: what the player sees now (trimmed copy of first10-minutes.mjs auditPage, plus valley parts)
function auditPage() {
  const vw = innerWidth, vh = innerHeight;
  const shown = (e) => { const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) >= 0.05; };
  const vis = (el) => { if (!el || !el.isConnected || !shown(el)) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const deepVis = (el) => { if (!vis(el)) return false; for (let e = el; e && e !== document.body; e = e.parentElement) { if (!shown(e) || e.hidden || e.getAttribute('aria-hidden') === 'true' || e.classList.contains('sr-only') || e.closest('[inert]')) return false; } return true; };
  const desc = (el) => {
    const c = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    const t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${c ? '.' + c : ''}${t ? ' "' + t + '"' : ''}`;
  };
  const txt = (el) => (el && deepVis(el) ? el.textContent.trim().replace(/\s+/g, ' ') : '');
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let words = 0;
  const leafs = new Set();
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const s = n.nodeValue.trim();
    if (!s) continue;
    const p = n.parentElement;
    if (!p || p.closest('script,style,svg') || !deepVis(p)) continue;
    const r = p.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
    words += s.split(/\s+/).filter((x) => /\p{L}/u.test(x)).length;
    leafs.add(p);
  }
  const small = [], covered = [];
  const inter = [...document.querySelectorAll('button, a[href], input, select, [role=button], [data-go], [data-act]')].filter(deepVis);
  for (const el of inter) {
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
    if (Math.min(r.width, r.height) < 47.5) {
      const big = el.parentElement?.closest('button, [role=button], [data-go], [data-act]');
      const br = big?.getBoundingClientRect();
      if (!br || Math.min(br.width, br.height) < 47.5) small.push(desc(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
    const cx = Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
    const hit = document.elementFromPoint(cx, cy);
    if (hit && hit.tagName !== 'CANVAS' && hit !== document.body && !el.contains(hit) && !hit.contains(el)) covered.push(desc(el) + ' under ' + desc(hit));
  }
  const overlaps = [];
  const L = [...leafs].map((p) => [p, p.getBoundingClientRect()]);
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const [a, ra] = L[i], [b, rb] = L[j];
    if (a.contains(b) || b.contains(a)) continue;
    const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (ix > 4 && iy > 4) {
      const sa = a.closest('#sheets, .letter, .scrim'), sb = b.closest('#sheets, .letter, .scrim');
      if (!!sa !== !!sb) continue;
      overlaps.push(desc(a) + ' x ' + desc(b));
    }
  }
  const rect = (sel) => { const e = document.querySelector(sel); if (!e || !deepVis(e)) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
  return {
    words, small: [...new Set(small)], covered: [...new Set(covered)].slice(0, 12), overlaps: [...new Set(overlaps)].slice(0, 12),
    stall: txt(document.querySelector('.stall-row')), stallRect: rect('.stall-row'),
    cure: [...document.querySelectorAll('.tool.is-cure')].filter(deepVis).map(desc),
    ev: txt(document.querySelector('.ev-card')), evRect: rect('.ev-card'), evOpen: document.querySelector('.ev-head')?.getAttribute('aria-expanded') ?? null,
    plaque: txt(document.querySelector('.plaque-wrap')), plaqueRect: rect('.plaque-wrap'),
    toasts: [...document.querySelectorAll('.toasts > *')].filter(deepVis).map((e) => e.textContent.trim().replace(/\s+/g, ' ')),
    toastRects: [...document.querySelectorAll('.toasts > *')].filter(deepVis).map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }),
    notice: txt(document.querySelector('.notice-wrap .notice')),
    rank: txt(document.querySelector('.rank-letter')),
    pins: [...document.querySelectorAll('button.bubble')].filter(deepVis).length,
    sheet: txt(document.querySelector('#sheets .sheet:last-child')),
    fix: [...document.querySelectorAll('.fix-btn')].filter(deepVis).map((e) => desc(e) + (e.classList.contains('is-disabled') ? ' [disabled]' : '')),
    rail: rect('.rail'),
  };
}

// in-page, cheap: the texts that compete for the player's eye (every chunk)
function probePage() {
  const shown = (e) => { const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) >= 0.05; };
  const deepVis = (el) => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return false; for (let e = el; e && e !== document.body; e = e.parentElement) if (!shown(e) || e.hidden) return false; return true; };
  const txt = (el) => (el && deepVis(el) ? el.textContent.trim().replace(/\s+/g, ' ') : '');
  return {
    stall: txt(document.querySelector('.stall-row')), ev: txt(document.querySelector('.ev-head')),
    toasts: [...document.querySelectorAll('.toasts > *')].filter(deepVis).map((e) => e.textContent.trim().replace(/\s+/g, ' ')),
    notice: txt(document.querySelector('.notice-wrap .notice')), rank: txt(document.querySelector('.rank-letter')),
    cure: [...document.querySelectorAll('.tool.is-cure')].filter(deepVis).map((e) => e.textContent.trim()),
    pins: [...document.querySelectorAll('button.bubble')].filter(deepVis).length,
  };
}

async function run([w, h]) {
  const orient = w > h ? 'land' : 'port';
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'pl-PL' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  const out = { size: `${w}x${h}`, menu: null, slot: null, start: null, timeline: [], looks: [], audits: [], shots: [], errors, taps: 0 };
  const T0 = Date.now();
  const log = (...a) => console.error(`[${orient} ${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
  let shotN = 0;
  const shot = async (label) => {
    shotN++;
    const f = `${orient}-${String(shotN).padStart(2, '0')}-${label}.jpg`;
    try { await page.screenshot({ path: resolve(shotDir, f), type: 'jpeg', quality: 60, timeout: 180000 }); out.shots.push(f); } catch (e) { log('shot failed', e.message.slice(0, 80)); }
  };
  const frames = (n = 2) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const tapSel = async (sel) => {
    const el = page.locator(sel).first();
    if (!(await el.count())) return false;
    await el.evaluate((e) => e.scrollIntoView({ block: 'nearest', behavior: 'instant' })).catch(() => {});
    const b = await el.boundingBox();
    if (!b) return false;
    out.taps++;
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await frames(3);
    return true;
  };
  const sim = () => page.evaluate(() => { const a = window.__marchia.app, s = a.world.state; return { tick: s.tick, coins: s.coins, rank: s.town?.rank ?? -1, wagons: s.wagons.length, speed: a.loop.speed, buildings: s.buildings.length }; });
  const audit = async (label) => { const a = await page.evaluate(auditPage); const s = await sim(); a.label = label; a.t = s.tick / 10; a.coins = s.coins; out.audits.push(a); return a; };

  // ---- cold start -> menu
  await page.goto(URL0 + '?debug=1&lang=pl&quality=low');
  await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 120000 });
  await frames(3);
  out.menu = await page.evaluate(() => {
    const r = [...document.querySelectorAll('.menu-item')].map((e) => { const q = e.getBoundingClientRect(); return { t: e.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), top: Math.round(q.top), bottom: Math.round(q.bottom), h: Math.round(q.height) }; });
    return { rows: r, vh: innerHeight, valley: r.find((x) => /Wolna dolina/.test(x.t)) ?? null };
  });
  log('menu valley row', JSON.stringify(out.menu.valley));
  await shot('menu');
  // ---- valley row -> ledger picker
  const below = out.menu.valley && out.menu.valley.bottom > h;
  if (below) out.menuScroll = true;
  await tapSel('.menu-item.is-valley');
  await page.waitForSelector('.slot-new', { timeout: 30000 }).catch(() => {});
  await frames(3);
  out.slot = await audit('ledger picker');
  await shot('ledger');
  await tapSel('.slot-new');
  await page.waitForFunction(() => window.__marchia.app?.world?.state.mission.id === 'sandbox' && document.body.classList.contains('mode-game'), null, { timeout: 60000 });
  await frames(6);
  const s0 = await sim();
  out.startState = s0;
  out.start = await audit('game start');
  await shot('start');
  log('start', JSON.stringify(s0), out.start.stall, '| ev:', out.start.ev, '| toasts:', out.start.toasts.join(' / '));

  // ---- play: the app's loop at ×1 between our chunks would also tick; pause it and drive the ticks ourselves
  await page.evaluate(() => { const a = window.__marchia.app; a.loop.speed = 0; a.hud?.setSpeed(0); });
  const seen = new Map();
  const note = (kind, text, t) => {
    if (!text) return;
    const k = kind + '|' + text.replace(/\d+:\d\d|\d+/g, '#');
    if (seen.has(k)) return;
    seen.set(k, t);
    out.timeline.push({ t, kind, text: text.slice(0, 220) });
  };
  const plan = [
    { name: 'farm', after: 30, rank: 0, cmd: { t: 'place', type: 'farm', x: 55, y: 25, facing: 2 } },
    { name: 'mill', rank: 1, cmd: { t: 'place', type: 'mill', x: 58, y: 25, facing: 2 } },
    { name: 'bakery', rank: 1, cmd: { t: 'place', type: 'bakery', x: 49, y: 25, facing: 2 } },
    { name: 'road', rank: 2, road: [45, 25, 30] },
    { name: 'fisher', rank: 2, cmd: { t: 'place', type: 'fisher', x: 44, y: 32, facing: 2 } },
  ];
  let k = 0;
  const shotsWanted = new Set(['first-toast', 'merchant', 'rain', 'rank', 'look1', 'look2', 'look-fix', 'min5', 'min10', 'min20', 'min30', 'ev-open', 'summer']);
  const takeOnce = async (label) => { if (shotsWanted.has(label)) { shotsWanted.delete(label); await shot(label); } };
  const end = MINUTES * 600;
  let lastToastCount = 0, nextLook = 300;
  out.cureSeen = 0; out.pinsMax = 0; out.chunks = 0;
  while (true) {
    const s = await sim();
    if (s.tick >= end) break;
    // build order
    if (k < plan.length) {
      const p = plan[k];
      if (s.rank >= p.rank && s.tick >= (p.after ?? 0) * 10) {
        const r = await page.evaluate((p) => {
          const a = window.__marchia.app, w = a.world, W = w.terrain.w;
          const cmd = p.road ? { t: 'road', surface: 1, cells: Array.from({ length: p.road[2] - p.road[1] + 1 }, (_, i) => (p.road[1] + i) * W + p.road[0]) } : p.cmd;
          const before = w.state.coins;
          a.loop.enqueue(cmd); a.loop.flushCommands();
          return w.state.coins !== before;
        }, p);
        if (r) { out.timeline.push({ t: s.tick / 10, kind: 'build', text: p.name }); k++; }
      }
    }
    // one look every 30 s of game time, through the UI
    if (s.tick >= nextLook) {
      nextLook += 300;
      const a0 = await page.evaluate(auditPage);
      const look = { t: s.tick / 10, coins: s.coins, wagons: s.wagons, rank: s.rank, card: a0.stall, cure: a0.cure, sheet: '', fix: [], act: '' };
      if (a0.stall && await tapSel('.stall-eye')) {
        await frames(3);
        const a1 = await page.evaluate(auditPage);
        look.sheet = a1.sheet.slice(0, 300); look.fix = a1.fix;
        if (out.looks.length < 2) await takeOnce(out.looks.length === 0 ? 'look1' : 'look2');
        const live = await page.locator('.fix-btn:not(.is-disabled)').count();
        if (live) {
          await takeOnce('look-fix');
          const label = await page.locator('.fix-btn:not(.is-disabled)').first().textContent();
          await tapSel('.fix-btn:not(.is-disabled)');
          const s2 = await sim();
          look.act = (label ?? '').trim().replace(/\s+/g, ' ') + (s2.coins !== s.coins ? ' (applied)' : ' (no effect)');
        }
        await tapSel('#sheets .sheet:last-child button.close');
      }
      out.looks.push(look);
      log('look', look.t, look.card.slice(0, 80), '|', look.act || '-', '| coins', look.coins, 'wagons', look.wagons, 'rank', look.rank);
    }
    // advance 10 s of game time, then let the HUD draw
    const n = s.tick < 3000 ? 100 : 200;
    await page.evaluate((n) => { const a = window.__marchia.app; for (let i = 0; i < n; i++) a.loop.tickOnce(); }, n);
    await frames(1);
    const a = await page.evaluate(probePage);
    const t = (s.tick + n) / 10;
    out.chunks++;
    if (a.cure.length) out.cureSeen++;
    out.pinsMax = Math.max(out.pinsMax, a.pins);
    note('cure', a.cure.join(','), t);
    note('card', a.stall, t);
    for (const x of a.toasts) note('toast', x, t);
    note('notice', a.notice, t);
    note('ev', a.ev, t);
    note('rank', a.rank, t);
    if (a.toasts.length && !lastToastCount) await takeOnce('first-toast');
    lastToastCount = a.toasts.length;
    if (a.toasts.some((x) => /kup(iec|ca)/i.test(x))) await takeOnce('merchant');
    if (/deszcz|pada/i.test(a.notice)) await takeOnce('rain');
    if (a.rank) { await takeOnce('rank'); if (!out.audits.some((x) => x.label === 'rank letter')) await audit('rank letter'); }
    if (/lato/i.test(a.notice)) await takeOnce('summer');
    for (const m of [5, 10, 20, 30]) if (t >= m * 60 && t < m * 60 + n / 10) { await takeOnce('min' + m); await audit('minute ' + m); }
  }
  // the event card opened once (one tap on its header) to see how much it covers
  if (await tapSel('.ev-head')) { await frames(3); await audit('event card open'); await takeOnce('ev-open'); await tapSel('.ev-head'); }
  out.end = await sim();
  out.wallS = (Date.now() - T0) / 1000;
  writeFileSync(resolve(shotDir, `sb30-${w}x${h}.json`), JSON.stringify(out, null, 1));
  await browser.close();
  return out;
}

for (const s of sizes) {
  const o = await run(s);
  console.log(JSON.stringify({ size: o.size, end: o.end, taps: o.taps, looks: o.looks.length, timeline: o.timeline.length, errors: o.errors.length, wallS: o.wallS }));
}
