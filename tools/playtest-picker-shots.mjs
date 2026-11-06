// The moderator's playtest screen (D-189..D-191) on a built game: a short press on the menu title does nothing,
// a 3 s press opens the screen; a start reloads into the protocol's setup on a no-save page (`pt=`), the trial
// is recorded, and back in the menu the screen copies one results row with the template's column count.
// Writes nothing to the save store. Built game: npm run build; npx vite preview --port 5194 --strictPort.
//   node tools/playtest-picker-shots.mjs [baseUrl] -> docs/shots/playtest-picker-*.jpg (412x915)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv.slice(2).find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5194/';
const columns = readFileSync('docs/playtest/results-template.csv', 'utf8').split(/\r?\n/)[0].split(',');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(180000);
const errors = [];
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok ' : 'BAD'} ${what}`); if (!ok) bad++; };
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const ready = () => page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
const shot = async (name) => (await page.waitForTimeout(700), page.screenshot({ path: `docs/shots/playtest-picker-${name}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 }));
const press = async (ms) => {
  const box = await page.locator('.menu-head .title').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
  await page.waitForTimeout(400);
};
const picker = () => page.locator('.sheet .pt-starts').count();
const savedSlots = () => page.evaluate(() => new Promise((res) => {
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

// 1. a plain release menu: no debug flag, the screen is hidden
await page.goto(`${base}?lang=pl&quality=low&dynres=0`);
await ready();
await page.waitForSelector('.menu-head .title');
await press(1200);
check(await picker() === 0, 'a 1.2 s press on the title opens nothing');
await press(3300);
check(await picker() === 1, 'a 3.3 s press on the title opens the playtest screen');
await shot('menu');
await page.locator('.pt-codes .btn', { hasText: 'P03' }).click();
await page.locator('#pt-dev').fill('Pixel 7, Android 15');
await page.locator('.sheet .sheet-body').evaluate((el) => { el.scrollTop = el.scrollHeight; });
await page.waitForTimeout(300);
await shot('starts');

// 2. S4: the fixture on a no-save trial page
await Promise.all([page.waitForNavigation(), page.locator('.pt-start[data-id="S4"]').click()]);
await ready();
await page.waitForTimeout(1200);
const q = new URL(page.url()).searchParams;
check(q.get('fixture') === 'bridge-jam' && q.get('debug') === '1' && q.get('pt') === 'S4' && q.get('pid') === 'P03'
  && q.get('dev') === 'Pixel 7, Android 15' && q.get('lang') === 'pl', `trial URL ${page.url()}`);
const fx = await page.evaluate(() => window.__marchia.fixture);
check(fx?.ok === true, `fixture ok (${JSON.stringify(fx)})`);
// the participant: a touch on the map, then the jammed wagon's card ("Why is it stalled?")
await page.touchscreen.tap(206, 420);
await page.waitForTimeout(700);
await page.evaluate(() => window.__marchia.app.go('wagon', 11, true));
await page.waitForTimeout(800);
await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); });
await page.evaluate(() => window.__marchia.app.showMenu());
await page.waitForSelector('.menu-head .title');
await page.waitForTimeout(600);
await press(3300);
check(await picker() === 1, 'the screen opens again from the trial page menu');
await page.locator('.pt-copy').click();
await page.waitForTimeout(500);
const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => '<no clipboard>'));
const cells = clip.split(','); // the test row has no quoted commas except the device note
console.log(`   row: ${clip}`);
const at = (c) => {
  // re-split respecting quotes for the device note
  const out = []; let cur = '', qq = false;
  for (let i = 0; i < clip.length; i++) {
    const ch = clip[i];
    if (qq) { if (ch === '"' && clip[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') qq = false; else cur += ch; }
    else if (ch === '"') qq = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out[columns.indexOf(c)];
};
check(cells.length >= columns.length, `row cells ${cells.length} for ${columns.length} columns`);
check(at('participant_id') === 'P03' && at('scenario_id') === 'S4' && at('fixture_id') === 'bridge-jam' && at('setup_method') === 'fixture'
  && at('device') === 'Pixel 7, Android 15' && at('fixture_hash') === fx.hash && at('opened_why') === '1' && at('opened_wagon') === '1'
  && Number(at('taps')) >= 1 && at('auto_why_open_s') !== '' && at('time_s') === '' && at('correct') === '', 'row fields');
await shot('copied');
const slots = await savedSlots();
check(slots.length === 0, `no save slots written (${slots.join(', ') || 'none'})`);
await ctx.close();
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
console.log(`PICKER bad=${bad + errors.length}`);
process.exit(bad + errors.length ? 1 : 0);
