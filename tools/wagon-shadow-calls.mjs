// Draw calls with N wagons in the far view, with and without shadows on the low-detail (LOD1) wagon rig.
// Usage: node tools/wagon-shadow-calls.mjs <baseUrl> [wagons=100] [quality=high] [dist=260]
// Serve a build first (e.g. `npx vite preview --port 4179`). Needs ?debug=1 (window.__marchia.app).
// Prints JSON: calls/triangles per variant, and how many wagons the far rig drew. Read-only on the sim
// apart from the benchmark set-up commands (same as tools/frame-cost.mjs).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [base, wagonsS = '100', quality = 'high', distS = '260'] = process.argv.slice(2);
const wagons = Number(wagonsS), dist = Number(distS);
const benchCmds = JSON.parse(readFileSync(new URL('./frame-cost-bench.json', import.meta.url), 'utf8'));
const url = `${base.replace(/\/?$/, '/')}?play=sandbox&ff=30&speed=0&quality=${quality}&dynres=0&debug=1`;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
// renderer.info.render.calls is reset after the shadow pass (three r181), so count draws at the GL level.
await page.addInitScript(() => {
  const G = { draws: 0, frames: 0 };
  window.__gld = G;
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const f = C.prototype[name];
      if (f) C.prototype[name] = function (...a) { G.draws++; return f.apply(this, a); };
    }
  }
  const raf = window.requestAnimationFrame.bind(window);
  const tick = () => { G.frames++; raf(tick); };
  raf(tick);
});
await page.goto(url);
await page.waitForFunction(() => window.__marchia && window.__marchia.ready, null, { timeout: 120000 });
await page.evaluate(({ n, cmds }) => {
  const app = window.__marchia.app;
  const st = app.world.state;
  st.coins = 1e8; st.town.rank = 5;
  for (const c of cmds) { if (c.t === 'road' && c.surface === 2) c.surface = 1; app.loop.enqueue(c); }
  app.loop.flushCommands();
  for (const b of st.buildings) if (b.type === 'warehouse') for (const g of ['wood', 'grain', 'flour']) { b.stock[g] += 48; st.ledger.produced[g] += 48; }
  const stable = st.buildings.find((b) => b.type === 'stable');
  for (let i = 0; i < n; i++) app.loop.enqueue({ t: 'buyWagon', stable: stable.id });
  app.loop.flushCommands();
  for (let i = 0; i < 600 * 6; i++) app.loop.tickOnce();
}, { n: wagons, cmds: benchCmds });

const measure = async (label) => {
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__gld.draws = 0; window.__gld.frames = 0; });
  await page.waitForTimeout(2000);
  return page.evaluate((label) => {
    const v = window.__marchia.app.view, w = v.wagons, G = window.__gld;
    const s = v.stats();
    const count = (p) => p.meshes.reduce((a, m) => a + (m.visible ? m.count : 0), 0);
    return {
      label, glDrawsPerFrame: +(G.draws / Math.max(1, G.frames)).toFixed(1), frames: G.frames,
      mainPassCalls: s.drawCalls, tris: s.triangles, lod1Drawn: count(w.lod1),
      lod1Meshes: w.lod1.meshes.length,
      lod1ShadowTris: w.lod1.meshes.some((m) => m.castShadow) ? w.lod1.meshes.reduce((a, m) => a + (m.visible ? m.count * (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3 : 0), 0) : 0, lod1Shadow: w.lod1.meshes.some((m) => m.castShadow),
    };
  }, label);
};
await page.evaluate((d) => {
  const app = window.__marchia.app, st = app.world.state, w = app.world.terrain.w;
  // aim at the centre of the wagons so most of them are on screen, from far away
  let x = 0, z = 0;
  for (const wg of st.wagons) { x += (wg.at % w + 0.5) * 4; z += (Math.floor(wg.at / w) + 0.5) * 4; }
  app.view.rig.set(x / st.wagons.length, z / st.wagons.length, d, 0.6);
}, dist);
const out = { wagons, quality, dist, runs: [] };
out.runs.push(await measure('as shipped'));
await page.evaluate(() => window.__marchia.app.view.wagons.lod1.setShadow(true));
out.runs.push(await measure('lod1 shadow on'));
await page.evaluate(() => window.__marchia.app.view.wagons.lod1.setShadow(false));
out.runs.push(await measure('lod1 shadow off'));
if (process.env.SHOT) {
  await page.evaluate(() => window.__marchia.app.view.wagons.lod1.setShadow(true));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: process.env.SHOT + '-on.png' });
  await page.evaluate(() => window.__marchia.app.view.wagons.lod1.setShadow(false));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: process.env.SHOT + '-off.png' });
}
out.errors = errs;
console.log(JSON.stringify(out, null, 1));
await browser.close();
