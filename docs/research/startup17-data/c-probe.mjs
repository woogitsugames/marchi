// Option (c): which building kinds / tree kinds / wagons does the menu's first frame show? Footprint boxes (ground
// height from the view's heightfield, 0..25 m above it) against the first-frame camera frustum.
import { createRequire } from 'node:module';
const require = createRequire('/workspace/marchi-geomcache/package.json');
const { chromium } = require('playwright');
const [base] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [w, h] of [[412, 915], [915, 412], [904, 1000]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 0.5, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${base}?quality=high&debug=1&perf=1`);
  await page.waitForFunction(() => performance.getEntriesByName('marchia:first-frame').length > 0, null, { timeout: 120000, polling: 50 });
  const r = await page.evaluate(() => {
    const v = window.__marchiaView, app = window.__marchia.app;
    const cam = v.rig.camera, hf = v.hf;
    const THREE_proj = cam.projectionMatrix.elements, mw = cam.matrixWorldInverse.elements;
    // clip-space test of a point
    const clip = (x, y, z) => {
      const e = mw; const vx = e[0]*x+e[4]*y+e[8]*z+e[12], vy = e[1]*x+e[5]*y+e[9]*z+e[13], vz = e[2]*x+e[6]*y+e[10]*z+e[14];
      const p = THREE_proj; const cx = p[0]*vx+p[4]*vy+p[8]*vz+p[12], cy = p[1]*vx+p[5]*vy+p[9]*vz+p[13], cw = p[3]*vx+p[7]*vy+p[11]*vz+p[15];
      return [cx / cw, cy / cw, cw];
    };
    const kinds = {};
    for (const b of app.world.state.buildings) {
      let vis = false, minx = 9, maxx = -9, miny = 9, maxy = -9;
      for (let j = 0; j <= 4 && !vis; j++) for (let i = 0; i <= 4; i++) for (const dy of [0, 25]) {
        const x = (b.x + (i / 4) * b.w) * 4, z = (b.y + (j / 4) * b.h) * 4, y = hf.height(x, z) + dy;
        const [cx, cy, cw] = clip(x, y, z);
        if (cw > 0) { minx = Math.min(minx, cx); maxx = Math.max(maxx, cx); miny = Math.min(miny, cy); maxy = Math.max(maxy, cy); }
      }
      vis = maxx >= -1 && minx <= 1 && maxy >= -1 && miny <= 1;
      (kinds[b.type] ??= { n: 0, vis: 0 }).n++;
      if (vis) kinds[b.type].vis++;
    }
    return { kinds };
  });
  console.log(JSON.stringify({ size: `${w}x${h}`, ...r }));
  await ctx.close();
}
await browser.close();
