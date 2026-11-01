// Texture tier comparison: renders the same close-up with 1k, 2k (high) and 4k (ultra) texture
// sets and writes side-by-side crops to docs/shots/tex-tier-<scene>.png.
// Start a dev server first:  npx vite --port 5176   then:  node tools/textures/tier-shots.mjs [baseUrl]
// Uses the view harness; textures are swapped in the page through the real loaders
// (loadTerrainTextures / loadPbrSet), view settings stay at 'high' so only textures differ.
// SwiftShader software GL: slow, each shot takes a while.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.argv[2] ?? 'http://localhost:5176';
const only = process.argv[3] ?? '';
const OUT = path.resolve('docs/shots');
// cam = x,z (cells), dist (m), yaw. 16 m = MIN_DIST (closest the player can zoom).
const SCENES = {
  road: { q: 'cam=41,34,16,-0.95&t=306&tod=0.36', crop: [0.30, 0.42, 0.40, 0.30] },
  roadmacro: { q: 'cam=41,34,6,-0.95&t=306&tod=0.36', crop: [0.30, 0.40, 0.40, 0.30] },
  building: { q: 'cam=55,44,16,-0.5&t=300&tod=0.36', crop: [0.25, 0.25, 0.50, 0.40] },
};
const TIERS = [
  ['1k', 1024],
  ['2k', 'high'],
  ['4k', 'ultra'],
];
const MODEL = [['wood', 'wood_planks'], ['thatch', 'thatch'], ['stone', 'fieldstone_wall'], ['plaster', 'plaster_daub'], ['bark', 'bark']];

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const W = 904, H = 1000, DPR = 2; // Fold inner-screen-like CSS size; renderer caps DPR at 2
const report = [];
for (const [scene, { q, crop }] of Object.entries(SCENES)) {
  if (only && !only.split(',').includes(scene)) continue;
  const shots = [];
  for (const [label, tier] of TIERS) {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /KTX2|texture/i.test(m.text()))) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}/tools/view-harness.html?${q}&paused=1&hud=0`);
    await page.waitForFunction(() => !!window.__harness, null, { timeout: 120000 });
    const info = await page.evaluate(async ([tier, model]) => {
      const h = window.__harness;
      await h.internals.ready();
      const tt = await import('/src/render/terrainTextures.ts');
      const tx = await import('/src/render/textures.ts');
      const mats = await import('/src/render/models/index.ts');
      const t0 = performance.now();
      const set = await tt.loadTerrainTextures(tier);
      h.view.terrain.setTextures(set);
      const q = typeof tier === 'number' ? 'low' : tier;
      for (const [key, name] of model) {
        const s = await tx.loadPbrSet(name, q, { albedo: false });
        mats.applyTextures(key, { normalMap: s.normalMap, roughnessMap: s.roughnessMap });
      }
      const f0 = h.frames();
      while (h.frames() < f0 + 3) await new Promise((r) => setTimeout(r, 200));
      return {
        loadMs: Math.round(performance.now() - t0),
        size: set.size,
        gpuMB: +(set.gpuBytes / 1048576).toFixed(1),
        albedo: set.albedo.constructor.name + ' fmt ' + set.albedo.format,
        normal: set.normal.constructor.name + ' fmt ' + set.normal.format,
        aniso: set.albedo.anisotropy,
      };
    }, [tier, MODEL]);
    const file = path.join(OUT, `.tier-${scene}-${label}.png`);
    await page.screenshot({ path: file, timeout: 300000 });
    report.push({ scene, label, ...info, errors });
    console.log(scene, label, JSON.stringify(info), errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors');
    shots.push([label, file]);
    await page.close();
  }
  // compose the crops side by side at 1:1 device pixels
  const [cx, cy, cw, ch] = crop;
  const pw = Math.round(W * DPR * cw), ph = Math.round(H * DPR * ch);
  const cells = shots.map(([label, f]) => {
    const b64 = fs.readFileSync(f).toString('base64');
    return `<figure><div style="width:${pw}px;height:${ph}px;background:url(data:image/png;base64,${b64}) -${Math.round(W * DPR * cx)}px -${Math.round(H * DPR * cy)}px"></div><figcaption>${label}</figcaption></figure>`;
  }).join('');
  const page = await browser.newPage({ viewport: { width: 3 * pw + 80, height: ph + 80 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>body{margin:0;padding:16px;background:#2b2620;color:#c9c6bb;font:16px Georgia,serif;display:flex;gap:16px}figure{margin:0}figcaption{margin-top:6px}</style>${cells}`);
  await page.screenshot({ path: path.join(OUT, `tex-tier-${scene}.png`), fullPage: true });
  await page.close();
  for (const [, f] of shots) fs.unlinkSync(f);
}
await browser.close();
