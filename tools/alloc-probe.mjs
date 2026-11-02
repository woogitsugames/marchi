// Heap allocation probe (GC audit, frame-cost item 5): CDP sampling heap profiler over N s of sandbox play,
// top allocating functions mapped through the bundle sourcemap. Build with
// `vite build --sourcemap --minify false --outDir <dir>`, serve it, then:
//   node tools/alloc-probe.mjs <baseUrl> [wagons=100] [seconds=15] [speed=4] [self|src]
// env SETTLE=ms (wait before sampling, default 8000), STACK=<fn prefix> (print its top call chains).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { SourceMapConsumer } = require('source-map-js');
const [base, wagonsS = '100', secS = '15', speedS = '4', mode = 'self'] = process.argv.slice(2);
const wagons = Number(wagonsS), secs = Number(secS);
const benchCmds = JSON.parse(readFileSync(new URL('./frame-cost-bench.json', import.meta.url), 'utf8'));
const url = `${base}?play=sandbox&ff=30&speed=${speedS}&quality=low&dynres=0&perf=1&debug=1`;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 0.5, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__marchia && window.__marchia.ready, null, { timeout: 120000 });
await page.waitForTimeout(1500);
if (wagons > 0) await page.evaluate(({ n, cmds }) => {
  const app = window.__marchia.app; const st = app.world.state;
  st.coins = 1e8; st.town.rank = 5;
  for (const c of cmds) { if (c.t === 'road' && c.surface === 2) c.surface = 1; app.loop.enqueue(c); }
  app.loop.flushCommands();
  for (const b of st.buildings) if (b.type === 'warehouse') for (const g of ['wood', 'grain', 'flour']) { b.stock[g] += 48; st.ledger.produced[g] += 48; }
  const stable = st.buildings.find((b) => b.type === 'stable');
  for (let i = 0; i < n; i++) app.loop.enqueue({ t: 'buyWagon', stable: stable.id });
  app.loop.flushCommands();
  for (let i = 0; i < 6000; i++) app.loop.tickOnce();
}, { n: wagons, cmds: benchCmds });
await page.waitForTimeout(Number(process.env.SETTLE ?? 8000));
const cdp = await ctx.newCDPSession(page);
await cdp.send('HeapProfiler.enable');
await page.evaluate(() => { window.__nf = 0; const r = () => { window.__nf++; requestAnimationFrame(r); }; requestAnimationFrame(r); });
await cdp.send('HeapProfiler.startSampling', { samplingInterval: 2048, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
await page.waitForTimeout(secs * 1000);
const { profile } = await cdp.send('HeapProfiler.stopSampling');
const nf = await page.evaluate(() => window.__nf);
const ticks = await page.evaluate(() => window.__marchia.app.world.state.tick);
const maps = new Map();
async function mapFor(u) {
  if (maps.has(u)) return maps.get(u);
  let c = null;
  try { const r = await fetch(u + '.map'); if (r.ok) c = new SourceMapConsumer(await r.json()); } catch { /* none */ }
  maps.set(u, c); return c;
}
async function name(cf) {
  let key = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber + 1}`;
  if (cf.url.startsWith('http')) {
    const c = await mapFor(cf.url);
    if (c) { const o = c.originalPositionFor({ line: cf.lineNumber + 1, column: cf.columnNumber }); if (o.source) key = `${cf.functionName || '(anon)'} @${o.source.replace(/^(\.\.\/)+/, '')}:${o.line}`; }
  }
  return key;
}
const agg = new Map(); const byFile = new Map(); let total = 0;
// self: by allocating function; with mode=src, attribute to the nearest frame under src/
const stacks = new Map();
async function walk(n, srcFrame, chain = []) {
  const nm = await name(n.callFrame);
  chain = [...chain, nm];
  if (n.selfSize && process.env.STACK && nm.startsWith(process.env.STACK)) { const k = chain.slice(-7).join(' < '); stacks.set(k, (stacks.get(k) ?? 0) + n.selfSize); }
  const here = nm.includes('@src/') ? nm : srcFrame;
  if (n.selfSize) {
    const key = mode === 'src' ? (here ?? nm) : nm;
    agg.set(key, (agg.get(key) ?? 0) + n.selfSize); total += n.selfSize;
    const f = (here ?? nm).replace(/^.*@/, '').replace(/:\d+$/, '');
    byFile.set(f, (byFile.get(f) ?? 0) + n.selfSize);
  }
  for (const c of n.children) await walk(c, here, chain);
}
await walk(profile.head, null);
console.log(`frames=${nf} secs=${secs} tick=${ticks} total sampled alloc=${(total / 1048576).toFixed(1)} MB  per frame=${(total / nf / 1024).toFixed(1)} KB`);
for (const [k, v] of [...agg].sort((a, b) => b[1] - a[1]).slice(0, 35)) console.log((v / 1024).toFixed(0).padStart(8), 'KB', (v / nf).toFixed(0).padStart(7), 'B/f ', k);
console.log('--- by src file');
for (const [k, v] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log((v / 1024).toFixed(0).padStart(8), 'KB', (v / nf).toFixed(0).padStart(7), 'B/f ', k);
for (const [k, v] of [...stacks].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log('STACK', (v / 1024).toFixed(0), 'KB', k);
console.log('errors', errs.length, errs.slice(0, 3));
await browser.close();
