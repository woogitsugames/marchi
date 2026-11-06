// Startup cost probe (perf day 10, 2026-11-06): page load -> `__marchia.ready` -> first frame -> textures bound ->
// shader pre-warm done, from the `marchia:*` User Timing marks (src/platform/marks.ts), plus what the main thread
// spends the time on:
//   - GL time by kind (shader compile/link/first use, texture upload, draws, other) from wrappers on the context;
//   - long tasks (> 50 ms) before ready and between ready and the end of the window ("quiet" = end of the last one);
//   - a CPU profile (0.1 ms sampling) of the whole window, bucketed by source file (source maps) / three.js / GC;
//   - JS heap and renderer.info.memory at the end (needs ?debug=1, which only exposes the handle).
// Each rep is a fresh browser (cold HTTP and V8 code cache), like a first start of the APK after install.
// Usage: node tools/startup-probe.mjs <baseUrl> <quality low|high> [reps=3] [query=''] [dpr=0.5] [throttle=1]
//   query: extra URL params, e.g. 'play=m1' (straight into a mission) — default is the real menu path.
// Prints one JSON line: per rep and the median of every number.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { SourceMapConsumer } = require('source-map-js');

const [base, quality = 'high', repsS = '3', query = '', dprS = '0.5', thrS = '1'] = process.argv.slice(2);
const reps = Number(repsS), dpr = Number(dprS), throttle = Number(thrS);
const root = base.replace(/\/?$/, '/');
const url = `${root}?quality=${quality}&debug=1${query ? '&' + query : ''}`;
const WINDOW_MS = Number(process.env.WINDOW_MS ?? 20000);

