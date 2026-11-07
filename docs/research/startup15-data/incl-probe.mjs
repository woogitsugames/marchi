// inclusive CPU per source function (src/render/**) between navigation and ready, one fresh browser per rep
import { createRequire } from 'node:module';
const require = createRequire('/workspace/marchi-kitperf/package.json');
const { chromium } = require('playwright');
const { SourceMapConsumer } = require('source-map-js');
const [base, repsS = '3', filt = 'src/render'] = process.argv.slice(2);
const maps = new Map();
const consumerFor = async (u) => { if (maps.has(u)) return maps.get(u); let c = null; try { const r = await fetch(u + '.map'); if (r.ok) c = new SourceMapConsumer(await r.json()); } catch {} maps.set(u, c); return c; };
const resolve = async (cf) => { const fn = cf.functionName || '(anon)'; if (cf.url && cf.url.endsWith('.js')) { const c = await consumerFor(cf.url); if (c) { const o = c.originalPositionFor({ line: cf.lineNumber + 1, column: cf.columnNumber }); if (o.source) return `${o.name || fn} @${o.source.replace(/^.*?\/?(?=src\/)/, '').replace(/^.*node_modules\//, '')}:${o.line}`; } } return `${fn} @${(cf.url || '').split('/').pop()}`; };
const agg = new Map(); const per = [];
for (let r = 0; r < Number(repsS); r++) {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 0.5, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(base + 'vendor/basis/basis_transcoder.js');
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start');
  await page.goto(base + '?quality=high&debug=1');
  await page.waitForFunction(() => window.__marchia && window.__marchia.ready, null, { timeout: 120000 });
  const { profile } = await cdp.send('Profiler.stop');
  await browser.close();
  const byId = new Map(profile.nodes.map((n) => [n.id, n])); const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const name = new Map(); for (const n of profile.nodes) name.set(n.id, await resolve(n.callFrame));
  const self = new Map();
  for (let i = 0; i < profile.samples.length; i++) { const d = (profile.timeDeltas[i + 1] ?? 0) / 1000; self.set(profile.samples[i], (self.get(profile.samples[i]) ?? 0) + d); }
  const one = new Map();
  for (const [id, d] of self) { const seen = new Set(); for (let k = id; k !== undefined; k = parent.get(k)) { const nm = name.get(k).replace(/ @(src\/[^:]*):\d+$/, ' @$1'); if (!seen.has(nm)) { seen.add(nm); one.set(nm, (one.get(nm) ?? 0) + d); } } }
  const pick = (re) => [...one].filter(([k]) => re.test(k)).reduce((a, [, v]) => Math.max(a, v), 0);
  per.push({ buildings: pick(/^buildingModel @/), trees: pick(/^treeParts @/), wagon: pick(/^wagonModel @/), lod1: pick(/^wagonLod1 @/), workers: pick(/^workerRig @/), bridges: pick(/^rebuild @src\/render\/bridgesView/), bbBake: pick(/^bakeTreeBillboards @/), sync: pick(/^sync @src\/render\/buildingsView/), setWorld: pick(/^setWorld @/) });
  for (const [id, d] of self) { const seen = new Set(); for (let k = id; k !== undefined; k = parent.get(k)) { const nm = name.get(k); if (!seen.has(nm)) { seen.add(nm); agg.set(nm, (agg.get(nm) ?? 0) + d / Number(repsS)); } } }
}
console.log(JSON.stringify(per.map((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(1)])))));
