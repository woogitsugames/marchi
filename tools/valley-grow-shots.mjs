// D-192 screenshots: the free valley's grow card ("Do rangi 2 brakuje już tylko renomy — postaw jeszcze: …") in the
// HUD, and the castle sheet with its cure. A staged state (speed 0, no ticks run): the sandbox at 1:00, rank 1 with
// four goods sold and the flow reached, renown below rank 2, silver for one more woodcutter — the state the card-only
// player reaches at ~15 min without playing it.
// Built game: npm run build; npx vite preview --port 5194 --strictPort.
//   node tools/valley-grow-shots.mjs [baseUrl] [WxH ...] -> docs/shots/valley-grow-{card,sheet}-<w>x<h>.jpg
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5194/';
const picked = args.filter((a) => /^\d+x\d+$/.test(a)).map((s) => s.split('x').map(Number));
const sizes = picked.length ? picked : [[412, 915]];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
let bad = 0;
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => errors.push(`${w}x${h}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${w}x${h}: ${m.text()}`); });
  await page.goto(`${base}?play=sandbox&ff=60&speed=0&quality=low&dynres=0&debug=1&lang=pl&view=flat`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const st = window.__marchia.app.world.state;
    st.town.rank = 1;
    st.town.renown = 640;
    st.town.bestFlow = 24;
    for (const g of ['wood', 'planks', 'grain', 'bread']) st.ledger.sold[g] = Math.max(st.ledger.sold[g], 12);
    st.coins = 520;
    st.netVersion++;
  });
  await page.waitForTimeout(1500);
  // the staged rank-up brings the sealed letter: one tap closes it (as the player would)
  if (await page.$('.rank-letter-wrap')) { await page.click('.rank-letter-wrap'); await page.waitForTimeout(500); }
  const card = await page.evaluate(() => ({
    kick: document.querySelector('.sc-kick, .stall-kick')?.textContent?.trim() ?? null,
    text: document.querySelector('.sc-text')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
  }));
  console.log(`${w}x${h} card`, JSON.stringify(card));
  if (!card.text || !card.text.includes('renomy')) bad++;
  await page.screenshot({ path: `docs/shots/valley-grow-card-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  await page.evaluate(() => {
    const app = window.__marchia.app;
    const castle = app.world.state.buildings.find((b) => b.type === 'castle');
    app.go('building', castle.id, true);
  });
  await page.waitForTimeout(1500);
  const sheet = await page.evaluate(() => {
    const sh = document.querySelector('#sheets .sheet:last-child');
    const btn = sh?.querySelector('.fix-btn');
    return { fix: btn?.textContent?.replace(/\s+/g, ' ').trim() ?? null, act: btn?.getAttribute('data-act') ?? null,
      hint: sh?.querySelector('.fix .s-hint')?.textContent?.replace(/\s+/g, ' ').trim() ?? null };
  });
  console.log(`${w}x${h} sheet`, JSON.stringify(sheet));
  if (!sheet.act?.startsWith('grow:')) bad++;
  await page.screenshot({ path: `docs/shots/valley-grow-sheet-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  // the button opens the build tool with the ghost by the castle
  if (sheet.act) {
    await page.click('#sheets .sheet:last-child .fix-btn');
    await page.waitForTimeout(1200);
    const tool = await page.evaluate(() => window.__marchia.app.build?.type ?? document.querySelector('.tool.is-on, [data-tool].is-active')?.getAttribute('data-tool') ?? null);
    console.log(`${w}x${h} after tap`, JSON.stringify(tool));
    await page.screenshot({ path: `docs/shots/valley-grow-ghost-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
  }
  await ctx.close();
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
process.exit(bad || errors.length ? 1 : 0);
