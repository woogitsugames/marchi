// Option (b) vs (a): read the catalogue from IndexedDB (second launch) vs fetch it from the server, cold browser.
import { createRequire } from 'node:module';
import { rmSync } from 'node:fs';
const require = createRequire('/workspace/marchi-geomcache/package.json');
const { chromium } = require('playwright');
const [base, asset, repsS = '5', thrS = '1'] = process.argv.slice(2);
const dir = new URL('./idb-profile', import.meta.url).pathname;
rmSync(dir, { recursive: true, force: true });
const args = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
let ctx = await chromium.launchPersistentContext(dir, { args });
let page = await ctx.newPage();
await page.goto(base + 'favicon.svg');
await page.evaluate(async (u) => {
  const buf = await (await fetch(u)).arrayBuffer();
  const db = await new Promise((ok, no) => { const r = indexedDB.open('p', 1); r.onupgradeneeded = () => r.result.createObjectStore('s'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  await new Promise((ok, no) => { const t = db.transaction('s', 'readwrite'); t.objectStore('s').put(buf, 'k'); t.oncomplete = ok; t.onerror = () => no(t.error); });
}, asset);
await ctx.close();
const out = [];
for (let r = 0; r < Number(repsS); r++) {
  ctx = await chromium.launchPersistentContext(dir, { args });
  page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (Number(thrS) > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(thrS) });
  await page.goto(base + 'favicon.svg');
  const m = await page.evaluate(async (u) => {
    const t0 = performance.now();
    const db = await new Promise((ok, no) => { const r = indexedDB.open('p', 1); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
    const buf = await new Promise((ok, no) => { const q = db.transaction('s').objectStore('s').get('k'); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); });
    const t1 = performance.now();
    const f = await (await fetch(u, { cache: 'no-store' })).arrayBuffer();
    const t2 = performance.now();
    // main-thread time of the idb read alone (structured clone deserialisation happens on the main thread)
    return { idb: +(t1 - t0).toFixed(1), fetch: +(t2 - t1).toFixed(1), n: buf.byteLength, nf: f.byteLength };
  }, asset);
  out.push(m);
  await ctx.close();
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[(s.length - 1) >> 1]; };
console.log(JSON.stringify({ thr: Number(thrS), idb: med(out.map((x) => x.idb)), fetch: med(out.map((x) => x.fetch)), out }));
