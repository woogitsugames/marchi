// Trading post and bottleneck card screenshots (D-170, D-171; spec docs/specs/2026-11-04-valley-trade-post.md §8).
// The state is prepared with commands (loop.enqueue) and, only here, by raising town.rank.
// Built game: npm run build; npx vite preview --port 5194 --strictPort.
//   node tools/trade-shots.mjs [baseUrl] [case ...] [WxH ...] -> docs/shots/trade-<case>-<w>x<h>.jpg
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5194/';
const sizes = args.filter((a) => /^\d+x\d+$/.test(a)).map((s) => s.split('x').map(Number));
const DEFAULT_SIZES = [[412, 915], [915, 412]];

// shared page-side helpers: the app, a tick runner, the post, the player's road to it (column x = 39)
const PRE = `const a = window.__marchia.app, w = a.world, W = w.terrain.w;
  const tick = (n) => { for (let i = 0; i < n; i++) a.loop.tickOnce(); };
  const post = w.state.buildings.find((b) => b.type === 'tradePost');
  const stable = w.state.buildings.find((b) => b.type === 'stable');
  const road = (surface) => { const cells = []; for (let y = 25; y <= 57; y++) cells.push(y * W + 39); a.loop.enqueue({ t: 'road', surface, cells }); };
  const wagons = (n) => { for (let i = 0; i < n; i++) a.loop.enqueue({ t: 'buyWagon', stable: stable.id }); };
  const open = () => { w.state.town.rank = 4; w.state.coins = Math.max(w.state.coins, 6000); };
  const letterOff = () => setTimeout(() => document.querySelector('.rank-letter-wrap')?.click(), 50);`;
const ALL = {
  // before rank 4: the post's sheet says when it opens
  'post-closed': { q: 'play=sandbox&ff=60&speed=0', run: `${PRE} a.go('building', post.id, true);` },
  // the rank-4 letter with the post line
  'post-letter': { q: 'play=sandbox&ff=60&speed=0', run: `${PRE} open(); tick(10); window.__marchia.rankUp(4);` },
  // rank 4, no road yet: the calm NO_ROAD line, "Zbuduj drogę i most" from the gap finder
  'post-noroad': { q: 'play=sandbox&ff=60&speed=0', run: `${PRE} open(); tick(30); letterOff(); a.go('building', post.id, true);` },
  // five minutes of trade: prices at the post against the castle, the last sales
  'post-sales': { q: 'play=sandbox&ff=60&speed=0', run: `${PRE} open(); road(1); wagons(4); tick(3000); letterOff(); a.go('building', post.id, true);` },
  // the same sheet scrolled to the last sales
  'post-sales-recent': { q: 'play=sandbox&ff=60&speed=0', scroll: '.post-sales', run: `${PRE} open(); road(1); wagons(4); tick(3000); letterOff(); a.go('building', post.id, true);` },
  // "Targ i ranga": the post's line and its button
  'post-market': { q: 'play=sandbox&ff=60&speed=0', run: `${PRE} open(); road(1); wagons(2); tick(600); letterOff(); a.openMarket();` },
};
const pick = args.filter((a) => ALL[a]);
const cases = pick.length ? pick : Object.keys(ALL);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const id of cases) for (const [w, h] of sizes.length ? sizes : ALL[id].sizes ?? DEFAULT_SIZES) {
  const c = ALL[id];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => errors.push(`${id} ${w}x${h}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${id} ${w}x${h}: ${m.text()}`); });
  await page.goto(`${base}?${c.q}&quality=low&dynres=0&debug=1&lang=${c.lang ?? 'pl'}&view=flat`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  if (c.run) await page.evaluate(c.run);
  await page.waitForTimeout(1500);
  if (c.scroll) {
    await page.evaluate((sel) => document.querySelector(`#sheets .sheet:last-child ${sel}`)?.scrollIntoView({ block: 'center' }), c.scroll);
    await page.waitForTimeout(400);
  }
  const info = await page.evaluate(() => {
    const sh = document.querySelector('#sheets .sheet:last-child');
    const card = document.querySelector('.stall-card');
    return {
      sheet: sh?.querySelector('.sheet-title, h2')?.textContent?.trim() ?? null,
      status: sh?.querySelector('.status-line')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      fix: sh?.querySelector('.fix-btn')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      card: card && card.offsetParent ? card.textContent.replace(/\s+/g, ' ').trim() : null,
      small: [...document.querySelectorAll('#sheets .sheet:last-child button')].filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && (r.width < 48 || r.height < 48) && !b.classList.contains('linkish');
      }).length,
    };
  });
  console.log(`${id} ${w}x${h}`, JSON.stringify(info));
  await page.screenshot({ path: `docs/shots/trade-${id}-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  await ctx.close();
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
