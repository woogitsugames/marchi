// First ten minutes of a new player, driven headless (research, docs/research/2026-11-03-first-10-minutes.md).
// Cold start (fresh browser context = empty IndexedDB/localStorage) -> main menu -> mission I with the
// castellan's tutorial (taps whatever the tutorial ring points at) -> first stall card -> Why sheet ->
// fix button -> play to the end of the contract (x4 after the tutorial) -> end letter -> mission II start.
// Per step it records taps, wall time, sim time, PL words on screen, tap targets < 48 px, clipped /
// covered text, what the tutorial points at (on/off screen, under the note), and gaps with no clear next
// action. Screenshots: small JPGs in docs/research/shots-first10b/ (FIRST10_SHOTDIR).
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
const shotDir = resolve(root, process.env.FIRST10_SHOTDIR ?? 'docs/research/shots-first10b');
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
// Run b (after the day-6 fixes): every tap is followed by settle(), which waits two animation frames
// (~1 s each under SwiftShader) until the UI signature stops changing, so the script never races the
// tutorial (the run-a artefact at step 4/5). Step 4 taps "Droga" once; step 5 drags only over the
// missing cells of the ghost crossing (+1 road cell at each end), touch first, mouse as a fallback.
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
  const log = (...a) => console.error(`[${orient} ${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
  const sim = () => page.evaluate(() => { const a = window.__marchia?.app; return a?.world ? { tick: a.world.state.tick, result: a.world.state.mission.result, mission: a.world.state.mission.id, speed: a.loop?.speed ?? null, coins: a.world.state.coins } : null; });
  const begin = async (name) => {
    if (cur) await finish();
    const s = await sim();
    log('step', name);
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
    try { await page.screenshot({ path: resolve(shotDir, f), type: 'jpeg', quality: 50, timeout: 180000 }); cur.shots.push(f); }
    catch (e) { cur.notes.push('screenshot failed: ' + e.message.slice(0, 80)); }
  };
  const finish = async () => {
    const s = await sim();
    cur.wallMs = Date.now() - cur.t0;
    cur.simS = s && s.mission === cur.mission ? (s.tick - cur.tick0) / 10 : null;
    steps.push(cur);
    cur = null;
    if (process.env.FIRST10_OUT) writeFileSync(process.env.FIRST10_OUT + '.partial', JSON.stringify({ size: `${w}x${h}`, steps, gaps, errors }, null, 1));
  };
  // UI signature after two animation frames: tutorial step/text/ring/note, top sheet, letter, stall card
  const sig = () => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const a = window.__marchia?.app, t = a?.tutorial;
    const r = (e) => (e ? [...Object.values(e.getBoundingClientRect().toJSON())].slice(0, 4).map((v) => Math.round(v / 4)).join(',') : '-');
    const top = document.querySelector('#sheets .sheet:last-child');
    const stall = document.querySelector('.stall-row');
    res([t && !t.ended ? t.current : 0, document.querySelector('.tutorial .tut-text')?.textContent ?? '',
      r(document.querySelector('.tutorial .tut-ring.is-shown')), r(document.querySelector('.tut-note-wrap:not(.is-gone)')),
      top ? r(top) : '-', document.querySelectorAll('.letter').length, document.querySelectorAll('.menu-item').length,
      stall ? stall.hidden : 'x', a?.tool ?? ''].join('|'));
  }))));
  const settle = async (maxMs = 10000) => {
    const t = Date.now();
    let prev = await sig();
    while (Date.now() - t < maxMs) {
      const s = await sig();
      if (s === prev) return Date.now() - t;
      prev = s;
    }
    cur?.notes.push('UI did not settle in ' + maxMs + ' ms');
    return maxMs;
  };
  const tapAt = async (x, y, what) => {
    taps++; cur.taps++;
    const hit = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); if (!e) return null; const c = typeof e.className === 'string' ? e.className.split(/\s+/).slice(0, 2).join('.') : ''; return e.tagName.toLowerCase() + (c ? '.' + c : '') + (e.closest('.tutorial') ? ' [IN TUTORIAL NOTE]' : ''); }, [x, y]);
    cur.notes.push(`tap ${what} @${Math.round(x)},${Math.round(y)} hits ${hit}`);
    await page.touchscreen.tap(x, y);
    await settle();
  };
  const tapSel = async (sel, what) => {
    const el = page.locator(sel).first();
    if (!(await el.count())) throw new Error('no element ' + sel);
    // a target below the fold of a sheet: the player has to scroll first (counted as a gesture)
    const below = await el.evaluate((e) => { const r = e.getBoundingClientRect(); return r.bottom > innerHeight || r.top < 0 || (() => { for (let a = e.parentElement; a; a = a.parentElement) { const q = a.getBoundingClientRect(), cs = getComputedStyle(a); if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && (r.bottom > q.bottom + 1 || r.top < q.top - 1)) return true; } return false; })(); }).catch(() => false);
    if (below) {
      cur.notes.push(`scroll needed to reach ${what ?? sel}`); cur.taps++; taps++;
      await el.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' })).catch(() => {});
      await settle();
    }
    const b = await el.boundingBox();
    if (!b) throw new Error('no box ' + sel);
    const ok = await el.evaluate((e, [x, y]) => { const h = document.elementFromPoint(x, y); return !!h && (e === h || e.contains(h)); }, [b.x + b.width / 2, b.y + b.height / 2]).catch(() => false);
    if (!ok) cur.notes.push(`WARN: ${what ?? sel} centre is covered by another element`);
    await tapAt(b.x + b.width / 2, b.y + b.height / 2, what ?? sel);
  };
  const tapRing = async (what) => {
    const r = await page.evaluate(() => {
      const ring = document.querySelector('.tutorial .tut-ring.is-shown');
      if (!ring) return null;
      const b = ring.getBoundingClientRect();
      const wb = document.querySelector('.waybill-wrap:not(.is-collapsed) .wb-line');
      if (wb) { const q = wb.getBoundingClientRect(); if (q.top >= b.top - 2 && q.bottom <= b.bottom + 2) return [q.left + q.width / 2, q.top + q.height / 2]; }
      return [b.left + b.width / 2, b.top + b.height / 2];
    });
    if (!r) return false;
    await tapAt(r[0], r[1], 'ring:' + what);
    return true;
  };
  const tutStep = () => page.evaluate(() => { const t = window.__marchia?.app?.tutorial; return t && !t.ended ? t.current : 0; });
  const waitFor = async (fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms, polling: 500 }).then(() => true, () => false);
  // sample "is there a clear next action" every second, recording gaps > 10 s (wall) with the sim time they cost
  const clearState = () => page.evaluate(() => {
    const t = document.querySelector('.tutorial .tut-note-wrap:not(.is-gone)');
    const ring = document.querySelector('.tutorial .tut-ring.is-shown');
    const cure = document.querySelector('.tool.is-cure');
    const stall = document.querySelector('.stall-row');
    const letter = document.querySelector('.letter .btn.primary, .letter [data-a]');
    const fix = document.querySelector('.fix-btn:not(.is-disabled)');
    const a = window.__marchia?.app;
    const stallShown = !!(stall && !stall.hidden);
    return { clear: !!(t && ring) || !!cure || !!letter || stallShown || !!fix, tut: !!t, stall: stallShown, tick: a?.world?.state.tick ?? 0, result: a?.world?.state.mission.result ?? '', speed: a?.loop?.speed ?? null };
  });
  const watch = async (ms, until) => {
    const end = Date.now() + ms;
    let gapStart = null;
    let st = null;
    while (Date.now() < end) {
      st = await clearState();
      if (!st.clear) { if (gapStart === null) gapStart = { t: Date.now(), tick: st.tick }; }
      else if (gapStart) { const d = Date.now() - gapStart.t; if (d > 10000) gaps.push({ step: cur?.name, wallS: d / 1000, simS: (st.tick - gapStart.tick) / 10, speed: st.speed }); gapStart = null; }
      if (until && await until(st)) break;
      await page.waitForTimeout(1000);
    }
    if (gapStart) { const d = Date.now() - gapStart.t; if (d > 10000) gaps.push({ step: cur?.name, wallS: d / 1000, simS: ((st?.tick ?? gapStart.tick) - gapStart.tick) / 10, speed: st?.speed, open: true }); }
    return st;
  };

  let tutorial = null;
  const body = async () => {
  // ---------------------------------------------------------------- 0 cold start
  await begin('00 zimny start -> menu');
  const tl = Date.now();
  await page.goto(URL0 + '?debug=1&lang=pl&quality=low');
  await page.evaluate(async () => { try { localStorage.clear(); } catch { /* fresh context anyway */ } });
  await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 120000 });
  cur.notes.push('load to ready ms ' + (Date.now() - tl));
  await settle();
  await audit('menu');
  cur.notes.push('menu rows: ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.menu-item')].map((e) => { const r = e.getBoundingClientRect(); return `${e.textContent.trim().replace(/\s+/g, ' ').slice(0, 50)} y${Math.round(r.top)}-${Math.round(r.bottom)}`; }))));
  await shot('menu');

  // ---------------------------------------------------------------- 1 mission I
  await begin('01 menu -> list kasztelana (misja I)');
  await tapSel('.menu-item >> nth=0', 'misja I');
  await waitFor(() => !!document.querySelector('.letter [data-a="start"]'), null, 30000);
  await settle();
  await audit('opening letter');
  await shot('letter');
  await begin('02 list -> gra, samouczek krok 1');
  await tapSel('.letter [data-a="start"]', 'Do dzieła');
  await waitFor(() => !!document.querySelector('.tutorial .tut-text')?.textContent, null, 15000);
  await settle();
  await audit('hud start + note 1');
  await shot('tut1');

  // ---------------------------------------------------------------- tutorial
  const seen = new Set([1]);
  let guard = 0, dragTries = 0;
  const tutT0 = Date.now(), tutTick0 = (await sim()).tick;
  while (guard++ < 40) {
    const st = await tutStep();
    if (!st) break;
    if (!seen.has(st)) {
      seen.add(st);
      await begin(`03 samouczek krok ${st}`);
      await settle();
      const a = await audit('note ' + st);
      log('note', st, JSON.stringify(a.tut));
      await shot('tut' + st, st !== 3);
    }
    if (st === 4) {
      const tool = await page.evaluate(() => window.__marchia.app.tool ?? null);
      if (tool !== 'road') {
        const ok = await tapRing('step4');
        if (!ok) { cur.notes.push('no ring at step 4, tapping the road tool'); await tapSel('.rail [data-tool="road"]', 'Droga'); }
      }
      await waitFor(() => window.__marchia.app.tutorial?.current !== 4, null, 8000);
      await settle();
      continue;
    }
    if (st === 5) {
      if (dragTries >= 4) { cur.notes.push('PROBLEM: bridge not built after 4 drags, giving up'); break; }
      const mode = dragTries < 2 ? 'touch' : 'mouse';
      dragTries++;
      const d = await page.evaluate(() => {
        const a = window.__marchia.app, cells = a.ghosts?.tut;
        if (!cells?.length) return null;
        const roads = a.world.state.roads;
        const i0 = cells.findIndex((c) => !roads[c]), i1 = cells.length - 1 - [...cells].reverse().findIndex((c) => !roads[c]);
        const span = cells.slice(Math.max(0, i0 - 1), i1 + 2);
        const pts = span.map((c) => a.view.cellToScreen(c));
        const hits = pts.map((p) => { const e = document.elementFromPoint(p.x, p.y); return !e ? 'off' : e.closest('.tutorial') ? 'note' : e.tagName === 'CANVAS' ? 'map' : 'ui'; });
        return { n: cells.length, span: span.length, pts, hits };
      });
      if (!d) { cur.notes.push('no ghost yet'); await settle(); continue; }
      const onScreen = d.pts.filter((p) => p.x >= 4 && p.x <= w - 4 && p.y >= 4 && p.y <= h - 4);
      const hc = d.hits.reduce((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});
      cur.notes.push(`ghost ${d.n} cells, drag span ${d.span}, on screen ${onScreen.length}, under: ${JSON.stringify(hc)}`);
      if (onScreen.length < d.span) cur.notes.push('PROBLEM: part of the ghost crossing off screen');
      if (hc.note || hc.ui) cur.notes.push('PROBLEM: part of the ghost crossing under the note/HUD');
      const pts = d.pts.filter((p, i) => d.hits[i] === 'map');
      if (pts.length < 2) { cur.notes.push('PROBLEM: no free map cells to drag'); await settle(); continue; }
      taps++; cur.taps++;
      cur.notes.push(`drag (${mode}) ${pts.length} pts`);
      if (mode === 'touch') {
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0].x, y: pts[0].y }] });
        for (const p of pts.slice(1)) { await page.waitForTimeout(40); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y }] }); }
        await page.waitForTimeout(150);
        if (dragTries === 1) { await audit('drag held'); await shot('drag'); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down();
        for (const p of pts.slice(1)) { await page.mouse.move(p.x, p.y, { steps: 3 }); await page.waitForTimeout(20); }
        await page.mouse.up();
      }
      await waitFor(() => window.__marchia.app.tutorial?.current !== 5, null, 10000);
      await settle();
      const toast = await page.evaluate(() => document.querySelector('.toasts')?.textContent?.trim() ?? '');
      if (toast) cur.notes.push('toast: ' + toast.slice(0, 120));
      if ((await tutStep()) === 5) cur.notes.push(`drag ${dragTries} (${mode}) not accepted`);
      continue;
    }
    const ok = await tapRing('step' + st);
    if (!ok) {
      const tr = await page.evaluate(() => document.querySelector('.tutorial .tut-text')?.textContent ?? '');
      cur.notes.push(`no ring shown at step ${st} ("${tr.slice(0, 50)}")`);
      await watch(3000, async () => (await tutStep()) !== st);
      const fallback = { 1: '.waybill-wrap .wb-line, .waybill-wrap .seal-only', 2: '#sheets .sheet:last-child .chain button[data-go]', 3: '#sheets .sheet:last-child .chain button[data-go]', 6: '.waybill-wrap .wb-line, .waybill-wrap .seal-only' }[st];
      const n = fallback ? await page.locator(fallback).count() : 0;
      if (n && (await tutStep()) === st) { cur.notes.push('fallback tap ' + fallback); await tapSel(fallback, 'fallback'); }
    }
    if (st === 6) { await watch(15000, async () => (await tutStep()) === 0); }
    else await waitFor((s) => window.__marchia.app.tutorial?.current !== s, st, 8000);
  }
  tutorial = { wallS: (Date.now() - tutT0) / 1000, simS: ((await sim()).tick - tutTick0) / 10, stepsSeen: [...seen] };
  await begin('04 koniec samouczka -> pierwszy przestój');
  await settle();
  const afterTut = await audit('tutorial over');
  await shot('after-tut', false);
  cur.notes.push('speed after tutorial ' + (await sim()).speed + ', stall card shown: ' + afterTut.stallShown);
  // a newcomer plays on at the speed the game left; we watch for the stall card (max 3 min wall)
  await watch(180000, async (s) => s.stall || s.result !== 'running');
  await settle();
  await audit('first stall card');
  await shot('stall');

  // ---------------------------------------------------------------- why + fix loop
  let fixes = 0, whys = 0;
  const loopEnd = Date.now() + 14 * 60000;
  while (whys < 10 && Date.now() < loopEnd) {
    const s = await sim();
    if (!s || s.result !== 'running') break;
    const has = await page.evaluate(() => { const r = document.querySelector('.stall-row'); return !!(r && !r.hidden); });
    if (!has) { await watch(30000, async (st) => st.stall || st.result !== 'running'); continue; }
    await begin(whys === 0 ? '05 karta przestoju -> arkusz „Dlaczego”' : `06 kolejny przestój #${whys + 1}`);
    whys++;
    const stallText = await page.evaluate(() => document.querySelector('.stall-row .sc-text')?.textContent?.trim() ?? '');
    cur.notes.push('stall card: ' + stallText);
    await tapSel('.stall-eye', 'oko');
    const a = await audit('why sheet');
    if (whys === 1) await shot('why');
    if (a.fix.length) {
      cur.notes.push('fix: ' + a.fix.join(' / '));
      const c0 = (await sim()).coins;
      try { await tapSel('.fix-btn:not(.is-disabled)', 'naprawa'); fixes++; }
      catch { cur.notes.push('fix button gone before the tap (sheet re-rendered)'); }
      cur.notes.push(`silver ${c0} -> ${(await sim()).coins}`);
      await audit('after fix');
      if (fixes === 1) await shot('fixed');
    } else {
      cur.notes.push('no enabled fix button: ' + a.texts.slice(-8).join(' | ').slice(0, 300));
      if (a.cure.length) { await tapSel('.tool.is-cure', 'is-cure'); cur.notes.push('cure tool shown but not used by the script'); }
    }
    // close sheets with one gesture (the close/back button if any, else Escape)
    await page.keyboard.press('Escape'); await settle();
    if (await page.evaluate(() => !!document.querySelector('#sheets .sheet'))) { await page.keyboard.press('Escape'); await settle(); }
    const sp = await page.evaluate(() => window.__marchia.app.loop.speed);
    if (sp !== 4) await tapSel('.speed .seg >> nth=3', '×4').catch((e) => cur.notes.push('speed: ' + e.message));
    await watch(30000, async (st) => st.result !== 'running');
  }
  await begin('07 czekanie na koniec zlecenia (×4)');
  if ((await sim()).speed !== 4) await tapSel('.speed .seg >> nth=3', '×4').catch(() => {});
  await watch(Number(process.env.FIRST10_ENDWAIT ?? 1200000), async (st) => st.result !== 'running');
  await waitFor(() => !!document.querySelector('.letter'), null, 30000);
  await settle();
  const end = await sim();
  cur.notes.push('result ' + JSON.stringify(end));
  await audit('end letter');
  await shot('end');

  // ---------------------------------------------------------------- mission II
  await begin('08 list końcowy -> misja II');
  const btns = await page.evaluate(() => [...document.querySelectorAll('.letter button')].map((b) => { const r = b.getBoundingClientRect(); return `${b.dataset.a ?? ''}|${b.textContent.trim().replace(/\s+/g, ' ')}|y${Math.round(r.top)}-${Math.round(r.bottom)}`; }));
  cur.notes.push('end letter buttons: ' + btns.join(' / '));
  const next = await page.locator('.letter [data-a="next"]').count();
  if (!(await page.locator('.letter').count())) {
    cur.notes.push('PROBLEM: contract still running, no end letter; reload and start mission II from the menu');
    await page.goto(URL0 + '?debug=1&lang=pl&quality=low');
    await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 120000 });
    await settle();
    await tapSel('.menu-item >> nth=1', 'misja II');
  } else if (next) await tapSel('.letter [data-a="next"]', 'Następna misja');
  else {
    cur.notes.push('PROBLEM: no "next" on the end letter: back to the menu');
    const m = await page.locator('.letter [data-a="menu"]').count();
    if (m) await tapSel('.letter [data-a="menu"]', 'menu'); else await tapSel('.letter button >> nth=-1', 'last button');
    await tapSel('.menu-item >> nth=1', 'misja II');
  }
  await waitFor(() => window.__marchia?.app?.world?.state.mission.id === 'm2', null, 30000);
  await waitFor(() => !!document.querySelector('.letter [data-a="start"], .scrim [data-a]'), null, 10000);
  await settle();
  cur.mission = 'm2';
  await audit('m2 opening');
  await shot('m2-letter');
  const st2 = await page.locator('.letter [data-a="start"]').count();
  if (st2) { await tapSel('.letter [data-a="start"]', 'Do dzieła (II)'); }
  else cur.notes.push('no start button on m2: ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.scrim button, .letter button')].map((b) => b.textContent.trim()))));
  await settle();
  await audit('m2 hud');
  await shot('m2-hud');
  };
  try { await body(); } catch (e) { errors.push('DRIVER: ' + e.message); log('DRIVER ERROR', e.message); }
  if (cur) await finish().catch(() => {});
  await browser.close();
  return { size: `${w}x${h}`, totalWallS: (Date.now() - T0) / 1000, taps, tutorial, steps, gaps, errors };
}

const out = [];
for (const s of sizes) out.push(await run(s));
const json = JSON.stringify(out, null, 1);
if (process.env.FIRST10_OUT) writeFileSync(process.env.FIRST10_OUT, json);
else console.log(json);
