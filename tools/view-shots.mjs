// Screenshots of the world view harness at the three reference sizes into docs/shots/view-*.png.
// Start a dev server first:  npx vite --port 5174   then:  node tools/view-shots.mjs [baseUrl] [only]
// Uses software GL (SwiftShader) when no GPU is present; each shot renders a few fixed frames.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.argv[2] ?? 'http://localhost:5174';
const only = process.argv[3] ?? '';
const SIZES = [
  ['portrait', 412, 915],
  ['landscape', 915, 412],
  ['fold', 904, 1000],
];
const SCENES = {
  close: 'follow=near&cam=41,34,22,-0.95&t=306&tod=0.33&sel=wagon',
  village: 'cam=55,44,72,-0.5&t=300&tod=0.33&sel=6',
  far: 'cam=48,36,420,-0.3&t=100',
  rain: 'cam=44,40,70,-0.6&t=200',
  traffic: 'cam=48,38,300,-0.3&t=300&wagons=40&overlay=traffic&tod=0.4',
  menu: 'menu=1&t=306',
  stress: 'cam=45,34,110,-0.4&t=5&wagons=200&stress=1&tod=0.4',
};

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
for (const [scene, query] of Object.entries(SCENES)) {
  if (only && !only.split(',').includes(scene)) continue;
  for (const [label, w, h] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.goto(`${base}/tools/view-harness.html?${query}&frames=4&hud=0`);
    await page.waitForFunction(() => window.__done === true, null, { timeout: 180000, polling: 500 });
    const out = `docs/shots/view-${scene}-${label}.png`;
    await page.screenshot({ path: out, timeout: 120000 });
    const s = await page.evaluate(() => window.__harness.view.stats());
    console.log(`${out}  calls ${s.drawCalls}  tris ${s.triangles}`);
    await page.close();
  }
}
await browser.close();
