// Render-side frame cost probe (D-570): GL-level counters per frame, programs, texture memory and frame time,
// interleaved A/B over two builds (the machine is shared, so only relative numbers count).
//   node tools/rperf-probe.mjs <urlA> [urlB] [rounds=3] [seconds=6] [scene,...] [quality,...] [profile=0|1]
// Scenes: the free valley with the bench road network (tools/frame-cost-bench.json) in summer / winter at 110 m,
// the same valley with 50 / 200 wagons bought at the stable (10 game minutes in, camera 160 m), mission I with the bot.
// Per frame (mean over the window, GL calls wrapped in an init script): draws in the main pass (default framebuffer)
// and in other targets (shadow map, bakes), triangles, useProgram, bindTexture, uniform* calls, buffer upload bytes.
// Then three's renderer.info (programs, geometries, textures) and the bytes of all live GL textures, rAF mean / median
// and the JS ms of App.frame. profile=1 adds a CDP CPU profile of the window aggregated by function (needs a build
// with a sourcemap to name src/ functions; plain builds still show three.js and the self time split).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [urlA, urlB = '', roundsS = '3', secsS = '6', onlyS = '', qualS = 'low,high', profS = '0'] = process.argv.slice(2);
const rounds = Number(roundsS), secs = Number(secsS), prof = profS === '1';
const bench = JSON.parse(readFileSync(resolve(root, 'tools/frame-cost-bench.json'), 'utf8'));
const SUMMER = 9000 + 4500, WINTER = 27000 + 4500;
const valley = (tick, dist, yaw, wagons = 0) => ({ q: 'play=sandbox&ff=30', valley: true, tick, dist, yaw, wagons });
const SCENES = {
  'v-summer': valley(SUMMER, 110, 0.9),
  'v-winter': valley(WINTER, 110, 0.9),
  'v-50w': valley(SUMMER, 160, 0.9, 50),
  'v-200w': valley(SUMMER, 160, 0.9, 200),
  m1: { q: 'play=m1&bot=1&ff=150', cam: [172.8, 144, 200, -0.3] },
};

