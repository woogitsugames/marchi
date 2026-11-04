// Night 6 (research 2026-11-04 P2/P4/P5) screenshots: the shared-producer card in IX (P5), the held-span card in
// IV (P4), the straight granary link offered in VI (P2). Built game: npm run build; npx vite preview --port 5194.
//   node tools/night6-cards-shots.mjs [baseUrl] [WxH ...] -> docs/shots/night6-card-<id>-<w>x<h>.jpg
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:5194/';
const sizes = (process.argv.slice(3).length ? process.argv.slice(3) : ['412x915', '915x412']).map((s) => s.split('x').map(Number));
const CASES = [
  { id: 'p5-m9-shared', q: 'play=m9&ff=30&speed=0&open=sawmill' },
  { id: 'p4-m4-heldspan', q: 'play=m4&ff=230&speed=0&open=sawmill' },
  // the large granary (36,35) of mission VI: its sheet offers the gap road, the ghost shows where
  { id: 'p2-m6-link', q: 'play=m6&ff=20&speed=0', pick: (st) => st.buildings.find((b) => b.type === 'warehouse' && b.x === 36).id },
];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const [w, h] of sizes) for (const c of CASES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => errors.push(`${c.id} ${w}x${h}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${c.id} ${w}x${h}: ${m.text()}`); });
  await page.goto(`${base}?${c.q}&quality=low&dynres=0&debug=1&lang=pl`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  if (c.pick) await page.evaluate(`(() => { const a = window.__marchia.app; a.go('building', (${c.pick.toString()})(a.world.state), true); })()`);
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => ({
    card: document.querySelector('.stall-card')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    fix: document.querySelector('#sheets .sheet:last-child .fix-btn')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    hint: document.querySelector('#sheets .sheet:last-child .fix-note, #sheets .sheet:last-child .fix-why')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
  }));
  console.log(`${c.id} ${w}x${h}`, JSON.stringify(info));
  await page.screenshot({ path: `docs/shots/night6-card-${c.id}-${w}x${h}.jpg`, type: 'jpeg', quality: 70, timeout: 120000 });
  await ctx.close();
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
