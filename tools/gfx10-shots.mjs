// Graphics polish 10 (D-200..): before/after close-ups of the late-chain yards (quarry, charcoal burner, malthouse,
// brewery, trading post), the new goods on wagons and the trading-post bank in autumn / winter.
// Built game: npm run build; npx vite preview --port 5194 --strictPort.
//   node tools/gfx10-shots.mjs <baseUrl> <tag> [scene,...] [quality,...]
// -> docs/shots/gfx10-<tag>-<scene>-<quality>.jpg (412x915) and gfx10-<tag>-<scene>-<quality>-crop.jpg (the middle
// 240x240 px, the "close crop"). Prints each building's status so a resting worker is not read as a bug.
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'docs/shots');
mkdirSync(outDir, { recursive: true });
const [base = 'http://127.0.0.1:5194/', tag = 'after', only = '', qualS = 'low,high'] = process.argv.slice(2);

// season ticks (TICK_HZ 10, 15 min seasons): a day moment in autumn / winter
const AUTUMN = 22392, WINTER = 31392;
// scene: q = mission query, type = building to look at, dist / yaw = camera, tick = optional season tick,
// pre = page-side setup run before the camera is placed (a = app, w = world)
const SCENES = {
  quarry: { q: 'play=m8&ff=20', type: 'quarry', dist: 20, yaw: 0.5 },
  charcoal: { q: 'play=m9&ff=20', type: 'charcoalBurner', dist: 18, yaw: 0.6 },
  malthouse: { q: 'play=m9&ff=20', type: 'malthouse', dist: 18, yaw: 0.5 },
  brewery: { q: 'play=m9&ff=20', type: 'brewery', dist: 20, yaw: 0.4 },
  'quarry-worker': { q: 'play=m8&ff=20', type: 'quarry', dist: 16, yaw: 0.7, worker: true },
  'charcoal-worker': { q: 'play=m9&ff=20', type: 'charcoalBurner', dist: 16, yaw: 0.6, worker: 'abs' },
  'malthouse-worker': { q: 'play=m9&ff=20', type: 'malthouse', dist: 16, yaw: 0.7, worker: true },
  'brewery-worker': { q: 'play=m9&ff=20', type: 'brewery', dist: 16, yaw: 0.4, worker: 'abs' },
  'post-worker': { q: 'play=sandbox&ff=30', type: 'tradePost', dist: 16, yaw: 0.4, worker: true, pre: 'w.state.town.rank = 4; w.state.market.open = true; for (let i = 0; i < 20; i++) a.loop.tickOnce();' },
  'post-closed': { q: 'play=sandbox&ff=30', type: 'tradePost', dist: 20, yaw: 0.3 },
  'post-open': { q: 'play=sandbox&ff=30', type: 'tradePost', dist: 20, yaw: 0.3, pre: 'w.state.town.rank = 4; w.state.market.open = true; for (let i = 0; i < 20; i++) a.loop.tickOnce();' },
  'post-autumn': { q: 'play=sandbox&ff=30', type: 'tradePost', dist: 55, yaw: 0.9, tick: AUTUMN, pre: 'w.state.town.rank = 4; w.state.market.open = true; for (let i = 0; i < 20; i++) a.loop.tickOnce(); a.loop.speed = 0;' },
  'post-winter': { q: 'play=sandbox&ff=30', type: 'tradePost', dist: 55, yaw: 0.9, tick: WINTER, pre: 'w.state.town.rank = 4; w.state.market.open = true; for (let i = 0; i < 20; i++) a.loop.tickOnce(); a.loop.speed = 0;' },
  'm9-winter': { q: 'play=m9&ff=20', type: 'brewery', dist: 60, yaw: 0.5, tick: WINTER },
  'm8-winter': { q: 'play=m8&ff=20', type: 'quarry', dist: 60, yaw: 0.5, tick: WINTER },
  // the new goods on wagons at mid distance, next to the older sacks and baskets they could be confused with
  cargo: { q: 'play=sandbox&ff=30', cargo: true, dist: 50, yaw: 1.65 },
};

