// UI round 3 verification shots -> docs/shots/ui3-*.png: menu with missions IV–VI, mission V waybill in
// tranches, mission IV ice on the bridge, mission VI small granary, free valley plaque + market sheet,
// build shelf, placement ghost (valid / invalid), undo, rank-up letter.
// Usage: node tools/ui3-shots.mjs [filter...]   (filters match scenario or device names)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'docs/shots');
mkdirSync(out, { recursive: true });
const filters = process.argv.slice(2);

const DEVICES = [
  { id: '412x915', w: 412, h: 915, mobile: true },
  { id: '915x412', w: 915, h: 412, mobile: true },
  { id: 'fold-inner-land', w: 874, h: 787, mobile: true },
  { id: 'fold-flex', w: 874, h: 787, mobile: true, hinge: 393 },
];

const { createServer } = await import('vite');
const server = await createServer({ root, server: { port: 5177, strictPort: false, host: '127.0.0.1', hmr: false }, logLevel: 'warn' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-experimental-web-platform-features'] });
const errors = [];

async function open(q, d) {
  const ctx = await browser.newContext({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: 1, isMobile: d.mobile, hasTouch: d.mobile });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const metrics = () => cdp.send('Emulation.setDeviceMetricsOverride', {
    width: d.w, height: d.h, deviceScaleFactor: 1, mobile: true,
    ...(d.hinge ? { displayFeature: { orientation: 'horizontal', offset: d.hinge, maskLength: 0 } } : {}),
  });
  if (d.hinge) await metrics();
  page.on('pageerror', (e) => errors.push(`${q}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${q}: ${m.text()}`); });
  await page.goto(`${base}?quality=low&dynres=0&lang=pl&${q}`);
  await page.waitForFunction(() => window.__marchia?.ready, null, { timeout: 180000 });
  if (d.hinge) await metrics();
  await page.waitForTimeout(2500);
  return { page, ctx, cdp };
}

async function shot(o, name) {
  const file = resolve(out, `ui3-${name}.png`);
  try {
    // CDP capture keeps the emulated hinge (page.screenshot re-applies Playwright's metrics)
    const { data } = await o.cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(file, Buffer.from(data, 'base64'));
    console.log('  ui3-' + name);
  } catch (e) { console.log('  FAILED ui3-' + name, e.message.split('\n')[0]); }
}

/** Put the ghost on the first screen point (spiral from the centre) whose placement is ok / refused. */
async function ghostAt(page, wantOk) {
  return page.evaluate((want) => {
    const app = window.__marchia.app;
    const b = app.build;
    const cv = document.getElementById('scene').getBoundingClientRect();
    const cx = cv.width * 0.45, cy = cv.height * 0.4;
    for (let r = 0; r < 400; r += 14) {
      for (let a = 0; a < 360; a += r ? Math.max(8, 600 / r) : 360) {
        const x = cx + Math.cos(a * Math.PI / 180) * r, y = cy + Math.sin(a * Math.PI / 180) * r * 0.8;
        b.tap(x, y);
        const res = b.result;
        if (res && res.ok === want && (want || 'cell' in res.err)) return { x, y, ok: res.ok, err: res.ok ? null : res.err.k };
      }
    }
    return null;
  }, wantOk);
}

const SCENARIOS = {
  async menu(d) {
    const o = await open('', d);
    await shot(o, `menu-${d.id}`);
    await o.ctx.close();
  },
  async m5(d) {
    // first letter delivered (sealed), second now due, third later
    const o = await open('play=m5&ff=215&speed=0', d);
    await shot(o, `m5-waybill-${d.id}`);
    await o.ctx.close();
  },
  async m4(d) {
    const o = await open('play=m4&ff=230&speed=0&wagon=closed', d);
    await o.page.waitForTimeout(800);
    await shot(o, `m4-ice-${d.id}`);
    await o.ctx.close();
  },
  async m6(d) {
    if (d.id !== '412x915') return;
    const o = await open('play=m6&ff=150&speed=0&open=warehouse', d);
    await shot(o, `m6-granary-${d.id}`);
    await o.ctx.close();
  },
  async plaque(d) {
    const o = await open('play=sandbox&ff=300&speed=0', d);
    await shot(o, `plaque-${d.id}`);
    await o.page.evaluate(() => window.__marchia.app.openMarket());
    await o.page.waitForTimeout(3500);
    await shot(o, `market-${d.id}`);
    await o.page.keyboard.press('Escape');
    await o.page.waitForTimeout(1500);
    await o.page.evaluate(() => window.__marchia.rankUp(1));
    await o.page.waitForTimeout(2500);
    await shot(o, `rankup-${d.id}`);
    await o.ctx.close();
  },
  async build(d) {
    const o = await open('play=sandbox&ff=420&speed=0&tool=build', d);
    await shot(o, `shelf-${d.id}`);
    await o.page.evaluate(() => window.__marchia.app.build.pick('farm'));
    await o.page.waitForTimeout(1500);
    const ok = await ghostAt(o.page, true);
    await o.page.waitForTimeout(2500);
    console.log('   valid ghost', JSON.stringify(ok));
    await shot(o, `ghost-ok-${d.id}`);
    const bad = await ghostAt(o.page, false);
    await o.page.waitForTimeout(2500);
    console.log('   invalid ghost', JSON.stringify(bad));
    await shot(o, `ghost-bad-${d.id}`);
    // back to a valid spot and place it: undo button (+ gap finder when the gate is cut off)
    await ghostAt(o.page, true);
    await o.page.evaluate(() => window.__marchia.app.build.confirm());
    await o.page.waitForTimeout(3500);
    await shot(o, `placed-${d.id}`);
    // a connected placement keeps the shelf and shows the floating undo button
    await o.page.keyboard.press('Escape');
    await o.page.evaluate(() => { const a = window.__marchia.app; a.setTool('build'); a.build.pick('woodcutter'); });
    await o.page.waitForTimeout(800);
    const near = await o.page.evaluate(() => {
      const a = window.__marchia.app, b = a.build, cv = document.getElementById('scene').getBoundingClientRect();
      for (let y = 60; y < cv.height - 60; y += 9) for (let x = 20; x < cv.width - 20; x += 9) {
        b.tap(x, y);
        if (b.result?.ok && b.tagSub.classList.contains('is-warn') === false) return { x, y };
      }
      return null;
    });
    console.log('   connected spot', JSON.stringify(near));
    if (near) { await o.page.evaluate(() => window.__marchia.app.build.confirm()); }
    await o.page.waitForTimeout(3000);
    await shot(o, `undo-${d.id}`);
    await o.ctx.close();
  },
};

for (const d of DEVICES) {
  for (const [name, fn] of Object.entries(SCENARIOS)) {
    if (filters.length && !filters.some((f) => name.includes(f) || d.id.includes(f))) continue;
    if (d.hinge && !['build', 'plaque', 'menu'].includes(name)) continue;
    console.log(`${name} @ ${d.id}`);
    try { await fn(d); } catch (e) { console.log('  ERROR', e.message.split('\n')[0]); }
  }
}
await browser.close();
await server.close();
if (errors.length) console.log('ERRORS:\n' + errors.slice(0, 30).join('\n'));
