// The trader's sale gesture at the open trading post (D-323): a before/after sequence of the counter.
// Built game: npm run build; npx vite preview --port 5242 --strictPort.
//   node tools/merchant-shots.mjs <baseUrl> <tag> [quality]
// For each shot size (412x915, 915x412, 904x1000): the sandbox with the post open, one sale put in
// tradePost.recent (shots only, as gfx10 does with its setups) so the view's read-only cue fires, then the
// gesture clock frozen at four moments (idle, reach, weigh, drop) by passing dt = 0 to the buildings view.
// -> docs/shots/merchant-<tag>-<w>x<h>.jpg (full frame at "weigh") and docs/shots/merchant-<tag>-<w>x<h>-seq.jpg
// (the four 240x240 crops around the trader side by side). Prints whether the cue fired on the injected sale and
// on real wagon sales, when the sandbox makes one within the tick budget.
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'docs/shots');
mkdirSync(outDir, { recursive: true });
const [base = 'http://127.0.0.1:5242/', tag = 'after', quality = 'high'] = process.argv.slice(2);
const SIZES = [[412, 915], [915, 412], [904, 1000]];
// gesture ages (s): idle (before the sale), reach over the counter, weigh the coin, drop it in the box
const AGES = [['idle', 99], ['reach', 0.7], ['weigh', 1.45], ['drop', 2.3]];

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const [W, H] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: W < H, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${W}x${H}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${W}x${H}: ${m.text()}`); });
  await page.goto(`${base}?play=sandbox&ff=30&speed=1&quality=${quality}&dynres=0&debug=1&lang=pl`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 120000 });
  const info = await page.evaluate(() => {
    const a = window.__marchia.app, w = a.world, bv = a.view.buildings;
    for (const el of Object.values(a.layers ?? {})) if (el && el.style) el.style.visibility = 'hidden';
    w.state.town.rank = 4; w.state.market.open = true;
    for (let i = 0; i < 20; i++) a.loop.tickOnce();
    a.loop.speed = 0;
    const b = w.state.buildings.find((x) => x.type === 'tradePost');
    const wk = bv.workers.find((x) => x.buildingId === b.id && x.kind === 'trader');
    const e = wk.base.elements;
    window.__gfxCam = [e[12], e[14], 13, Math.atan2(e[8], e[10]) + 0.45];
    a.view.rig.set(...window.__gfxCam);
    // freeze the view's worker clocks: dt = 0 from here on, the idle loop pinned at one moment
    const upd = bv.update.bind(bv);
    bv.update = (world, dt) => upd(world, window.__freeze ? 0 : dt);
    return { post: b.id, sales: w.state.tradePost?.recent.length ?? 0 };
  });
  // one sale at the post, as a wagon unloading would append it; the view must pick it up on its own
  await page.evaluate(() => { window.__freeze = false; const w = window.__marchia.app.world; w.state.tradePost.recent.push({ tick: w.state.tick, good: 'beer', qty: 4, cents: 900 }); });
  await page.waitForTimeout(600);
  info.cueFired = await page.evaluate(() => window.__marchia.app.view.buildings.saleT);
  await page.evaluate(() => { window.__freeze = true; });
  const crops = [];
  for (const [name, age] of AGES) {
    await page.evaluate((age) => { const bv = window.__marchia.app.view.buildings; bv.saleT = age; bv.time = 3.1; window.__marchia.app.view.rig.set(...window.__gfxCam); }, age);
    await page.waitForTimeout(2500);
    const cx = Math.round(W / 2), cy = Math.round(H / 2);
    const crop = resolve(outDir, `merchant-${tag}-${W}x${H}-${name}.jpg`);
    await page.screenshot({ path: crop, type: 'jpeg', quality: 88, clip: { x: cx - 120, y: cy - 150, width: 240, height: 240 }, scale: 'css', timeout: 600000 });
    crops.push(crop);
    if (name === 'weigh') await page.screenshot({ path: resolve(outDir, `merchant-${tag}-${W}x${H}.jpg`), type: 'jpeg', quality: 82, timeout: 600000 });
  }
  const seq = resolve(outDir, `merchant-${tag}-${W}x${H}-seq.jpg`);
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
ims = [Image.open(p) for p in sys.argv[2:]]
out = Image.new('RGB', (sum(i.width for i in ims) + 6 * (len(ims) - 1), ims[0].height), (40, 34, 28))
x = 0
for i in ims:
    out.paste(i, (x, 0)); x += i.width + 6
out.save(sys.argv[1], quality=88)
`, seq, ...crops]);
  for (const c of crops) rmSync(c);
  // real sales: let the sandbox run (no dt freeze) and see whether a wagon sells at the post and the cue fires
  info.real = await page.evaluate(() => {
    window.__freeze = false;
    const a = window.__marchia.app, w = a.world, bv = a.view.buildings;
    const n0 = w.state.tradePost.earnedCents;
    for (let i = 0; i < 3000 && w.state.tradePost.earnedCents === n0; i++) a.loop.tickOnce();
    return w.state.tradePost.earnedCents === n0 ? 'no wagon sold at the post within 3000 ticks' : `sold at tick ${w.state.tick}`;
  });
  if (info.real.startsWith('sold')) {
    await page.waitForTimeout(400);
    info.realCue = await page.evaluate(() => window.__marchia.app.view.buildings.saleT);
  }
  console.log(`${W}x${H}: ${JSON.stringify(info)} -> ${seq.replace(root + '/', '')}`);
  await ctx.close();
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
