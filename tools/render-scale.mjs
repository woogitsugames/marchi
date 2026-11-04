// Render cost vs wagon count (research 2026-11-04, BACKLOG P1 "Pomiar FPS i pamięci przy 50/100/200 wozach — headless").
// One page per (wagons, quality); for each camera (near / far) it measures, at game speed x4:
//   - GL draws per frame split main pass / offscreen (shadow map) pass, GL triangles in both passes
//     (renderer.info only counts the main pass), buffer bytes uploaded per frame, total GL calls per frame;
//   - JS ms per frame split: sim step, tick callbacks (view.afterTick / other onTick UI), view.frame
//     (of which wagons.frame and renderer.render), hud.update, markers.update;
//   - CDP Performance metrics per second: style recalcs, layouts, their ms; DOM nodes; visible stall pins;
//   - CPU profile (1 ms sampling): GC ms and top self-time functions (sourcemapped);
//   - heap sampling window: MB allocated per second and top allocators (sourcemapped);
//   - resident GPU memory estimated at the GL level (texImage/texStorage/compressed*, bufferData,
//     renderbufferStorage*, minus deletes) plus renderer.info.memory counts.
// Usage (serve `vite build --sourcemap --minify false --outDir <dir>` with `vite preview --port 5197`):
//   node tools/render-scale.mjs <baseUrl> <wagons> <quality> [cams=near,far] [secs=8] [pins=0] [throttle=4] [dpr=0.5]
// pins=N places N extra bakeries away from roads (NO_ROAD stalls) to load the pin layer.
// env PRE=<js> init script before the page loads, EXP=<js> evaluated after set-up (local prototype flags).
// env SCATTER=0 keeps the bench's own traffic (see doScatter).
// Prints one JSON line. SwiftShader: absolute ms are not phone numbers; read counts and ratios.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { SourceMapConsumer } = require('source-map-js');

