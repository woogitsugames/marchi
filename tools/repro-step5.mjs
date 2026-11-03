// Repro: mission I tutorial step 5 (bridge) with real Playwright input on a cold start.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL0 = process.env.URL0 ?? 'http://127.0.0.1:5194/';
const MODE = process.env.MODE ?? 'mouse'; // mouse | touch
const OUT = process.env.OUT ?? '';
const [w, h] = (process.argv[2] ?? '412x915').split('x').map(Number);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: MODE === 'touch', hasTouch: MODE === 'touch', locale: 'pl-PL' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message)); page.on('framenavigated', (f) => { if (f === page.mainFrame()) console.log('NAV', f.url()); }); page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
const log = (...a) => console.log(new Date().toISOString().slice(14, 23), ...a);
const tap = async (x, y) => { if (MODE === 'touch') await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); await page.waitForTimeout(400); };
const tapSel = async (sel) => { const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error('no ' + sel); await tap(b.x + b.width / 2, b.y + b.height / 2); };
const state = () => page.evaluate(() => {
  const a = window.__marchia.app, t = a.tutorial;
  const ring = document.querySelector('.tutorial .tut-ring.is-shown');
  return { step: t ? t.current : 0, text: document.querySelector('.tutorial .tut-text')?.textContent?.slice(0, 50), ring: ring ? [...Object.values(ring.getBoundingClientRect().toJSON())].map(Math.round).slice(0, 4).join(',') : null,
    tool: a.hud?.tool ?? a.tool ?? null, tick: a.world.state.tick, speed: a.loop.speed, roads: a.world.state.netVersion, ghost: a.ghosts?.tut?.length ?? null, top: (() => { const e = document.querySelector('#sheets .sheet:last-child'); return e ? 'sheet ' + [...Object.values(e.getBoundingClientRect().toJSON())].map(Math.round).slice(0, 4).join(',') : null; })(), note: document.querySelector('.tut-note-wrap')?.style.transform + ' w' + document.querySelector('.tut-note-wrap')?.offsetWidth + ' h' + document.querySelector('.tut-note-wrap')?.offsetHeight + ' ' + document.querySelector('.tut-note-wrap')?.className, paused: document.querySelector('.tutorial')?.className };
});
await page.goto(URL0 + '?debug=1&lang=pl&quality=low');
await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 120000 });
await page.waitForTimeout(1000);
await tapSel('.menu-item >> nth=0');
await page.waitForSelector('.letter [data-a="start"]', { timeout: 30000 });
await page.waitForTimeout(500);
await tapSel('.letter [data-a="start"]');
await page.waitForFunction(() => !!document.querySelector('.tutorial .tut-text')?.textContent, null, { timeout: 15000 });
const seen = new Set();
let guard = 0;
while (guard++ < 30) {
  const s = await state();
  log(JSON.stringify(s));
  if (OUT && !seen.has(s.step)) { seen.add(s.step); await page.waitForTimeout(600); await page.screenshot({ path: OUT + `-s${s.step}.jpg`, type: 'jpeg', quality: 55, timeout: 120000 }); }
  if (s.step === 0 || s.step >= 5) break;
  if (s.step === 4) {
    // tap once and wait for the frame: under SwiftShader a frame takes ~1 s, and a second tap on
    // "Droga" while `current` already reads 5 toggles the tool off (the day-6 research artefact)
    if (s.tool !== 'road' && s.ring) await tapSel('.rail [data-tool="road"]');
    await page.waitForFunction(() => window.__marchia.app.tutorial?.current !== 4, null, { timeout: 8000 }).catch(() => {});
    continue;
  }
  const r = await page.evaluate(() => {
    const ring = document.querySelector('.tutorial .tut-ring.is-shown'); if (!ring) return null;
    const b = ring.getBoundingClientRect();
    const wb = document.querySelector('.waybill-wrap:not(.is-collapsed) .wb-line');
    if (wb) { const q = wb.getBoundingClientRect(); if (q.top >= b.top - 2 && q.bottom <= b.bottom + 2) return [q.left + q.width / 2, q.top + q.height / 2]; }
    return [b.left + b.width / 2, b.top + b.height / 2];
  });
  if (r) await tap(r[0], r[1]);
  await page.waitForTimeout(900);
}
// observe step 5 for a few seconds
for (let i = 0; i < 4; i++) { await page.waitForTimeout(700); log('obs', JSON.stringify(await state())); }
if (OUT) await page.screenshot({ path: OUT + '-step5.jpg', type: 'jpeg', quality: 55, timeout: 120000 });
await page.evaluate(() => {
  const a = window.__marchia.app, d = a.draft; window.__dlog = [];
  for (const k of ['start', 'end', 'cancel']) { const f = d[k].bind(d); d[k] = (...args) => { window.__dlog.push(k + ' ' + args.map(Math.round).join(',') + ' cells=' + (d.cells?.length ?? '?') + ' first=' + d.cells?.[0] + ' last=' + d.cells?.[d.cells.length - 1]); return f(...args); }; }
});
for (let attempt = 0; attempt < (Number(process.env.TRIES) || 3); attempt++) {
  const d = await page.evaluate((process_env_full) => {
    const a = window.__marchia.app, cells = a.ghosts?.tut;
    if (!cells?.length) return null;
    const roads = a.world.state.roads;
    let i0 = cells.findIndex((c) => !roads[c]), i1 = cells.length - 1 - [...cells].reverse().findIndex((c) => !roads[c]);
    const span = process_env_full ? cells : cells.slice(Math.max(0, i0 - 1), i1 + 2);
    return { pts: span.map((c) => a.view.cellToScreen(c)), n: cells.length, span: span.length, i0, i1 };
  }, process.env.FULL === '1');
  log('ghost', d ? d.n + ' cells span ' + d.span + ' i0 ' + d.i0 + ' i1 ' + d.i1 + ', from ' + JSON.stringify(d.pts[0]) + ' to ' + JSON.stringify(d.pts[d.pts.length - 1]) : null);
  if (!d) break;
  const pts = d.pts.filter((p) => p.x >= 4 && p.x <= w - 4 && p.y >= 4 && p.y <= h - 4);
  log('onscreen pts', pts.length, JSON.stringify(pts.map((p) => [Math.round(p.x), Math.round(p.y)])));
  log('hit at start', await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + '.' + e.className : null; }, [pts[0].x, pts[0].y]));
  if (MODE === 'touch') {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0].x, y: pts[0].y }] });
    for (const p of pts.slice(1)) { await page.waitForTimeout(40); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y }] }); }
    await page.waitForTimeout(150);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down();
    for (const p of pts.slice(1)) { await page.mouse.move(p.x, p.y, { steps: 3 }); await page.waitForTimeout(20); }
    await page.mouse.up();
  }
  await page.waitForTimeout(1500);
  const toast = await page.evaluate(() => document.querySelector('.toasts')?.textContent?.trim() ?? '');
  log('dlog', JSON.stringify(await page.evaluate(() => window.__dlog.splice(0))));
  log('after drag', JSON.stringify(await state()), 'toast:', toast);
  if (OUT) await page.screenshot({ path: OUT + `-drag${attempt}.jpg`, type: 'jpeg', quality: 55, timeout: 120000 });
  if ((await state()).step !== 5) break;
}
await browser.close();
