// D-245 screenshots: the trading post's road card. A staged state (speed 0): the free valley at 1:00 lifted to rank 4
// (the post opens), its granary full of wood the castle will not take (price on the floor) — the saturated market of
// D-233 without the 70-minute card-only run. The post has no road (NO_ROAD), so:
//   postroad-hud-<w>x<h>.jpg     — the calm slot's post card (sheets closed);
//   postroad-post-<w>x<h>.jpg    — its eye: the post's sheet, the gap finder's road + bridge framed once (D-144);
//   postroad-granary-<w>x<h>.jpg — the granary's sheet: "Posterunek handlowy za rzeką kupi więcej" + the same road.
// Built game: npm run build; npx vite preview --port 5210 --strictPort.
//   node tools/postroad-shots.mjs [baseUrl] [WxH ...]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5210/';
const picked = args.filter((a) => /^\d+x\d+$/.test(a)).map((s) => s.split('x').map(Number));
const sizes = picked.length ? picked : [[412, 915], [915, 412]];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const sheetInfo = (page) => page.evaluate(() => {
  const app = window.__marchia.app, c = app.ghosts?.gap, to = app.view.cellToScreen?.bind(app.view);
  const ghost = c && to ? [c[0], c[c.length - 1]].map((x) => { const p = to(x); return [Math.round(p.x), Math.round(p.y)]; }).join(' -> ') : null;
  const sh = document.querySelector('#sheets .sheet:last-child');
  const tx = (el) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  return { ghost, title: tx(sh?.querySelector('.sheet-title, h2')), calm: tx(sh?.querySelector('.calm-hint')), fix: tx(sh?.querySelector('.fix-btn')), note: tx(sh?.querySelector('.fix-note, .fix-why')) };
});
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => errors.push(`${w}x${h}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${w}x${h}: ${m.text()}`); if (/^(CHK|CORRECT)/.test(m.text())) console.log(m.text()); });
  await page.goto(`${base}?play=sandbox&ff=60&speed=0&quality=low&dynres=0&debug=1&lang=pl`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  const staged = await page.evaluate(() => {
    const app = window.__marchia.app, st = app.world.state;
    st.town.rank = 4;
    st.coins = Math.max(st.coins, 900);
    const wh = st.buildings.find((b) => b.type === 'warehouse');
    for (const g of Object.keys(wh.stock)) { wh.stock[g] = 0; wh.reservedOut[g] = 0; }
    wh.stock.wood = 60;
    wh.status = { k: 'STORAGE_FULL' };
    wh.stalledTicks = 900;
    st.market.saturation.wood = 24; // MARKET.cap: the castle's price at the floor
    const post = st.buildings.find((b) => b.type === 'tradePost');
    if (post) post.status = { k: 'NO_ROAD' };
    st.netVersion++;
    app.sheets.closeAll();
    return { wh: wh.id, post: post?.id ?? -1 };
  });
  // the rank-up letter (rank 4 staged) and the opened plaque: dismissed as a player would (one gesture each)
  await page.waitForTimeout(3000);
  await page.evaluate(() => document.querySelector('.rank-letter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(8000);
  const hud = await page.evaluate(() => {
    const r = document.querySelector('.stall-row');
    return { row: r?.className, text: r?.textContent?.replace(/\s+/g, ' ').trim() };
  });
  console.log(`${w}x${h} hud`, JSON.stringify(hud));
  await page.screenshot({ path: `docs/shots/postroad-hud-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  await page.click('.stall-row .stall-eye');
  await page.waitForTimeout(12000);
  console.log(`${w}x${h} post`, JSON.stringify(await sheetInfo(page)));
  await page.screenshot({ path: `docs/shots/postroad-post-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  await page.evaluate((id) => { const app = window.__marchia.app; app.sheets.closeAll(); app.go('building', id, true); }, staged.wh);
  await page.waitForTimeout(12000);
  console.log(`${w}x${h} granary`, JSON.stringify(await sheetInfo(page)));
  await page.screenshot({ path: `docs/shots/postroad-granary-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  await ctx.close();
}
await browser.close();
if (errors.length) { console.log('ERRORS\n' + errors.join('\n')); process.exitCode = 1; }
