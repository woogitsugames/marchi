// In-game close-ups of the animated yard workers added in night 6 (sawyers, farmer, fisherman) and the older
// three, from the built game (`npm run build`, `npx vite preview --port 5194 --strictPort`):
//   node tools/night6-workers-shots.mjs [baseUrl] [which,...]
// -> docs/shots/night6-workers-<which>-<w>x<h>.jpg at 412x915 and 915x412. Prints each building's status, so a
// shot of a resting worker is not mistaken for a broken animation.
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'docs/shots');
mkdirSync(outDir, { recursive: true });
const [base = 'http://127.0.0.1:5194/', only = ''] = process.argv.slice(2);
// which: [mission query, building type, camera distance, yaw]
const SCENES = {
  sawmill: ['play=m1&bot=1&ff=40', 'sawmill', 22, 1.2],
  farm: ['play=m1&bot=1&ff=40', 'farm', 17, 0.8],
  fisher: ['play=m7&ff=20', 'fisher', 17, 0.7],
  woodcutter: ['play=m1&bot=1&ff=40', 'woodcutter', 17, 0.6],
};
const SIZES = [[412, 915], [915, 412]];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const [name, [q, type, dist, yaw]] of Object.entries(SCENES)) {
  if (only && !only.split(',').includes(name)) continue;
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${name} ${w}x${h}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} ${w}x${h}: ${m.text()}`); });
    await page.goto(`${base}?${q}&quality=low&dynres=0&speed=1&debug=1&lang=pl`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 120000 });
    const info = await page.evaluate(([type, dist, yaw]) => {
      const app = window.__marchia.app;
      const b = app.world.state.buildings.find((x) => x.type === type);
      // run the sim on (up to 4 game minutes) until the building works, so the shot shows the work cycle
      let n = 0;
      while (b.status.k !== 'WORKING' && n < 4 * 60 * 10 && app.world.state.mission.result === 'running') { app.loop.tickOnce(); n++; }
      // aim at the worker himself (the farmer is out on a field): from behind his shoulder, `yaw` to the side
      const ws = app.view.buildings.workers.filter((w) => w.buildingId === b.id);
      const e = ws[ws.length - 1].base.elements;
      const facing = Math.atan2(e[8], e[10]);
      app.view.rig.set(e[12], e[14], dist, facing + Math.PI + yaw);
      return { id: b.id, status: b.status.k, ticks: n, workers: ws.map((w) => w.kind).join('+') };
    }, [type, dist, yaw]);
    await page.waitForTimeout(4000);
    const st = await page.evaluate((id) => window.__marchia.app.world.state.buildings.find((x) => x.id === id).status.k, info.id);
    const f = resolve(outDir, `night6-workers-${name}-${w}x${h}.jpg`);
    await page.screenshot({ path: f, type: 'jpeg', quality: 80 });
    console.log(`${name} ${w}x${h}: building ${info.id} [${info.workers}] ${info.status} after ${info.ticks} ticks -> ${st}; ${f.replace(root + '/', '')}`);
    await ctx.close();
  }
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
