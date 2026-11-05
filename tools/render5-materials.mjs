// Research render #5 (docs/research/2026-11-05-render5-materials.md): separate materials for the InstancedMesh parts.
// One page per (build, quality), sandbox with 200 wagons (same set-up and deterministic scatter as render4-shadows.mjs),
// sim paused, render time frozen (view.frame(a, 0)), UI hidden. Per camera distance, on that frozen frame:
//   - program-parameter rebuilds per renderer.render(): every getParameters() in three.js calls
//     material.customProgramCacheKey() once, so that method is wrapped (Material.prototype + own overrides) and counted,
//     split main / shadow-depth materials and by material name;
//   - census: materials drawn by both InstancedMesh and Mesh in the scene (the cause of the rebuilds);
//   - renderer.info.programs, GL draws main / offscreen per render;
//   - CPU: renderer.render() median ms (blocks of 3 calls), KB allocated per render (CDP heap sampling, 256 B) with
//     the top allocators (sourcemapped: build with --sourcemap --minify false);
//   - a screenshot <outDir>/<quality>-<dist>.png for the pixel diff (tools/render5-diff.py).
// Then state switches with shader links counted INSIDE App.frame (D-65 criterion): night, winter night (seasons on),
// winter day, quality switch to the other tier and back; shot after the winter night.
// Usage: node tools/render5-materials.mjs <baseUrl> <quality> <outDir> [dists=60,320] [wagons=200] [events=1]
// env DPR (default 1). Prints one JSON line.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { SourceMapConsumer } = require('source-map-js');

const [base, quality = 'high', outDir = '.', distsS = '60,320', wagonsS = '200', eventsS = '1'] = process.argv.slice(2);
const dists = distsS ? distsS.split(',').map(Number) : [], wagons = Number(wagonsS), events = eventsS !== '0';
mkdirSync(outDir, { recursive: true });
const benchCmds = JSON.parse(readFileSync(new URL('./frame-cost-bench.json', import.meta.url), 'utf8'));
const url = `${base.replace(/\/?$/, '/')}?play=sandbox&ff=30&speed=0&quality=${quality}&dynres=0&debug=1`;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: Number(process.env.DPR ?? 1), isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.addInitScript(() => {
  const G = { fb: null, draws: 0, drawsOff: 0, link: 0, compile: 0, inFrame: false, fLink: 0, fCompile: 0 };
  window.__gl = G;
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    const P = C.prototype;
    const wrap = (name, pre) => { const f = P[name]; if (f) P[name] = function (...a) { pre(a); return f.apply(this, a); }; };
    const add = () => { if (G.fb !== null) G.drawsOff++; else G.draws++; };
    wrap('bindFramebuffer', (a) => { G.fb = a[1]; });
    for (const n of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) wrap(n, add);
    // a link whose stack passes through setProgram is a draw-time compile (the frame stalls on it), counted from
    // navigation on; links from renderer.compile (the pre-warm) do not go through setProgram
    G.drawLinks = [];
    wrap('linkProgram', () => { G.link++; if (G.inFrame) G.fLink++; const st = new Error().stack || ''; if (st.includes('setProgram')) G.drawLinks.push(Math.round(performance.now())); });
    wrap('compileShader', () => { G.compile++; if (G.inFrame) G.fCompile++; });
  }
});
await page.goto(url);
await page.waitForFunction(() => window.__marchia && window.__marchia.ready, null, { timeout: 180000 });
await page.evaluate(() => window.__marchia.app.view.texturesReady).catch(() => {});
await page.evaluate(({ n, cmds }) => {
  const app = window.__marchia.app, st = app.world.state;
  st.coins = 1e9; st.town.rank = 5;
  st.rain = [];
  for (const c of cmds) { if (c.t === 'road' && c.surface === 2) c.surface = 1; app.loop.enqueue(c); }
  app.loop.flushCommands();
  for (const b of st.buildings) if (b.type === 'warehouse') for (const g of ['wood', 'grain', 'flour']) { b.stock[g] += 48; st.ledger.produced[g] += 48; }
  const stable = st.buildings.find((b) => b.type === 'stable');
  for (let i = 0; i < n; i++) app.loop.enqueue({ t: 'buyWagon', stable: stable.id });
  app.loop.flushCommands();
  for (let i = 0; i < 600 * 3; i++) app.loop.tickOnce();
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
  for (const el of Object.values(app.layers ?? {})) if (el && el.style) el.style.visibility = 'hidden';
  // shader links inside App.frame (the ones that stall a frame)
  const fr = app.frame.bind(app);
  app.frame = (now) => { window.__gl.inFrame = true; try { fr(now); } finally { window.__gl.inFrame = false; } };
  // count getParameters(): customProgramCacheKey() is called exactly once per program (re)acquire
  const C = { on: false, n: 0, by: new Map() };
  window.__cpk = C;
  const hit = (m) => { if (!C.on) return; C.n++; const k = (m.isMeshDepthMaterial ? 'depth:' : '') + (m.name || m.type); C.by.set(k, (C.by.get(k) ?? 0) + 1); };
  const wrapped = new WeakSet();
  const wrapOwn = (m) => {
    if (wrapped.has(m) || !Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey')) return;
    const f = m.customProgramCacheKey;
    if (f.__r5) return;
    const g = function () { hit(this); return f.call(this); };
    g.__r5 = true;
    m.customProgramCacheKey = g;
    wrapped.add(m);
  };
  let any = null;
  app.view.scene.traverse((o) => { if (o.material && !any) any = Array.isArray(o.material) ? o.material[0] : o.material; });
  let proto = Object.getPrototypeOf(any);
  while (proto && !Object.prototype.hasOwnProperty.call(proto, 'customProgramCacheKey')) proto = Object.getPrototypeOf(proto);
  const pf = proto.customProgramCacheKey;
  proto.customProgramCacheKey = function () { hit(this); return pf.call(this); };
  // TOGGLE: put the base material back on the instanced meshes that carry a mirror ('-inst') = the shipped state,
  // on the same frozen frame (exact before/after pixel pair on one page)
  window.__r5swap = (toBase) => {
    const base = new Map();
    app.view.scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.material && !Array.isArray(o.material)) base.set(o.material.name, o.material); });
    let n = 0;
    app.view.scene.traverse((o) => {
      if (!o.isInstancedMesh) return;
      if (toBase && o.material.name.endsWith('-inst')) { const b = base.get(o.material.name.slice(0, -5)); if (b) { o.userData.__r5inst = o.material; o.material = b; n++; } }
      if (!toBase && o.userData.__r5inst) { o.material = o.userData.__r5inst; delete o.userData.__r5inst; n++; }
    });
    return n;
  };
  window.__r5wrapAll = () => app.view.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) wrapOwn(m); });
}, { n: wagons, cmds: benchCmds });

