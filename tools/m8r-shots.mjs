// Mission VIII redesign screenshots (D-165): the opening letter, the start (the one lane between the hamlet and
// the castle), the lesson moment at 1:40 (rain, 24 stone in the granaries, the mud card offering the cobbles) and the
// paved lane a minute later.
// Usage: node tools/m8r-shots.mjs [baseUrl] [WxH ...]  (server: npm run build; npx vite preview --port 5194 --strictPort)
// -> docs/shots/m8r-<what>-<w>x<h>.jpg
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:5194/';
const sizes = (process.argv.slice(3).length ? process.argv.slice(3) : ['412x915']).map((s) => s.split('x').map(Number));
const lang = process.env.LANG_Q ?? 'pl';
mkdirSync('docs/shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const card = (page) => page.evaluate(() => document.querySelector('.stall-card')?.textContent?.replace(/\s+/g, ' ').trim() ?? null);
for (const [w, h] of sizes) {
  const tag = `${w}x${h}${lang === 'pl' ? '' : '-' + lang}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`); });
  const shot = (what) => page.screenshot({ path: `docs/shots/m8r-${what}-${tag}.jpg`, type: 'jpeg', quality: 70, timeout: 120000 });
  // the start: the letter, then the valley at 0:00
  await page.goto(`${base}?play=m8&quality=low&dynres=0&debug=1&lang=${lang}&speed=0`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const a = window.__marchia.app, W = a.world.terrain.w; a.view.camera.focusCell(24 * W + 42, { x: 0, y: 140 }); });
  await page.waitForTimeout(4000);
  console.log(tag, 'start card:', await card(page));
  await shot('start');
  // the lesson moment: 1:40, the storm is on, the granaries hold the lane's stone, the mud card offers the cobbles
  await page.goto(`${base}?play=m8&quality=low&dynres=0&debug=1&lang=${lang}&ff=100&speed=0&collapsed=1`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const st = window.__marchia.app.world.state;
    const stone = st.buildings.filter((b) => b.type === 'warehouse').reduce((a, b) => a + b.stock.stone, 0);
    return { tick: st.tick, rain: st.rain.some((r) => r.start <= st.tick && st.tick < r.end), stone };
  });
  await page.evaluate(() => { const a = window.__marchia.app, W = a.world.terrain.w; a.view.camera.focusCell(24 * W + 42, { x: 0, y: 140 }); });
  await page.waitForTimeout(4000);
  console.log(tag, 'lesson:', JSON.stringify(info), 'card:', await card(page));
  await shot('mud');
  // the lane paved (the same command the sheet's button sends), a minute on in the rain
  await page.evaluate(() => {
    const app = window.__marchia.app, W = app.world.terrain.w, cells = [];
    for (let x = 31; x <= 53; x++) cells.push(24 * W + x);
    app.loop.enqueue({ t: 'road', surface: 2, cells });
    for (let i = 0; i < 600 && app.world.state.mission.result === 'running'; i++) app.loop.tickOnce();
    return cells.filter((c) => app.world.state.roads[c] === 2).length;
  }).then((n) => console.log(tag, 'cobbled cells:', n));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await page.evaluate(() => { const a = window.__marchia.app, W = a.world.terrain.w; a.view.camera.focusCell(24 * W + 42, { x: 0, y: 140 }); });
  await page.waitForTimeout(4000);
  console.log(tag, 'paved card:', await card(page));
  await shot('paved');
  await ctx.close();
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
