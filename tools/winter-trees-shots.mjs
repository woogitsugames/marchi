// Winter trees (D-260..D-263): deciduous crowns bare in winter, conifers green. Before/after shots of the free valley
// (seasons on) at a forest edge, camera 45-110 m, portrait and landscape, low and high.
// Built game: npm run build -- --outDir <dist>; npx vite preview --outDir <dist> --port 5201 --strictPort.
//   node tools/winter-trees-shots.mjs <baseUrl> <tag> [scene,...] [quality,...] [sizes]
// -> docs/shots/winter-trees-<tag>-<scene>-<quality>-<w>x<h>.jpg
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'docs/shots');
mkdirSync(outDir, { recursive: true });
const [base = 'http://127.0.0.1:5201/', tag = 'after', only = '', qualS = 'low,high', sizeS = '412x915,915x412'] = process.argv.slice(2);

// season ticks (TICK_HZ 10, 15 min seasons = 9000 ticks; spring 0, summer 9000, autumn 18000, winter 27000):
// mid-winter day, late autumn (leaves falling), early spring (leaves coming back)
const WINTER = 31392, LATE_AUTUMN = 26100, SPRING = 37800, AUTUMN = 22392;
// scene: tick, dist (m), yaw, the target: the forest-edge cell nearest the castle
const SCENES = {
  winter: { tick: WINTER, dist: 70 },
  'winter-far': { tick: WINTER, dist: 110, yaw: 0.9 },
  'winter-near': { tick: WINTER, dist: 45, yaw: 0.2 },
  autumn: { tick: AUTUMN, dist: 70 },
  'late-autumn': { tick: LATE_AUTUMN, dist: 70 },
  spring: { tick: SPRING, dist: 70 },
};

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const [name, sc] of Object.entries(SCENES)) {
  if (only && !only.split(',').includes(name)) continue;
  for (const quality of qualS.split(',')) {
    for (const size of sizeS.split(',')) {
      const [vw, vh] = size.split('x').map(Number);
      const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${name} ${quality}: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} ${quality}: ${m.text()}`); });
      await page.goto(`${base}?play=sandbox&ff=30&speed=1&quality=${quality}&dynres=0&debug=1&lang=pl`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 120000 });
      const info = await page.evaluate((sc) => {
        const a = window.__marchia.app, w = a.world;
        for (const el of Object.values(a.layers ?? {})) if (el && el.style) el.style.visibility = 'hidden';
        w.seasons = true; w.state.tick = sc.tick; a.loop.speed = 0; a.view.snapEnv = true;
        if (a.view.debug) a.view.debug.forceTime = 0.42;
        const W = w.terrain.w, H = w.terrain.h;
        const castle = w.state.buildings.find((b) => b.type === 'castle');
        // forest edge: forest > 0.4 with an open neighbour, nearest the castle, south of the conifer belt (y < 22 is
        // spruce and pine) so the oaks, birches and shrubs are in the frame
        let best = -1, bd = 1e9;
        for (let y = 26; y < H - 4; y++) for (let x = 4; x < W - 4; x++) {
          const i = y * W + x;
          if (w.terrain.forest[i] < 0.4 || w.terrain.forest[i + 3] > 0.1) continue;
          const d = (x - castle.x) ** 2 + (y - castle.y) ** 2;
          if (d < bd) { bd = d; best = i; }
        }
        window.__wtCam = [((best % W) + 0.5) * 4, (Math.floor(best / W) + 0.5) * 4, sc.dist, sc.yaw ?? 0.5];
        a.view.rig.set(...window.__wtCam);
        return { cell: best, season: w.state.tick };
      }, sc);
      await page.waitForTimeout(4000);
      await page.evaluate(() => window.__marchia.app.view.rig.set(...window.__wtCam));
      await page.waitForTimeout(1500);
      const f = resolve(outDir, `winter-trees-${tag}-${name}-${quality}-${vw}x${vh}.jpg`);
      await page.screenshot({ path: f, type: 'jpeg', quality: 82, timeout: 600000 });
      console.log(`${name} ${quality} ${size}: ${JSON.stringify(info)} -> ${f.replace(root + '/', '')}`);
      await ctx.close();
    }
  }
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