const target = await page.evaluate(() => {
  const app = window.__marchia.app, st = app.world.state, w = app.world.terrain.w;
  const cnt = new Map();
  for (const wg of st.wagons) if (wg.next >= 0 || wg.status.k !== 'IDLE') cnt.set(wg.at, (cnt.get(wg.at) ?? 0) + 1);
  let best = -1, bn = 0;
  for (const [c] of cnt) { let s = 0; for (const [c2, k2] of cnt) { const dx = c2 % w - c % w, dy = Math.floor(c2 / w) - Math.floor(c / w); if (dx * dx + dy * dy < 36) s += k2; } if (s > bn) { bn = s; best = c; } }
  return { x: (best % w + 0.5) * 4, z: (Math.floor(best / w) + 0.5) * 4, tick: st.tick, n: bn };
});
const freeze = (on) => page.evaluate((on) => {
  const v = window.__marchia.app.view;
  if (!v.__frame0) v.__frame0 = v.frame.bind(v);
  v.frame = on ? (a) => v.__frame0(a, 0) : v.__frame0;
}, on);
const frames = (n) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

const cdp = await ctx.newCDPSession(page);
const maps = new Map();
const consumerFor = async (u) => {
  if (maps.has(u)) return maps.get(u);
  let c = null;
  try { const r = await fetch(u + '.map'); if (r.ok) c = new SourceMapConsumer(await r.json()); } catch { /* none */ }
  maps.set(u, c); return c;
};
const nameOf = async (cf) => {
  const fn = `${cf.functionName || '(anon)'}`;
  if (cf.url && cf.url.endsWith('.js')) {
    const c = await consumerFor(cf.url);
    if (c) { const o = c.originalPositionFor({ line: cf.lineNumber + 1, column: cf.columnNumber }); if (o.source) return `${fn} @${o.source.replace(/^(\.\.\/)+/, '').replace(/^.*node_modules\//, '')}:${o.line}`; }
    return `${fn} ${cf.url.split('/').pop()}:${cf.lineNumber + 1}`;
  }
  return fn.startsWith('(') ? fn : `(${fn || 'native'})`;
};