const INIT = () => {
  const G = { draws: 0, mainDraws: 0, tris: 0, mainTris: 0, progs: 0, texBinds: 0, unis: 0, upBytes: 0, fb: null, tex: new Map(), cur: new Map(), unit: 0 };
  window.__rp = G;
  const BPP = { 0x8058: 4, 0x1908: 4, 0x8c43: 4, 0x881a: 8, 0x8814: 16, 0x81a6: 4, 0x8cac: 4, 0x88f0: 4, 0x8229: 1, 0x822b: 2, 0x1907: 3, 0x8051: 3, 0x81a5: 2, 0x8d48: 1, 0x822f: 8, 0x93b0: 1, 0x9274: 0.5, 0x9278: 1, 0x83f0: 0.5, 0x83f1: 0.5, 0x83f3: 1, 0x8e8c: 1, 0x8d64: 0.5 };
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    const P = C.prototype;
    const w = (name, fn) => { const f = P[name]; if (!f) return; P[name] = function (...a) { fn.call(this, a); return f.apply(this, a); }; };
    const tri = (mode, count, inst) => (mode === 4 ? (count / 3) * inst : mode === 5 ? Math.max(0, count - 2) * inst : 0);
    G.by = new Map(); G.obj = '?';
    const draw = (mode, count, inst) => {
      G.draws++; const t = tri(mode, count, inst); G.tris += t; if (G.fb === null) { G.mainDraws++; G.mainTris += t; }
      if (G.split) { const k = (G.fb === null ? 'main ' : 'off  ') + G.obj; const e = G.by.get(k) ?? [0, 0]; e[0]++; e[1] += t; G.by.set(k, e); }
    };
    w('drawElements', (a) => draw(a[0], a[1], 1));
    w('drawArrays', (a) => draw(a[0], a[2], 1));
    w('drawElementsInstanced', (a) => draw(a[0], a[1], a[4]));
    w('drawArraysInstanced', (a) => draw(a[0], a[2], a[3]));
    w('bindFramebuffer', (a) => { if (a[0] === 0x8d40 || a[0] === 0x8ca9) G.fb = a[1]; });
    w('useProgram', () => G.progs++);
    w('activeTexture', (a) => { G.unit = a[0]; });
    w('bindTexture', (a) => { G.texBinds++; G.cur.set(G.unit + ':' + a[0], a[1]); });
    w('bufferData', (a) => { const d = a[1]; G.upBytes += typeof d === 'number' ? d : d?.byteLength ?? 0; });
    w('bufferSubData', (a) => { const d = a[2]; G.upBytes += a[4] ? a[4] * (d?.BYTES_PER_ELEMENT ?? 1) : d?.byteLength ?? 0; });
    for (const n of Object.getOwnPropertyNames(P)) if (/^uniform(Matrix)?[1-4]/.test(n)) w(n, () => G.unis++);
    const texOf = (target) => G.cur.get(G.unit + ':' + (target >= 0x8515 && target <= 0x851a ? 0x8513 : target));
    const add = (target, key, bytes) => { const t = texOf(target); if (!t) return; let m = G.tex.get(t); if (!m) G.tex.set(t, (m = new Map())); m.set(target + ':' + key, bytes); };
    w('texStorage2D', (a) => { let s = 0, x = a[3], y = a[4]; for (let l = 0; l < a[1]; l++) { s += x * y * (BPP[a[2]] ?? 4); x = Math.max(1, x >> 1); y = Math.max(1, y >> 1); } add(a[0], 'st', s * (a[0] === 0x8513 ? 6 : 1)); });
    w('texStorage3D', (a) => { let s = 0, x = a[3], y = a[4]; for (let l = 0; l < a[1]; l++) { s += x * y * (BPP[a[2]] ?? 4); x = Math.max(1, x >> 1); y = Math.max(1, y >> 1); } add(a[0], 'st', s * a[5]); });
    w('texImage2D', (a) => { if (a.length >= 8) add(a[0], a[1], a[3] * a[4] * (BPP[a[2]] ?? 4)); else { const s = a[5]; add(a[0], a[1], (s?.width ?? 0) * (s?.height ?? 0) * 4); } });
    w('compressedTexImage2D', (a) => add(a[0], a[1], a[6]?.byteLength ?? 0));
    w('deleteTexture', (a) => G.tex.delete(a[0]));
  }
};

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function measure(base, sc, quality) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(INIT);
  await page.goto(`${base}?${sc.q}&speed=1&quality=${quality}&dynres=0&debug=1&lang=pl`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 180000 });
  if (sc.valley) {
    await page.evaluate(new Function('sc', `
      const a = window.__marchia.app, w = a.world, st = w.state;
      st.coins = 1e9; st.town.rank = 5;
      for (const c of sc.cmds) { const k = { ...c }; if (k.t === 'road' && k.surface === 2) k.surface = 1; a.loop.enqueue(k); }
      a.loop.flushCommands();
      if (sc.wagons) {
        for (const b of st.buildings) if (b.type === 'warehouse') for (const g of ['wood', 'grain', 'flour']) { b.stock[g] += 48; st.ledger.produced[g] += 48; }
        const stable = st.buildings.find((b) => b.type === 'stable');
        for (let i = 0; i < sc.wagons; i++) a.loop.enqueue({ t: 'buyWagon', stable: stable.id });
        a.loop.flushCommands();
        for (let i = 0; i < 6000; i++) a.loop.tickOnce();
      } else for (let i = 0; i < 900; i++) a.loop.tickOnce();
      w.seasons = true; st.tick = sc.tick; a.view.snapEnv = true; a.view.debug.forceTime = 0.45;
      a.loop.speed = sc.wagons ? 1 : 0;
      const castle = st.buildings.find((b) => b.type === 'castle');
      const c = a.view.buildings.info.get(castle.id).centre;
      a.view.rig.set(c.x, c.z, sc.dist, sc.yaw);
    `), { ...sc, cmds: bench });
  }
  if (sc.cam) await page.evaluate((cam) => window.__marchia.app.view.rig.set(...cam), sc.cam);
  // wait for the tier's textures (KTX2 transcodes are slow here), the tree bake and a few settled frames
  await page.evaluate(async () => { const v = window.__marchia.app.view; let p; do { p = v.texturesReady; await p; } while (p !== v.texturesReady); });
  await page.waitForTimeout(4000);
  await page.evaluate(() => new Promise((res) => { let n = 0; const f = () => (++n >= 4 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
  if (process.env.RP_SPLIT) {
    const by = await page.evaluate(() => new Promise((res) => {
      const G = window.__rp, app = window.__marchia.app;
      const name = (o) => { let s = o.name || o.type; for (let p = o.parent; p && p !== app.view.scene; p = p.parent) if (p.name) { s = p.name + '/' + s; break; } return s + (o.isInstancedMesh ? '[I' + o.count + ']' : ''); };
      app.view.scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine || o.isSprite) { const n = name(o); o.onBeforeRender = () => { G.obj = n; }; o.onBeforeShadow = () => { G.obj = n; }; } });
      requestAnimationFrame(() => { G.by.clear(); G.split = true; requestAnimationFrame(() => { requestAnimationFrame(() => { G.split = false; res([...G.by].sort((a, b) => b[1][1] - a[1][1]).map(([k, v]) => `${String(v[0]).padStart(3)} ${(v[1] / 1000).toFixed(1).padStart(7)}k ${k}`)); }); }); });
    }));
    console.log('# split (2 frames)\n' + by.join('\n'));
  }
  const cdp = prof ? await ctx.newCDPSession(page) : null;
  if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
  const res = await page.evaluate((secs) => new Promise((res) => {
    const G = window.__rp, app = window.__marchia.app;
    const k0 = { draws: G.draws, mainDraws: G.mainDraws, tris: G.tris, mainTris: G.mainTris, progs: G.progs, texBinds: G.texBinds, unis: G.unis, upBytes: G.upBytes };
    let fms = 0, fn = 0;
    const fr = app.frame.bind(app);
    // the shadow map is refreshed every 2nd frame (D-150): offscreen work is reported per refresh, not per frame
    let offN = 0;
    app.frame = (now) => { const off0 = G.draws - G.mainDraws, t = performance.now(); fr(now); fms += performance.now() - t; fn++; if (G.draws - G.mainDraws > off0) offN++; };
    const d = []; let last = 0; const end = performance.now() + secs * 1000;
    const f = (t) => {
      if (last) d.push(t - last); last = t;
      if (t < end) { requestAnimationFrame(f); return; }
      app.frame = fr;
      const per = {}; for (const k in k0) per[k] = (G[k] - k0[k]) / Math.max(1, fn);
      per.offDraws = (G.draws - G.mainDraws - k0.draws + k0.mainDraws) / Math.max(1, offN);
      per.offTris = (G.tris - G.mainTris - k0.tris + k0.mainTris) / Math.max(1, offN);
      per.offShare = offN / Math.max(1, fn);
      let texBytes = 0; for (const m of G.tex.values()) for (const b of m.values()) texBytes += b;
      const ri = app.view.renderer.info;
      d.sort((x, y) => x - y);
      let objs = 0, meshes = 0, vis = 0, auto = 0;
      app.view.scene.traverse((o) => { objs++; if (o.isMesh || o.isPoints || o.isLine) meshes++; if (o.visible) vis++; if (o.matrixAutoUpdate) auto++; });
      res({ per, frames: fn, frameMs: fms / Math.max(1, fn), mean: d.reduce((s, x) => s + x, 0) / d.length, med: d[d.length >> 1],
        programs: ri.programs.length, geos: ri.memory.geometries, texs: ri.memory.textures, texMB: texBytes / 1048576, objs, meshes, vis, auto,
        wagons: app.world.state.wagons.length });
    };
    requestAnimationFrame(f);
  }), secs);
  let top = null;
  if (cdp) {
    const { profile } = await cdp.send('Profiler.stop');
    const self = new Map(); const dt = profile.timeDeltas;
    for (let i = 0; i < profile.samples.length; i++) self.set(profile.samples[i], (self.get(profile.samples[i]) ?? 0) + (dt[i] ?? 0));
    const byFn = new Map(); let total = 0;
    for (const n of profile.nodes) {
      const t = (self.get(n.id) ?? 0) / 1000; if (!t) continue; total += t;
      const cf = n.callFrame; const key = `${cf.functionName || '(anon)'} ${cf.url.replace(/^.*\//, '')}:${cf.lineNumber}:${cf.columnNumber}`;
      byFn.set(key, (byFn.get(key) ?? 0) + t);
    }
    top = { totalMs: total, fns: [...byFn].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${v.toFixed(0).padStart(6)} ${k}`) };
  }
  await ctx.close();
  res.errs = errs.slice(0, 2);
  return { res, top };
}

const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };
const builds = urlB ? [['A', urlA], ['B', urlB]] : [['A', urlA]];
for (const quality of qualS.split(',')) {
  for (const [name, sc] of Object.entries(SCENES)) {
    if (onlyS && !onlyS.split(',').includes(name)) continue;
    const acc = { A: [], B: [] };
    for (let r = 0; r < rounds; r++) {
      for (const [k, u] of r % 2 ? [...builds].reverse() : builds) {
        const m = await measure(u, sc, quality);
        acc[k].push(m.res);
        if (m.top) console.log(`# profile ${name} ${quality} ${k} total ${m.top.totalMs.toFixed(0)} ms\n` + m.top.fns.join('\n'));
        if (m.res.errs.length) console.log('# errors', k, m.res.errs);
      }
    }
    for (const [k] of builds) {
      const xs = acc[k], p = xs[0].per;
      console.log(`${name.padEnd(9)} ${quality.padEnd(4)} ${k}  main ${p.mainDraws.toFixed(0)} draws ${(p.mainTris / 1000).toFixed(1)}k tris  shadow/refresh ${p.offDraws.toFixed(0)} draws ${(p.offTris / 1000).toFixed(1)}k tris (${(p.offShare * 100).toFixed(0)} % of frames)  prog-sw ${p.progs.toFixed(0)}  texBind ${p.texBinds.toFixed(0)}  unif ${p.unis.toFixed(0)}  upKB ${(p.upBytes / 1024).toFixed(1)}  programs ${xs[0].programs}  geos ${xs[0].geos}  texs ${xs[0].texs}  texMB ${xs[0].texMB.toFixed(1)}  objs ${xs[0].objs}/${xs[0].meshes}m/${xs[0].auto}auto  wag ${xs[0].wagons}` +
        `  | rAF med-of-means ${med(xs.map((x) => x.mean)).toFixed(1)} ms (${xs.map((x) => x.mean.toFixed(0)).join('/')})  frameJS ${med(xs.map((x) => x.frameMs)).toFixed(1)} ms (${xs.map((x) => x.frameMs.toFixed(1)).join('/')})`);
    }
  }
}
await browser.close();
