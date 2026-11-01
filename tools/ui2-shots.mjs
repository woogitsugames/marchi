// UI round 2 verification shots -> docs/shots/ui2-*.png (tutorial steps, gap finder, end-letter ledger, RTL/de/ja).
// Usage: node tools/ui2-shots.mjs [filter...]
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'docs/shots');
mkdirSync(out, { recursive: true });
const filters = process.argv.slice(2);
const want = (n) => !filters.length || filters.some((f) => n.includes(f));

const { createServer } = await import('vite');
const server = await createServer({ root, server: { port: 5176, strictPort: false, host: '127.0.0.1', hmr: false }, logLevel: 'warn' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];

async function open(q, w = 412, h = 915) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < h, hasTouch: w < h });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${q}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${q}: ${m.text()}`); });
  await page.goto(`${base}?quality=low&dynres=0&${q}`);
  await page.waitForFunction(() => window.__marchia?.ready, null, { timeout: 180000 });
  await page.waitForTimeout(900);
  return { page, ctx };
}
const shot = async (page, name) => {
  try { await page.screenshot({ path: resolve(out, `ui2-${name}.png`), timeout: 90000 }); console.log('  ui2-' + name); }
  catch (e) { console.log('  FAILED ui2-' + name, e.message.split('\n')[0]); }
};
const step = (page) => page.evaluate(() => window.__marchia.app.tutorial?.current ?? 0);

async function tutorial(w, h) {
  const tag = `${w}x${h}`;
  const { page, ctx } = await open('play=m1&tut=1', w, h);
  await shot(page, `tut1-${tag}`);
  await page.locator('.wb-line').first().click();
  await page.waitForTimeout(2600);
  console.log('   step', await step(page));
  await shot(page, `tut2-${tag}`);
  await page.locator('#sheets .chain button[data-go]:not([disabled])').first().click();
  await page.waitForTimeout(2200);
  console.log('   step', await step(page));
  await shot(page, `tut3-${tag}`);
  const link = page.locator('#sheets .chain button[data-go]:not([disabled])').first();
  if (await link.count()) await link.click();
  await page.waitForTimeout(4500);
  console.log('   step', await step(page));
  await shot(page, `tut4-${tag}`);
  await page.locator('.rail [data-tool="road"]').click();
  await page.waitForTimeout(700);
  console.log('   step', await step(page));
  await shot(page, `tut5-${tag}`);
  await page.evaluate(() => { const a = window.__marchia.app; a.buildRoad(a.tutorial.crossing().cells); });
  await page.waitForTimeout(900);
  await page.keyboard.press('Escape'); // tool off
  await page.waitForTimeout(300);
  console.log('   step', await step(page));
  await shot(page, `tut6-${tag}`);
  await page.locator('.wb-line').first().click();
  await page.waitForTimeout(1300);
  await shot(page, `tut6-coda-${tag}`);
  await page.waitForTimeout(2600);
  console.log('   after coda', await step(page), await page.evaluate(() => localStorage.getItem('marchia.prefs')));
  await ctx.close();
}

if (want('tut')) { await tutorial(412, 915); await tutorial(915, 412); }
if (want('gap')) {
  for (const [w, h] of [[412, 915], [915, 412], [904, 1000]]) {
    const { page, ctx } = await open('play=m1&ff=60&speed=0&open=mill', w, h);
    await page.waitForTimeout(600);
    await shot(page, `gap-mill-${w}x${h}`);
    await ctx.close();
    if (w === 412) {
      const { page: p2, ctx: c2 } = await open('play=m1&ff=60&speed=0&open=bakery', w, h);
      await shot(p2, `gap-bakery-${w}x${h}`); await c2.close();
    }
  }
}
if (want('end')) {
  for (const [q, n] of [['play=m1&bot=1&ff=600', 'end-won'], ['play=m1&ff=720', 'end-lost']]) {
    for (const [w, h] of [[412, 915], [915, 412]]) {
      const { page, ctx } = await open(q + '&lang=pl', w, h);
      await page.waitForTimeout(500);
      await shot(page, `${n}-${w}x${h}`); await ctx.close();
    }
  }
}
if (want('lang')) {
  for (const l of ['ar', 'de', 'ja']) {
    const { page, ctx } = await open(`play=m1&ff=90&speed=0&lang=${l}`);
    await shot(page, `${l}-hud-412x915`);
    await page.evaluate(() => { const a = window.__marchia.app; const b = a.world.state.buildings.find((x) => x.type === 'bakery'); a.go('building', b.id, true); });
    await page.waitForTimeout(700);
    await shot(page, `${l}-why-412x915`);
    await page.evaluate(() => { const a = window.__marchia.app; const w = a.world.state.wagons.find((x) => x.status.k !== 'IDLE'); if (w) a.go('wagon', w.id, true); });
    await page.waitForTimeout(700);
    await shot(page, `${l}-wagon-412x915`);
    await ctx.close();
    const e = await open(`play=m1&ff=720&lang=${l}`);
    await e.page.waitForTimeout(500);
    await shot(e.page, `${l}-end-412x915`); await e.ctx.close();
  }
  // live switch: tool labels must follow
  const { page, ctx } = await open('play=m1&speed=0&lang=en');
  await page.evaluate(async () => { const m = await import('/src/i18n/index.ts'); await m.setLang('de'); });
  await page.waitForTimeout(400);
  console.log('   labels after switch:', await page.locator('.tool .tl').allTextContents(), await page.evaluate(() => [document.documentElement.lang, document.title]));
  await ctx.close();
  for (const l of ['en', 'ar']) {
    const t = await open(`play=m1&tut=1&lang=${l}`);
    await shot(t.page, `tut1-${l}-412x915`); await t.ctx.close();
  }
}
await browser.close();
await server.close();
if (errors.length) { console.log('ERRORS:\n' + errors.slice(0, 20).join('\n')); }
