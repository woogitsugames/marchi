// Memory probe (perf day 10, 2026-11-06): JS heap (after a forced GC), renderer.info.memory (geometries, textures),
// programs, DOM counters (nodes, documents, JS event listeners) at the menu, in a mission, after start -> menu ->
// start cycles (leaks across restarts) and through a long free-valley game.
// Usage: node tools/memory-probe.mjs <baseUrl> <quality> [cycles=10] [mission=m12] [valleyHours=3]
// Each sample: HeapProfiler.collectGarbage twice, then usedJSHeapSize; a few real frames are drawn first so the
// renderer has uploaded what the scene holds. Prints one JSON line.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [base, quality = 'high', cyclesS = '10', mission = 'm12', hoursS = '3'] = process.argv.slice(2);
const cycles = Number(cyclesS), hours = Number(hoursS);
const benchCmds = JSON.parse(readFileSync(new URL('./frame-cost-bench.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 0.5, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const cdp = await ctx.newCDPSession(page);
await page.goto(`${base.replace(/\/?$/, '/')}?quality=${quality}&dynres=0&debug=1`);
await page.waitForFunction(() => window.__marchia && window.__marchia.ready, null, { timeout: 120000 });
await page.evaluate(() => window.__marchia.app.view.texturesReady);
await page.waitForTimeout(3000);
// park the browser's own frame chain: the probe draws frames itself (SwiftShader raster is slow)
await page.evaluate(() => {
  const raf = window.requestAnimationFrame.bind(window);
  window.__mp = { parked: true, now: performance.now() };
  window.requestAnimationFrame = (f) => (window.__mp.parked ? 0 : raf(f));
});

const frames = (n) => page.evaluate((k) => {
  const app = window.__marchia.app, M = window.__mp;
  M.now = Math.max(M.now, app.lastFrame);
  for (let i = 0; i < k; i++) { M.now += 1000 / 60; app.frame(M.now); }
}, n);
const sample = async (label) => {
  await frames(4);
  await page.waitForTimeout(300); // pre-warm slices, texture binds
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
  const dom = await cdp.send('Memory.getDOMCounters');
  const s = await page.evaluate(() => {
    const app = window.__marchia.app, r = app.view.renderer;
    return {
      heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(2),
      geometries: r.info.memory.geometries, textures: r.info.memory.textures, programs: r.info.programs?.length ?? 0,
      mode: app.mode, mission: app.world.state.mission.id ?? app.missionId, tick: app.world.state.tick,
      wagons: app.world.state.wagons.length, buildings: app.world.state.buildings.length,
      sheets: document.querySelectorAll('.sheet').length, pins: app.markers.pool?.length ?? null,
      sceneChildren: (() => { let n = 0; app.view.scene.traverse(() => { n++; }); return n; })(),
    };
  });
  const row = { label, ...s, nodes: dom.nodes, docs: dom.documents, listeners: dom.jsEventListeners };
  process.stderr.write(`${label}: heap ${row.heapMB} MB geo ${row.geometries} tex ${row.textures} prog ${row.programs} nodes ${row.nodes} listeners ${row.listeners} obj ${row.sceneChildren}\n`);
  return row;
};

const out = { quality, mission, cycles, hours, menu: null, cyclesRows: [], valley: [] };
out.menu = await sample('menu');
// start -> play 60 s of game -> menu, x cycles
for (let c = 1; c <= cycles; c++) {
  await page.evaluate((m) => {
    const app = window.__marchia.app;
    app.newGame(m, null, false);
    app.loop.speed = 0;
    for (let i = 0; i < 600; i++) app.loop.tickOnce();
  }, mission);
  const inGame = await sample(`cycle ${c} in ${mission}`);
  await page.evaluate(() => { void window.__marchia.app.showMenu(); });
  await page.waitForTimeout(500);
  const back = await sample(`cycle ${c} menu`);
  out.cyclesRows.push({ c, game: inGame, menu: back });
}
// free valley: the bench roads and 100 wagons, then `hours` of game time, sampled every 30 min
if (hours > 0) {
  await page.evaluate(({ cmds }) => {
    const app = window.__marchia.app;
    app.newGame('sandbox', 'valley3', false);
    const st = app.world.state;
    app.loop.speed = 0;
    st.coins = 1e9; st.town.rank = 5;
    for (const c of cmds) { if (c.t === 'road' && c.surface === 2) c.surface = 1; app.loop.enqueue(c); }
    app.loop.flushCommands();
    const stable = st.buildings.find((b) => b.type === 'stable');
    for (let i = 0; i < 100; i++) app.loop.enqueue({ t: 'buyWagon', stable: stable.id });
    app.loop.flushCommands();
  }, { cmds: benchCmds });
  out.valley.push(await sample('valley 0:00'));
  const steps = Math.round(hours * 2);
  for (let k = 1; k <= steps; k++) {
    // 30 min of game: 18000 ticks, with the view's afterTick and a frame every 600 ticks (one per minute)
    await page.evaluate(() => {
      const app = window.__marchia.app, M = window.__mp;
      for (let m = 0; m < 30; m++) {
        for (let i = 0; i < 600; i++) app.loop.tickOnce();
        M.now = Math.max(M.now, app.lastFrame) + 1000 / 60; app.frame(M.now);
      }
    });
    out.valley.push(await sample(`valley ${Math.floor(k / 2)}:${k % 2 ? '30' : '00'}`));
  }
}
out.errors = errs.slice(0, 5);
console.log(JSON.stringify(out));
await browser.close();
