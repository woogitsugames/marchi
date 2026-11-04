// Research render #4 (docs/research/2026-11-04-render4-shadows.md): before/after shots and shadow-pass counts for
// the mid wagon rig / far cargo shadows, on ONE page at ONE tick (the sim is paused; the shadow modes are switched
// at runtime with WagonsView.setShadowTiers from docs/research/2026-11-04-render4-shadows.patch).
// Usage: node tools/render4-shadows.mjs <baseUrl> <quality> <portrait|landscape> <dists=50,80,110> <outDir> [wagons=200] [shots=1]
// env DPR (default 2), MEASURE=0 skips the GL counts (shots only; SwiftShader at DPR 2 takes ~1 min per frame).
// Serve a build WITH the patch applied (?debug=1 exposes window.__marchia.app). Without the patch (setShadowTiers
// missing) it only measures the shipped state ("unpatched").
// Prints one JSON line: per distance and mode, GL draws/triangles in the main and offscreen (shadow) passes,
// wagons drawn per LOD tier. Shots: <outDir>/<quality>-<orient>-<dist>-{before,after}.png
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [base, quality = 'high', orient = 'portrait', distsS = '50,80,110', outDir = '.', wagonsS = '200', shotsS = '1'] = process.argv.slice(2);
const dists = distsS.split(',').map(Number), wagons = Number(wagonsS), shots = shotsS !== '0';
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
const patched = await page.evaluate(() => typeof window.__marchia.app.view.wagons.setShadowTiers === 'function');

const measure = () => page.evaluate(() => new Promise((res) => {
  const G = window.__gl;
  const f0 = G.frames;
  const z = () => { G.draws = G.drawsOff = G.tris = G.trisOff = 0; };
  // skip one frame, then count over 3 frames
  const wait = (n, cb) => { const s = G.frames; const p = () => (G.frames - s >= n ? cb() : requestAnimationFrame(p)); requestAnimationFrame(p); };
  wait(1, () => { z(); const s = G.frames; wait(3, () => {
    const f = G.frames - s, v = window.__marchia.app.view.wagons;
    const vis = (p) => p.meshes.reduce((a, m) => Math.max(a, m.visible ? m.count : 0), 0);
    res({ drawsMain: +(G.draws / f).toFixed(1), drawsShadow: +(G.drawsOff / f).toFixed(1), trisMain: Math.round(G.tris / f), trisShadow: Math.round(G.trisOff / f),
      near: vis(v.near.horse), mid: vis(v.mid.horse), far: vis(v.lod1), framesSkipped: s - f0 });
  }); });
}));
const measuring = process.env.MEASURE !== '0';
const MODES = patched ? [['before', 'rig', true], ['after', 'none', false], ...(measuring ? [['proxy', 'proxy', false]] : [])] : [['unpatched']];
// freeze render time (water, wind, rain, idle horses) once the camera has settled: only the shadow mode differs
const freeze = (on) => page.evaluate((on) => {
  const v = window.__marchia.app.view;
  if (!v.__frame0) v.__frame0 = v.frame.bind(v);
  v.frame = on ? (a) => v.__frame0(a, 0) : v.__frame0;
}, on);
const out = { quality, orient, wagons, target, patched, runs: [] };
for (const d of dists) {
  await page.evaluate(({ x, z, d }) => { const app = window.__marchia.app; app.view.rig.set(x, z, d, 0.6); app.view.rig.follow?.(null); }, { ...target, d });
  await freeze(false);
  await page.waitForTimeout(2500);
  await freeze(true);
  for (const [label, mid, farCargo] of MODES) {
    if (mid) await page.evaluate(({ mid, farCargo }) => window.__marchia.app.view.wagons.setShadowTiers(mid, farCargo), { mid, farCargo });
    const r = measuring ? await measure() : {};
    if (shots && (label === 'before' || label === 'after')) {
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${outDir}/${quality}-${orient}-${d}-${label}.png`, timeout: 600000 });
    }
    console.error(`[render4] ${quality} ${orient} ${d} m ${label}: ${JSON.stringify(r)} (${Math.round(performance.now() / 1000)} s)`);
    out.runs.push({ dist: d, label, camDist: await page.evaluate(() => window.__marchia.app.view.rig.dist), ...r });
  }
}
out.tickAtEnd = await page.evaluate(() => window.__marchia.app.world.state.tick);
out.errors = errs;
console.log(JSON.stringify(out));
await browser.close();
