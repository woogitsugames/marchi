// First ten minutes of a new player, driven headless (research, docs/research/2026-11-03-first-10-minutes.md).
// Cold start (fresh browser context = empty IndexedDB/localStorage) -> main menu -> mission I with the
// castellan's tutorial (taps whatever the tutorial ring points at) -> first stall card -> Why sheet ->
// fix button -> play to the end of the contract (x4 after the tutorial) -> end letter -> mission II start.
// Per step it records taps, wall time, sim time, PL words on screen, tap targets < 48 px, clipped /
// covered text, what the tutorial points at (on/off screen, under the note), and gaps with no clear next
// action. Screenshots: small JPGs in docs/research/shots-first10/.
//
// Usage: npx vite preview --port 5195 --strictPort   (after npm run build)
//        node tools/first10-minutes.mjs 412x915 [more sizes...]   -> JSON on stdout + shots
// Env: FIRST10_URL (default http://127.0.0.1:5195/), FIRST10_OUT (JSON path), FIRST10_SHOTS=0 to skip shots.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = resolve(root, 'docs/research/shots-first10');
mkdirSync(shotDir, { recursive: true });
const URL0 = process.env.FIRST10_URL ?? 'http://127.0.0.1:5195/';
const SHOTS = process.env.FIRST10_SHOTS !== '0';
const sizes = (process.argv.slice(2).length ? process.argv.slice(2) : ['412x915']).map((s) => s.split('x').map(Number));

