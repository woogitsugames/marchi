// Night 6b: mission I tutorial, step 2 (castle card, order and pace folded) and step 4 (the "Droga" ring kept on
// screen). Built game: npm run build; npx vite preview --port 5194 --strictPort.
//   node tools/night6b-tut-shots.mjs [baseUrl] [WxH ...] [--tag before] -> docs/shots/night6b-tut-s{2,4}[-tag]-<w>x<h>.jpg
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const ti = args.indexOf('--tag');
const tag = ti >= 0 ? '-' + args[ti + 1] : '';
const rest = args.filter((a, i) => ti < 0 || (i !== ti && i !== ti + 1));
const base = rest[0] ?? 'http://127.0.0.1:5194/';
const sizes = (rest.slice(1).length ? rest.slice(1) : ['412x915', '915x412']).map((s) => s.split('x').map(Number));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'pl-PL' });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(300000);
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  const tap = async (x, y) => { await page.touchscreen.tap(x, y); await page.waitForTimeout(400); };
  const tapSel = async (sel) => { const b = await page.locator(sel).first().boundingBox(); await tap(b.x + b.width / 2, b.y + b.height / 2); };
  const step = () => page.evaluate(() => window.__marchia.app.tutorial?.current ?? 0);
  const ringTap = async () => {
    const r = await page.evaluate(() => {
      const ring = document.querySelector('.tutorial .tut-ring.is-shown'); if (!ring) return null;
      const b = ring.getBoundingClientRect();
      const wb = document.querySelector('.waybill-wrap:not(.is-collapsed) .wb-line');
      if (wb) { const q = wb.getBoundingClientRect(); if (q.top >= b.top - 2 && q.bottom <= b.bottom + 2) return [q.left + q.width / 2, q.top + q.height / 2]; }
      return [b.left + b.width / 2, b.top + b.height / 2];
    });
    if (r) await tap(r[0], r[1]);
  };
  await page.goto(base + '?debug=1&lang=pl&quality=low');
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 300000 });
  await page.waitForTimeout(1000);
  await tapSel('.menu-item >> nth=0');
  await page.waitForSelector('.letter [data-a="start"]', { timeout: 30000 });
  await page.waitForTimeout(500);
  await tapSel('.letter [data-a="start"]');
  await page.waitForFunction(() => !!document.querySelector('.tutorial .tut-text')?.textContent, null, { timeout: 15000 });
  for (let guard = 0; guard < 20; guard++) {
    const s = await step();
    if (s === 0 || s >= 5) break;
    if (s === 2 || s === 4) {
      await page.waitForTimeout(2500);
      // step 4 in portrait: the card folds away after 2 s, then the ring goes round "Droga"
      if (s === 4) await page.waitForFunction(() => !!document.querySelector('.tutorial .tut-ring.is-shown'), null, { timeout: 8000 }).catch(() => {});
      if (s === 4) await page.waitForTimeout(600);
      const info = await page.evaluate(() => {
        const sh = document.querySelector('#sheets .sheet:last-child');
        const txt = sh ? [...sh.querySelectorAll('.sheet-body > *')].filter((e) => !e.closest('[hidden]')).map((e) => e.innerText).join(' ') : '';
        const ring = document.querySelector('.tutorial .tut-ring.is-shown')?.getBoundingClientRect();
        return { words: txt.split(/\s+/).filter(Boolean).length, fold: !!sh?.querySelector('.sfold'), ring: ring ? [ring.left, ring.top, ring.right, ring.bottom].map((v) => Math.round(v * 10) / 10) : null, vw: innerWidth, vh: innerHeight };
      });
      console.log(`${w}x${h} step ${s}`, JSON.stringify(info));
      await page.screenshot({ path: `docs/shots/night6b-tut-s${s}${tag}-${w}x${h}.jpg`, type: 'jpeg', quality: 60, timeout: 300000 });
    }
    if (s === 4) {
      if (await page.evaluate(() => !!document.querySelector('.tutorial .tut-ring.is-shown'))) await tapSel('.rail [data-tool="road"]');
      await page.waitForFunction(() => window.__marchia.app.tutorial?.current !== 4, null, { timeout: 8000 }).catch(() => {});
      continue;
    }
    await ringTap();
    await page.waitForTimeout(900);
  }
  await ctx.close();
}
await browser.close();