const benchCmds = JSON.parse(readFileSync(resolve(root, 'tools/frame-cost-bench.json'), 'utf8'));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const [name, sc] of Object.entries(SCENES)) {
  if (only && !only.split(',').includes(name)) continue;
  for (const quality of qualS.split(',')) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${name} ${quality}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} ${quality}: ${m.text()}`); });
    await page.goto(`${base}?${sc.q}${sc.q.includes('speed=') ? '' : '&speed=1'}&quality=${quality}&dynres=0&debug=1&lang=pl`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 120000 });
    const info = await page.evaluate(new Function('sc', `
      const a = window.__marchia.app, w = a.world;
      for (const el of Object.values(a.layers ?? {})) if (el && el.style) el.style.visibility = 'hidden';
      ${sc.pre ?? ''}
      if (sc.tick) { w.seasons = true; w.state.tick = sc.tick; a.view.snapEnv = true; }
      if (sc.cargo) {
        // the bench roads (tools/frame-cost-bench.json) and five wagons put on one road, each loaded with one of the
        // new goods and driving (shots only: conservation does not matter here, the sim is paused right after)
        w.state.coins = 1e9; w.state.town.rank = 5;
        for (const c of sc.cmds) { if (c.t === 'road' && c.surface === 2) c.surface = 1; a.loop.enqueue(c); }
        a.loop.flushCommands();
        const stable = w.state.buildings.find((b) => b.type === 'stable');
        for (let i = 0; i < 8; i++) a.loop.enqueue({ t: 'buyWagon', stable: stable.id });
        a.loop.flushCommands();
        for (let i = 0; i < 60; i++) a.loop.tickOnce();
        const W = w.terrain.w, roads = [];
        for (let c = 0; c < w.state.roads.length; c++) if (w.state.roads[c] > 0 && !w.terrain.water[c]) roads.push(c);
        // a straight stretch: the longest run of road cells along one row
        let best = [], run = [];
        for (const c of roads) { if (run.length && c === run[run.length - 1] + 1) run.push(c); else run = [c]; if (run.length > best.length) best = run.slice(); }
        const pick = [0, 2, 4, 6, 8, 10, 12, 14].map((k) => best[Math.min(best.length - 1, k)]);
        const goods = ['stone', 'charcoal', 'malt', 'beer', 'fish', 'grain', 'flour', 'bread'];
        const ws = w.state.wagons.slice(-8);
        ws.forEach((v, i) => { v.cargoGood = goods[i]; v.cargoQty = 4; v.at = pick[i]; v.next = -1; v.path = []; v.edgeT = 0; v.pathVer = -1; v.busyTicks = 0; v.status = { k: 'RETURNING' }; });
        for (let i = 0; i < 8; i++) a.loop.tickOnce();
        a.loop.speed = 0;
        const c = pick[3];
        window.__gfxCam = [((c % W) + 1.5) * 4, (Math.floor(c / W) + 0.5) * 4, sc.dist, sc.yaw];
        a.view.rig.set(...window.__gfxCam);
        return { wagons: ws.map((v) => v.cargoGood + '@' + v.at).join(' ') };
      }
      const b = w.state.buildings.find((x) => x.type === sc.type);
      let n = 0;
      if (!sc.tick) while (b.status.k !== 'WORKING' && n < 4 * 60 * 10 && w.state.mission.result === 'running') { a.loop.tickOnce(); n++; }
      const c = a.view.buildings.info.get(b.id).centre;
      const wk = a.view.buildings.workers.filter((x) => x.buildingId === b.id);
      // the "-worker" close-ups aim at the worker, yaw from his facing; the others at the building's centre
      if (sc.worker && wk.length) { const e = wk[0].base.elements; window.__gfxCam = [e[12], e[14], sc.dist, (sc.worker === 'abs' ? 0 : Math.atan2(e[8], e[10])) + sc.yaw]; }
      else window.__gfxCam = [c.x, c.z, sc.dist, sc.yaw];
      a.view.rig.set(...window.__gfxCam);
      const ws = wk.map((x) => x.kind).join('+');
      return { id: b.id, status: b.status.k, ticks: n, workers: ws };
    `), { ...sc, cmds: sc.cargo ? benchCmds : [] });
    await page.waitForTimeout(4000);
    // a rank-up glides the camera to the castle: put it back where the scene wants it
    if (await page.evaluate(() => { if (!window.__gfxCam) return false; window.__marchia.app.view.rig.set(...window.__gfxCam); return true; })) await page.waitForTimeout(1500);
    const f = resolve(outDir, `gfx10-${tag}-${name}-${quality}.jpg`);
    await page.screenshot({ path: f, type: 'jpeg', quality: 82, timeout: 600000 });
    // close crop: the middle 240x240 px of the frame
    const crop = resolve(outDir, `gfx10-${tag}-${name}-${quality}-crop.jpg`);
    await page.screenshot({ path: crop, type: 'jpeg', quality: 85, clip: { x: 86, y: 338, width: 240, height: 240 }, scale: 'css', timeout: 600000 });
    console.log(`${name} ${quality}: ${JSON.stringify(info)} -> ${f.replace(root + '/', '')}`);
    await ctx.close();
  }
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
