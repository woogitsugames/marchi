// D-339 screenshots: situational "Co to znaczy?" entries open on a card. Staged states (speed 0):
//   market — the sandbox granary full of wood at a saturated market (as tools/day9j-shots.mjs), Polish;
//   castle — mission XVI at ~0:40, the east castle card (even split / the other castle takes the planks), German;
//   post   — the sandbox at rank 4, the trading post without its road, Arabic (RTL).
// Built game: npm run build; npx vite preview --port 5292 --strictPort.
//   node tools/codex-shots.mjs [baseUrl] [WxH ...] -> docs/shots/codex-<scene>-<w>x<h>.jpg
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5292/';
const picked = args.filter((a) => /^\d+x\d+$/.test(a)).map((s) => s.split('x').map(Number));
const sizes = picked.length ? picked : [[412, 915], [915, 412]];

const scenes = [
  {
    name: 'market', query: 'play=sandbox&ff=60&lang=pl',
    stage: () => {
      const app = window.__marchia.app, st = app.world.state;
      const wh = st.buildings.find((b) => b.type === 'warehouse');
      for (const g of Object.keys(wh.stock)) { wh.stock[g] = 0; wh.reservedOut[g] = 0; }
      wh.stock.wood = 60;
      wh.status = { k: 'STORAGE_FULL' };
      wh.stalledTicks = 900;
      st.market.saturation.wood = 24; // MARKET.cap: price at the floor
      for (const m of st.buildings) if (m.type === 'tradePost') m.incoming.wood = Math.max(m.incoming.wood, 40);
      st.netVersion++;
      app.go('building', wh.id, true);
    },
  },
  {
    name: 'castle', query: 'play=m16&ff=40&lang=de',
    stage: () => {
      const app = window.__marchia.app, st = app.world.state;
      const east = st.buildings.find((b) => b.id === st.mission.contract.castle);
      app.go('building', east.id, true);
    },
  },
  {
    name: 'post', query: 'play=sandbox&ff=30&lang=ar',
    stage: () => {
      const app = window.__marchia.app, st = app.world.state;
      st.town.rank = Math.max(st.town.rank, 4);
      const post = st.buildings.find((b) => b.type === 'tradePost');
      post.status = { k: 'NO_ROAD' };
      post.stalledTicks = 600;
      st.netVersion++;
      app.go('building', post.id, true);
    },
  },
];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const sc of scenes) {
  for (const [w, h] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.setDefaultNavigationTimeout(180000);
    page.on('pageerror', (e) => errors.push(`${sc.name} ${w}x${h}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${sc.name} ${w}x${h}: ${m.text()}`); });
    await page.goto(`${base}?${sc.query}&speed=0&quality=low&dynres=0&debug=1&view=flat`);
    await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
    await page.waitForTimeout(800);
    await page.evaluate(sc.stage);
    await page.waitForTimeout(1500);
    // a staged rank opens the rank letter over the card: put it away (the card stays)
    await page.evaluate(() => { document.querySelector('.rank-letter-wrap')?.remove(); });
    // open the fold, then scroll it into the sheet's view
    await page.evaluate(() => {
      const tog = document.querySelector('#sheets .sheet:last-child .codex-tog');
      if (tog && tog.getAttribute('aria-expanded') !== 'true') tog.click();
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelector('#sheets .sheet:last-child .codex')?.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => {
      const sh = document.querySelector('#sheets .sheet:last-child');
      return { name: sh?.querySelector('.codex-name')?.textContent?.replace(/\s+/g, ' ').trim() ?? null };
    });
    console.log(sc.name, `${w}x${h}`, JSON.stringify(info));
    await page.screenshot({ path: `docs/shots/codex-${sc.name}-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
    await ctx.close();
  }
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
