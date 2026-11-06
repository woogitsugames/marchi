// Missions XIV-XV screenshots (D-210/D-212): the opening letter, the lesson moment (XIV: the pace card asking for a
// second burner at 1:10; XV: the woodcutters' card asking for a granary at 0:55) and XV's calm fish store sheet.
// Usage: node tools/m14-15-shots.mjs [baseUrl] [WxH ...]  (server: npm run build; npx vite preview --port 5195 --strictPort)
// -> docs/shots/m14-<what>-<w>x<h>.jpg, docs/shots/m15-<what>-<w>x<h>.jpg
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:5195/';
const sizes = (process.argv.slice(3).length ? process.argv.slice(3) : ['412x915']).map((s) => s.split('x').map(Number));
const lang = process.env.LANG_Q ?? 'pl';
mkdirSync('docs/shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const SHOTS = [
  { id: 'm14', what: 'letter', q: 'speed=0', letter: true },
  { id: 'm14', what: 'lesson', q: 'ff=70&speed=0' },
  { id: 'm15', what: 'letter', q: 'speed=0', letter: true },
  { id: 'm15', what: 'lesson', q: 'ff=55&speed=0' },
  { id: 'm15', what: 'calm', q: 'ff=55&speed=0&open=warehouse' },
];
for (const [w, h] of sizes) {
  const tag = `${w}x${h}${lang === 'pl' ? '' : '-' + lang}`;
  for (const s of SHOTS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.setDefaultNavigationTimeout(180000);
    page.on('pageerror', (e) => errors.push(`${s.id}-${s.what} ${tag}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${s.id}-${s.what} ${tag}: ${m.text()}`); });
    await page.goto(`${base}?play=${s.id}&quality=low&dynres=0&debug=1&lang=${lang}&${s.q}`);
    await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
    await page.waitForTimeout(2000);
    // a ?play= start skips the letter: start the mission again the way the menu does
    if (s.letter) {
      await page.evaluate((id) => { const A = window.__marchia.app; A.debugStart = false; A.newGame(id); }, s.id);
      await page.waitForTimeout(1500);
    } else {
      const start = page.locator('.letter [data-a="start"]');
      if (await start.count()) { await start.first().click(); await page.waitForTimeout(800); }
      await page.waitForTimeout(1500);
    }
    const info = await page.evaluate(() => ({
      letter: document.querySelector('.letter')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 160) ?? null,
      card: document.querySelector('.stall-card')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      sheet: document.querySelector('#sheets .sheet:last-child')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 240) ?? null,
    }));
    console.log(s.id, s.what, tag, JSON.stringify(info));
    await page.screenshot({ path: `docs/shots/${s.id}-${s.what}-${tag}.jpg`, type: 'jpeg', quality: 70, timeout: 120000 });
    await ctx.close();
  }
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
