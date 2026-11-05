// Research shadow pass (docs/research/2026-11-05-shadow-pass.md): before/after shots of the shadow-pass cuts on ONE
// page (setup, scatter and camera from tools/render4-shadows.mjs; unpatched build, ?debug=1). Render time frozen.
//   a   = shadow map one sim tick older than the picture (option A at x4: 0.67 tick per 60 fps frame, 1.33 at 30 fps)
//   b   = shadow frustum radius x K (default 0.6)
//   base= shipped state, same tick as a and b
// Usage: node tools/shadow9-shots.mjs <baseUrl> <quality> <portrait|landscape> <dist=60> <outDir> [wagons=100]
// env DPR (default 2), K. Shots: <outDir>/<quality>-<orient>-<dist>-{base,a,b}.png
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [base, quality = 'high', orient = 'portrait', distS = '60', outDir = '.', wagonsS = '100'] = process.argv.slice(2);
const d = Number(distS), wagons = Number(wagonsS), K = Number(process.env.K ?? 0.6);
mkdirSync(outDir, { recursive: true });
const benchCmds = JSON.parse(readFileSync(new URL('./frame-cost-bench.json', import.meta.url), 'utf8'));
const url = `${base.replace(/\/?$/, '/')}?play=sandbox&ff=30&speed=0&quality=${quality}&dynres=0&debug=1`;
const viewport = orient === 'portrait' ? { width: 412, height: 915 } : { width: 915, height: 412 };

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const t0 = performance.now();
const page = await (await browser.newContext({ viewport, deviceScaleFactor: Number(process.env.DPR ?? 2), isMobile: true, hasTouch: true })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => {
  const G = { fb: null, frames: 0, draws: 0, drawsOff: 0, tris: 0, trisOff: 0 };
  window.__gl = G;
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    const P = C.prototype;
    const wrap = (name, pre) => { const f = P[name]; if (f) P[name] = function (...a) { pre(a); return f.apply(this, a); }; };
    const add = (n) => { if (G.fb !== null) { G.drawsOff++; G.trisOff += n; } else { G.draws++; G.tris += n; } };
    wrap('bindFramebuffer', (a) => { G.fb = a[1]; });
    wrap('drawArrays', (a) => add(a[0] === 4 ? a[2] / 3 : 0));
    wrap('drawElements', (a) => add(a[0] === 4 ? a[1] / 3 : 0));
    wrap('drawArraysInstanced', (a) => add(a[0] === 4 ? (a[2] / 3) * a[3] : 0));
    wrap('drawElementsInstanced', (a) => add(a[0] === 4 ? (a[1] / 3) * a[4] : 0));
  }
  const raf = window.requestAnimationFrame.bind(window);
  const tick = () => { G.frames++; raf(tick); };
  raf(tick);
});
await page.goto(url);
await page.waitForFunction(() => window.__marchia && window.__marchia.ready, null, { timeout: 180000 });
await page.evaluate(() => window.__marchia.app.view.texturesReady).catch(() => {});
await page.evaluate(({ n, cmds }) => {
  const app = window.__marchia.app, st = app.world.state;
  st.coins = 1e9; st.town.rank = 5;
  st.rain = []; // dry weather: no rain streaks, full sun shadows (set before any tick: same state on every page)
  for (const c of cmds) { if (c.t === 'road' && c.surface === 2) c.surface = 1; app.loop.enqueue(c); }
  app.loop.flushCommands();
  for (const b of st.buildings) if (b.type === 'warehouse') for (const g of ['wood', 'grain', 'flour']) { b.stock[g] += 48; st.ledger.produced[g] += 48; }
  const stable = st.buildings.find((b) => b.type === 'stable');
  for (let i = 0; i < n; i++) app.loop.enqueue({ t: 'buyWagon', stable: stable.id });
  app.loop.flushCommands();
  for (let i = 0; i < 600 * 3; i++) app.loop.tickOnce();
  // same deterministic scatter as tools/render-scale.mjs: idle wagons onto the roads, 60 % loaded (throwaway page)
  const t = app.world.terrain, roads = [];
  for (let c = 0; c < st.roads.length; c++) if (st.roads[c] > 0 && !t.water[c]) roads.push(c);
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const goods = ['wood', 'grain', 'flour', 'planks', 'bread'];
  let k = 0;
  for (const w of st.wagons) {
    if (w.status.k !== 'IDLE' || w.job) continue;
    w.at = roads[Math.floor(rnd() * roads.length)]; w.next = -1; w.edgeT = 0; w.path = []; w.pathVer = -1; w.busyTicks = 0;
    w.status = { k: 'RETURNING' };
    if (k++ % 5 < 3) { w.cargoGood = goods[k % goods.length]; w.cargoQty = 4; }
  }
  for (let i = 0; i < 120; i++) app.loop.tickOnce();
  app.loop.speed = 0;
  // the game UI is the same in both shots and covers the road: hide it (sheets, HUD, pins)
  for (const el of Object.values(app.layers ?? {})) if (el && el.style) el.style.visibility = 'hidden';
}, { n: wagons, cmds: benchCmds });
// the busiest spot (render-scale "near"): the cell with most moving wagons within 6 cells
const target = await page.evaluate(() => {
  const app = window.__marchia.app, st = app.world.state, w = app.world.terrain.w;
  const cnt = new Map();
  for (const wg of st.wagons) if (wg.next >= 0 || wg.status.k !== 'IDLE') cnt.set(wg.at, (cnt.get(wg.at) ?? 0) + 1);
  let best = -1, bn = 0;
  for (const [c] of cnt) { let s = 0; for (const [c2, k2] of cnt) { const dx = c2 % w - c % w, dy = Math.floor(c2 / w) - Math.floor(c / w); if (dx * dx + dy * dy < 36) s += k2; } if (s > bn) { bn = s; best = c; } }
  return { x: (best % w + 0.5) * 4, z: (Math.floor(best / w) + 0.5) * 4, tick: st.tick, n: bn };
});

