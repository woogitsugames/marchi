// Day 10a screenshots (D-193): a calm stall without calmWhy reads calm in the sheet — the pickup wait
// (WAITING_PICKUP) of mission II's farm at 0:45 ("Wóz N już jedzie po ładunek — będzie za 0:12"), with the
// calm title and plain row; no "Kup wóz" (the fleet gate does not hold).
// Built game: npm run build; npx vite preview --port 5194 --strictPort.
//   node tools/day10a-shots.mjs [before|after] [baseUrl] [WxH ...] -> docs/shots/day10a-<tag>-<w>x<h>.jpg
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const tag = args.find((a) => /^[a-z][a-z-]*$/.test(a)) ?? 'after';
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5194/';
const picked = args.filter((a) => /^\d+x\d+$/.test(a)).map((s) => s.split('x').map(Number));
const sizes = picked.length ? picked : [[412, 915], [915, 412]];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => errors.push(`${w}x${h}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${w}x${h}: ${m.text()}`); });
  await page.goto(`${base}?play=m2&ff=45&speed=0&quality=low&dynres=0&debug=1&lang=pl&view=flat`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  const id = await page.evaluate(() => {
    const app = window.__marchia.app;
    const b = app.world.state.buildings.find((q) => q.status.k === 'WAITING_PICKUP');
    if (b) app.go('building', b.id, true);
    return b?.id ?? -1;
  });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => ({
    status: document.querySelector('.status-line')?.className ?? document.querySelector('.chain-h')?.className,
    root: [...document.querySelectorAll('.chain .link.is-root')].map((e) => e.className),
    calm: document.querySelector('.calm-hint')?.textContent?.trim(),
    buy: !!document.querySelector('[data-act^="buy:"]'),
  }));
  console.log(`${w}x${h} building ${id}`, JSON.stringify(info));
  await page.screenshot({ path: `docs/shots/day10a-${tag}-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  await ctx.close();
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
