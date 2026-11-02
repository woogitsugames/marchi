// Frame-cost probe (research 2026-11-02): per-frame JS cost split sim / render / DOM-HUD, rAF deltas, draw calls, heap,
// optional CDP CPU profile aggregated by source file via the bundle sourcemap.
// Usage: node tools/frame-cost.mjs <baseUrl> <label> <scene> <quality> <dpr> [wagons] [profile=0|1] [seconds=20]
//   scene: m1 | sandbox. Build the page with `vite build --sourcemap --minify false --outDir dist-perf` and serve it.
// Needs ?debug=1 (window.__marchia.app) for the in-page wrappers. CPU throttle 4x, 412x915.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { SourceMapConsumer } = require('source-map-js');

const [base, label, scene, quality, dprS, wagonsS = '0', profS = '0', secS = '20'] = process.argv.slice(2);
const dpr = Number(dprS), wagons = Number(wagonsS), prof = profS === '1', secs = Number(secS);
const q = scene === 'm1' ? 'play=m1&bot=1&ff=170' : 'play=sandbox&ff=30';
const benchCmds = JSON.parse(readFileSync(new URL('./frame-cost-bench.json', import.meta.url), 'utf8'));
const url = `${base.replace(/\/?$/, '/')}?${q}&speed=1&quality=${quality}&dynres=0&perf=1&debug=1`;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(url);
await page.waitForFunction(() => window.__marchia && window.__marchia.ready, null, { timeout: 60000 });
await page.waitForTimeout(1500);

if (wagons > 0) {
  await page.evaluate(({ n, cmds }) => {
    const app = window.__marchia.app;
    const st = app.world.state;
    st.coins = 1e8; st.town.rank = 9;
    for (const c of cmds) { if (c.t === 'road' && c.surface === 2) c.surface = 1; app.loop.enqueue(c); }
    app.loop.flushCommands();
    for (const b of st.buildings) if (b.type === 'warehouse') for (const g of ['wood', 'grain', 'flour']) { b.stock[g] += 48; st.ledger.produced[g] += 48; }
    const stable = st.buildings.find((b) => b.type === 'stable');
    for (let i = 0; i < n; i++) app.loop.enqueue({ t: 'buyWagon', stable: stable.id });
    app.loop.flushCommands();
    for (let i = 0; i < 600 * 10; i++) app.loop.tickOnce(); // 10 game minutes so wagons get busy
  }, { n: wagons, cmds: benchCmds });
}

await page.evaluate(() => {
  const app = window.__marchia.app;
  const S = { sim: 0, render: 0, hud: 0, frame: 0, n: 0, dts: [], ticks0: app.world.state.tick, heap0: performance.memory?.usedJSHeapSize ?? 0 };
  window.__fc = S;
  const wrap = (obj, name, key) => {
    const f = obj[name].bind(obj);
    obj[name] = (...a) => { const t = performance.now(); const r = f(...a); S[key] += performance.now() - t; return r; };
  };
  wrap(app.loop, 'advance', 'sim');
  wrap(app.view, 'frame', 'render');
  wrap(app.hud, 'update', 'hud');
  wrap(app.markers, 'update', 'hud');
  const fr = app.frame.bind(app);
  app.frame = (now) => { const t = performance.now(); fr(now); S.frame += performance.now() - t; S.n++; };
  let last = 0;
  const tick = (t) => { if (last) S.dts.push(t - last); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});

const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
if (prof) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
await page.evaluate(() => { const S = window.__fc; S.sim = S.render = S.hud = S.frame = 0; S.n = 0; S.dts.length = 0; S.ticks0 = window.__marchia.app.world.state.tick; S.heap0 = performance.memory?.usedJSHeapSize ?? 0; });
await page.waitForTimeout(secs * 1000);
const res = await page.evaluate(() => {
  const S = window.__fc, app = window.__marchia.app;
  const d = [...S.dts].sort((a, b) => a - b);
  const p = (x) => d[Math.min(d.length - 1, Math.floor(d.length * x))] ?? 0;
  const ws = app.world.state.wagons;
  const st = app.view.stats();
  return {
    frames: S.n, rafCount: d.length, p50: p(0.5), p95: p(0.95), p99: p(0.99), mean: d.reduce((a, b) => a + b, 0) / Math.max(1, d.length),
    simMs: S.sim / S.n, simPerTickMs: S.sim / Math.max(1, app.world.state.tick - S.ticks0), renderMs: S.render / S.n, hudMs: S.hud / S.n, frameMs: S.frame / S.n,
    ticks: app.world.state.tick - S.ticks0,
    wagons: ws.length, moving: ws.filter((w) => w.status.k !== 'IDLE').length,
    calls: st.drawCalls, tris: st.triangles, geos: st.geometries, texs: st.textures,
    heapMB: (performance.memory?.usedJSHeapSize ?? 0) / 1048576, heapDeltaMB: ((performance.memory?.usedJSHeapSize ?? 0) - S.heap0) / 1048576,
    dom: document.getElementsByTagName('*').length,
    dprUsed: window.devicePixelRatio,
  };
});
let top = null;
if (prof) {
  const { profile } = await cdp.send('Profiler.stop');
  const dt = profile.timeDeltas; const self = new Map();
  for (let i = 0; i < profile.samples.length; i++) self.set(profile.samples[i], (self.get(profile.samples[i]) ?? 0) + (dt[i] ?? 0));
  const maps = new Map();
  const consumerFor = async (u) => {
    if (maps.has(u)) return maps.get(u);
    let c = null;
    try {
      const r = await fetch(u + '.map'); if (r.ok) c = new SourceMapConsumer(await r.json());
    } catch {}
    maps.set(u, c); return c;
  };
  const byFile = new Map(), byFn = new Map(); let total = 0;
  for (const n of profile.nodes) {
    const t = (self.get(n.id) ?? 0) / 1000; if (!t) continue; total += t;
    const cf = n.callFrame; let file = cf.url ? cf.url.replace(/^https?:\/\/[^/]+\//, '') : '(' + (cf.functionName || 'native') + ')'; let fn = cf.functionName || '(anon)';
    if (cf.url && cf.url.endsWith('.js')) {
      const c = await consumerFor(cf.url);
      if (c) { const o = c.originalPositionFor({ line: cf.lineNumber + 1, column: cf.columnNumber }); if (o.source) { file = o.source.replace(/^(\.\.\/)+/, ''); fn = `${cf.functionName || '(anon)'} @${file}:${o.line}`; } }
    }
    const grp = file.startsWith('src/sim') ? 'src/sim' : file.startsWith('src/render') ? 'src/render' : file.startsWith('src/ui') ? 'src/ui' : file.startsWith('src/') ? 'src/other' : file.includes('node_modules/three') ? 'three.js' : file.startsWith('(') ? file : 'other';
    byFile.set(grp, (byFile.get(grp) ?? 0) + t);
    byFn.set(fn, (byFn.get(fn) ?? 0) + t);
  }
  top = { totalMs: total, groups: [...byFile].sort((a, b) => b[1] - a[1]), fns: [...byFn].sort((a, b) => b[1] - a[1]).slice(0, 30) };
}
res.errs = errs.slice(0, 3);
const out = { label, scene, quality, dpr, wagons, url, res, top };
console.log(JSON.stringify(out));
await browser.close();