const out = { quality, wagons, target, dpr: Number(process.env.DPR ?? 1), runs: [], events: [] };
for (const d of dists) {
  await page.evaluate(({ x, z, d }) => { const app = window.__marchia.app; app.view.rig.set(x, z, d, 0.6); app.view.rig.follow?.(null); }, { ...target, d });
  await freeze(false);
  await page.waitForTimeout(2500);
  await freeze(true);
  await frames(3);
  const one = async (mode) => {
  const r = await page.evaluate(() => {
    const app = window.__marchia.app, v = app.view, r = v.renderer, cam = v.rig.camera, C = window.__cpk, G = window.__gl;
    window.__r5wrapAll();
    // census: which materials are drawn by both InstancedMesh and Mesh
    const use = new Map();
    v.scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of [].concat(o.material)) {
        let u = use.get(m); if (!u) use.set(m, (u = { inst: 0, plain: 0, instVis: 0, plainVis: 0 }));
        const vis = o.visible && (!o.isInstancedMesh || o.count > 0);
        if (o.isInstancedMesh) { u.inst++; if (vis) u.instVis++; } else { u.plain++; if (vis) u.plainVis++; }
      }
    });
    const shared = [...use].filter(([, u]) => u.inst && u.plain).map(([m, u]) => `${m.name || m.type} i${u.instVis}/${u.inst} p${u.plainVis}/${u.plain}`);
    r.render(v.scene, cam); r.render(v.scene, cam);
    C.by.clear(); C.n = 0; C.on = true;
    const d0 = G.draws, o0 = G.drawsOff;
    r.render(v.scene, cam);
    C.on = false;
    const by = [...C.by].sort((a, b) => b[1] - a[1]);
    const depth = by.filter(([k]) => k.startsWith('depth:')).reduce((a, [, n]) => a + n, 0);
    // CPU: median of blocks of 3 renders
    const ts = [];
    for (let i = 0; i < 8; i++) { const t = performance.now(); for (let k = 0; k < 3; k++) r.render(v.scene, cam); ts.push((performance.now() - t) / 3); }
    ts.sort((a, b) => a - b);
    return {
      programs: r.info.programs.length, drawsMain: G.draws - d0, drawsShadow: G.drawsOff - o0,
      getParams: C.n, getParamsDepth: depth, getParamsBy: by.slice(0, 14), shared,
      renderMs: +ts[4].toFixed(2), renderMsMin: +ts[0].toFixed(2), wagonsVisible: v.wagons.body.count,
    };
  });
  // allocations per render (sampling heap profiler)
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.startSampling', { samplingInterval: 256, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  const K = 20;
  await page.evaluate((K) => { const v = window.__marchia.app.view; for (let i = 0; i < K; i++) v.renderer.render(v.scene, v.rig.camera); }, K);
  const { profile: hp } = await cdp.send('HeapProfiler.stopSampling');
  await cdp.send('HeapProfiler.disable');
  let tot = 0; const by = new Map();
  const walk = async (n) => { if (n.selfSize) { tot += n.selfSize; const k = await nameOf(n.callFrame); by.set(k, (by.get(k) ?? 0) + n.selfSize); } for (const c of n.children) await walk(c); };
  await walk(hp.head);
  // getParameters' own frame and its callees (getProgramCacheKey etc.) by inclusive walk
  let gp = 0;
  const walkI = async (n, inGp) => { const nm = n.callFrame.functionName; const here = inGp || nm === 'getParameters' || nm === 'getProgramCacheKey'; if (here) gp += n.selfSize; for (const c of n.children) await walkI(c, here); };
  await walkI(hp.head, false);
  r.allocKB = +(tot / K / 1024).toFixed(1);
  r.allocGetParamsKB = +(gp / K / 1024).toFixed(1);
  r.allocTop = [...by].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => [k, +(v / K / 1024).toFixed(1)]);
  await frames(2);
  await page.screenshot({ path: `${outDir}/${quality}-${d}${mode}.png`, timeout: 600000 });
  console.error(`[render5] ${quality} ${d} m${mode}: ${JSON.stringify(r)} (${Math.round(performance.now() / 1000)} s)`);
  out.runs.push({ dist: d, mode, ...r });
  };
  await one('');
  if (process.env.TOGGLE === '1') {
    const n = await page.evaluate(() => window.__r5swap(true));
    await frames(3);
    await one('-base');
    await page.evaluate(() => window.__r5swap(false));
    await frames(3);
    await page.screenshot({ path: `${outDir}/${quality}-${d}-again.png`, timeout: 600000 });
    out.runs[out.runs.length - 1].swapped = n;
  }
}

