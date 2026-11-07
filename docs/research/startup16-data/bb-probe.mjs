// bakeTreeBillboards inclusive CPU + breakdown (leaf self-time under it), marks ready/first-frame; one fresh browser per rep
import { createRequire } from 'node:module';
const require = createRequire('/workspace/marchi-billboard/package.json');
const { chromium } = require('playwright');
const { SourceMapConsumer } = require('source-map-js');
const [base, repsS = '3', quality = 'high', extra = ''] = process.argv.slice(2);
const maps = new Map();
const consumerFor = async (u) => { if (maps.has(u)) return maps.get(u); let c = null; try { const r = await fetch(u + '.map'); if (r.ok) c = new SourceMapConsumer(await r.json()); } catch {} maps.set(u, c); return c; };
const resolve = async (cf) => { const fn = cf.functionName || '(anon)'; if (cf.url && cf.url.endsWith('.js')) { const c = await consumerFor(cf.url); if (c) { const o = c.originalPositionFor({ line: cf.lineNumber + 1, column: cf.columnNumber }); if (o.source) return `${o.name || fn} @${o.source.replace(/^.*?\/?(?=src\/)/, '').replace(/^.*node_modules\//, '')}`; } } return `${fn} @${(cf.url || '').split('/').pop()}`; };
const out = [];
for (let r = 0; r < Number(repsS); r++) {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 0.5, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__rafT = []; const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => raf((t) => { window.__rafT.push(performance.now()); return cb(t); }); });
  const cdp = await ctx.newCDPSession(page);
  await page.goto(base + 'vendor/basis/basis_transcoder.js');
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start');
  await page.goto(base + `?quality=${quality}&debug=1${extra}`);
  await page.waitForFunction(() => performance.getEntriesByName('marchia:first-frame').length > 0, null, { timeout: 120000, polling: 50 });
  await page.waitForTimeout(3000);
  const marks = await page.evaluate(() => Object.fromEntries(['menu-start', 'menu-world', 'menu-sim', 'menu-dom', 'menu-saves', 'ready', 'first-frame'].map((n) => [n, Math.round(performance.getEntriesByName('marchia:' + n)[0]?.startTime ?? -1)])));
  marks.shown = await page.evaluate((ff) => Math.round(window.__rafT.find((t) => t > ff) ?? -1), marks['first-frame']);
  const { profile } = await cdp.send('Profiler.stop');
  await browser.close();
  const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const name = new Map(); for (const n of profile.nodes) name.set(n.id, await resolve(n.callFrame));
  const self = new Map();
  for (let i = 0; i < profile.samples.length; i++) { const d = (profile.timeDeltas[i + 1] ?? 0) / 1000; self.set(profile.samples[i], (self.get(profile.samples[i]) ?? 0) + d); }
  if (process.env.DUMP) { const ns = new Set(name.values()); console.error([...ns].filter((s) => /trees|vegetation|view/.test(s)).join('\n')); }
  let bake = 0, render = 0; const leaf = new Map(); const kid = new Map();
  for (const [id, d] of self) {
    const chain = []; for (let k = id; k !== undefined; k = parent.get(k)) chain.push(name.get(k));
    const bi = chain.findIndex((s) => s.startsWith('bakeTreeBillboards '));
    const ri = chain.findIndex((s) => /^render @.*src\/render\/view/.test(s));
    if (ri >= 0) render += d;
    if (bi < 0) continue;
    bake += d;
    const l = chain[0].replace(/ @.*/, ''); leaf.set(l, (leaf.get(l) ?? 0) + d);
    const c = bi > 0 ? chain[bi - 1] : '(self)'; kid.set(c, (kid.get(c) ?? 0) + d);
  }
  const top = (m) => Object.fromEntries([...m].sort((a, b) => b[1] - a[1]).slice(0, +(process.env.TOP ?? 12)).map(([k, v]) => [k, +v.toFixed(1)]));
  const allLeaf = new Map(); for (const [id, d] of self) { const chain = []; for (let k = id, j = 0; k !== undefined && j < 4; k = parent.get(k), j++) chain.push(name.get(k).replace(/ @.*\//, '@')); const l = chain.join(' < '); allLeaf.set(l, (allLeaf.get(l) ?? 0) + d); }
  const fnIncl = {}; if (process.env.FN) { const re = new RegExp(process.env.FN); for (const [id, d] of self) { const seen = new Set(); for (let k = id; k !== undefined; k = parent.get(k)) { const nm = name.get(k).replace(/ @.*/, ''); if (re.test(nm) && !seen.has(nm)) { seen.add(nm); fnIncl[nm] = +((fnIncl[nm] ?? 0) + d).toFixed(1); } } } }
  const rec = { marks, fnIncl, all: process.env.ALL ? top(allLeaf) : undefined, bake: +bake.toFixed(1), viewRender: +render.toFixed(1), kids: top(kid), leaf: top(leaf) };
  out.push(rec);
  process.stderr.write(JSON.stringify(rec) + '\n');
}
console.log(JSON.stringify(out));
