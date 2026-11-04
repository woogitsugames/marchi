// Mission XIII screenshots (night 6, D-102): the game at 2:30 with one wagon (the worst
// stall card should read "all wagons busy"), its why sheet, and the main menu row XIII.
// Usage: node tools/m13-shots.mjs [baseUrl] [WxH ...]  (server: npm run build; npx vite preview --port 5194 --strictPort)
// -> docs/shots/night6-m13-<what>-<w>x<h>.jpg
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:5194/';
const sizes = (process.argv.slice(3).length ? process.argv.slice(3) : ['412x915', '915x412']).map((s) => s.split('x').map(Number));
const lang = process.env.LANG_Q ?? 'pl';
mkdirSync('docs/shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const [w, h] of sizes) {
  const tag = `${w}x${h}${lang === 'pl' ? '' : '-' + lang}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`); });
  // a minute in with one wagon
  await page.goto(`${base}?play=m13&quality=low&dynres=0&debug=1&lang=${lang}&ff=150&speed=0`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  const start = page.locator('.letter [data-a="start"]');
  if (await start.count()) { await start.first().click(); await page.waitForTimeout(800); }
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const st = window.__marchia.app.world.state;
    return { stalls: st.buildings.map((b) => `${b.type}:${b.status.k}${b.status.cause ? '.' + b.status.cause : ''}`).join(' '),
      card: document.querySelector('.stall-card')?.textContent?.replace(/\s+/g, ' ').trim() ?? null };
  });
  console.log(tag, JSON.stringify(info));
  await page.screenshot({ path: `docs/shots/night6-m13-play-${tag}.jpg`, type: 'jpeg', quality: 70, timeout: 120000 });
  // the bakery's sheet (the worst stall): what "Dlaczego stoi?" says and the fix it offers
  await page.goto(`${base}?play=m13&quality=low&dynres=0&debug=1&lang=${lang}&ff=150&speed=0&open=bakery`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  const why = await page.evaluate(() => document.querySelector('#sheets .sheet:last-child')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 300) ?? null);
  console.log(tag, 'sheet:', why);
  await page.screenshot({ path: `docs/shots/night6-m13-why-${tag}.jpg`, type: 'jpeg', quality: 70, timeout: 120000 });
  // the main menu, scrolled to the last mission
  await page.goto(`${base}?quality=low&dynres=0&lang=${lang}`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const row = page.locator('.menu-item', { hasText: 'XIII' }).first();
  const rows = page.locator('.menu-item');
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    const label = await rows.nth(i).getAttribute('aria-label');
    if (label && label.startsWith('XIII')) { await rows.nth(i).scrollIntoViewIfNeeded(); console.log(tag, 'menu row:', label); }
  }
  void row;
  await page.waitForTimeout(500);
  await page.screenshot({ path: `docs/shots/night6-m13-menu-${tag}.jpg`, type: 'jpeg', quality: 70, timeout: 120000 });
  await ctx.close();
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
