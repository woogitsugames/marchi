// Frame cost after render #1-#6, D-126 and D-133 (research day 9d, 2026-11-05).
// One page per (scene, quality); for each camera it drives the REAL App.frame synchronously as "synthetic seconds":
// 60 calls of app.frame(now += 16.67 ms) at loop speed x4 (so 40 sim ticks/s exactly as in the game, with onTick,
// the UI samplers, the HUD, pins, sheets and the renderer). The browser's own rAF chain is parked meanwhile.
// Per synthetic second (repeated REPS times, median and min-max reported):
//   - wall ms of the whole second and its parts (in-page wrappers): sim step (loop.advance - onTick), view.afterTick,
//     onTick other (pace / input-wait / fleet samplers, audio observer, chronicle), view.frame (of which wagons.frame,
//     renderer.render, shadow-map render), hud.update, markers.update, rest of App.frame (ranking, speed hint,
//     sheets every 250 ms, occluder rects, ghost);
//   - program parameter rebuilds per render (customProgramCacheKey calls), GL draws main/shadow, triangles, upload KB;
//   - CPU profile (0.2 ms sampling) over all REPS seconds, each sample attributed to the innermost src/ file, or to a
//     three.js WebGLRenderer bucket (getProgram/getParameters, shadow pass, projectObject, draw submit, other) when
//     the stack is inside renderer.render, plus GC;
//   - sampling heap profiler (512 B) over separate REPS seconds: MB allocated per game second, top allocators.
// GL draw calls are counted but not forwarded during synthetic seconds (SwiftShader raster would block the main
// thread for seconds per frame); everything else, uniforms and buffer uploads included, goes to the driver.
// Then a short real rAF window (x4) for CDP style-recalc / layout ms per real frame (the synthetic loop never paints).
// Usage (serve `vite build --sourcemap --minify false --outDir dist-perf9` with `vite preview --port 5199`):
//   node tools/frame9-cost.mjs <baseUrl> <scene> <quality> [cams=near,mid] [reps=4] [dpr=0.5]
//   scene: sandbox50 | sandbox100 | sandbox200 (bench roads + N wagons, scattered as in render-scale.mjs)
//          m13 (3 wagons bought at 0:20, measured from 3:30, the mission's stall peak) | m12 (start fleet, from 4:00)
// Prints one JSON line. SwiftShader + desktop CPU: read counts and ratios, not phone milliseconds.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { SourceMapConsumer } = require('source-map-js');

