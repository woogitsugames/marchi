// Onboarding (D-235/D-236): every step of the free-valley build tutorial and the help sheet (pause menu + main
// menu). The player's map gestures (moving the ghost, dragging the road) are replaced by the debug handle; every
// tap the tutorial asks for is a real touch on the ringed control. Built game:
//   npm run build; npx vite preview --port 5194 --strictPort
//   node tools/onboard-shots.mjs [baseUrl] [WxH ...] [--lang pl] -> docs/shots/onboard-<id>-<w>x<h>.jpg
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const li = args.indexOf('--lang');
const lang = li >= 0 ? args[li + 1] : 'pl';
const HELP_ONLY = args.includes('--help-only');
const rest = args.filter((a, i) => a !== '--help-only' && (li < 0 || (i !== li && i !== li + 1)));
const base = rest[0] ?? 'http://127.0.0.1:5194/';
const sizes = (rest.slice(1).length ? rest.slice(1) : ['412x915', '915x412']).map((s) => s.split('x').map(Number));
const suffix = lang === 'pl' ? '' : `-${lang}`;
// a legal woodcutter site in the free valley's northern forest, off the roads, and a track to the castle road
// (sandbox seed; see tests/tutorial-build.test.ts for the same search)
const SITE = { x: 26, y: 14 };
const ROAD = [1563, 1660, 1757, 1854, 1951, 2048, 2145, 2242, 2339, 2340];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let bad = 0;
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'pl-PL' });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(300000);
  page.on('pageerror', (e) => { bad++; console.log('PAGEERROR', e.message); });
  const tap = async (x, y) => { await page.touchscreen.tap(x, y); await page.waitForTimeout(450); };
  // locator.tap waits for the element to be stable (sheets slide in) and scrolls it into view
  const tapSel = async (sel) => { await page.locator(sel).first().tap({ timeout: 30000 }); await page.waitForTimeout(450); };
  const step = () => page.evaluate(() => window.__marchia.app.buildTut?.current ?? -1);
  // frames can take seconds under software GL: let the tutorial run three frames after the last change
  const frames = () => page.evaluate(() => new Promise((r) => { let n = 3; const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }));
  const shot = async (id) => {
    await page.waitForTimeout(400);
    await frames();
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => {
      const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(Math.round); };
      return { step: window.__marchia.app.buildTut?.current ?? -1, note: r(document.querySelector('.tut-note-wrap')), ring: r(document.querySelector('.tut-ring.is-shown')), arrow: !!document.querySelector('.tut-arrow.is-shown'), text: document.querySelector('.tut-text')?.textContent };
    });
    console.log(`${w}x${h} ${id}`, JSON.stringify(info));
    await page.screenshot({ path: `docs/shots/onboard-${id}${suffix}-${w}x${h}.jpg`, type: 'jpeg', quality: 62, timeout: 300000 });
  };
  const waitStep = (s) => page.waitForFunction((s) => (window.__marchia.app.buildTut?.current ?? -1) === s, s, { timeout: 90000 });

  await page.goto(base + `?debug=1&lang=${lang}&quality=low&play=sandbox&tut=build`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 300000 });
  await page.waitForTimeout(1500);
  if (!HELP_ONLY) {
  await shot('s0');
  await tapSel('.tutorial .tut-act');
  await waitStep(1);
  await shot('s1');
  await tapSel('.rail [data-tool="build"]');
  await shot('s1b');
  await tapSel('.build-shelf [data-b="pick:woodcutter"]');
  await waitStep(2);
  await page.evaluate(({ x, y }) => { const a = window.__marchia.app; a.build.facing = 0; a.build.manualFacing = true; const c = (y + 1) * a.world.terrain.w + x + 1; a.build.moveTo(c); a.frameCells([c]); }, SITE);
  await page.waitForTimeout(1500);
  await shot('s2');
  await tapSel('.build-shelf [data-b="place"]');
  await page.waitForFunction(() => (window.__marchia.app.buildTut?.current ?? -1) >= 3, null, { timeout: 90000 });
  if ((await step()) === 3) {
    await shot('s3');
    // portrait: the card's own "Zbuduj drogę" (a real tap); landscape: the player closes the card and drags with the Road tool
    const fix = w < h && await page.evaluate(() => !!document.querySelector('#sheets .sheet:last-child .fix-btn'));
    if (fix) await tapSel('#sheets .sheet:last-child .fix-btn');
    else {
      await tapSel('#sheets .sheet:last-child .close').catch(() => {});
      await page.waitForTimeout(800);
      await shot('s3a');
      await tapSel('.rail [data-tool="road"]');
      await shot('s3b');
      const gate = await page.evaluate((cells) => {
        const a = window.__marchia.app; const hut = a.world.state.buildings.at(-1);
        if (hut.gate === cells[0]) a.buildRoad(cells);
        return hut.gate;
      }, ROAD);
      if (gate !== ROAD[0]) console.log('gate moved to', gate, '- road not drawn');
    }
  }
  await page.waitForFunction(() => (window.__marchia.app.buildTut?.current ?? -1) >= 4, null, { timeout: 90000 });
  if ((await step()) === 4) {
  await shot('s4');
  // a tap on the hut: the ring's centre
  const ring = await page.evaluate(() => { const b = document.querySelector('.tut-ring.is-shown')?.getBoundingClientRect(); return b ? [b.left + b.width / 2, b.top + b.height / 2] : null; });
  if (ring) await tap(ring[0], ring[1]);
  await page.waitForTimeout(1500);
  if ((await step()) === 4) await page.evaluate(() => { const a = window.__marchia.app; a.go('building', a.world.state.buildings.at(-1).id); });
  }
  await page.waitForFunction(() => (window.__marchia.app.buildTut?.current ?? -1) >= 5, null, { timeout: 90000 });
  if ((await step()) === 5) {
    await shot('s5');
    await tapSel('.tut-ring.is-shown');
  }
  await waitStep(6).catch(() => {});
  await shot('s6');
  await tapSel('#sheets .sheet:last-child .close').catch(() => {});
  await page.waitForFunction(() => window.__marchia.app.buildTut === null, null, { timeout: 90000 }).catch(() => {});
  const pref = await page.evaluate(() => ({ tut: window.__marchia.app.buildTut === null, pref: JSON.parse(localStorage.getItem('marchia.prefs') || '{}').tutorialBuild }));
  console.log(`${w}x${h} end`, JSON.stringify(pref));
  if (!pref.tut || pref.pref !== 'done') bad++;
  }

  // help from the pause menu
  await tapSel('.topbar .menu-btn');
  await page.waitForTimeout(500);
  await tapSel('#sheets [data-a="help"]');
  await shot('help-pause');
  await tapSel('#sheets [data-topic="roads"]');
  await shot('help-roads');
  await tapSel('#sheets .sheet:last-child .close');
  await page.waitForTimeout(500);
  // help from the main menu
  await page.goto(base + `?debug=1&lang=${lang}&quality=low`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 300000 });
  await page.waitForTimeout(1200);
  await shot('menu');
  await tapSel('.menu-help');
  await shot('help-menu');
  await ctx.close();
}
await browser.close();
console.log(bad ? `FAIL ${bad}` : 'OK');
process.exit(bad ? 1 : 0);
