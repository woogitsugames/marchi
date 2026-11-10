// Graphics audit 12 (D-543): A/B frame time of two builds, interleaved (SwiftShader rAF deltas, as D-502).
//   node tools/gfx12-frame-ab.mjs <urlA> <urlB> [rounds=3] [seconds=8] [scene,...] [quality,...]
// Scenes: the free valley with the bench road network in summer at 110 m and at the castle close-up (38 m), and
// mission I with the bot after 150 s: `m1-fixed` with the old overview camera in both builds (shader cost only),
// `m1-bot` with each build's own camera (also the cost of the closer opening frame, D-542).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [urlA, urlB, roundsS = '3', secsS = '8', onlyS = '', qualS = 'low,high'] = process.argv.slice(2);
const rounds = Number(roundsS), secs = Number(secsS);
const bench = JSON.parse(readFileSync(resolve(root, 'tools/frame-cost-bench.json'), 'utf8'));
const SUMMER = 9000 + 4500;
const SCENES = {
  'valley-110': { q: 'play=sandbox&ff=30', valley: true, dist: 110, yaw: 0.9 },
  'valley-38': { q: 'play=sandbox&ff=30', valley: true, dist: 38, yaw: 1.4 },
  'm1-fixed': { q: 'play=m1&bot=1&ff=150', cam: [172.8, 144, 200, -0.3] },
  'm1-bot': { q: 'play=m1&bot=1&ff=150' },
};

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function measure(base, sc, quality) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${base}?${sc.q}&speed=1&quality=${quality}&dynres=0&debug=1&lang=pl`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 120000 });
  if (sc.valley) {
    await page.evaluate(new Function('sc', `
      const a = window.__marchia.app, w = a.world;
      w.state.coins = 1e9; w.state.town.rank = 5;
      for (const c of sc.cmds) { if (c.t === 'road' && c.surface === 2) c.surface = 1; a.loop.enqueue(c); }
      a.loop.flushCommands();
      for (let i = 0; i < 900; i++) a.loop.tickOnce();
      w.seasons = true; w.state.tick = sc.tick; a.view.snapEnv = true; a.view.debug.forceTime = 0.45;
      a.loop.speed = 0;
      const castle = w.state.buildings.find((b) => b.type === 'castle');
      const c = a.view.buildings.info.get(castle.id).centre;
      a.view.rig.set(c.x, c.z, sc.dist, sc.yaw);
    `), { ...sc, cmds: bench, tick: SUMMER });
  }
  if (sc.cam) await page.evaluate((cam) => window.__marchia.app.view.rig.set(...cam), sc.cam);
  await page.waitForTimeout(5000);
  const ms = await page.evaluate((secs) => new Promise((res) => {
    const d = []; let last = 0; const end = performance.now() + secs * 1000;
    const f = (t) => { if (last) d.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else res(d); };
    requestAnimationFrame(f);
  }), secs);
  await ctx.close();
  ms.sort((a, b) => a - b);
  return { mean: ms.reduce((s, x) => s + x, 0) / ms.length, med: ms[ms.length >> 1], n: ms.length };
}

for (const quality of qualS.split(',')) {
  for (const [name, sc] of Object.entries(SCENES)) {
    if (onlyS && !onlyS.split(',').includes(name)) continue;
    const acc = { A: [], B: [] };
    for (let r = 0; r < rounds; r++) {
      for (const [k, u] of r % 2 ? [['B', urlB], ['A', urlA]] : [['A', urlA], ['B', urlB]]) acc[k].push((await measure(u, sc, quality)).mean);
    }
    const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const a = avg(acc.A), b = avg(acc.B);
    console.log(`${name.padEnd(11)} ${quality.padEnd(4)} A ${a.toFixed(0)} ms  B ${b.toFixed(0)} ms  B/A ${((b / a - 1) * 100).toFixed(1)} %  (A ${acc.A.map((x) => x.toFixed(0)).join('/')}, B ${acc.B.map((x) => x.toFixed(0)).join('/')})`);
  }
}
await browser.close();
