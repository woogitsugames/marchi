// Pixel-identity shots for render optimizations (D-572): the game's frame loop is stopped and the view draws a few
// frames with dt = 0 at fixed clocks (view, yard workers), so two builds that draw the same scene give the same PNG.
//   node tools/rperf-shots.mjs <baseUrl> <outDir> [scene,...] [quality,...] [viewport,...]
// Then: python3 tools/render5-diff.py <dirA> <dirB>   (diff_px per shot; 0 = identical)
// Scenes: the free valley with the bench road network (tools/frame-cost-bench.json, 10 wagons) in summer and winter at
// 110 m, close (38 m) and far (230 m) in summer; mission I with the bot after 150 s at its overview camera.
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [base, outDir, only = '', qualS = 'low,high', vpS = '412x915,915x412,904x1000'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const SUMMER = 9000 + 4500, WINTER = 27000 + 4500;
const valley = (tick, dist, yaw) => ({ q: 'play=sandbox&ff=30', valley: true, tick, dist, yaw });
const SCENES = {
  'v-summer': valley(SUMMER, 110, 0.9),
  'v-winter': valley(WINTER, 110, 0.9),
  'v-close': valley(SUMMER, 38, 1.4),
  'v-far': valley(SUMMER, 230, 0.9),
  m1: { q: 'play=m1&bot=1&ff=150', cam: [172.8, 144, 200, -0.3] },
};
const bench = JSON.parse(readFileSync(resolve(root, 'tools/frame-cost-bench.json'), 'utf8'));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let errors = 0;
for (const [name, sc] of Object.entries(SCENES)) {
  if (only && !only.split(',').includes(name)) continue;
  for (const vp of vpS.split(',')) {
    const [vw, vh] = vp.split('x').map(Number);
    for (const quality of qualS.split(',')) {
      const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => { errors++; console.log(`  error ${name} ${quality} ${vp}: ${e.message}`); });
      await page.goto(`${base}?${sc.q}&speed=0&quality=${quality}&dynres=0&debug=1&lang=pl`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 180000 });
      await page.evaluate(new Function('sc', `
        const a = window.__marchia.app, w = a.world;
        for (const el of Object.values(a.layers ?? {})) if (el && el.style) el.style.visibility = 'hidden';
        a.loop.speed = 0;
        if (sc.valley) {
          w.state.coins = 1e9; w.state.town.rank = 5;
          for (const c of sc.cmds) { const k = { ...c }; if (k.t === 'road' && k.surface === 2) k.surface = 1; a.loop.enqueue(k); }
          a.loop.flushCommands();
          const stable = w.state.buildings.find((b) => b.type === 'stable');
          for (let i = 0; i < 10; i++) a.loop.enqueue({ t: 'buyWagon', stable: stable.id });
          a.loop.flushCommands();
          for (let i = 0; i < 900; i++) a.loop.tickOnce();
          w.seasons = true; w.state.tick = sc.tick;
          for (let i = 0; i < 5; i++) a.loop.tickOnce();
          const castle = w.state.buildings.find((b) => b.type === 'castle');
          const c = a.view.buildings.info.get(castle.id).centre;
          window.__cam = [c.x, c.z, sc.dist, sc.yaw];
        } else window.__cam = sc.cam;
        a.view.debug.forceTime = 0.45;
      `), { ...sc, cmds: sc.valley ? bench : [] });
      // textures of the tier, then the season's tree bake and a few live frames
      await page.evaluate(async () => { const v = window.__marchia.app.view; let p; do { p = v.texturesReady; await p; } while (p !== v.texturesReady); });
      await page.waitForTimeout(4000);
      await page.evaluate(() => new Promise((res) => {
        const a = window.__marchia.app, v = a.view;
        a.frame = () => {};
        v.rig.set(...window.__cam);
        // the rig eases toward its goal: settle it with dt > 0 (camera only), then draw at fixed clocks with dt = 0
        for (let i = 0; i < 200; i++) v.rig.update(0.1, null);
        v.time = 100; v.buildings.time = 100; v.snapEnv = true;
        // the other clocks that run on frame dt: mill wheels, a hoeing farmer's walk, the trader's gesture
        for (const w of v.buildings.wheels) w.angle = 0;
        for (const w of v.buildings.workers) if (w.walk) w.walk.t = 0;
        v.buildings.saleT = 99;
        for (let i = 0; i < 4; i++) { v.snapEnv = true; v.frame(1, 0); }
        requestAnimationFrame(() => requestAnimationFrame(res));
      }));
      const f = resolve(outDir, `${name}-${quality}-${vp}.png`);
      await page.screenshot({ path: f, type: 'png', timeout: 600000 });
      console.log(`${name} ${quality} ${vp} -> ${f}`);
      await ctx.close();
    }
  }
}
await browser.close();
console.log(`page errors: ${errors}`);
