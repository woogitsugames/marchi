// Startup marks per variant, fresh browser per rep, variants interleaved.
// node marks-probe.mjs reps throttle quality variant1 variant2 ...   (variant = url incl. query)
import { createRequire } from 'node:module';
const require = createRequire('/workspace/marchi-geomcache/package.json');
const { chromium } = require('playwright');
const [repsS, thrS, quality, ...variants] = process.argv.slice(2);
const res = variants.map(() => []);
for (let r = 0; r < Number(repsS); r++) {
  for (let vi = 0; vi < variants.length; vi++) {
    const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 0.5, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    if (Number(thrS) > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(thrS) });
    const sep = variants[vi].includes('?') ? '&' : '?';
    await page.goto(`${variants[vi]}${sep}quality=${quality}&debug=1`);
    await page.waitForFunction(() => performance.getEntriesByName('marchia:first-frame').length > 0, null, { timeout: 180000, polling: 100 });
    const m = await page.evaluate(() => Object.fromEntries(performance.getEntriesByType('mark').filter((e) => e.name.startsWith('marchia:')).map((e) => [e.name.slice(8), +e.startTime.toFixed(1)])));
    res[vi].push(m);
    process.stderr.write(`r${r} v${vi} ready=${m.ready} ms=${(m['menu-world'] - m['menu-start']).toFixed(1)} vm=${m['view-module']} bk=${m['baked-models']} ff=${m['first-frame']}\n`);
    await browser.close();
  }
}
const med = (a) => { const s = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); return s.length ? s[(s.length - 1) >> 1] : null; };
const keys = { ready: (m) => m.ready, 'menu-world - menu-start': (m) => m['menu-world'] - m['menu-start'], 'view-module': (m) => m['view-module'], 'first-frame': (m) => m['first-frame'], 'ready->ff': (m) => m['first-frame'] - m.ready, 'app': (m) => m.app };
for (let vi = 0; vi < variants.length; vi++) {
  const o = {}; for (const [k, f] of Object.entries(keys)) o[k] = +(med(res[vi].map(f)) ?? NaN).toFixed(1);
  console.log(JSON.stringify({ variant: variants[vi], n: res[vi].length, thr: Number(thrS), med: o }));
}
console.log(JSON.stringify({ raw: res }));