// ------------------------------------------------------------------ in-page audit
// Runs in the page: everything the player sees at this moment.
function auditPage() {
  const vw = innerWidth, vh = innerHeight;
  const vis = (el) => {
    if (!el || !el.isConnected) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const deepVis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { if (!vis(e) || e.hidden || e.getAttribute('aria-hidden') === 'true' || e.classList.contains('sr-only')) return false; } return true; };
  const desc = (el) => {
    const c = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    const t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${c ? '.' + c : ''}${t ? ' "' + t + '"' : ''}`;
  };
  const rr = (r) => [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  // words
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const texts = [];
  let words = 0, letters = 0;
  const leafs = new Set();
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const s = n.nodeValue.trim();
    if (!s) continue;
    const p = n.parentElement;
    if (!p || p.closest('script,style,svg,.tutorial-hidden') || !deepVis(p)) continue;
    const r = p.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
    const ws = s.split(/\s+/).filter((x) => /\p{L}/u.test(x));
    words += ws.length; letters += s.length;
    if (ws.length) texts.push(s);
    leafs.add(p);
  }
  // tap targets
  const small = [], covered = [], offscreen = [];
  const inter = [...document.querySelectorAll('button, a[href], input, select, [role=button], [data-wb], [data-go], [data-act]')].filter(deepVis);
  const canvasLike = (el) => !el || el.tagName === 'CANVAS' || el === document.body || el === document.documentElement || el.classList.contains('scene') ;
  for (const el of inter) {
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) { offscreen.push(desc(el) + ' @' + rr(r).join(',')); continue; }
    if (r.top < -1 || r.bottom > vh + 1 || r.left < -1 || r.right > vw + 1) offscreen.push('partly ' + desc(el) + ' @' + rr(r).join(','));
    if (Math.min(r.width, r.height) < 47.5 && !el.closest('[data-go],[data-act],[data-wb]')?.isSameNode?.(null)) {
      // a child inside a larger tappable ancestor is not its own target
      const big = el.parentElement?.closest('button, [role=button], [data-wb], [data-go], [data-act]');
      const br = big?.getBoundingClientRect();
      if (!br || Math.min(br.width, br.height) < 47.5) small.push(desc(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
    const cx = Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
    const hit = document.elementFromPoint(cx, cy);
    if (hit && !canvasLike(hit) && !el.contains(hit) && !hit.contains(el)) covered.push(desc(el) + ' under ' + desc(hit));
  }
  // clipped text
  const clipped = [];
  for (const p of leafs) {
    const cs = getComputedStyle(p);
    const r = p.getBoundingClientRect();
    if ((p.scrollWidth > p.clientWidth + 1 && cs.overflowX !== 'visible') || (p.scrollHeight > p.clientHeight + 2 && cs.overflowY === 'hidden') || cs.textOverflow === 'ellipsis' && p.scrollWidth > p.clientWidth + 1)
      clipped.push(desc(p) + ` scroll ${p.scrollWidth}x${p.scrollHeight} > ${p.clientWidth}x${p.clientHeight}`);
    if (r.left < -1 || r.right > vw + 1 || r.bottom > vh + 1 || r.top < -1) clipped.push('viewport ' + desc(p) + ' @' + rr(r).join(','));
    // ancestors that clip it
    for (let a = p.parentElement; a && a !== document.body; a = a.parentElement) {
      const acs = getComputedStyle(a);
      if (acs.overflow === 'visible' && acs.clipPath === 'none') continue;
      if (acs.overflowY === 'auto' || acs.overflowY === 'scroll') break; // scrollable: reachable
      const ar = a.getBoundingClientRect();
      if (acs.overflow !== 'visible' && (r.bottom > ar.bottom + 2 || r.right > ar.right + 2 || r.left < ar.left - 2 || r.top < ar.top - 2)) { clipped.push('cut by ' + desc(a) + ': ' + desc(p)); break; }
    }
  }
  // text under text: two visible text leaves overlapping
  const overlaps = [];
  const L = [...leafs].filter((p) => !p.closest('.tutorial')).map((p) => [p, p.getBoundingClientRect()]);
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const [a, ra] = L[i], [b, rb] = L[j];
    if (a.contains(b) || b.contains(a)) continue;
    const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (ix > 4 && iy > 4) {
      // only when one is not inside a sheet that lies above the other (a sheet covering the HUD is by design)
      const sa = a.closest('#sheets, .letter, .scrim'), sb = b.closest('#sheets, .letter, .scrim');
      if (!!sa !== !!sb) continue;
      overlaps.push(desc(a) + ' x ' + desc(b));
    }
  }
  // tutorial
  let tut = null;
  const tr = document.querySelector('.tutorial');
  if (tr) {
    const note = tr.querySelector('.tut-note-wrap'), ring = tr.querySelector('.tut-ring'), arrow = tr.querySelector('.tut-arrow');
    const nr = note && !note.classList.contains('is-gone') && vis(note) ? note.getBoundingClientRect() : null;
    const rg = ring && ring.classList.contains('is-shown') ? ring.getBoundingClientRect() : null;
    const ar = arrow && arrow.classList.contains('is-shown') ? arrow.getBoundingClientRect() : null;
    const noteCovers = [];
    if (nr) {
      for (const el of [...inter, ...leafs]) {
        if (el.closest('.tutorial')) continue;
        const r = el.getBoundingClientRect();
        const ix = Math.min(r.right, nr.right) - Math.max(r.left, nr.left), iy = Math.min(r.bottom, nr.bottom) - Math.max(r.top, nr.top);
        if (ix > 6 && iy > 6 && ix * iy > 0.3 * r.width * r.height) noteCovers.push(desc(el));
      }
    }
    tut = {
      text: tr.querySelector('.tut-text')?.textContent ?? '',
      note: nr ? rr(nr) : null, ring: rg ? rr(rg) : null, arrow: ar ? rr(ar) : null,
      ringOff: rg ? (rg.top < 0 || rg.bottom > vh || rg.left < 0 || rg.right > vw) : null,
      noteCovers: [...new Set(noteCovers)].slice(0, 8),
      ringUnderNote: !!(rg && nr && Math.min(rg.right, nr.right) - Math.max(rg.left, nr.left) > 8 && Math.min(rg.bottom, nr.bottom) - Math.max(rg.top, nr.top) > 8),
    };
  }
  const cure = [...document.querySelectorAll('.tool.is-cure')].filter(deepVis).map(desc);
  const fix = [...document.querySelectorAll('.fix-btn:not(.is-disabled)')].filter(deepVis).map(desc);
  const primary = [...document.querySelectorAll('.letter .btn.primary, .scrim .btn.primary')].filter(deepVis).map(desc);
  const stall = document.querySelector('.stall-row');
  return {
    words, letters, texts: texts.slice(0, 80), small: [...new Set(small)], covered: [...new Set(covered)].slice(0, 12),
    offscreen: offscreen.slice(0, 12), clipped: [...new Set(clipped)].slice(0, 12), overlaps: [...new Set(overlaps)].slice(0, 12), tut,
    cure, fix, primary, stallShown: !!(stall && !stall.hidden && deepVis(stall)), sheet: document.querySelector('#sheets .sheet:last-child') ? true : false,
    stallText: stall && !stall.hidden ? stall.textContent.trim().replace(/\s+/g, ' ') : '',
  };
}

// ------------------------------------------------------------------ driver
async function run([w, h]) {
  const orient = w > h ? 'land' : 'port';
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'pl-PL' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const steps = [];
  const gaps = [];
  let cur = null, shotN = 0, taps = 0;
  const T0 = Date.now();
  const sim = () => page.evaluate(() => { const a = window.__marchia?.app; return a?.world ? { tick: a.world.state.tick, result: a.world.state.mission.result, mission: a.world.state.mission.id, speed: a.loop?.speed ?? null, coins: a.world.state.coins } : null; });
  const begin = async (name) => {
    if (cur) await finish();
    const s = await sim();
    cur = { name, t0: Date.now(), tick0: s?.tick ?? 0, mission: s?.mission ?? null, taps: 0, audits: [], shots: [], notes: [] };
  };
  const audit = async (label) => {
    const a = await page.evaluate(auditPage);
    a.label = label; a.atMs = Date.now() - cur.t0;
    cur.audits.push(a);
    return a;
  };
  const shot = async (label, keep = true) => {
    if (!SHOTS || !keep) return;
    shotN++;
    const f = `${orient}-${String(shotN).padStart(2, '0')}-${label}.jpg`;
    await page.screenshot({ path: resolve(shotDir, f), type: 'jpeg', quality: 55, timeout: 120000 });
    cur.shots.push(f);
  };
  const finish = async () => {
    const s = await sim();
    cur.wallMs = Date.now() - cur.t0;
    cur.simS = s && s.mission === cur.mission ? (s.tick - cur.tick0) / 10 : null;
    steps.push(cur);
    cur = null;
  };
  const tapAt = async (x, y, what) => {
    taps++; cur.taps++;
    cur.notes.push(`tap ${what} @${Math.round(x)},${Math.round(y)}`);
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(400);
  };
  const tapSel = async (sel, what) => {
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    const b = await el.boundingBox();
    if (!b) throw new Error('no element ' + sel);
    await tapAt(b.x + b.width / 2, b.y + b.height / 2, what ?? sel);
  };
  // the element the tutorial ring encloses: tap the centre of the ring
  const tapRing = async (what) => {
    const r = await page.evaluate(() => {
      const ring = document.querySelector('.tutorial .tut-ring.is-shown');
      if (!ring) return null;
      const b = ring.getBoundingClientRect();
      // the lines of the waybill: tap the first line, not the gap between them
      const wb = document.querySelector('.waybill-wrap:not(.is-collapsed) .wb-line');
      if (wb) { const q = wb.getBoundingClientRect(); if (q.top >= b.top - 2 && q.bottom <= b.bottom + 2) return [q.left + q.width / 2, q.top + q.height / 2]; }
      return [b.left + b.width / 2, b.top + b.height / 2];
    });
    if (!r) return false;
    await tapAt(r[0], r[1], 'ring:' + what);
    return true;
  };
  const tutStep = () => page.evaluate(() => { const t = window.__marchia?.app?.tutorial; return t ? t.current : 0; });
  const waitFor = async (fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  // sample "is there a clear next action" every second for `ms` (wall), recording gaps > 10 s
  const watch = async (ms, until) => {
    const end = Date.now() + ms;
    let gapStart = null;
    while (Date.now() < end) {
      const st = await page.evaluate(() => {
        const t = document.querySelector('.tutorial .tut-note-wrap:not(.is-gone)');
        const ring = document.querySelector('.tutorial .tut-ring.is-shown');
        const cure = document.querySelector('.tool.is-cure');
        const stall = document.querySelector('.stall-row');
        const letter = document.querySelector('.letter .btn.primary');
        const a = window.__marchia?.app;
        return { clear: !!(t && ring) || !!cure || !!letter, stall: !!(stall && !stall.hidden), tick: a?.world?.state.tick ?? 0, result: a?.world?.state.mission.result ?? '' };
      });
      if (!st.clear) { if (gapStart === null) gapStart = { t: Date.now(), tick: st.tick, stall: st.stall }; }
      else if (gapStart) { const d = Date.now() - gapStart.t; if (d > 10000) gaps.push({ step: cur?.name, wallS: d / 1000, simS: (st.tick - gapStart.tick) / 10, stallCardShown: gapStart.stall }); gapStart = null; }
      if (until && await until(st)) break;
      await page.waitForTimeout(1000);
    }
    if (gapStart) { const d = Date.now() - gapStart.t; if (d > 10000) { const tk = (await sim())?.tick ?? gapStart.tick; gaps.push({ step: cur?.name, wallS: d / 1000, simS: (tk - gapStart.tick) / 10, stallCardShown: gapStart.stall, open: true }); } }
  };

  // ---------------------------------------------------------------- 0 cold start
  await begin('00 zimny start -> menu');
  const tl = Date.now();
  await page.goto(URL0 + '?debug=1&lang=pl&quality=low');
  await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 120000 });
  cur.notes.push('load to ready ms ' + (Date.now() - tl));
  await page.waitForTimeout(1500);
  await audit('menu');
  await shot('menu');

  // ---------------------------------------------------------------- 1 mission I
  await begin('01 menu -> list kasztelana (misja I)');
  await tapSel('.menu-item >> nth=0', 'misja I');
  await waitFor(() => !!document.querySelector('.letter'), null, 30000);
  await page.waitForTimeout(600);
  await audit('opening letter');
  await shot('letter');
  await begin('02 list -> gra (start samouczka)');
  await tapSel('.letter [data-a="start"]', 'Rozpocznij');
  await waitFor(() => !!document.querySelector('.tutorial .tut-text')?.textContent, null, 15000);
  await page.waitForTimeout(800);
  await audit('hud start + note 1');
  await shot('tut1');

  // ---------------------------------------------------------------- tutorial
  const seen = new Set();
  let guard = 0;
  while (guard++ < 40) {
    const st = await tutStep();
    if (!st) break;
    if (!seen.has(st)) {
      seen.add(st);
      if (st !== 1) { await begin(`03 samouczek krok ${st}`); await page.waitForTimeout(700); await audit('note ' + st); await shot('tut' + st, st !== 3); }
      else { cur.name = '02 list -> gra, samouczek krok 1'; }
    }
    if (st === 5) {
      // drag along the ghost crossing the tutorial draws on the map
      const d = await page.evaluate(() => {
        const a = window.__marchia.app, cells = a.ghosts?.tut;
        if (!cells || !cells.length) return null;
        const p = (c) => a.view.cellToScreen(c);
        return { from: p(cells[0]), to: p(cells[cells.length - 1]), mid: p(cells[Math.floor(cells.length / 2)]), n: cells.length };
      });
      cur.notes.push('ghost crossing ' + JSON.stringify(d));
      if (!d) { await page.waitForTimeout(1000); continue; }
      const onScreen = (q) => q.visible !== false && q.x >= 0 && q.y >= 0 && q.x <= w && q.y <= h;
      if (!onScreen(d.from) || !onScreen(d.to)) cur.notes.push('PROBLEM: ghost end off screen');
      // a drag: touch swipe through CDP
      const cdp = await ctx.newCDPSession(page);
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const f = i / 14;
        const [a, b] = f <= 0.5 ? [d.from, d.mid] : [d.mid, d.to];
        const g = f <= 0.5 ? f * 2 : (f - 0.5) * 2;
        pts.push([a.x + (b.x - a.x) * g, a.y + (b.y - a.y) * g]);
      }
      taps++; cur.taps++;
      cur.notes.push('drag ' + pts.length + ' pts');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
      for (const [x, y] of pts.slice(1)) { await page.waitForTimeout(30); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); }
      await page.waitForTimeout(200);
      await audit('drag held');
      await shot('drag');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(1500);
      const toast = await page.evaluate(() => document.querySelector('.toasts')?.textContent?.trim() ?? '');
      if (toast) cur.notes.push('toast: ' + toast);
      if ((await tutStep()) === 5) { cur.notes.push('drag not accepted, retry'); await page.waitForTimeout(1500); }
      continue;
    }
    const ok = await tapRing('step' + st);
    if (!ok) {
      const tr = await page.evaluate(() => document.querySelector('.tutorial .tut-text')?.textContent ?? '');
      cur.notes.push(`no ring shown at step ${st} ("${tr.slice(0, 40)}")`);
      await watch(2500);
      // fallback: the selector the tutorial would have pointed at
      const fallback = { 1: '.waybill-wrap .wb-line, .waybill-wrap .seal-only', 2: '#sheets .sheet:last-child .chain button[data-go]', 3: '#sheets .sheet:last-child .chain button[data-go]', 4: '.rail [data-tool="road"]', 6: '.waybill-wrap .wb-line, .waybill-wrap .seal-only' }[st];
      const n = fallback ? await page.locator(fallback).count() : 0;
      if (n && (await tutStep()) === st) { cur.notes.push('fallback tap ' + fallback); await tapSel(fallback, 'fallback'); }
    }
    await page.waitForTimeout(900);
    if ((await tutStep()) === st && st === 6) { await watch(4000, async () => (await tutStep()) === 0); }
  }
  await begin('04 koniec samouczka -> pierwszy przestój');
  await page.waitForTimeout(500);
  await audit('tutorial over');
  await shot('after-tut');
  // what a newcomer does next: nothing until the alarm (x1), we only watch
  await watch(90000, async (s) => s.stall || s.result !== 'running');
  await audit('first stall card');
  await shot('stall');

  // ---------------------------------------------------------------- why + fix loop
  let fixes = 0;
  let firstWhy = true;
  while (fixes < 8) {
    const s = await sim();
    if (!s || s.result !== 'running') break;
    const has = await page.evaluate(() => { const r = document.querySelector('.stall-row'); return !!(r && !r.hidden); });
    if (!has) { await watch(30000, async (st) => st.stall || st.result !== 'running'); continue; }
    await begin(firstWhy ? '05 karta przestoju -> arkusz „Dlaczego”' : `06 kolejny przestój #${fixes + 1}`);
    await tapSel('.stall-eye', 'oko');
    await page.waitForTimeout(700);
    const a = await audit('why sheet');
    if (firstWhy) await shot('why');
    firstWhy = false;
    if (a.fix.length) {
      await tapSel('.fix-btn:not(.is-disabled)', 'naprawa');
      fixes++;
      await page.waitForTimeout(800);
      await audit('after fix');
      if (fixes === 1) await shot('fixed');
    } else {
      cur.notes.push('no enabled fix button in the Why sheet: ' + (a.texts.slice(-6).join(' | ')));
      await page.keyboard.press('Escape');
      if (a.cure.length) { await tapSel('.tool.is-cure', 'is-cure'); fixes++; }
      else { await watch(20000, async (st) => st.result !== 'running'); fixes++; }
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    // after a fix the newcomer speeds up (the speed segment) and watches
    const sp = await page.evaluate(() => window.__marchia.app.loop.speed);
    if (sp !== 4) { await tapSel('.speed .seg >> nth=3', 'x4').catch((e) => cur.notes.push('speed: ' + e.message)); }
    await watch(25000, async (st) => st.result !== 'running');
  }
  await begin('07 czekanie na koniec zlecenia (x4)');
  await watch(240000, async (st) => st.result !== 'running');
  await waitFor(() => !!document.querySelector('.letter'), null, 20000);
  await page.waitForTimeout(900);
  const end = await sim();
  cur.notes.push('result ' + JSON.stringify(end));
  await audit('end letter');
  await shot('end');

  // ---------------------------------------------------------------- mission II
  await begin('08 list końcowy -> misja II');
  const btns = await page.evaluate(() => [...document.querySelectorAll('.letter button')].map((b) => `${b.dataset.a ?? ''}|${b.textContent.trim()}`));
  cur.notes.push('end letter buttons: ' + btns.join(' / '));
  const next = await page.locator('.letter [data-a="next"]').count();
  if (next) await tapSel('.letter [data-a="next"]', 'następna misja');
  else {
    cur.notes.push('no "next" on the end letter: back to the menu');
    const m = await page.locator('.letter [data-a="menu"]').count();
    if (m) await tapSel('.letter [data-a="menu"]', 'menu'); else await tapSel('.letter button >> nth=-1', 'last button');
    await page.waitForTimeout(1500);
    await tapSel('.menu-item >> nth=1', 'misja II');
  }
  await waitFor(() => window.__marchia?.app?.world?.state.mission.id === 'm2', null, 30000);
  await page.waitForTimeout(1200);
  await audit('m2 opening');
  await shot('m2-letter');
  const st2 = await page.locator('.letter [data-a="start"]').count();
  if (st2) { await tapSel('.letter [data-a="start"]', 'Rozpocznij II'); await page.waitForTimeout(1500); }
  await audit('m2 hud');
  await shot('m2-hud');
  await finish();
  await browser.close();
  return { size: `${w}x${h}`, totalWallS: (Date.now() - T0) / 1000, taps, steps, gaps, errors };
}

const out = [];
for (const s of sizes) out.push(await run(s));
const json = JSON.stringify(out, null, 1);
if (process.env.FIRST10_OUT) writeFileSync(process.env.FIRST10_OUT, json);
else console.log(json);
