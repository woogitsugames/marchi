// Camera vs open sheet (BACKLOG P2, D-43): opens a building sheet in m1 and measures where the selected
// building's marker (stall bubble, above the roof) lands relative to the sheet, at 412x915, 915x412, 904x1000
// (+ RTL at 915x412 and 904x1000), opened by navigation (?open=) and by a tap on a building sitting where the sheet
// docks. Writes docs/shots/camera-<tag>[-tap]-<size>.jpg for the first building.
// Usage: node tools/camera-shots.mjs <baseUrl> <tag>     e.g. node tools/camera-shots.mjs http://127.0.0.1:4173/ after
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'docs/shots');
mkdirSync(outDir, { recursive: true });
const [url = 'http://127.0.0.1:4173/', tag = 'after'] = process.argv.slice(2);

const SIZES = [
  { w: 412, h: 915, mobile: true },
  { w: 915, h: 412, mobile: true },
  { w: 904, h: 1000, mobile: false },
  { w: 915, h: 412, mobile: true, lang: 'ar' },
  { w: 904, h: 1000, mobile: false, lang: 'ar' },
];
const BUILDINGS = ['bakery', 'mill', 'farm', 'sawmill', 'warehouse'];

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const rows = [];

/** Building marker (stall bubble) and gate on screen, and the sheet's rect. */
const probe = (page, type) => page.evaluate((type) => {
  const app = window.__marchia.app;
  const bd = app.world.state.buildings.find((q) => q.type === type);
  const a = app.view.anchorOf('building', bd.id);
  const g = app.view.cellToScreen(bd.gate);
  const el = [...document.querySelectorAll('#sheets .sheet:not(.is-leaving)')].pop();
  const r = el ? el.getBoundingClientRect() : null;
  return { x: a.x, y: a.y, visible: a.visible, gx: g.x, gy: g.y, id: bd.id, sheet: r && { l: r.left, t: r.top, r: r.right, b: r.bottom } };
}, type);

// software GL renders a few frames a second: wait until the camera has settled
async function settle(page, type) {
  let last = null;
  for (let k = 0; k < 40; k++) {
    await page.waitForTimeout(400);
    const a = await probe(page, type);
    if (last && Math.abs(a.x - last.x) + Math.abs(a.y - last.y) < 1.5) return a;
    last = a;
  }
  return last;
}

function row(size, b, how, m) {
  const s = m.sheet;
  const bottom = s.b >= size.h - 2 && s.l <= 2 && s.r >= size.w - 2;
  const left = !bottom && (s.l + s.r) / 2 < size.w / 2;
  // clearance from the sheet edge (positive = outside the sheet, on the free part of the screen)
  // (a short side sheet: a point above or below it is clear too)
  const clear = (x, y) => Math.round(bottom ? s.t - y : Math.max(left ? x - s.r : s.l - x, y - s.b, s.t - y));
  const under = (x, y) => x >= s.l && x <= s.r && y >= s.t && y <= s.b;
  rows.push({
    size: `${size.w}x${size.h}${size.lang ? ' ' + size.lang : ''}`, b, how,
    sheet: bottom ? `bottom t=${Math.round(s.t)}` : `${left ? 'left' : 'right'} x ${Math.round(s.l)}..${Math.round(s.r)} y ${Math.round(s.t)}..${Math.round(s.b)}`,
    marker: `${Math.round(m.x)},${Math.round(m.y)}`, clear: clear(m.x, m.y), gateClear: clear(m.gx, m.gy),
    hidden: !m.visible || under(m.x, m.y) || under(m.gx, m.gy),
  });
}

for (const size of SIZES) {
  for (const [i, b] of BUILDINGS.entries()) {
    const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1, isMobile: size.mobile, hasTouch: size.mobile });
    const page = await ctx.newPage();
    const name = `${size.w}x${size.h}${size.lang ? '-' + size.lang : ''} ${b}`;
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
    // 1) ?open= (navigation: PanelNav.go with focus)
    await page.goto(`${url}?play=m1&quality=low&dynres=0&speed=0&ff=90&lang=${size.lang ?? 'pl'}&open=${b}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 90000 });
    const m = await settle(page, b);
    row(size, b, 'open', m);
    if (i === 0) {
      const f = resolve(outDir, `camera-${tag}-${size.w}x${size.h}${size.lang ? '-' + size.lang : ''}.jpg`);
      await page.screenshot({ path: f, type: 'jpeg', quality: 80 });
      console.log('shot', f.replace(root + '/', ''));
    }
    // 2) tap on a building that sits where the sheet will be (the reported case): close, pan the building
    //    under the centre of the sheet's rect, open it the way a tap does (no explicit focus)
    const s = m.sheet;
    const want = { x: (s.l + s.r) / 2, y: Math.min(size.h - 60, (s.t + s.b) / 2) };
    await page.evaluate(() => window.__marchia.app.sheets.closeAll());
    for (let k = 0; k < 3; k++) {
      const a = await settle(page, b);
      await page.evaluate(([dx, dy]) => window.__marchia.app.view.camera.pan(dx, dy), [want.x - a.x, want.y - a.y]);
    }
    await settle(page, b);
    await page.evaluate((id) => window.__marchia.app.go('building', id, false), m.id);
    row(size, b, 'tap', await settle(page, b));
    if (i === 0) {
      const f = resolve(outDir, `camera-${tag}-tap-${size.w}x${size.h}${size.lang ? '-' + size.lang : ''}.jpg`);
      await page.screenshot({ path: f, type: 'jpeg', quality: 80 });
      console.log('shot', f.replace(root + '/', ''));
    }
    await ctx.close();
  }
}
await browser.close();
console.table(rows);
for (const how of ['open', 'tap']) {
  const r = rows.filter((q) => q.how === how);
  console.log(`${tag} ${how}: ${r.filter((q) => q.hidden).length}/${r.length} marker or gate under the sheet / off screen; median marker clearance ${r.map((q) => q.clear).sort((a, b) => a - b)[r.length >> 1]} px, min ${Math.min(...r.map((q) => q.clear))} px`);
}
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
