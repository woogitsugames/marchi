// Help from the map (D-254): a building card with its "?" and the help sheet it opens. Built game:
//   npm run build; npx vite preview --port 5198 --strictPort
//   node tools/help-map-shots.mjs [baseUrl] [WxH ...] [--lang pl] -> docs/shots/helpmap-<id>-<w>x<h>.jpg
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const argv = process.argv.slice(2);
const li = argv.indexOf('--lang');
const lang = li >= 0 ? argv[li + 1] : 'pl';
const args = argv.filter((a, i) => li < 0 || (i !== li && i !== li + 1));
const suffix = lang === 'pl' ? '' : `-${lang}`;
const OUT = process.env.SHOTS_DIR ?? 'docs/shots';
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5198/';
const picked = args.filter((a) => /^\d+x\d+$/.test(a));
const sizes = (picked.length ? picked : ['412x915', '915x412', '904x1000']).map((s) => s.split('x').map(Number));
// settle: the sheet's slide-in (CSS transition) has finished before a screenshot, also on a loaded machine
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let bad = 0;
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(300000);
  page.on('pageerror', (e) => { bad++; console.log('PAGEERROR', e.message); });
  await page.goto(base + `?debug=1&lang=${lang}&quality=low&play=m1&ff=60&speed=0&tut=0`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 300000 });
  await page.waitForTimeout(1500);
  for (const [kind, open] of [['building', 'b'], ['wagon', 'w']]) {
    const ok = await page.evaluate((open) => {
      const a = window.__marchia.app; const st = a.world.state;
      if (open === 'b') { const b = st.buildings.find((x) => x.type === 'castle') ?? st.buildings[0]; a.go('building', b.id, true); return true; }
      const wg = st.wagons[0]; if (!wg) return false; a.go('wagon', wg.id, true); return true;
    }, open);
    if (!ok) continue;
    await page.waitForTimeout(1200);
    await page.waitForFunction(() => { const s = document.querySelector('#sheets .sheet:last-child'); if (!s) return false; const cs = getComputedStyle(s); return cs.opacity === '1' && (cs.transform === 'none' || cs.transform === 'matrix(1, 0, 0, 1, 0, 0)'); }, null, { timeout: 30000 }).catch(() => {});
    const vis = await page.evaluate(() => { const b = document.querySelector('#sheets .sheet:last-child .sh-help'); return !!b && !b.hidden && b.getBoundingClientRect().width; });
    console.log(`${w}x${h} ${kind} help button`, vis);
    // RTL: the "?" is mirrored like the Arabic question mark (D-284)
    if (lang === 'ar') {
      const tf = await page.evaluate(() => getComputedStyle(document.querySelector('#sheets .sheet:last-child .sh-help')).transform);
      console.log(`${w}x${h} ${kind} rtl glyph`, tf);
      if (!tf.startsWith('matrix(-1')) bad++;
    }
    if (!vis) bad++;
    await page.screenshot({ path: `${OUT}/helpmap-${kind}${suffix}-${w}x${h}.jpg`, type: 'jpeg', quality: 62, timeout: 300000 });
    await page.locator('#sheets .sheet:last-child .sh-help').tap({ timeout: 30000 });
    await page.waitForTimeout(900);
    await page.waitForFunction(() => { const s = document.querySelector('#sheets .sheet:last-child'); if (!s) return false; const cs = getComputedStyle(s); return cs.opacity === '1' && (cs.transform === 'none' || cs.transform === 'matrix(1, 0, 0, 1, 0, 0)'); }, null, { timeout: 30000 }).catch(() => {});
    // the opened topic's answer is in view (D-286: on a short landscape sheet it lay under the fold)
    await page.waitForFunction(() => {
      const p = document.querySelector('.help-topic.is-open .help-p'), body = document.querySelector('#sheets .sheet:last-child .sheet-body');
      return !!p && !!body && p.getBoundingClientRect().top < body.getBoundingClientRect().bottom - 24;
    }, null, { timeout: 15000 }).catch(() => {});
    const res = await page.evaluate(() => {
      const p = document.querySelector('.help-topic.is-open .help-p'), body = document.querySelector('#sheets .sheet:last-child .sheet-body');
      const inView = !!p && !!body && p.getBoundingClientRect().top < body.getBoundingClientRect().bottom - 24;
      return { kind: document.querySelector('#sheets .sheet:last-child')?.dataset.kind, topic: document.querySelector('.help-topic.is-open .help-tog')?.dataset.topic, q: !document.querySelector('#sheets .sheet:last-child .sh-help')?.hidden, inView };
    });
    console.log(`${w}x${h} ${kind} ->`, JSON.stringify(res));
    if (res.kind !== "help" || res.q || !res.inView) bad++;
    await page.screenshot({ path: `${OUT}/helpmap-${kind}-help${suffix}-${w}x${h}.jpg`, type: 'jpeg', quality: 62, timeout: 300000 });
    await page.evaluate(() => window.__marchia.app.sheets.closeAll());
    await page.waitForTimeout(500);
  }
  await ctx.close();
}
await browser.close();
console.log(bad ? `FAIL ${bad}` : 'OK');
process.exit(bad ? 1 : 0);