const init = () => {
  const P = { gl: { shader: 0, tex: 0, draw: 0, other: 0, nShader: 0, nTex: 0 }, long: [] };
  window.__probe = P;
  // clock alignment for the CPU profile: a named 4 ms busy loop at document start
  const __probeSync = () => { const t = performance.now(); while (performance.now() - t < 4); return t; };
  P.sync = __probeSync();
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) P.long.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch { /* none */ }
  const SH = /^(compileShader|linkProgram|getProgramParameter|getShaderParameter|getProgramInfoLog|getShaderInfoLog|getUniformLocation|getActiveUniform|getAttribLocation|getActiveAttrib|getShaderPrecisionFormat|getUniformBlockIndex|uniformBlockBinding|getActiveUniformBlockParameter)$/;
  const TX = /^(texImage2D|texImage3D|texSubImage2D|texSubImage3D|compressedTexImage2D|compressedTexImage3D|compressedTexSubImage2D|compressedTexSubImage3D|texStorage2D|texStorage3D|generateMipmap)$/;
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    const proto = C.prototype;
    for (const name of Object.getOwnPropertyNames(proto)) {
      const d = Object.getOwnPropertyDescriptor(proto, name);
      if (!d || typeof d.value !== 'function' || name === 'constructor') continue;
      const f = d.value;
      const k = SH.test(name) ? 'shader' : TX.test(name) ? 'tex' : name.startsWith('draw') ? 'draw' : 'other';
      proto[name] = function (...a) {
        const t = performance.now();
        try { return f.apply(this, a); } finally {
          P.gl[k] += performance.now() - t;
          if (k === 'shader' && name === 'linkProgram') P.gl.nShader++;
          if (k === 'tex') P.gl.nTex++;
        }
      };
    }
  }
};

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
    if (c) { const o = c.originalPositionFor({ line: cf.lineNumber + 1, column: cf.columnNumber }); if (o.source) return { fn, src: o.source.replace(/^.*?\/?(?=src\/)/, '').replace(/^.*node_modules\//, ''), line: o.line }; }
    return { fn, src: cf.url.split('/').pop(), line: cf.lineNumber + 1 };
  }
  return { fn, src: cf.url ? cf.url.split('/').pop() : '', line: 0 };
};

async function once() {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(init);
  const cdp = await ctx.newCDPSession(page);
  // a same-origin document first, so the profiler session survives the navigation into the game
  await page.goto(`${root}vendor/basis/basis_transcoder.js`);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  await cdp.send('Profiler.start');
  await page.goto(url, { waitUntil: 'commit' });
  const t0 = Date.now();
  await page.waitForFunction(() => window.__marchia && window.__marchia.ready, null, { timeout: 120000, polling: 50 });
  await page.waitForFunction(() => performance.getEntriesByName('marchia:prewarm-1').length > 0 && performance.getEntriesByType('mark').some((m) => m.name.startsWith('marchia:textures-')), null, { timeout: WINDOW_MS, polling: 100 }).catch(() => {});
  // the pre-warm after the textures bind (warmPending) and the first-use slices: give them a moment
  await page.waitForTimeout(1500);
  const { profile } = await cdp.send('Profiler.stop');
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const res = await page.evaluate(() => {
    const P = window.__probe;
    const nav = performance.getEntriesByType('navigation')[0];
    const marks = Object.fromEntries(performance.getEntriesByType('mark').filter((m) => m.name.startsWith('marchia:')).map((m) => [m.name.slice(8), +m.startTime.toFixed(0)]));
    const ready = marks.ready ?? 0;
    const lt = P.long;
    const sum = (a) => a.reduce((s, x) => s + x[1], 0);
    const pre = lt.filter((x) => x[0] < ready), post = lt.filter((x) => x[0] >= ready);
    const app = window.__marchia.app, r = app.view.renderer;
    const res = performance.getEntriesByType('resource');
    const kb = (re) => +(res.filter((e) => re.test(e.name)).reduce((s, e) => s + (e.encodedBodySize || e.transferSize || 0), 0) / 1024).toFixed(0);
    return {
      nav: { domInteractive: +nav.domInteractive.toFixed(0), dcl: +nav.domContentLoadedEventEnd.toFixed(0), load: +nav.loadEventEnd.toFixed(0) },
      marks, sync: P.sync,
      gl: Object.fromEntries(Object.entries(P.gl).map(([k, v]) => [k, +v.toFixed(0)])),
      longPre: { n: pre.length, ms: +sum(pre).toFixed(0), max: +Math.max(0, ...pre.map((x) => x[1])).toFixed(0) },
      longPost: { n: post.length, ms: +sum(post).toFixed(0), max: +Math.max(0, ...post.map((x) => x[1])).toFixed(0), quietAt: +Math.max(ready, ...post.map((x) => x[0] + x[1])).toFixed(0), list: post.map((x) => [+x[0].toFixed(0), +x[1].toFixed(0)]).slice(0, 30) },
      bytesKB: { js: kb(/\.js(\?|$)/), css: kb(/\.css(\?|$)/), font: kb(/\.woff2?(\?|$)/), ktx2: kb(/\.ktx2(\?|$)/), img: kb(/\.(jpe?g|png|webp)(\?|$)/), wasm: kb(/\.wasm(\?|$)/), audio: kb(/\.(ogg|mp3|m4a|opus)(\?|$)/), n: res.length },
      heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1),
      gpu: { textures: r.info.memory.textures, geometries: r.info.memory.geometries, programs: r.info.programs?.length ?? 0 },
    };
  });
  // CPU profile buckets: before ready and ready -> end (time-based split on the sample timeline)
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const lab = new Map();
  for (const n of profile.nodes) {
    const f = await resolve(n.callFrame);
    let l;
    if (f.fn === '(garbage collector)') l = 'GC';
    else if (['(program)', '(idle)', '(root)'].includes(f.fn)) l = f.fn;
    else {
      const chain = [];
      for (let k = n.id; k !== undefined; k = parent.get(k)) chain.push(await resolve(byId.get(k).callFrame));
      const three = chain.find((x) => x.src.includes('three/'));
      const src = chain.find((x) => x.src.startsWith('src/'));
      if (three && chain.indexOf(three) < (src ? chain.indexOf(src) : 1e9)) {
        const fns = chain.slice(0, src ? chain.indexOf(src) : chain.length).map((x) => x.fn).join(' ');
        l = /getProgram|WebGLProgram|compile/.test(fns) ? 'three: programs' : /uploadTexture|setTexture|texImage|initTexture/.test(fns) ? 'three: texture upload' : 'three: other';
        if (src) l += ` (${src.src})`;
      } else if (src) l = src.src;
      else l = f.src ? `other ${f.src}` : `native ${f.fn}`;
    }
    lab.set(n.id, l);
  }
  const navStart = profile.startTime; // us, profiler clock
  const readyUs = res.marks.ready * 1000;
  // align: the profiler clock and performance.now differ by an offset; use the first sample at/after navigation
  let t = profile.startTime;
  const pre = new Map(), post = new Map(), fnPre = new Map();
  const fnName = new Map();
  for (const n of profile.nodes) { const f = await resolve(n.callFrame); fnName.set(n.id, `${f.fn} @${f.src}:${f.line}`); }
  // performance.timeOrigin of the game document ~ the first non-idle sample after navigation; good enough
  // for a pre/post split at ready (the split only moves samples by a few ms)
  const firstBusy = (() => { let tt = profile.startTime; for (let i = 0; i < profile.samples.length; i++) { tt += profile.timeDeltas[i]; if (lab.get(profile.samples[i]) !== '(idle)') return tt; } return tt; })();
  // profiler clock -> performance.now(): the first sample inside __probeSync
  let off = null;
  { let tt = profile.startTime; for (let i = 0; i < profile.samples.length; i++) { tt += profile.timeDeltas[i]; if (byId.get(profile.samples[i]).callFrame.functionName === '__probeSync') { off = tt / 1000 - res.sync; break; } } }
  const ms = Object.entries(res.marks).sort((a, b) => a[1] - b[1]);
  const phase = new Map();
  for (let i = 0; i < profile.samples.length; i++) {
    t += profile.timeDeltas[i];
    if (off !== null) {
      const pn = t / 1000 - off;
      let ph = 'pre-boot';
      for (const [k, v] of ms) if (pn >= v) ph = k;
      const l0 = lab.get(profile.samples[i]);
      if (l0 !== '(idle)' && l0 !== '(root)') {
        const m0 = phase.get(ph) ?? new Map(); phase.set(ph, m0);
        const d0 = (profile.timeDeltas[i + 1] ?? 0) / 1000;
        m0.set(l0, (m0.get(l0) ?? 0) + d0);
      }
    }
    const dt = (profile.timeDeltas[i + 1] ?? 0) / 1000;
    const l = lab.get(profile.samples[i]);
    if (l === '(idle)' || l === '(root)') continue;
    const m = (t - firstBusy) < readyUs ? pre : post;
    m.set(l, (m.get(l) ?? 0) + dt);
    if (m === pre) { const k = fnName.get(profile.samples[i]); fnPre.set(k, (fnPre.get(k) ?? 0) + dt); }
  }
  const top = (m, n = 14) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, +v.toFixed(0)]);
  const tot = (m) => +[...m.values()].reduce((a, b) => a + b, 0).toFixed(0);
  res.cpu = { aligned: off !== null, phases: Object.fromEntries([...phase].map(([k, m]) => [k, { ms: tot(m), top: top(m, 8) }])), preReadyMs: tot(pre), postReadyMs: tot(post), pre: top(pre, 20), post: top(post), fnPre: top(fnPre, 20), navStartUs: navStart };
  res.wallS = (Date.now() - t0) / 1000;
  res.errors = errs.slice(0, 3);
  await browser.close();
  return res;
}