const waitFrames = (n) => page.evaluate((n) => new Promise((res) => { const G = window.__gl; const s = G.frames; const p = () => (G.frames - s >= n ? res() : requestAnimationFrame(p)); requestAnimationFrame(p); }), n);
const freeze = (on) => page.evaluate((on) => {
  const v = window.__marchia.app.view;
  if (!v.__frame0) v.__frame0 = v.frame.bind(v);
  v.frame = on ? (a) => v.__frame0(a, 0) : v.__frame0;
}, on);
const log = (m) => console.error(`[shadow9] ${quality} ${orient} ${d} m ${m} (${Math.round(performance.now() / 1000)} s)`);
await page.evaluate(({ x, z, d }) => { const app = window.__marchia.app; app.view.rig.set(x, z, d, 0.6); app.view.rig.follow?.(null); }, { ...target, d });
await freeze(false);
await page.waitForTimeout(2500);
await freeze(true);
await waitFrames(1);
const shot = async (name) => { await page.screenshot({ path: `${outDir}/${quality}-${orient}-${d}-${name}.png`, timeout: 600000 }); log(name); };
// a: shadow map rendered at tick T, picture at T+1
await page.evaluate(() => { const s = window.__marchia.app.view.lighting.sun.shadow; s.autoUpdate = false; s.needsUpdate = true; });
await waitFrames(1);
const moved = await page.evaluate(() => { const app = window.__marchia.app; app.loop.tickOnce(); return app.world.state.wagons.filter((w) => w.next >= 0).length; });
await waitFrames(1);
await shot('a');
// base: same tick, fresh map
await page.evaluate(() => { const s = window.__marchia.app.view.lighting.sun.shadow; s.autoUpdate = true; });
await waitFrames(1);
await shot('base');
// b: tighter frustum
await page.evaluate((K) => { const L = window.__marchia.app.view.lighting; L.__fit0 = L.fitShadow.bind(L); L.fitShadow = (t, r) => L.__fit0(t, r * K); }, K);
await waitFrames(1);
await shot('b');
const tick = await page.evaluate(() => window.__marchia.app.world.state.tick);
console.log(JSON.stringify({ quality, orient, d, wagons, K, target, moved, tick, errors: errs }));
await browser.close();
