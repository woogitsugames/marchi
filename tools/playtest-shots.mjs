// Playtest fixture screenshots and checks (D-185, docs/playtest/PROTOCOL.md §3): every ?fixture= setup loads,
// reports ok in window.__marchia.fixture, stays paused, and writes nothing to the save store (also after the
// page is hidden, which normally autosaves). Two shots per fixture: the HUD as the participant gets it, and
// the moderator's preflight card (openId/wagonId). Plus the invalid-setup notice for an unknown id.
// Built game: npm run build; npx vite preview --port 5194 --strictPort.
//   node tools/playtest-shots.mjs [baseUrl] [WxH ...] -> docs/shots/playtest-<id>[-card].jpg
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5194/';
const picked = args.filter((a) => /^\d+x\d+$/.test(a)).map((s) => s.split('x').map(Number));
const sizes = picked.length ? picked : [[412, 915]];
const FIXTURES = ['bridge-cut-in-transit', 'all-busy', 'bridge-jam', 'warehouse-full', 'no-such-setup'];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
let bad = 0;
const savedSlots = (page) => page.evaluate(() => new Promise((res) => {
  const req = indexedDB.open('marchia');
  req.onerror = () => res(['<open failed>']);
  req.onsuccess = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('saves')) { db.close(); res([]); return; }
    const all = db.transaction('saves', 'readonly').objectStore('saves').getAllKeys();
    all.onsuccess = () => { db.close(); res(all.result.map(String)); };
    all.onerror = () => { db.close(); res(['<read failed>']); };
  };
}));
for (const [w, h] of sizes) {
  for (const id of FIXTURES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.setDefaultNavigationTimeout(180000);
    const invalid = id === 'no-such-setup';
    page.on('pageerror', (e) => errors.push(`${id}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !(invalid && m.text().startsWith('[fixture]'))) errors.push(`${id}: ${m.text()}`); });
    const url = `${base}?fixture=${id}&debug=1&lang=pl&quality=low&dynres=0`;
    await page.goto(url);
    await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
    await page.waitForTimeout(1500);
    const fx = await page.evaluate(() => {
      const f = window.__marchia.fixture, app = window.__marchia.app;
      return { ...f, speed: app?.loop?.speed, tick: app?.world.state.tick, notice: document.querySelector('.fixture-invalid')?.textContent ?? null };
    });
    const okWanted = !invalid;
    const fine = okWanted ? fx.ok === true && fx.speed === 0 && !fx.notice : fx.ok === false && !!fx.notice;
    if (!fine) bad++;
    console.log(`${w}x${h} ${id.padEnd(22)} ${fine ? 'ok ' : 'BAD'} ${JSON.stringify(fx)}`);
    await page.screenshot({ path: `docs/shots/playtest-${id}${w === 412 ? '' : `-${w}x${h}`}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
    if (!invalid && fx.focus) {
      // the moderator's preflight view: the same setup with the subject's card open
      const p = fx.focus.kind === 'wagon' ? 'wagonId' : 'openId';
      await page.goto(`${url}&${p}=${fx.focus.id}`);
      await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `docs/shots/playtest-${id}-card${w === 412 ? '' : `-${w}x${h}`}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
    }
    // hiding the page autosaves a normal game; a fixture page must not
    await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); });
    await page.waitForTimeout(600);
    const slots = await savedSlots(page);
    if (slots.length) { bad++; console.log(`   BAD save slots written: ${slots.join(', ')}`); }
    await ctx.close();
  }
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
console.log(`PLAYTEST bad=${bad + errors.length}`);
process.exit(bad + errors.length ? 1 : 0);