const runs = [];
for (let i = 0; i < reps; i++) {
  runs.push(await once());
  process.stderr.write(`rep ${i + 1}: ready ${runs.at(-1).marks.ready} first-frame ${runs.at(-1).marks['first-frame']} prewarm ${runs.at(-1).marks['prewarm-1']}\n`);
}
const med = (a) => { const s = a.filter((x) => typeof x === 'number').sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const markNames = [...new Set(runs.flatMap((r) => Object.keys(r.marks)))];
const summary = {
  marks: Object.fromEntries(markNames.map((k) => [k, { med: med(runs.map((r) => r.marks[k])), min: Math.min(...runs.map((r) => r.marks[k] ?? Infinity)), max: Math.max(...runs.map((r) => r.marks[k] ?? -Infinity)) }])),
  gl: Object.fromEntries(Object.keys(runs[0].gl).map((k) => [k, med(runs.map((r) => r.gl[k]))])),
  longPreMs: med(runs.map((r) => r.longPre.ms)), longPostMs: med(runs.map((r) => r.longPost.ms)), quietAt: med(runs.map((r) => r.longPost.quietAt)),
  cpuPreReadyMs: med(runs.map((r) => r.cpu.preReadyMs)), cpuPostReadyMs: med(runs.map((r) => r.cpu.postReadyMs)),
  heapMB: med(runs.map((r) => r.heapMB)),
};
console.log(JSON.stringify({ url, quality, reps, dpr, throttle, load: process.env.LOADAVG ?? null, summary, runs }));
