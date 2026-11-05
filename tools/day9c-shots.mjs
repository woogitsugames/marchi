// Day 9c screenshots: mission IV before the ice, the stone-span cure ("Wyłóż most kamieniem") with its ghost on the
// wooden deck (D-134).
// Built game: npm run build; npx vite preview --port 5194 --strictPort.
//   NO_GHOST=1 clears the road preview (the look before D-134) for before/after shots
//   node tools/day9c-shots.mjs [baseUrl] [case ...] [WxH ...] [--tag x] -> docs/shots/day9c-<case>[-x]-<w>x<h>.jpg
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const ti = args.indexOf('--tag');
const tag = ti >= 0 ? '-' + args[ti + 1] : '';
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5194/';
const sizes = args.filter((a) => /^\d+x\d+$/.test(a)).map((s) => s.split('x').map(Number));
const ALL = {
  // IV at 1:00, two wagons bought (a third would cost the stone span): the card's sheet with "Wyłóż most kamieniem"
  'm4-pave': { q: 'play=m4&ff=60&speed=0', pre: 'wagon', eye: true },
  // the same, the camera brought down to 45 m over the span
  'm4-pave-near': { q: 'play=m4&ff=60&speed=0', pre: 'wagon', eye: true, near: 45 },
};
const pick = args.filter((a) => ALL[a]);
const cases = pick.length ? pick : Object.keys(ALL);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const [w, h] of sizes.length ? sizes : [[412, 915], [915, 412]]) for (const id of cases) {
  const c = ALL[id];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => errors.push(`${id} ${w}x${h}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${id} ${w}x${h}: ${m.text()}`); });
  await page.goto(`${base}?${c.q}&quality=low&dynres=0&debug=1&lang=pl`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  if (c.pre === 'wagon') {
    await page.evaluate(() => { const a = window.__marchia.app; a.buyWagonFromRail(); a.buyWagonFromRail(); a.loop.flushCommands(); });
  }
  await page.waitForTimeout(1500);
  if (c.eye) { await page.evaluate(() => document.querySelector('.stall-eye')?.click()); await page.waitForTimeout(1500); }
  if (c.near) {
    await page.evaluate((d) => {
      const a = window.__marchia.app, W = a.world.terrain.w, t = a.world.terrain, st = a.world.state;
      // the proposed span, or (no ghost, the look before D-134) the bridge cells of the network
      let cells = a.ghosts.gap;
      if (!cells?.length) { cells = []; for (let i = 0; i < t.water.length; i++) if (t.water[i] && st.roads[i]) cells.push(i); }
      if (!cells.length) return;
      const m = cells[Math.floor(cells.length / 2)];
      const portrait = innerHeight > innerWidth;
      a.view.rig.set((m % W + 0.5) * 4, (Math.floor(m / W) + 0.5) * 4 + (portrait ? d * 0.35 : 0), d, a.view.rig.yaw);
    }, c.near);
    await page.waitForTimeout(1500);
  }
  // NO_GHOST=1: the look before D-134 (no ghost for the stone-span cure)
  if (process.env.NO_GHOST === '1') { await page.evaluate(() => window.__marchia.app.view.setRoadPreview(null)); await page.waitForTimeout(800); }
  const info = await page.evaluate(() => ({
    card: document.querySelector('.stall-row:not([hidden]) .stall-card')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    fix: document.querySelector('#sheets .sheet:last-child .fix-btn')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    ghost: window.__marchia.app.ghosts.gap,
    pave: window.__marchia.app.ghostPave,
  }));
  console.log(`${id} ${w}x${h}`, JSON.stringify(info));
  await page.screenshot({ path: `docs/shots/day9c-${id}${tag}-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  await ctx.close();
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
