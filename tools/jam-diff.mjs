// Pixel diff of the world-view harness between two servers (research 2026-11-02 follow-up: markOpposing
// moved from every tick to once per frame must draw the same picture). Renders a deterministic scene
// (frames=N fixed 1/30 s steps, sim ×4 so several ticks fall between frames) on both and compares pixels.
// Usage: node tools/jam-diff.mjs <baseA> <baseB> <outDir> [query]
//   bases: dev servers (`npx vite --port N`) serving /tools/view-harness.html
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');

const [a, b, outDir, query = 'wagons=30&t=90&speed=4&frames=90&cam=41.5,35,75,-0.75&tod=0.4&hud=0&quality=low'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
async function shot(base, tag) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(`${tag}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`${tag}: ${m.text()}`); });
  await page.goto(`${base.replace(/\/?$/, '/')}tools/view-harness.html?${query}`);
  await page.waitForFunction(() => window.__done === true, null, { timeout: 300000 });
  const info = await page.evaluate(() => {
    const h = window.__harness;
    const snaps = [...h.view.wagons.snaps.values()];
    return { wagons: h.world.state.wagons.length, moving: h.world.state.wagons.filter((w) => w.next >= 0).length, opp: snaps.filter((s) => s.opp).length, tick: h.world.state.tick };
  });
  const png = await page.screenshot();
  writeFileSync(`${outDir}/jam-${tag}.png`, png);
  await ctx.close();
  return { png, info };
}
const A = await shot(a, 'a');
const B = await shot(b, 'b');
const ra = await sharp(A.png).raw().toBuffer({ resolveWithObject: true });
const rb = await sharp(B.png).raw().toBuffer({ resolveWithObject: true });
let diff = 0, maxd = 0;
const ch = ra.info.channels;
for (let i = 0; i < ra.data.length; i += ch) {
  let d = 0;
  for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(ra.data[i + c] - rb.data[i + c]));
  if (d > 0) diff++;
  if (d > maxd) maxd = d;
}
console.log(JSON.stringify({ query, a: A.info, b: B.info, pixels: ra.data.length / ch, diffPixels: diff, maxChannelDiff: maxd, errs }));
await browser.close();