const [base, scene = 'sandbox100', quality = 'high', camsS = 'near,mid', repsS = '4', dprS = '0.5'] = process.argv.slice(2);
const reps = Number(repsS), dpr = Number(dprS);
const cams = camsS.split(',');
const CAM = { near: 60, mid: 160, far: 320 };
const benchCmds = JSON.parse(readFileSync(new URL('./frame-cost-bench.json', import.meta.url), 'utf8'));
const sandboxN = scene.startsWith('sandbox') ? Number(scene.slice(7)) : 0;
const mission = sandboxN ? 'sandbox' : scene;
// m15: the busiest stretch of XV (frame9-m13-peak: 4-5 wagons moving, 3 stalled from 6:00); FF=<s> overrides
const ff = process.env.FF ? Number(process.env.FF) : mission === 'sandbox' ? 30 : mission === 'm13' ? 20 : mission === 'm15' ? 390 : 240;
const url = `${base.replace(/\/?$/, '/')}?play=${mission}&ff=${ff}&speed=0&quality=${quality}&dynres=0&perf=1&debug=1`;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info', ...(process.env.JSFLAGS ? ['--js-flags=' + process.env.JSFLAGS] : [])] }); // JSFLAGS=--no-turbo-inlining: allocations land in the callee, not the inlining caller
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await page.addInitScript(() => {
  const G = { on: false, skipDraw: false, calls: 0, draws: 0, drawsOff: 0, tris: 0, trisOff: 0, upBytes: 0, fb: null };
  window.__gl = G;
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    const P = C.prototype;
    for (const name of Object.getOwnPropertyNames(P)) {
      const d = Object.getOwnPropertyDescriptor(P, name);
      if (!d || typeof d.value !== 'function' || name === 'constructor') continue;
      const f = d.value;
      let pre = null;
      const draw = (count, inst) => { const off = G.fb !== null; if (off) { G.drawsOff++; G.trisOff += count / 3 * inst; } else { G.draws++; G.tris += count / 3 * inst; } };
      switch (name) {
        case 'drawArrays': pre = (a) => draw(a[0] === 4 ? a[2] : 0, 1); break;
        case 'drawElements': pre = (a) => draw(a[0] === 4 ? a[1] : 0, 1); break;
        case 'drawArraysInstanced': pre = (a) => draw(a[0] === 4 ? a[2] : 0, a[3]); break;
        case 'drawElementsInstanced': pre = (a) => draw(a[0] === 4 ? a[1] : 0, a[4]); break;
        case 'bindFramebuffer': pre = (a) => { G.fb = a[1]; }; break;
        case 'bufferData': pre = (a) => { if (G.on) { const s = a[1]; G.upBytes += typeof s === 'number' ? s : s ? s.byteLength : 0; } }; break;
        case 'bufferSubData': pre = (a) => { if (!G.on) return; const s = a[2]; const e = s?.BYTES_PER_ELEMENT ?? 1; G.upBytes += a.length >= 5 && a[4] ? a[4] * e : (s ? s.byteLength - (a[3] ?? 0) * e : 0); }; break;
        default:
      }
      const isDraw = name.startsWith('draw');
      P[name] = pre
        ? function (...a) { if (G.on) G.calls++; pre(a); if (isDraw && G.skipDraw) return undefined; return f.apply(this, a); }
        : function (...a) { if (G.on) G.calls++; return f.apply(this, a); };
    }
  }
});

const cdp = await ctx.newCDPSession(page);
await page.goto(url);
await page.waitForFunction(() => window.__marchia && window.__marchia.ready, null, { timeout: 240000 });
await page.evaluate(() => window.__marchia.app.view.texturesReady).catch(() => {});
await page.waitForTimeout(2000);

const setup = await page.evaluate(({ n, cmds, mission }) => {
  const app = window.__marchia.app;
  const st = app.world.state;
  if (mission === 'sandbox') {
    st.coins = 1e9; st.town.rank = 5;
    for (const c of cmds) { if (c.t === 'road' && c.surface === 2) c.surface = 1; app.loop.enqueue(c); }
    app.loop.flushCommands();
    for (const b of st.buildings) if (b.type === 'warehouse') for (const g of ['wood', 'grain', 'flour']) { b.stock[g] += 48; st.ledger.produced[g] += 48; }
    const stable = st.buildings.find((b) => b.type === 'stable');
    for (let i = 0; i < n; i++) app.loop.enqueue({ t: 'buyWagon', stable: stable.id });
    app.loop.flushCommands();
    for (let i = 0; i < 600 * 3; i++) app.loop.tickOnce();
  } else if (mission === 'm13') {
    // the ladder's "wlasciwa" play (tools/bot-m13.ts): three wagons at 0:20, then to 3:30 (stalled buildings 1.9-2.1)
    const stable = st.buildings.find((b) => b.type === 'stable');
    for (let i = 0; i < 3; i++) app.loop.enqueue({ t: 'buyWagon', stable: stable.id });
    app.loop.flushCommands();
    while (st.tick < 210 * 10 && st.mission.result === 'running') app.loop.tickOnce();
  }
  return { tick: st.tick, buildings: st.buildings.length, wagons: st.wagons.length, result: st.mission.result };
}, { n: sandboxN, cmds: benchCmds, mission });

// optional shadow-pass prototype (tools/shadow9-modes.js): SHADOW_MODE=a|b|c, SHADOW_K=<radius factor for b>
if (process.env.SHADOW_MODE) {
  const src = readFileSync(new URL('./shadow9-modes.js', import.meta.url), 'utf8').replace(/^\/\/.*\n/gm, '');
  setup.shadowMode = await page.evaluate(`(${src.trim().replace(/;$/, '')})(${JSON.stringify(process.env.SHADOW_MODE)}, ${Number(process.env.SHADOW_K ?? 0)})`);
}