const [base, wagonsS = '100', quality = 'high', camsS = 'near,far', secsS = '8', pinsS = '0', thrS = '4', dprS = '0.5'] = process.argv.slice(2);
const wagons = Number(wagonsS), secs = Number(secsS), pins = Number(pinsS), throttle = Number(thrS), dpr = Number(dprS);
const cams = camsS.split(',');
const CAM = { near: 60, mid: 160, far: 320 };
const benchCmds = JSON.parse(readFileSync(new URL('./frame-cost-bench.json', import.meta.url), 'utf8'));
const url = `${base.replace(/\/?$/, '/')}?play=sandbox&ff=30&speed=0&quality=${quality}&dynres=0&perf=1&debug=1`;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await page.addInitScript(() => {
  const G = {
    on: false, calls: 0, draws: 0, drawsOff: 0, tris: 0, trisOff: 0, inst: 0, upBytes: 0, upCalls: 0, uniforms: 0,
    fb: null, tex: new Map(), buf: new Map(), rb: new Map(), unit: 0, bound: new Map(), bbuf: new Map(), brb: null,
  };
  window.__gl = G;
  const TRI = 4;
  const BPP = { 0x8058: 4, 0x8051: 3, 0x8C43: 4, 0x8C41: 3, 0x81A6: 4, 0x88F0: 4, 0x8CAC: 4, 0x8CAD: 8, 0x881A: 8, 0x8814: 16, 0x8229: 1, 0x822B: 2, 0x81A5: 2, 0x1908: 4, 0x1907: 3, 0x1903: 1, 0x1909: 1, 0x8D48: 1, 0x822D: 2, 0x822F: 4, 0x8C3A: 4, 0x8D62: 2, 0x8056: 2, 0x8057: 2 };
  const HALF = new Set([0x83F0, 0x83F1, 0x9274, 0x9275, 0x8D64, 0x9270, 0x9271, 0x9276, 0x9277, 0x8C00, 0x8C01, 0x8C02, 0x8C03]);
  const bpp = (f) => BPP[f] ?? (HALF.has(f) ? 0.5 : f >= 0x83F0 && f <= 0x93FF ? 1 : 4);
  const texKey = (target) => G.unit * 100000 + target;
  const cur = (target) => { const t = target >= 0x8515 && target <= 0x851A ? 0x8513 : target; return G.bound.get(texKey(t)); };
  const setLevel = (tex, key, bytes) => { if (!tex) return; let m = G.tex.get(tex); if (!m) G.tex.set(tex, (m = new Map())); m.set(key, bytes); };
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    const P = C.prototype;
    for (const name of Object.getOwnPropertyNames(P)) {
      const d = Object.getOwnPropertyDescriptor(P, name);
      if (!d || typeof d.value !== 'function' || name === 'constructor') continue;
      const f = d.value;
      let pre = null;
      switch (name) {
        case 'drawArrays': pre = (a) => { const off = G.fb !== null; if (off) G.drawsOff++; else G.draws++; if (a[0] === TRI) { if (off) G.trisOff += a[2] / 3; else G.tris += a[2] / 3; } }; break;
        case 'drawElements': pre = (a) => { const off = G.fb !== null; if (off) G.drawsOff++; else G.draws++; if (a[0] === TRI) { if (off) G.trisOff += a[1] / 3; else G.tris += a[1] / 3; } }; break;
        case 'drawArraysInstanced': pre = (a) => { const off = G.fb !== null; if (off) G.drawsOff++; else G.draws++; G.inst += a[3]; if (a[0] === TRI) { if (off) G.trisOff += a[2] / 3 * a[3]; else G.tris += a[2] / 3 * a[3]; } }; break;
        case 'drawElementsInstanced': pre = (a) => { const off = G.fb !== null; if (off) G.drawsOff++; else G.draws++; G.inst += a[4]; if (a[0] === TRI) { if (off) G.trisOff += a[1] / 3 * a[4]; else G.tris += a[1] / 3 * a[4]; } }; break;
        case 'bindFramebuffer': pre = (a) => { G.fb = a[1]; }; break;
        case 'activeTexture': pre = (a) => { G.unit = a[0] - 0x84C0; }; break;
        case 'bindTexture': pre = (a) => { G.bound.set(texKey(a[0]), a[1]); }; break;
        case 'deleteTexture': pre = (a) => { G.tex.delete(a[0]); }; break;
        case 'texStorage2D': pre = (a) => { const t = cur(a[0]); let b = 0; for (let l = 0; l < a[1]; l++) b += Math.max(1, a[3] >> l) * Math.max(1, a[4] >> l) * bpp(a[2]); if (a[0] === 0x8513) b *= 6; setLevel(t, 'storage', b); }; break;
        case 'texStorage3D': pre = (a) => { const t = cur(a[0]); let b = 0; for (let l = 0; l < a[1]; l++) b += Math.max(1, a[3] >> l) * Math.max(1, a[4] >> l) * bpp(a[2]) * (a[0] === 0x8C1A ? a[5] : Math.max(1, a[5] >> l)); setLevel(t, 'storage', b); }; break;
        case 'texImage2D': pre = (a) => { const t = cur(a[0]); let w, h; if (a.length >= 8) { w = a[3]; h = a[4]; } else { const s = a[5]; w = s?.width ?? s?.videoWidth ?? 0; h = s?.height ?? s?.videoHeight ?? 0; } setLevel(t, a[0] + ':' + a[1], w * h * bpp(a[2])); }; break;
        case 'texImage3D': pre = (a) => { const t = cur(a[0]); setLevel(t, a[0] + ':' + a[1], a[3] * a[4] * a[5] * bpp(a[2])); }; break;
        case 'compressedTexImage2D': pre = (a) => { const t = cur(a[0]); const d = a[6]; const n = typeof d === 'number' ? d : d ? d.byteLength : 0; setLevel(t, a[0] + ':' + a[1], n); }; break;
        case 'compressedTexImage3D': pre = (a) => { const t = cur(a[0]); const d = a[7]; setLevel(t, a[0] + ':' + a[1], d ? d.byteLength : 0); }; break;
        case 'bindBuffer': pre = (a) => { G.bbuf.set(a[0], a[1]); }; break;
        case 'bindVertexArray': pre = () => { G.bbuf.delete(0x8893); }; break;
        case 'deleteBuffer': pre = (a) => { G.buf.delete(a[0]); }; break;
        case 'bufferData': pre = (a) => { const b = G.bbuf.get(a[0]); if (!b) return; const s = a[1]; let n = typeof s === 'number' ? s : s ? s.byteLength : 0; if (a.length >= 5 && a[4]) n = a[4] * (s.BYTES_PER_ELEMENT ?? 1); G.buf.set(b, n); if (G.on) { G.upBytes += n; G.upCalls++; } }; break;
        case 'bufferSubData': pre = (a) => { if (!G.on) return; const s = a[2]; const e = s?.BYTES_PER_ELEMENT ?? 1; G.upBytes += a.length >= 5 && a[4] ? a[4] * e : (s ? s.byteLength - (a[3] ?? 0) * e : 0); G.upCalls++; }; break;
        case 'bindRenderbuffer': pre = (a) => { G.brb = a[1]; }; break;
        case 'deleteRenderbuffer': pre = (a) => { G.rb.delete(a[0]); }; break;
        case 'renderbufferStorage': pre = (a) => { if (G.brb) G.rb.set(G.brb, a[2] * a[3] * bpp(a[1])); }; break;
        case 'renderbufferStorageMultisample': pre = (a) => { if (G.brb) G.rb.set(G.brb, a[3] * a[4] * bpp(a[2]) * Math.max(1, a[1])); }; break;
        default:
          if (name.startsWith('uniform')) pre = () => { if (G.on) G.uniforms++; };
      }
      P[name] = pre
        ? function (...a) { if (G.on) G.calls++; pre(a); return f.apply(this, a); }
        : function (...a) { if (G.on) G.calls++; return f.apply(this, a); };
    }
  }
});

