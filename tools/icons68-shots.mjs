// Order 68 (D-345) screenshots: the new woodcut state icons where they appear. Staged states (speed 0):
//   market — the sandbox granary full of wood at a saturated market: the market_full hint in its sheet;
//   grow   — the free valley's grow card (as tools/valley-grow-shots.mjs) with a calm pin, so its seal shows 'grow';
//   cut    — a farm ghost whose corner would cut a diagonal road step: 'cut_road' leads the ghost tag.
// Built game: npm run build; npx vite preview --port 5322 --strictPort.
//   node tools/icons68-shots.mjs [baseUrl] [scene] [WxH ...] -> docs/shots/icons68-<scene>-<w>x<h>.jpg
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5322/';
const picked = args.filter((a) => /^\d+x\d+$/.test(a)).map((s) => s.split('x').map(Number));
const sizes = picked.length ? picked : [[412, 915], [915, 412]];

const only = args.find((a) => /^[a-z]+$/.test(a));
const scenes = [
  {
    name: 'market', query: 'play=sandbox&ff=60&lang=pl', probe: '#sheets .sheet:last-child .calm-hint',
    stage: () => {
      const app = window.__marchia.app, st = app.world.state;
      const wh = st.buildings.find((b) => b.type === 'warehouse');
      for (const g of Object.keys(wh.stock)) { wh.stock[g] = 0; wh.reservedOut[g] = 0; }
      wh.stock.wood = 60;
      wh.status = { k: 'STORAGE_FULL' };
      wh.stalledTicks = 900;
      st.market.saturation.wood = 24;
      st.netVersion++;
      app.go('building', wh.id, true);
    },
  },
  {
    name: 'grow', query: 'play=sandbox&ff=60&lang=pl', probe: '.al-ic',
    stage: () => {
      const st = window.__marchia.app.world.state;
      st.town.rank = 1;
      st.town.renown = 640;
      st.town.bestFlow = 24;
      for (const g of ['wood', 'planks', 'grain', 'bread']) st.ledger.sold[g] = Math.max(st.ledger.sold[g], 12);
      st.coins = 520;
      // one calm pin, so the alarm seal (and its icon) is on screen
      const wh = st.buildings.find((b) => b.type === 'warehouse');
      for (const g of Object.keys(wh.stock)) { wh.stock[g] = 0; wh.reservedOut[g] = 0; }
      wh.stock.wood = 60;
      wh.status = { k: 'STORAGE_FULL' };
      wh.stalledTicks = 900;
      st.market.saturation.wood = 24;
      st.netVersion++;
    },
  },
  {
    name: 'cut', query: 'play=sandbox&ff=20&lang=pl', probe: '.gt-main',
    stage: () => {
      const app = window.__marchia.app, st = app.world.state, W = app.world.terrain.w;
      app.setTool('build');
      app.build.pick('farm');
      // walk out from the centre to a free site whose corner can take a diagonal road step (as tests/ghost-link)
      const b = app.build, T = app.world.terrain, c0 = b.gy * W + b.gx;
      for (let r = 0; r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const c = c0 + dy * W + dx;
        b.moveTo(c);
        if (!b.result?.ok) continue;
        const a = (b.gy - 1) * W + b.gx, l = b.gy * W + b.gx - 1, k = (b.gy - 1) * W + b.gx - 1;
        if ([a, l, k].some((i) => T.water[i] || st.roads[i] || Math.abs(T.cellH[i] - T.cellH[b.gy * W + b.gx]) > 0.5)) continue;
        st.roads[a] = 1; st.roads[l] = 1; st.netVersion++;
        b.previewKey = ''; b.revalidate();
        if (document.querySelector('.gt-main svg')) return;
        st.roads[a] = 0; st.roads[l] = 0; st.netVersion++;
      }
    },
  },
];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const sc of scenes.filter((x) => !only || x.name === only)) {
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
    await page.evaluate(() => { document.querySelector('.rank-letter-wrap')?.remove(); });
    await page.waitForTimeout(300);
    const info = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return { text: el?.textContent?.replace(/\s+/g, ' ').trim() ?? null, svg: !!el?.querySelector('svg') };
    }, sc.probe);
    console.log(sc.name, `${w}x${h}`, JSON.stringify(info));
    await page.screenshot({ path: `docs/shots/icons68-${sc.name}-${w}x${h}.jpg`, type: 'jpeg', quality: 70, timeout: 120000 });
    await ctx.close();
  }
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