if (events) {
  const ev = async (label, fn, waitMs = 3000, shot = null) => {
    const s0 = await page.evaluate(() => ({ dl: window.__gl.drawLinks.length, fLink: window.__gl.fLink, fCompile: window.__gl.fCompile, link: window.__gl.link, progs: window.__marchia.app.view.renderer.info.programs.length, ids: window.__marchia.app.view.renderer.info.programs.map((p) => p.id) }));
    await page.evaluate(fn);
    await page.waitForTimeout(waitMs);
    await frames(4);
    if (shot) {
      await page.evaluate(() => { const v = window.__marchia.app.view; if (!v.__frame0) v.__frame0 = v.frame.bind(v); v.frame = (a) => v.__frame0(a, 0); });
      await frames(3);
      await page.screenshot({ path: `${outDir}/${quality}-${shot}.png`, timeout: 600000 });
      if (process.env.TOGGLE === '1') {
        await page.evaluate(() => window.__r5swap(true)); await frames(3);
        await page.screenshot({ path: `${outDir}/${quality}-${shot}-base.png`, timeout: 600000 });
        await page.evaluate(() => window.__r5swap(false)); await frames(3);
      }
    }
    const s1 = await page.evaluate((ids) => {
      const r = window.__marchia.app.view.renderer, old = new Set(ids);
      return { fLink: window.__gl.fLink, fCompile: window.__gl.fCompile, link: window.__gl.link, progs: r.info.programs.length, fresh: r.info.programs.filter((p) => !old.has(p.id)).map((p) => p.name) };
    }, s0.ids);
    const e = { label, drawTimeLinks: (await page.evaluate(() => window.__gl.drawLinks.length)) - s0.dl, inFrameLinks: s1.fLink - s0.fLink, inFrameCompiles: s1.fCompile - s0.fCompile, links: s1.link - s0.link, programs: `${s0.progs} -> ${s1.progs}`, newPrograms: s1.fresh };
    console.error(`[render5] event ${JSON.stringify(e)}`);
    out.events.push(e);
  };
  const DAY = 14400, SEASON = 9000;
  await page.evaluate(({ x, z }) => window.__marchia.app.view.rig.set(x, z, 60, 0.6), target);
  await ev('settle', () => {}, 2000);
  // summer night (f = 0.27 + tick/DAY ~ 0.1), winter night (seasons on), winter day
  await ev('night', () => { const a = window.__marchia.app; a.world.state.tick = 11952; a.view.snapEnv = true; }, 2500, null);
  await page.evaluate(() => {});
  await ev('winter-night', () => { const a = window.__marchia.app; a.world.seasons = true; a.world.state.tick = 27000; a.view.snapEnv = true; }, 2500, 'winter-night-60');
  await ev('winter-day', () => { const a = window.__marchia.app; a.world.state.tick = 31392; a.view.snapEnv = true; }, 2500);
  const other = quality === 'low' ? 'high' : 'low';
  await ev(`quality-${other}`, `window.__marchia.app.view.setQuality('${other}')`, 1);
  // the switch lands after its pre-warm and the texture reload: wait for both
  await page.evaluate(() => new Promise((res) => setTimeout(res, 500)).then(() => window.__marchia.app.view.texturesReady)).catch(() => {});
  await ev(`quality-${other}-settled`, () => {}, 4000);
  await ev(`quality-${quality}`, `window.__marchia.app.view.setQuality('${quality}')`, 1);
  await page.evaluate(() => new Promise((res) => setTimeout(res, 500)).then(() => window.__marchia.app.view.texturesReady)).catch(() => {});
  await ev(`quality-${quality}-settled`, () => {}, 4000);
  void DAY; void SEASON;
}
out.drawTimeLinks = await page.evaluate(() => window.__gl.drawLinks);
out.linksTotal = await page.evaluate(() => window.__gl.link);
out.errors = errs.slice(0, 5);
console.log(JSON.stringify(out));
await browser.close();
