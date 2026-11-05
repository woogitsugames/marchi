// Free valley, the first 5 game minutes of a new player who only follows the game's own cues
// (research day 9h, docs/research/2026-11-05-first-10-minutes-e.md).
// Cold start -> menu -> "Wolna dolina" -> new ledger -> castellan's letter (D-151) -> "Do dzieła" -> the rank card
// (D-152) in the worst-stall slot -> its eye -> castle sheet -> "Postaw: <name>" -> build ghost -> "Postaw" on the
// shelf. Then game time advances in 5 s chunks through the app's loop (tickOnce, as tools/sandbox-first30.mjs) and
// every 30 s of game time the player looks at the card: eye -> sheet -> the enabled "Naprawa" button if any ->
// if that opened the build tool, "Postaw" -> close. Records taps and game time to the first placed building,
// every distinct card text, the sheets and fixes, audits (words, targets < 48 px, covered) at the milestones.
//   npx vite preview --port 5195 --strictPort   (after npm run build)
//   node tools/valley-first5.mjs 412x915     -> JSON next to the shots (VF5_SHOTDIR)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = resolve(root, process.env.VF5_SHOTDIR ?? 'docs/research/shots-valley5');
mkdirSync(shotDir, { recursive: true });
const URL0 = process.env.VF5_URL ?? 'http://127.0.0.1:5195/';
const MINUTES = Number(process.env.VF5_MIN ?? 5);
const sizes = (process.argv.slice(2).length ? process.argv.slice(2) : ['412x915']).map((s) => s.split('x').map(Number));

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
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const s = n.nodeValue.trim(); const p = n.parentElement;
    if (!s || !p || p.closest('script,style,svg') || !deepVis(p)) continue;
    const r = p.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
    words += s.split(/\s+/).filter((x) => /\p{L}/u.test(x)).length;
  }
  const small = [], covered = [];
  for (const el of document.querySelectorAll('button, a[href], [role="button"], input, select')) {
    if (!deepVis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
    if (Math.min(r.width, r.height) < 47.5) small.push(desc(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    const cx = Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
    const hit = document.elementFromPoint(cx, cy);
    if (hit && hit.tagName !== 'CANVAS' && hit !== document.body && !el.contains(hit) && !hit.contains(el)) covered.push(desc(el) + ' under ' + desc(hit));
  }
  return {
    words, small: [...new Set(small)], covered: [...new Set(covered)].slice(0, 12),
    letter: txt(document.querySelector('.letter')).slice(0, 600),
    stall: txt(document.querySelector('.stall-row')),
    plaque: txt(document.querySelector('.plaque-wrap')),
    toasts: [...document.querySelectorAll('.toasts > *')].filter(deepVis).map((e) => e.textContent.trim().replace(/\s+/g, ' ')),
    notice: txt(document.querySelector('.notice-wrap .notice')),
    ev: txt(document.querySelector('.ev-head')),
    rank: txt(document.querySelector('.rank-letter')),
    sheet: txt(document.querySelector('#sheets .sheet:last-child')).slice(0, 500),
    fix: [...document.querySelectorAll('.fix-btn')].filter(deepVis).map((e) => desc(e) + (e.classList.contains('is-disabled') ? ' [disabled]' : '')),
    shelf: [...document.querySelectorAll('[data-b="place"]')].filter(deepVis).map((e) => { const r = e.getBoundingClientRect(); return desc(e) + ` ${Math.round(r.width)}x${Math.round(r.height)} y${Math.round(r.top)}`; }),
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
  const out = { size: `${w}x${h}`, taps: 0, steps: [], looks: [], timeline: [], builds: [], firstBuild: null, errors };
  const T0 = Date.now();
  const log = (...a) => console.error(`[valley ${orient} ${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
  let shotN = 0;
  const shot = async (label) => {
    const f = `valley-${orient}-${String(++shotN).padStart(2, '0')}-${label}.jpg`;
    try { await page.screenshot({ path: resolve(shotDir, f), type: 'jpeg', quality: 60, timeout: 180000 }); } catch (e) { log('shot failed', e.message.slice(0, 80)); }
    return f;
  };
  const frames = (n = 2) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  // a sheet fades in over frames; under swiftshader that takes seconds of wall time (D-135): wait for it
  const settle = async () => { await frames(3); await page.waitForFunction(() => { const s = document.querySelector('#sheets .sheet:last-child'); return !s || Number(getComputedStyle(s).opacity) > 0.95; }, null, { timeout: 30000, polling: 300 }).catch(() => {}); };
  const tapSel = async (sel) => {
    const el = page.locator(sel).first();
    if (!(await el.count())) return false;
    await el.evaluate((e) => e.scrollIntoView({ block: 'nearest', behavior: 'instant' })).catch(() => {});
    const b = await el.boundingBox({ timeout: 5000 }).catch(() => null);
    if (!b) return false;
    out.taps++;
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await settle();
    return true;
  };
  const sim = () => page.evaluate(() => { const a = window.__marchia.app, s = a.world.state; return { tick: s.tick, coins: s.coins, rank: s.town?.rank ?? -1, wagons: s.wagons.length, buildings: s.buildings.map((b) => b.type), tool: a.tool ?? null }; });
  const step = async (name, extra = {}) => { const a = await page.evaluate(auditPage); const s = await sim(); const st = { name, t: s.tick / 10, taps: out.taps, coins: s.coins, ...a, ...extra }; out.steps.push(st); log(name, 't', st.t, '| card:', a.stall.slice(0, 90), '| fix:', a.fix.join(' / ')); return st; };

  await page.goto(URL0 + '?debug=1&lang=pl&quality=low');
  await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 120000 });
  await settle();
  const menu = await page.evaluate(() => { const e = document.querySelector('.menu-item.is-valley'); const r = e?.getBoundingClientRect(); return { top: Math.round(r?.top ?? -1), bottom: Math.round(r?.bottom ?? -1), vh: innerHeight }; });
  await step('menu', { valleyRow: menu, shot: await shot('menu') });
  await tapSel('.menu-item.is-valley');
  await page.waitForSelector('.slot-new', { timeout: 30000 }).catch(() => {});
  await step('ledger', { shot: await shot('ledger') });
  await tapSel('.slot-new');
  await page.waitForFunction(() => window.__marchia.app?.world?.state.mission.id === 'sandbox', null, { timeout: 60000 });
  await page.waitForSelector('.letter [data-a="start"]', { timeout: 20000 }).catch(() => {});
  await settle();
  const L = await step('letter', { shot: await shot('letter') });
  const tapsBefore = out.taps;
  await tapSel('.letter [data-a="start"]');
  await frames(6);
  const g = await step('game start (letter closed)', { shot: await shot('start') });
  const tStart = (await sim()).tick;

  // drive the clock ourselves (the app's own ×1 would tick between our chunks too)
  await page.evaluate(() => { const a = window.__marchia.app; a.loop.speed = 0; a.hud?.setSpeed?.(0); });
  const seen = new Set();
  const note = (kind, text, t) => { if (!text) return; const k = kind + '|' + text.replace(/\d+:\d\d|\d+/g, '#'); if (seen.has(k)) return; seen.add(k); out.timeline.push({ t, kind, text: text.slice(0, 220) }); };
  const look = async (first) => {
    const s = await sim();
    const a0 = await page.evaluate(auditPage);
    const lk = { t: s.tick / 10, coins: s.coins, rank: s.rank, wagons: s.wagons, card: a0.stall, sheet: '', fix: [], act: '' };
    if (a0.stall && await tapSel('.stall-eye')) {
      const a1 = await page.evaluate(auditPage);
      lk.sheet = a1.sheet; lk.fix = a1.fix;
      if (first) await step('rank card eye -> castle sheet', { shot: await shot('sheet') });
      const live = page.locator('.fix-btn:not(.is-disabled)');
      if (await live.count()) {
        const label = ((await live.first().textContent()) ?? '').trim().replace(/\s+/g, ' ');
        const nb = s.buildings.length;
        await tapSel('.fix-btn:not(.is-disabled)');
        const s1 = await sim();
        lk.act = label;
        if (s1.tool === 'build') {
          await frames(4);
          if (first) await step('build ghost after "Postaw"', { shot: await shot('ghost') });
          const ok = await tapSel('[data-b="place"]');
          await frames(3);
          const s2 = await sim();
          const placed = s2.buildings.length > nb;
          lk.act += placed ? ` -> placed ${s2.buildings.at(-1)}` : ' -> NOT placed' + (ok ? '' : ' (no place button)');
          if (placed) { out.builds.push({ t: s2.tick / 10, type: s2.buildings.at(-1), taps: out.taps }); if (!out.firstBuild) out.firstBuild = { t: (s2.tick - tStart) / 10, taps: out.taps - tapsBefore, type: s2.buildings.at(-1) }; }
          if (first) await step('after place', { shot: await shot('placed') });
          // the new building's sheet is open over the build tool: Escape would close that sheet, not the tool, and the
          // next tap hit the leaving sheet (V1 of first-10-minutes-e was this artifact, day 9h); close the tool only
          // when no sheet came up
          if (s2.tool === 'build' && !(await page.locator('#sheets .sheet:not(.is-leaving)').count())) await page.keyboard.press('Escape');
          // the new building's sheet opens with its own "Naprawa" (the missing road stretch): the player takes it
          const next = page.locator('#sheets .sheet:last-child .fix-btn:not(.is-disabled)');
          if (placed && await next.count()) {
            const l2 = ((await next.first().textContent()) ?? '').trim().replace(/\s+/g, ' ');
            const r0 = await page.evaluate(() => window.__marchia.app.world.state.roads.filter(Boolean).length);
            await tapSel('#sheets .sheet:last-child .fix-btn:not(.is-disabled)');
            await frames(3);
            const r1 = await page.evaluate(() => window.__marchia.app.world.state.roads.filter(Boolean).length);
            lk.act += ` -> ${l2} (${r1 > r0 ? 'road +' + (r1 - r0) : 'no road change'})`;
            if (first) { out.firstLinked = { t: ((await sim()).tick - tStart) / 10, taps: out.taps - tapsBefore, roads: r1 - r0 }; await step('after road fix', { shot: await shot('road') }); }
          }
        } else lk.act += s1.coins !== s.coins ? ' (applied)' : ' (no visible effect)';
      }
      for (let i = 0; i < 3 && await page.locator('#sheets .sheet').count(); i++) { out.taps++; await page.keyboard.press('Escape'); await settle(); }
    }
    out.looks.push(lk);
    log('look', lk.t, '|', lk.card.slice(0, 80), '|', lk.act || '-', '| coins', lk.coins, 'rank', lk.rank);
  };
  await look(true);
  const end = tStart + MINUTES * 600;
  let nextLook = (await sim()).tick + 300;
  const shotAt = new Set([60, 180, 300]);
  while (true) {
    const s = await sim();
    if (s.tick >= end) break;
    await page.evaluate(() => { const a = window.__marchia.app; for (let i = 0; i < 50; i++) a.loop.tickOnce(); });
    await frames(1);
    const a = await page.evaluate(auditPage);
    const t = (s.tick + 50 - tStart) / 10;
    note('card', a.stall, t); note('notice', a.notice, t); note('ev', a.ev, t); note('rank', a.rank, t); note('plaque', a.plaque, t);
    for (const x of a.toasts) note('toast', x, t);
    for (const m of shotAt) if (t >= m) { shotAt.delete(m); await step('minute ' + m / 60, { shot: await shot('min' + m / 60) }); }
    if (s.tick + 50 >= nextLook) { nextLook += 300; await look(false); }
  }
  out.end = await sim();
  out.wallS = (Date.now() - T0) / 1000;
  writeFileSync(resolve(shotDir, `valley5-${w}x${h}.json`), JSON.stringify(out, null, 1));
  await browser.close();
  return out;
}

for (const s of sizes) {
  const o = await run(s);
  console.log(JSON.stringify({ size: o.size, firstBuild: o.firstBuild, builds: o.builds, end: o.end, taps: o.taps, errors: o.errors.length, wallS: o.wallS }));
}