const doScatter = () => page.evaluate(() => {
  const app = window.__marchia.app, st = app.world.state, t = app.world.terrain;
  const roads = [];
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
  return k;
});

// in-page wrappers + synthetic second
await page.evaluate(() => {
  const app = window.__marchia.app, v = app.view;
  const S = {};
  window.__f9 = S;
  const keys = ['advance', 'onTick', 'vAfterTick', 'vFrame', 'wFrame', 'render', 'shadow', 'hud', 'markers', 'appFrame', 'rank'];
  S.reset = () => { for (const k of keys) S[k] = 0; S.frames = 0; S.cpk = 0; S.renders = 0; S.rankN = 0; };
  S.reset();
  const wrap = (obj, name, key, extra) => {
    const f = obj[name].bind(obj);
    obj[name] = (...a) => { const t = performance.now(); try { return f(...a); } finally { S[key] += performance.now() - t; if (extra) extra(); } };
  };
  wrap(app.loop, 'advance', 'advance');
  const ot = app.loop.onTick;
  app.loop.onTick = () => { const t = performance.now(); try { ot(); } finally { S.onTick += performance.now() - t; } };
  wrap(v, 'afterTick', 'vAfterTick');
  wrap(v, 'frame', 'vFrame');
  wrap(v.wagons, 'frame', 'wFrame');
  wrap(v.renderer, 'render', 'render', () => { S.renders++; });
  wrap(v.renderer.shadowMap, 'render', 'shadow');
  if (app.hud) wrap(app.hud, 'update', 'hud');
  wrap(app.markers, 'update', 'markers');
  wrap(app.ranking, 'get', 'rank');
  const fr = app.frame.bind(app);
  app.frame = (now) => { const t = performance.now(); try { fr(now); } finally { S.appFrame += performance.now() - t; S.frames++; } };
  // program parameter rebuilds: customProgramCacheKey() runs once per getProgram() (render5-materials.mjs)
  let any = null;
  v.scene.traverse((o) => { if (o.material && !any) any = Array.isArray(o.material) ? o.material[0] : o.material; });
  let proto = Object.getPrototypeOf(any);
  while (proto && !Object.prototype.hasOwnProperty.call(proto, 'customProgramCacheKey')) proto = Object.getPrototypeOf(proto);
  const pf = proto.customProgramCacheKey;
  proto.customProgramCacheKey = function () { S.cpk++; return pf.call(this); };
  const seen = new WeakSet();
  S.wrapOwn = () => v.scene.traverse((o) => {
    if (!o.material) return;
    for (const m of [].concat(o.material)) {
      if (seen.has(m) || !Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey')) continue;
      seen.add(m); const f = m.customProgramCacheKey; m.customProgramCacheKey = function () { S.cpk++; return f.call(this); };
    }
  });
  // park the browser's rAF chain while a synthetic second runs (App.frame re-requests itself)
  const raf = window.requestAnimationFrame.bind(window);
  S.parked = true; S.held = [];
  window.requestAnimationFrame = (f) => (S.parked ? (S.held.push(f), 0) : raf(f));
  S.now = performance.now();
  S.second = () => {
    S.parked = true;
    S.now = Math.max(S.now, app.lastFrame);
    window.__gl.skipDraw = true; // CPU side only: three.js does all its work and GL state calls, the GPU rasterises nothing
    app.loop.speed = 4;
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) { S.now += 1000 / 60; app.frame(S.now); }
    const ms = performance.now() - t0;
    app.loop.speed = 0;
    window.__gl.skipDraw = false;
    S.held.length = 0;
    return ms;
  };
  // the browser's own frames stay parked between synthetic seconds too (no SwiftShader raster competing for the
  // CPU); only the real-frame window below lets them run
  S.unpark = () => { S.parked = false; S.now = performance.now(); app.lastFrame = S.now; raf((t) => app.frame(t)); };
  S.park = () => { S.parked = true; };
});

