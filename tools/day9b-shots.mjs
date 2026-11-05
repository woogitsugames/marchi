// Day 9b screenshots: the wagon card's disabled "Sprzedaj za 15" (D-131), the end of the tutorial with the worst-stall
// card in view (D-129), mission III's mud stretch ghost in the rain (D-116, D-132).
// Built game: npm run build; npx vite preview --port 5194 --strictPort.
//   node tools/day9b-shots.mjs [baseUrl] [case ...] [WxH ...] [--tag x] -> docs/shots/day9b-<case>[-x]-<w>x<h>.jpg
//   OLD_GHOST=1 draws the mud stretch with the plain road ghost (the look before D-132)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const ti = args.indexOf('--tag');
const tag = ti >= 0 ? '-' + args[ti + 1] : '';
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5194/';
const sizes = args.filter((a) => /^\d+x\d+$/.test(a)).map((s) => s.split('x').map(Number));
const ALL = {
  // a wagon on its run: "Sprzedaj za 15" disabled with its reason
  'wagon': { q: 'play=m1&bot=1&ff=150&speed=0&wagon=1' },
  // the tutorial's last step leaves the castle sheet open; its end closes it and the worst-stall card shows
  'tut-end': { q: 'play=m1&tut=1&ff=150', tut: true },
  // III at 2:50 in the rain: the mud card's sheet, its stretch drawn on the map (zoomed in on the ghost)
  'm3-mud': { q: 'play=m3&ff=170&speed=0', eye: true },
  // the same, the camera brought down to 40 m over the middle of the stretch (setts close up)
  'm3-mud-near': { q: 'play=m3&ff=170&speed=0', eye: true, near: 40 },
};
const pick = args.filter((a) => ALL[a]);
const cases = pick.length ? pick : Object.keys(ALL);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const [w, h] of sizes.length ? sizes : [[412, 915]]) for (const id of cases) {
  const c = ALL[id];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => errors.push(`${id} ${w}x${h}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${id} ${w}x${h}: ${m.text()}`); });
  await page.goto(`${base}?${c.q}&quality=low&dynres=0&debug=1&lang=pl`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  const shot = (name) => page.screenshot({ path: `docs/shots/day9b-${name}${tag}-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  const info = () => page.evaluate(() => ({
    card: document.querySelector('.stall-row:not([hidden]) .stall-card')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    sheets: [...document.querySelectorAll('#sheets .sheet')].map((s) => s.getAttribute('aria-label') ?? s.querySelector('h2,h3')?.textContent?.trim()),
    sell: document.querySelector('.sell-btn')?.textContent?.trim() ?? null,
    fix: document.querySelector('#sheets .sheet:last-child .fix-btn')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    tut: window.__marchia.app.tutorial?.current ?? 0,
  }));
  if (c.tut) {
    await page.waitForSelector('.letter [data-a="start"]', { timeout: 30000 });
    await page.evaluate(() => document.querySelector('.letter [data-a="start"]').click());
    await page.waitForTimeout(800);
    // the state step 6 leaves: game paused for the shot, the castle sheet open
    await page.evaluate(() => {
      const a = window.__marchia.app; a.loop.speed = 0;
      const castle = a.world.state.buildings.find((b) => b.type === 'castle');
      a.go('building', castle.id, true);
    });
    await page.waitForTimeout(1200);
    console.log(`${id}-before ${w}x${h}`, JSON.stringify(await info()));
    await shot(`${id}-before`);
    await page.evaluate(() => window.__marchia.app.tutorial?.end('done'));
    await page.waitForTimeout(1200);
  } else {
    await page.waitForTimeout(1500);
    if (c.eye) { await page.evaluate(() => document.querySelector('.stall-eye')?.click()); await page.waitForTimeout(1500); }
    if (c.near) {
      await page.evaluate((d) => {
        const a = window.__marchia.app, cells = a.ghosts.gap, W = a.world.terrain.w;
        if (!cells?.length) return;
        const m = cells[Math.floor(cells.length / 2)];
        // the sheet covers the lower half in portrait: aim a little past the middle so the stretch sits above it
        a.view.rig.set((m % W + 0.5) * 4, (Math.floor(m / W) + 0.5) * 4 + d * 0.35, d, a.view.rig.yaw);
      }, c.near);
      await page.waitForTimeout(1500);
    }
  }
  // OLD_GHOST=1: the pre-D-132 look (the mud stretch in the plain ochre road ghost) for before/after shots
  if (process.env.OLD_GHOST === '1') { await page.evaluate(() => { window.__marchia.app.view.overlay.previewPave.value = 0; }); await page.waitForTimeout(800); }
  console.log(`${id} ${w}x${h}`, JSON.stringify(await info()));
  await shot(id);
  await ctx.close();
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
