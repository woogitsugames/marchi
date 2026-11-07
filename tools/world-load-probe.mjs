// World change cost in the browser (perf day 14, D-310..D-312): start at the menu, wait until its shader pre-warm is
// done, then time the synchronous `newGame` (setWorld + network sync + HUD) of mission I (same ground as the menu)
// and then of mission II (a new ground), and the frame after each. Each rep is a fresh browser.
// Usage: node tools/world-load-probe.mjs <baseUrl> [reps=5] [quality=high]   (prints one JSON line)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [base, repsS = '5', quality = 'high'] = process.argv.slice(2);
const root = base.replace(/\/?$/, '/');
const runs = [];
for (let r = 0; r < Number(repsS); r++) {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 0.5, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${root}?quality=${quality}&debug=1`);
  await page.waitForFunction(() => window.__marchia && window.__marchia.ready, null, { timeout: 120000 });
  await page.waitForFunction(() => performance.getEntriesByName('marchia:prewarm-1').length > 0, null, { timeout: 60000, polling: 200 }).catch(() => {});
  await page.waitForTimeout(1500);
  const res = {};
  for (const id of ['m1', 'm2']) {
    res[id] = await page.evaluate(async (m) => {
      const app = window.__marchia.app;
      const t0 = performance.now();
      app.newGame(m, null, false);
      const t1 = performance.now();
      await new Promise((ok) => requestAnimationFrame(() => ok(undefined)));
      const t2 = performance.now();
      await new Promise((ok) => requestAnimationFrame(() => ok(undefined)));
      return { build: +(t1 - t0).toFixed(1), frame: +(performance.now() - t2).toFixed(1), toFrame: +(t2 - t1).toFixed(1) };
    }, id);
    await page.waitForTimeout(2500); // the new world's pre-warm and deferred terrain pieces
  }
  runs.push(res);
  process.stderr.write(`rep ${r + 1}: ${JSON.stringify(res)}\n`);
  await browser.close();
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[(s.length - 1) >> 1]; };
const summary = {};
for (const id of ['m1', 'm2']) for (const k of ['build', 'toFrame', 'frame']) summary[`${id}.${k}`] = med(runs.map((x) => x[id][k]));
console.log(JSON.stringify({ base, quality, summary, runs }));
