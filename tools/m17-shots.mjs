// Mission XVII screenshots (D-356..D-358): the opening letter, the HUD with the castle pace card and the two-castle
// waybill (1:00), the east castle's card at the even split (chain line "Tartak stoi — drewno idzie na węgiel dla Zamku
// Północnego" and the two switches), the same card after one tap on "Cały łańcuch dla tego zamku", and the charcoal
// burner's sheet with the east chain first (NO_INPUT.CHAIN_FIRST: "Drewno → Tartak, dla Zamku Wschodniego").
// Usage: [ONLY=regex] node tools/m17-shots.mjs [baseUrl] [WxH ...]  (server: npm run build; npx vite preview --port 5360 --strictPort)
// -> docs/shots/m17-<what>-<w>x<h>.jpg
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:5360/';
const sizes = (process.argv.slice(3).length ? process.argv.slice(3) : ['412x915', '915x412', '904x1000']).map((s) => s.split('x').map(Number));
const lang = process.env.LANG_Q ?? 'pl';
mkdirSync('docs/shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
// building ids in m17: 3 = Węglarnia, 5 = Zamek Wschodni (main contract), 6 = Zamek Północny
const SHOTS = [
  { what: 'letter', q: 'speed=0', letter: true },
  { what: 'card', q: 'ff=60&speed=0' },
  { what: 'castle', q: 'ff=60&speed=0&openId=5' },
  { what: 'chain', q: 'ff=60&speed=0&openId=5', tap: true },
  { what: 'burner', q: 'speed=0', chainAt: 50, open: 3 },
];
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
for (const [w, h] of sizes) {
  const tag = `${w}x${h}${lang === 'pl' ? '' : '-' + lang}`;
  for (const s of SHOTS) {
    if (only && !only.test(s.what)) continue;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.setDefaultNavigationTimeout(180000);
    page.on('pageerror', (e) => errors.push(`${s.what} ${tag}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${s.what} ${tag}: ${m.text()}`); });
    await page.goto(`${base}?play=m17&quality=low&dynres=0&debug=1&lang=${lang}&${s.q}`);
    await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
    await page.waitForTimeout(2000);
    if (s.letter) {
      await page.evaluate(() => { const A = window.__marchia.app; A.debugStart = false; A.newGame('m17'); });
      await page.waitForTimeout(1500);
    } else {
      const start = page.locator('.letter [data-a="start"]');
      if (await start.count()) { await start.first().click(); await page.waitForTimeout(800); }
      await page.waitForTimeout(1500);
    }
    if (s.chainAt) {
      // the east castle first with its whole chain at 0:00, then the app's own loop to the given second
      await page.evaluate(([sec]) => {
        const A = window.__marchia.app;
        A.loop.enqueue({ t: 'chainFirst', castle: 5 }); A.loop.flushCommands();
        while (A.world.state.tick < sec * 10) A.loop.tickOnce();
      }, [s.chainAt]);
      await page.waitForTimeout(1500);
      await page.evaluate((id) => window.__marchia.app.go('building', id, true), s.open);
      await page.waitForTimeout(3000);
      const st = await page.evaluate(() => JSON.stringify(window.__marchia.app.world.state.buildings.find((b) => b.id === 3).status));
      if (!st.includes('CHAIN_FIRST')) errors.push(`${s.what} ${tag}: burner status ${st}`);
    }
    if (s.tap) {
      const btn = page.locator('[data-act="chainfirst:5"]');
      if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(1200); }
      else errors.push(`${s.what} ${tag}: no chain switch on the castle card`);
    }
    // One UI frame after the last step, so every panel has seen the paused state (the HUD redraws inside the frame).
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    // What the player sees: in portrait an open sheet folds the waybill to its seal (D-62) and the folded parchment
    // is display:none and not redrawn until it unfolds (D-153), so its DOM text is not read then; the seal's fill is.
    const info = await page.evaluate(() => {
      const A = window.__marchia.app, st = A.world.state, m = st.mission;
      const orders = m.contract ? [m.contract, ...(m.extraContracts ?? [])] : [];
      const stockOf = (k) => st.buildings.find((b) => b.id === k.castle)?.stock ?? {};
      const castles = orders.map((k) => Object.keys(k.need).filter((g) => k.need[g] > 0)
        .map((g) => `${Math.min(stockOf(k)[g] ?? 0, k.need[g])}/${k.need[g]}`).join(' '));
      let got = 0, total = 0;
      for (const k of orders) for (const g of Object.keys(k.need)) if (k.need[g] > 0) { total += k.need[g]; got += Math.min(stockOf(k)[g] ?? 0, k.need[g]); }
      const wrap = document.querySelector('.waybill-wrap');
      const folded = !!wrap?.classList.contains('is-collapsed');
      const wb = document.querySelector('.wb-castles');
      const fill = document.querySelector('.waybill-wrap .so-fill')?.style.clipPath.match(/inset\(([\d.]+)%/)?.[1];
      return {
        tick: st.tick, castles,
        letter: document.querySelector('.letter')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 160) ?? null,
        card: document.querySelector('.stall-card')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        waybill: wrap?.hidden ? null : folded
          ? { seal: document.querySelector('.waybill-wrap .seal-only')?.textContent?.replace(/\s+/g, ' ').trim(), fillPct: fill ? 100 - Number(fill) : null, wantPct: (100 * got) / Math.max(1, total) }
          : wb?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        waybillCounts: !folded && wb ? [...wb.querySelectorAll('.wb-tr')].map((li) => [...li.querySelectorAll('.count')].map((c) => c.textContent).join(' ')) : null,
        sheet: document.querySelector('#sheets .sheet:last-child')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 400) ?? null,
      };
    });
    // the shown counts must be the state's (rows of delivered castles carry no counts)
    if (info.waybillCounts && info.waybillCounts.some((c, i) => c && c !== info.castles[i])) errors.push(`${s.what} ${tag}: waybill ${info.waybillCounts} != state ${info.castles}`);
    if (info.waybill?.fillPct != null && Math.abs(info.waybill.fillPct - info.waybill.wantPct) > 0.5) errors.push(`${s.what} ${tag}: seal fill ${info.waybill.fillPct}% != ${info.waybill.wantPct}%`);
    console.log(s.what, tag, JSON.stringify(info));
    await page.screenshot({ path: `docs/shots/m17-${s.what}-${tag}.jpg`, type: 'jpeg', quality: 70, timeout: 120000 });
    await ctx.close();
  }
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
