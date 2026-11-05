// Day 9h screenshots (first-10-minutes-e fixes): N6 the docked "Kup wóz" over a chain link on a short landscape
// sheet, N7 the surplus title, N8 the castle sheet right after its wagon wait resolved.
// Built game: npm run build; npx vite preview --port 5195 --strictPort.
//   node tools/day9h-shots.mjs [baseUrl] [case ...] [WxH ...] [--tag x] -> docs/shots/day9h-<case>[-x]-<w>x<h>.jpg
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const ti = args.indexOf('--tag');
const tag = ti >= 0 ? '-' + args[ti + 1] : '';
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5195/';
const sizes = args.filter((a) => /^\d+x\d+$/.test(a)).map((s) => s.split('x').map(Number));
const ALL = {
  // I at 1:30: the farm's yard is full, two wagons on the road; its sheet lists the mill waiting and "Kup wóz"
  'n6-farm': { q: 'play=m1&ff=90&speed=0&open=farm', sizes: [[915, 412]] },
  // the same, the body scrolled half way: the link stays above the dock, never under it
  'n6-farm-scrolled': { q: 'play=m1&ff=90&speed=0&open=farm', sizes: [[915, 412]], scroll: 0.5 },
  // VIII at 2:20: a farm's grain nobody needs right now (calm surplus)
  'n7-surplus': { q: 'play=m8&ff=140&speed=0&open=farm', sizes: [[412, 915]] },
};
const pick = args.filter((a) => ALL[a]);
const cases = pick.length ? pick : Object.keys(ALL);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const id of cases) for (const [w, h] of sizes.length ? sizes : ALL[id].sizes) {
  const c = ALL[id];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => errors.push(`${id} ${w}x${h}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${id} ${w}x${h}: ${m.text()}`); });
  await page.goto(`${base}?${c.q}&quality=low&dynres=0&debug=1&lang=pl&view=flat`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  if (c.scroll) {
    await page.evaluate((f) => { const b = document.querySelector('#sheets .sheet:last-child .sheet-body'); b.scrollTop = (b.scrollHeight - b.clientHeight) * f; }, c.scroll);
    await page.waitForTimeout(400);
  }
  const info = await page.evaluate(() => {
    const sh = document.querySelector('#sheets .sheet:last-child');
    const btn = sh?.querySelector('.fix-btn');
    const br = btn?.getBoundingClientRect();
    // links of the body whose middle lies under the fix button (N6)
    const under = br ? [...sh.querySelectorAll('.sheet-body .linkish, .sheet-body button')].filter((e) => !e.closest('.fix-dock')).filter((e) => {
      const r = e.getBoundingClientRect(), y = r.top + r.height / 2, x = r.left + r.width / 2;
      // only where the scrolling body shows it (a link scrolled out of the body is not on screen)
      const sb = e.closest('.sheet-body').getBoundingClientRect();
      if (y < sb.top || y > sb.bottom) return false;
      return r.height > 0 && x >= br.left && x <= br.right && y >= br.top && y <= br.bottom;
    }).map((e) => e.textContent.trim()) : [];
    return {
      status: sh?.querySelector('.status-line, .chain .l-text')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      fix: btn?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      under,
    };
  });
  console.log(`${id} ${w}x${h}`, JSON.stringify(info));
  await page.screenshot({ path: `docs/shots/day9h-${id}${tag}-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  await ctx.close();
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