if (process.env.PRE) await page.addInitScript(process.env.PRE); // e.g. prototype flags read at construction
const cdp = await ctx.newCDPSession(page);
await page.goto(url);
await page.waitForFunction(() => window.__marchia && window.__marchia.ready, null, { timeout: 180000 });
await page.evaluate(() => window.__marchia.app.view.texturesReady).catch(() => {});
await page.waitForTimeout(2000);

const setup = await page.evaluate(({ n, cmds, pins }) => {
  const app = window.__marchia.app;
  const st = app.world.state;
  st.coins = 1e9; st.town.rank = 5;
  for (const c of cmds) { if (c.t === 'road' && c.surface === 2) c.surface = 1; app.loop.enqueue(c); }
  app.loop.flushCommands();
  for (const b of st.buildings) if (b.type === 'warehouse') for (const g of ['wood', 'grain', 'flour']) { b.stock[g] += 48; st.ledger.produced[g] += 48; }
  const stable = st.buildings.find((b) => b.type === 'stable');
  for (let i = 0; i < n; i++) app.loop.enqueue({ t: 'buyWagon', stable: stable.id });
  app.loop.flushCommands();
  // stall-pin load: bakeries with no road (NO_ROAD) on a grid of free cells
  let placed = 0;
  const w = app.world.terrain.w, h = app.world.terrain.h;
  for (let y = 4; y < h - 4 && placed < pins; y += 4) {
    for (let x = 4; x < w - 4 && placed < pins; x += 4) {
      const before = st.buildings.length;
      app.loop.enqueue({ t: 'place', type: 'bakery', x, y, facing: 0 });
      app.loop.flushCommands();
      if (st.buildings.length > before) placed++;
    }
  }
  const t0 = performance.now();
  for (let i = 0; i < 600 * 3; i++) app.loop.tickOnce(); // 3 game minutes: the bench's own traffic settles
  return { placed, warmupMs: Math.round(performance.now() - t0), buildings: st.buildings.length, wagons: st.wagons.length };
}, { n: wagons, cmds: benchCmds, pins });
// The bench's own demand keeps only ~10-35 wagons on the road whatever the fleet (the rest wait hidden in the
// stable), so a fleet of N would not load the renderer. scatter=1 (default): before each camera window every idle
// wagon is put on a road cell (deterministic spread) heading home, 60 % with a visible load; the sim then drives
// them back over the bridges (real paths, real BRIDGE_JAM queues). Render-only research: the sim state is a
// throwaway page, goods conservation is not kept for these loads.
const scatter = process.env.SCATTER !== '0';
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
  for (let i = 0; i < 120; i++) app.loop.tickOnce(); // 12 s of game: on their way, first queues at the bridges
  return k;
});
if (process.env.EXP) await page.evaluate(process.env.EXP);

