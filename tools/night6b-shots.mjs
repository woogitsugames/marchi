// Night 6b screenshots. Built game: npm run build; npx vite preview --port 5194 --strictPort.
//   node tools/night6b-shots.mjs <case> [baseUrl] [WxH ...] -> docs/shots/night6b-<case>-<w>x<h>.jpg
// Cases: m6-surplus (VI after the link, the sawmill's next-letter planks: calm, no "Kup wóz"),
//        m10-ghost (X, "Postaw jeszcze: Chata drwala": the ghost on the authored site).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const which = process.argv[2];
const base = process.argv[3] ?? 'http://127.0.0.1:5194/';
const sizes = (process.argv.slice(4).length ? process.argv.slice(4) : ['412x915', '915x412']).map((s) => s.split('x').map(Number));
const CASES = {
  'm6-surplus': {
    q: 'play=m6&speed=0',
    run: `(() => { const a = window.__marchia.app, W = a.world.terrain.w;
      a.loop.enqueue({ t: 'road', surface: 1, cells: [38 * W + 37, 39 * W + 37] }); a.loop.flushCommands();
      while (a.world.state.tick < 160 * 10) a.loop.tickOnce();
      a.go('building', a.world.state.buildings.find((b) => b.type === 'sawmill').id, true); })()`,
  },
  // X: the shared-producer card's "Naprawa" opens the build tool; the ghost starts on the authored site (D-107)
  'm10-ghost': {
    q: 'play=m10&ff=30&speed=0&open=sawmill',
    after: async (page) => {
      await page.waitForTimeout(2500);
      const fix = page.locator('#sheets .sheet:last-child .fix-btn').first();
      console.log('fix button:', (await fix.textContent())?.replace(/\s+/g, ' ').trim());
      await fix.click();
      await page.waitForTimeout(1500);
      console.log('ghost:', JSON.stringify(await page.evaluate(() => { const b = window.__marchia.app.build; return { x: b.gx, y: b.gy, f: b.facing }; })));
    },
  },
};
const c = CASES[which];
if (!c) throw new Error('case? ' + Object.keys(CASES).join(' '));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => errors.push(`${w}x${h}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${w}x${h}: ${m.text()}`); });
  await page.goto(`${base}?${c.q}&quality=low&dynres=0&debug=1&lang=pl${c.extra ?? ''}`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  if (c.run) await page.evaluate(c.run);
  if (c.after) await c.after(page);
  await page.waitForTimeout(c.wait ?? 2500);
  const info = await page.evaluate(() => ({
    card: document.querySelector('.stall-card')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    sheet: document.querySelector('#sheets .sheet:last-child')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 400) ?? null,
  }));
  console.log(`${which} ${w}x${h}`, JSON.stringify(info));
  await page.screenshot({ path: `docs/shots/night6b-${which}-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  await ctx.close();
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
