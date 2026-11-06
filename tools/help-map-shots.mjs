// Help from the map (D-254): a building card with its "?" and the help sheet it opens. Built game:
//   npm run build; npx vite preview --port 5198 --strictPort
//   node tools/help-map-shots.mjs [baseUrl] [WxH ...] -> docs/shots/helpmap-<id>-<w>x<h>.jpg
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const base = args[0] ?? 'http://127.0.0.1:5198/';
const sizes = (args.slice(1).length ? args.slice(1) : ['412x915', '915x412', '904x1000']).map((s) => s.split('x').map(Number));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let bad = 0;
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'pl-PL' });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(300000);
  page.on('pageerror', (e) => { bad++; console.log('PAGEERROR', e.message); });
  await page.goto(base + '?debug=1&lang=pl&quality=low&play=1&tut=0');
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
    const vis = await page.evaluate(() => { const b = document.querySelector('#sheets .sheet:last-child .sh-help'); return !!b && !b.hidden && b.getBoundingClientRect().width; });
    console.log(`${w}x${h} ${kind} help button`, vis);
    if (!vis) bad++;
    await page.screenshot({ path: `docs/shots/helpmap-${kind}-${w}x${h}.jpg`, type: 'jpeg', quality: 62, timeout: 300000 });
    await page.locator('#sheets .sheet:last-child .sh-help').tap({ timeout: 30000 });
    await page.waitForTimeout(900);
    const res = await page.evaluate(() => ({ kind: document.querySelector('#sheets .sheet:last-child')?.dataset.kind, topic: document.querySelector('.help-topic.is-open .help-tog')?.dataset.topic, q: !document.querySelector('#sheets .sheet:last-child .sh-help')?.hidden }));
    console.log(`${w}x${h} ${kind} ->`, JSON.stringify(res));
    if (res.kind !== "help" || res.q) bad++;
    await page.screenshot({ path: `docs/shots/helpmap-${kind}-help-${w}x${h}.jpg`, type: 'jpeg', quality: 62, timeout: 300000 });
    await page.evaluate(() => window.__marchia.app.sheets.closeAll());
    await page.waitForTimeout(500);
  }
  await ctx.close();
}
await browser.close();
console.log(bad ? `FAIL ${bad}` : 'OK');
process.exit(bad ? 1 : 0);