// in-page timers (installed once; reset per window)
await page.evaluate(() => {
  const app = window.__marchia.app;
  const S = { on: false };
  window.__rs = S;
  const keys = ['advance', 'onTick', 'vAfterTick', 'vFrame', 'wFrame', 'render', 'hud', 'markers', 'appFrame'];
  S.reset = () => { for (const k of keys) S[k] = 0; S.frames = 0; S.ticks0 = app.world.state.tick; S.t0 = performance.now(); };
  S.reset();
  const wrap = (obj, name, key) => {
    const f = obj[name].bind(obj);
    obj[name] = (...a) => { const t = performance.now(); try { return f(...a); } finally { S[key] += performance.now() - t; } };
  };
  wrap(app.loop, 'advance', 'advance');
  const ot = app.loop.onTick;
  app.loop.onTick = () => { const t = performance.now(); try { ot(); } finally { S.onTick += performance.now() - t; } };
  wrap(app.view, 'afterTick', 'vAfterTick');
  wrap(app.view, 'frame', 'vFrame');
  wrap(app.view.wagons, 'frame', 'wFrame');
  wrap(app.view.renderer, 'render', 'render');
  wrap(app.hud, 'update', 'hud');
  wrap(app.markers, 'update', 'markers');
  const fr = app.frame.bind(app);
  app.frame = (now) => { const t = performance.now(); try { fr(now); } finally { S.appFrame += performance.now() - t; S.frames++; } };
});

await cdp.send('Performance.enable');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));

const maps = new Map();
const consumerFor = async (u) => {
  if (maps.has(u)) return maps.get(u);
  let c = null;
  try { const r = await fetch(u + '.map'); if (r.ok) c = new SourceMapConsumer(await r.json()); } catch { /* none */ }
  maps.set(u, c); return c;
};
const nameOf = async (cf) => {
  let fn = `${cf.functionName || '(anon)'}`;
  if (cf.url && cf.url.endsWith('.js')) {
    const c = await consumerFor(cf.url);
    if (c) { const o = c.originalPositionFor({ line: cf.lineNumber + 1, column: cf.columnNumber }); if (o.source) return `${fn} @${o.source.replace(/^(\.\.\/)+/, '')}:${o.line}`; }
    return `${fn} ${cf.url.split('/').pop()}:${cf.lineNumber + 1}`;
  }
  return cf.url ? fn : fn.startsWith('(') ? fn : `(${fn || 'native'})`;
};