const maps = new Map();
const consumerFor = async (u) => {
  if (maps.has(u)) return maps.get(u);
  let c = null;
  try { const r = await fetch(u + '.map'); if (r.ok) c = new SourceMapConsumer(await r.json()); } catch { /* none */ }
  maps.set(u, c); return c;
};
const resolve = async (cf) => {
  const fn = cf.functionName || '(anon)';
  if (cf.url && cf.url.endsWith('.js')) {
    const c = await consumerFor(cf.url);
    if (c) { const o = c.originalPositionFor({ line: cf.lineNumber + 1, column: cf.columnNumber }); if (o.source) return { fn, src: o.source.replace(/^(\.\.\/)+/, '').replace(/^node_modules\//, ''), line: o.line }; }
    return { fn, src: cf.url.split('/').pop(), line: cf.lineNumber + 1 };
  }
  return { fn, src: '', line: 0 };
};
// three.module.js r181 line numbers (node_modules/three/build/three.module.js)
const THREE_RENDER = 16628, THREE_SHADOW = 8644;
const isThree = (f) => f.src.includes('three/build/three');

const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]; };
const stat = (a) => ({ med: +quantile(a, 0.5).toFixed(2), min: +Math.min(...a).toFixed(2), max: +Math.max(...a).toFixed(2) });

const T0 = Date.now();
const log = (m) => process.stderr.write(`[${((Date.now() - T0) / 1000).toFixed(0)}s] ${scene} ${quality} ${m}\n`);
log('setup ' + JSON.stringify(setup));
const out = { scene, quality, dpr, reps, setup, cams: {} };
for (const cam of cams) {
  const scattered = sandboxN ? await doScatter() : 0;
  await page.evaluate(({ d }) => {
    const app = window.__marchia.app, st = app.world.state, w = app.world.terrain.w;
    const cnt = new Map();
    for (const wg of st.wagons) if (wg.next >= 0 || wg.status.k !== 'IDLE') cnt.set(wg.at, (cnt.get(wg.at) ?? 0) + 1);
    let best = -1, bn = 0;
    for (const [c] of cnt) { let s = 0; for (const [c2, k2] of cnt) { const dx = c2 % w - c % w, dy = Math.floor(c2 / w) - Math.floor(c / w); if (dx * dx + dy * dy < 36) s += k2; } if (s > bn) { bn = s; best = c; } }
    let x, z;
    if (best >= 0) { x = (best % w + 0.5) * 4; z = (Math.floor(best / w) + 0.5) * 4; } else { const b = st.buildings[0]; x = (b.x + 1) * 4; z = (b.y + 1) * 4; }
    app.view.rig.set(x, z, d, 0.6);
  }, { d: CAM[cam] });
  // settle: 3 synthetic seconds (JIT, camera, first pins)
  await page.evaluate(() => { const S = window.__f9; S.wrapOwn(); for (let i = 0; i < 3; i++) S.second(); });

  log(cam + ' settled');
  // --- timing reps (no profiler attached)
  const rows = [];
  for (let r = 0; r < reps; r++) {
    rows.push(await page.evaluate(() => {
      const S = window.__f9, G = window.__gl, app = window.__marchia.app;
      S.reset(); for (const k of ['calls', 'draws', 'drawsOff', 'tris', 'trisOff', 'upBytes']) G[k] = 0; G.on = true;
      const tick0 = app.world.state.tick;
      const wall = S.second();
      G.on = false;
      const f = Math.max(1, S.frames);
      return {
        wall, ticks: app.world.state.tick - tick0, frames: S.frames,
        sim: S.advance - S.onTick, afterTick: S.vAfterTick, onTickOther: S.onTick - S.vAfterTick,
        viewFrame: S.vFrame, wagonsFrame: S.wFrame, render: S.render, shadow: S.shadow, viewOther: S.vFrame - S.wFrame - S.render,
        hud: S.hud, markers: S.markers, rank: S.rank, appRest: S.appFrame - S.advance - S.vFrame - S.hud - S.markers - S.rank,
        cpkPerRender: S.cpk / Math.max(1, S.renders), draws: G.draws / f, drawsShadow: G.drawsOff / f,
        tris: G.tris / f, trisShadow: G.trisOff / f, glCalls: G.calls / f, uploadKB: G.upBytes / f / 1024,
      };
    }));
  }
  const keys = Object.keys(rows[0]);
  const r = { scattered, timing: Object.fromEntries(keys.map((k) => [k, stat(rows.map((x) => x[k]))])) };

  log(cam + ' timing done');
  // --- CPU profile over reps seconds
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  const profWall = await page.evaluate((n) => { let s = 0; for (let i = 0; i < n; i++) s += window.__f9.second(); return s; }, reps);
  const { profile } = await cdp.send('Profiler.stop');
  await cdp.send('Profiler.disable');
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const res = new Map();
  for (const n of profile.nodes) res.set(n.id, await resolve(n.callFrame));
  const labelCache = new Map();
  const labelOf = (id) => {
    if (labelCache.has(id)) return labelCache.get(id);
    const own = res.get(id);
    let lab;
    if (own.fn === '(garbage collector)') lab = 'GC';
    else if (own.fn === '(program)' || own.fn === '(idle)' || own.fn === '(root)') lab = own.fn;
    else {
      const chain = [];
      for (let k = id; k !== undefined; k = parent.get(k)) chain.push(res.get(k));
      const inRender = chain.some((f) => isThree(f) && f.line === THREE_RENDER);
      if (inRender) {
        if (chain.some((f) => isThree(f) && /^(getProgram|getParameters|getProgramCacheKey)/.test(f.fn))) lab = 'three: getProgram/getParameters';
        else if (chain.some((f) => isThree(f) && f.line === THREE_SHADOW)) lab = 'three: shadow pass (CPU)';
        else if (chain.some((f) => isThree(f) && f.fn === 'projectObject')) lab = 'three: projectObject (traversal, cull)';
        else if (chain.some((f) => isThree(f) && /^(renderObjects|renderObject|renderBufferDirect|setProgram|renderScene)/.test(f.fn))) lab = 'three: draw submit (setProgram, uniforms, GL)';
        else lab = 'three: render other';
      } else {
        const s = chain.find((f) => f.src.startsWith('src/'));
        lab = s ? s.src : isThree(chain[0]) ? 'three (outside render)' : `native ${own.fn}`;
      }
    }
    labelCache.set(id, lab);
    return lab;
  };
  const self = new Map();
  for (let i = 0; i < profile.samples.length; i++) self.set(profile.samples[i], (self.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i] ?? 0));
  const byLab = new Map(), byFn = new Map(); let total = 0;
  for (const [id, us] of self) {
    const lab = labelOf(id); if (lab === '(idle)' || lab === '(root)') continue;
    const t = us / 1000; total += t;
    byLab.set(lab, (byLab.get(lab) ?? 0) + t);
    const f = res.get(id); const k = `${f.fn} @${f.src.replace(/^.*three\/build\//, 'three/')}:${f.line}`;
    byFn.set(k, (byFn.get(k) ?? 0) + t);
  }
  const perS = (x) => +(x / reps).toFixed(2);
  r.profile = {
    wallMsPerS: perS(profWall), sampledMsPerS: perS(total),
    buckets: [...byLab].sort((a, b) => b[1] - a[1]).slice(0, 22).map(([k, v]) => [k, perS(v)]),
    topSelf: [...byFn].filter(([k]) => !k.startsWith('(program)')).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => [k, perS(v)]),
  };

  log(cam + ' profile done');
  // --- allocations over reps seconds
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.startSampling', { samplingInterval: 512, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  const heap0 = await page.evaluate((n) => { const h0 = performance.memory.usedJSHeapSize; for (let i = 0; i < n; i++) window.__f9.second(); return [h0, performance.memory.usedJSHeapSize]; }, reps);
  const { profile: hp } = await cdp.send('HeapProfiler.stopSampling');
  await cdp.send('HeapProfiler.disable');
  const agg = new Map(), aggFn = new Map(); let atotal = 0;
  const walk = async (n, here, hereFn) => {
    const f = await resolve(n.callFrame);
    let h = here, hf = hereFn;
    if (f.src.startsWith('src/')) hf = `${f.fn} @${f.src}:${f.line}`;
    if (f.src.startsWith('src/')) h = f.src;
    else if (isThree(f) && /^(getProgram|getParameters|getProgramCacheKey)/.test(f.fn)) { h = 'three: getProgram/getParameters'; hf = h; }
    else if (isThree(f) && f.line === THREE_RENDER) { h = 'three: render (other)'; hf = h; }
    else if (isThree(f) && f.line === THREE_SHADOW) { h = 'three: shadow pass'; hf = h; }
    if (n.selfSize) {
      const k = h ?? `${f.fn || 'native'}`; agg.set(k, (agg.get(k) ?? 0) + n.selfSize); atotal += n.selfSize;
      const kf = hf ?? k; aggFn.set(kf, (aggFn.get(kf) ?? 0) + n.selfSize);
    }
    for (const ch of n.children) await walk(ch, h && h.startsWith('three') && f.src.startsWith('src/') ? f.src : h, hf);
  };
  await walk(hp.head, null, null);
  r.alloc = {
    MBperGameS: +(atotal / 1048576 / reps).toFixed(2),
    KBperFrame: +(atotal / 1024 / reps / 60).toFixed(1),
    heapDeltaMB: +((heap0[1] - heap0[0]) / 1048576).toFixed(1),
    top: [...agg].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => [k, +(v / 1024 / reps).toFixed(0)]),
    topFn: [...aggFn].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => [k, +(v / 1024 / reps).toFixed(0)]),
  };

  log(cam + ' alloc done');
  // --- state of the scene
  r.scene = await page.evaluate(() => {
    const app = window.__marchia.app, v = app.view, ws = app.world.state.wagons, wv = v.wagons;
    const vis = (p) => p.meshes.reduce((a, m) => a + (m.visible ? m.count : 0), 0) / Math.max(1, p.meshes.length);
    const pool = app.markers.pool;
    return {
      wagons: ws.length, moving: ws.filter((w) => w.next >= 0).length,
      drawnNear: vis(wv.near.horse), drawnMid: vis(wv.mid.horse), drawnFar: vis(wv.lod1),
      pins: pool.filter((b) => b.key && b.used).length, pinPool: pool.length,
      stalls: app.ranking.get(app.world, app.loop.journal.length).length,
      sheets: [...document.querySelectorAll('.sheet')].map((e) => e.className.slice(0, 40) + (e.querySelector('.fix-dock') ? ' +dock' : '')),
      dom: document.getElementsByTagName('*').length, heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1),
      programs: v.renderer.info.programs?.length ?? 0, camDist: v.rig.dist, shadow9: window.__shadow9 ?? null,
    };
  });

  // --- real rAF window at x4: style recalc / layout per painted frame (the synthetic loop never paints)
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  await cdp.send('Performance.enable');
  const f0 = await page.evaluate(() => { window.__marchia.app.loop.speed = 4; window.__f9.unpark(); return window.__f9.frames; });
  const m0 = await metrics();
  await page.waitForTimeout(6000);
  const m1 = await metrics();
  const f1 = await page.evaluate(() => { window.__marchia.app.loop.speed = 0; window.__f9.park(); return window.__f9.frames; });
  const nf = Math.max(1, f1 - f0);
  r.realFrames = {
    frames: nf, recalcStyleMsPerFrame: +((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000 / nf).toFixed(2),
    recalcPerFrame: +((m1.RecalcStyleCount - m0.RecalcStyleCount) / nf).toFixed(2),
    layoutMsPerFrame: +((m1.LayoutDuration - m0.LayoutDuration) * 1000 / nf).toFixed(2), layoutPerFrame: +((m1.LayoutCount - m0.LayoutCount) / nf).toFixed(2),
  };
  await cdp.send('Performance.disable');
  out.cams[cam] = r;
}
out.errors = errs.slice(0, 5);
console.log(JSON.stringify(out));
await browser.close();
