// In-game forest screenshots + render stats (draw calls / triangles) at 412x915 dpr 2.
// usage: npm run build && npx vite preview --port 5180 &   then
//        node tools/tree-shots.mjs [baseUrl] [prefix] [only]
// writes docs/shots/<prefix>-<scene>-<quality>.jpg and prints `r.info.render` for each scene.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:5180';
const prefix = process.argv[3] ?? 'trees2';
const only = process.argv[4] ?? '';

// camera: [x, z, distance, yaw] in metres (m1: north forest z < 80 m, oak/birch copses near z 170)
const SCENES = {
  near: [120, 80, 50, -0.3],
  mid: [150, 88, 110, -0.3],
  far: [180, 120, 260, -0.3],
  copse: [84, 180, 55, -0.3],
};
const MISSIONS = (process.env.TREE_MISSIONS ?? 'm1').split(',');
const QUALITIES = (process.env.TREE_QUALITIES ?? 'high,low').split(',');

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const mission of MISSIONS) {
  for (const q of QUALITIES) {
    const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    const ff = mission === 'm1' ? '&bot=1&ff=170' : '&ff=60';
    await page.goto(`${base}/?play=${mission}${ff}&quality=${q}&dynres=0&perf=1&speed=0`);
    await page.waitForFunction(() => !!window.__marchiaView, null, { timeout: 180000 });
    await page.waitForTimeout(3000);
    for (const [scene, cam] of Object.entries(SCENES)) {
      if (only && !only.split(',').includes(scene)) continue;
      await page.evaluate((c) => window.__marchiaView.rig.set(c[0], c[1], c[2], c[3]), cam);
      await page.waitForTimeout(2500);
      const s = await page.evaluate(() => window.__marchiaView.stats());
      const out = `docs/shots/${prefix}-${mission === 'm1' ? '' : mission + '-'}${scene}-${q}.jpg`;
      if (mission === 'm1') await page.screenshot({ path: out, type: 'jpeg', quality: 62, timeout: 120000 });
      console.log(`${mission} ${q} ${scene}: calls ${s.drawCalls} tris ${s.triangles}${mission === 'm1' ? '  -> ' + out : ''}`);
    }
    console.log(`${mission} ${q}: console errors ${errors.length}${errors.length ? ' ' + errors.slice(0, 3).join(' | ') : ''}`);
    await page.close();
  }
}
await browser.close();