const out = { wagons, quality, pins, throttle, dpr, setup, cams: {} };
for (const cam of cams) {
  const scattered = scatter ? await doScatter() : 0;
  await page.evaluate(({ d, cam }) => {
    const app = window.__marchia.app, st = app.world.state, w = app.world.terrain.w;
    let x = 0, z = 0, n = 0;
    if (cam === 'near') {
      // the busiest spot: the cell with most wagons on it or next to it (a bridge queue)
      const cnt = new Map();
      for (const wg of st.wagons) if (wg.next >= 0 || wg.status.k !== 'IDLE') cnt.set(wg.at, (cnt.get(wg.at) ?? 0) + 1);
      let best = -1, bn = 0;
      for (const [c, k] of cnt) { let s = 0; for (const [c2, k2] of cnt) { const dx = c2 % w - c % w, dy = Math.floor(c2 / w) - Math.floor(c / w); if (dx * dx + dy * dy < 36) s += k2; } if (s > bn) { bn = s; best = c; } }
      if (best >= 0) { x = (best % w + 0.5) * 4; z = (Math.floor(best / w) + 0.5) * 4; n = 1; }
    }
    if (!n) { for (const wg of st.wagons) { x += (wg.at % w + 0.5) * 4; z += (Math.floor(wg.at / w) + 0.5) * 4; n++; } x /= n; z /= n; }
    app.view.rig.set(x, z, d, 0.6);
    app.loop.speed = 4;
  }, { d: CAM[cam], cam });
  await page.waitForTimeout(2500);

  // --- timing window (+ CPU profile at 1 ms)
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  const m0 = await metrics();
  await page.evaluate(() => { const G = window.__gl; for (const k of ['calls', 'draws', 'drawsOff', 'tris', 'trisOff', 'inst', 'upBytes', 'upCalls', 'uniforms']) G[k] = 0; G.on = true; window.__rs.reset(); });
  await cdp.send('Profiler.start');
  await page.waitForTimeout(secs * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  const r = await page.evaluate(() => {
    const G = window.__gl, S = window.__rs, app = window.__marchia.app, v = app.view;
    G.on = false;
    const f = Math.max(1, S.frames), wall = (performance.now() - S.t0) / 1000;
    const ticks = app.world.state.tick - S.ticks0;
    const ws = app.world.state.wagons;
    const info = v.renderer.info;
    const pool = app.markers.pool;
    const shownPins = pool.filter((b) => b.key && b.used);
    const sum = (m) => { let s = 0; for (const x of m.values()) s += typeof x === 'number' ? x : [...x.values()].reduce((a, b) => a + b, 0); return s; };
    const c = document.querySelector('canvas');
    const fbBytes = c ? c.width * c.height * (4 + 4) * 4 /* MSAA x4 color + depth/stencil */ + c.width * c.height * 4 : 0;
    const wv = v.wagons;
    const vis = (p) => p.meshes.reduce((a, m) => a + (m.visible ? m.count : 0), 0) / Math.max(1, p.meshes.length);
    return {
      frames: S.frames, wallS: +wall.toFixed(1), fps: +(S.frames / wall).toFixed(2), ticks, ticksPerFrame: +(ticks / f).toFixed(2),
      ms: {
        appFrame: S.appFrame / f, simStep: (S.advance - S.onTick) / f, simPerTick: (S.advance - S.onTick) / Math.max(1, ticks),
        afterTickView: S.vAfterTick / f, onTickOther: (S.onTick - S.vAfterTick) / f, viewFrame: S.vFrame / f, wagonsFrame: S.wFrame / f,
        render: S.render / f, viewOther: (S.vFrame - S.wFrame - S.render) / f, hud: S.hud / f, markers: S.markers / f,
        rest: (S.appFrame - S.advance - S.vFrame - S.hud - S.markers) / f,
      },
      gl: {
        callsPerFrame: G.calls / f, drawsMain: G.draws / f, drawsShadow: G.drawsOff / f, trisMain: G.tris / f, trisShadow: G.trisOff / f,
        instancesPerFrame: G.inst / f, uploadKBPerFrame: G.upBytes / f / 1024, uploadCallsPerFrame: G.upCalls / f, uniformCallsPerFrame: G.uniforms / f,
      },
      info: { calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? 0 },
      memMB: { textures: sum(G.tex) / 1048576, buffers: sum(G.buf) / 1048576, renderbuffers: sum(G.rb) / 1048576, canvasEst: fbBytes / 1048576, nTex: G.tex.size, nBuf: G.buf.size },
      heapMB: (performance.memory?.usedJSHeapSize ?? 0) / 1048576,
      dom: document.getElementsByTagName('*').length,
      markerNodes: app.markers.root.getElementsByTagName('*').length,
      pins: { pool: pool.length, shown: shownPins.length, wagon: shownPins.filter((b) => b.key.startsWith('wagon')).length },
      wagons: { total: ws.length, moving: ws.filter((w) => w.next >= 0).length, jam: ws.filter((w) => w.status.k === 'BRIDGE_JAM').length, near: vis(wv.near.horse), mid: vis(wv.mid.horse), far: vis(wv.lod1), body: vis(wv.body) },
      camDist: v.rig.dist,
    };
  });
  const m1 = await metrics();
  const dS = (m1.Timestamp - m0.Timestamp) || secs;
  r.cdp = {
    recalcStylePerS: (m1.RecalcStyleCount - m0.RecalcStyleCount) / dS, recalcStyleMsPerS: (m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000 / dS,
    layoutPerS: (m1.LayoutCount - m0.LayoutCount) / dS, layoutMsPerS: (m1.LayoutDuration - m0.LayoutDuration) * 1000 / dS,
    scriptMsPerS: (m1.ScriptDuration - m0.ScriptDuration) * 1000 / dS, taskMsPerS: (m1.TaskDuration - m0.TaskDuration) * 1000 / dS,
    nodes: m1.Nodes, listeners: m1.JSEventListeners,
  };
  r.ms.recalcStylePerFrame = r.cdp.recalcStyleMsPerS / Math.max(0.01, r.fps);
  r.ms.layoutPerFrame = r.cdp.layoutMsPerS / Math.max(0.01, r.fps);
  // profile: self time by function and group
  const self = new Map();
  for (let i = 0; i < profile.samples.length; i++) self.set(profile.samples[i], (self.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i] ?? 0));
  const byFn = new Map(), byGrp = new Map(); let total = 0;
  for (const n of profile.nodes) {
    const t = (self.get(n.id) ?? 0) / 1000; if (!t) continue; total += t;
    const nm = await nameOf(n.callFrame);
    byFn.set(nm, (byFn.get(nm) ?? 0) + t);
    const src = (nm.match(/@(\S+):\d+$/) ?? [])[1] ?? '';
    const g = src.startsWith('src/sim') ? 'src/sim' : src.startsWith('src/render') ? 'src/render' : src.startsWith('src/ui') ? 'src/ui' : src.startsWith('src/') ? 'src/other' : src.includes('three') ? 'three.js' : nm.startsWith('(') ? nm : 'other';
    byGrp.set(g, (byGrp.get(g) ?? 0) + t);
  }
  const perS = (x) => +(x / dS).toFixed(1);
  r.profile = {
    totalMsPerS: perS(total), gcMsPerS: perS(byFn.get('(garbage collector)') ?? 0),
    groups: [...byGrp].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => [k, perS(v)]),
    top: [...byFn].filter(([k]) => !k.startsWith('(program)') && !k.startsWith('(idle)')).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => [k, perS(v)]),
  };
  await cdp.send('Profiler.disable');

  // --- allocation window
  await cdp.send('HeapProfiler.enable');
  const fA = await page.evaluate(() => window.__rs.frames);
  await cdp.send('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  const ta = Date.now();
  await page.waitForTimeout(Math.max(4, secs * 0.75) * 1000);
  const { profile: hp } = await cdp.send('HeapProfiler.stopSampling');
  const aS = (Date.now() - ta) / 1000;
  const fB = await page.evaluate(() => window.__rs.frames);
  const agg = new Map(); let atotal = 0;
  const walk = async (n, here) => {
    const nm = await nameOf(n.callFrame);
    const h = nm.includes('@src/') ? nm : here;
    if (n.selfSize) { const k = h ?? nm; agg.set(k, (agg.get(k) ?? 0) + n.selfSize); atotal += n.selfSize; }
    for (const ch of n.children) await walk(ch, h);
  };
  await walk(hp.head, null);
  r.alloc = {
    MBperS: +(atotal / 1048576 / aS).toFixed(2), KBperFrame: +(atotal / 1024 / Math.max(1, fB - fA)).toFixed(1),
    top: [...agg].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => [k, +(v / 1024 / aS).toFixed(0)]),
  };
  await cdp.send('HeapProfiler.disable');
  await page.evaluate(() => { window.__marchia.app.loop.speed = 0; });
  // --- micro: the per-frame / per-tick JS pieces called back to back (game paused, same camera), median of N.
  // Under SwiftShader a real frame takes ~2 s (raster blocks the main thread), so the timing window holds
  // few frames; these give stable per-call numbers for the CPU side. render = renderer.render alone.
  await page.waitForTimeout(500);
  r.micro = await page.evaluate(async () => {
    const app = window.__marchia.app, v = app.view, w = app.world, cam = v.rig.camera;
    const N = 12;
    // performance.now() is clamped to 0.1 ms here: time blocks of 5 calls, median block / 5
    const time = (fn, warm = 100) => { for (let i = 0; i < warm; i++) fn(); const ts = []; for (let i = 0; i < N; i++) { const t = performance.now(); for (let k = 0; k < 5; k++) fn(); ts.push((performance.now() - t) / 5); } ts.sort((a, b) => a - b); return +ts[N >> 1].toFixed(3); };
    const ranked = app.ranking.get(w, app.loop.journal.length);
    const res = {
      wagonsFrame: time(() => v.wagons.frame(w, 0.5, 1 / 60, cam, v.time)),
      markers: time(() => app.markers.update(w, v, null, false, ranked[0]?.id ?? -1)),
      hud: time(() => app.hud.update(w, app.pace, ranked)),
      rankingFresh: time(() => { app.ranking.invalidate(); app.ranking.get(w, app.loop.journal.length); }),
      occluderRects: time(() => { app.markers.update(w, v, null, false, -1); app.occluderRects(); }) ,
      viewAfterTick: time(() => v.afterTick()),
      onTick: time(() => app.loop.onTick()),
      render: time(() => v.renderer.render(v.scene, cam), 5),
    };
    res.occluderRects = +(res.occluderRects - res.markers).toFixed(3);
    // autosave: synchronous part (serialise + hash on the main thread) and until the IDB write resolves
    const ts = performance.now(); void app.autosave(); res.autosaveSync = +(performance.now() - ts).toFixed(2);
    res.onTickOther = +(res.onTick - res.viewAfterTick).toFixed(3);
    return res;
  });
  // --- micro allocations: bytes allocated per call (sampling heap profiler, 256 B interval, 200 calls each (render 20,
  // tick 40), after
  // a warm-up so the functions run optimised as they would after a minute at 60 fps)
  r.microAlloc = {};
  await cdp.send('HeapProfiler.enable');
  for (const fnName of ['wagonsFrame', 'viewAfterTick', 'onTickOther', 'markers', 'hud', 'render', 'tick']) {
    await page.evaluate((fnName) => {
      const app = window.__marchia.app, v = app.view, w = app.world;
      const n = fnName === 'render' ? 10 : fnName === 'tick' ? 100 : 300;
      for (let i = 0; i < n; i++) {
        if (fnName === 'wagonsFrame') v.wagons.frame(w, 0.5, 1 / 60, v.rig.camera, v.time);
        else if (fnName === 'viewAfterTick') v.afterTick();
        else if (fnName === 'markers') app.markers.update(w, v, null, false, -1);
        else if (fnName === 'hud') app.hud.update(w, app.pace, app.ranking.get(w, app.loop.journal.length));
        else if (fnName === 'render') v.renderer.render(v.scene, v.rig.camera);
        else if (fnName === 'tick') app.loop.tickOnce();
        else { const f = v.afterTick; v.afterTick = () => {}; try { app.loop.onTick(); } finally { v.afterTick = f; } }
      }
    }, fnName);
    await cdp.send('HeapProfiler.startSampling', { samplingInterval: 256, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    await page.evaluate((fnName) => {
      const app = window.__marchia.app, v = app.view, w = app.world, cam = v.rig.camera;
      const ranked = app.ranking.get(w, app.loop.journal.length);
      const fns = {
        wagonsFrame: () => v.wagons.frame(w, 0.5, 1 / 60, cam, v.time),
        viewAfterTick: () => v.afterTick(),
        onTickOther: () => { const f = v.afterTick; v.afterTick = () => {}; try { app.loop.onTick(); } finally { v.afterTick = f; } },
        markers: () => app.markers.update(w, v, null, false, ranked[0]?.id ?? -1),
        hud: () => app.hud.update(w, app.pace, ranked),
        render: () => v.renderer.render(v.scene, cam),
        tick: () => app.loop.tickOnce(),
      };
      const K = fnName === 'render' ? 20 : fnName === 'tick' ? 40 : 200;
      for (let i = 0; i < K; i++) fns[fnName]();
    }, fnName);
    const { profile: hp } = await cdp.send('HeapProfiler.stopSampling');
    let tot = 0; const by = new Map();
    const walkA = async (n) => {
      if (n.selfSize) { tot += n.selfSize; const k = await nameOf(n.callFrame); by.set(k, (by.get(k) ?? 0) + n.selfSize); }
      for (const c of n.children) await walkA(c);
    };
    await walkA(hp.head);
    const K = fnName === 'render' ? 20 : fnName === 'tick' ? 40 : 200;
    r.microAlloc[fnName] = +(tot / K / 1024).toFixed(1); // KB per call
    r.microAlloc[fnName + 'Top'] = [...by].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => [k.replace(/@\S*?(src|three)\//, '@$1/'), +(v / K / 1024).toFixed(1)]);
  }
  await cdp.send('HeapProfiler.disable');
  r.scattered = scattered;
  out.cams[cam] = r;
}
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
out.errors = errs.slice(0, 5);
const round = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(3) : v)));
console.log(JSON.stringify(round(out)));
await browser.close();
