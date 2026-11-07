// Mission XVI screenshots (D-288..D-291): the opening letter, the castle pace card on the HUD with the two-castle
// waybill (0:20), the east castle's card with the rival line and the "Ten zamek pierwszy" switch (2:30, even split),
// and the same card after one tap on the switch; D-307: with the east castle first from 0:00, the haul card "Kup wóz" on
// the HUD at 1:30 and the sawmill's sheet it opens.
// Usage: [ONLY=regex] node tools/m16-shots.mjs [baseUrl] [WxH ...]  (server: npm run build; npx vite preview --port 5231 --strictPort)
// -> docs/shots/m16-<what>-<w>x<h>.jpg
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:5231/';
const sizes = (process.argv.slice(3).length ? process.argv.slice(3) : ['412x915', '915x412', '904x1000']).map((s) => s.split('x').map(Number));
const lang = process.env.LANG_Q ?? 'pl';
mkdirSync('docs/shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
// building ids in m16: 5 = Zamek Wschodni (main contract), 6 = Zamek Północny
const SHOTS = [
  { what: 'letter', q: 'speed=0', letter: true },
  { what: 'card', q: 'ff=20&speed=0' },
  { what: 'castle', q: 'ff=150&speed=0&openId=5' },
  { what: 'switch', q: 'ff=40&speed=0&openId=5', tap: true },
  { what: 'haul', q: 'speed=0', haul: 90 },
  { what: 'haulsheet', q: 'speed=0', haul: 90, sheet: true },
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
    await page.goto(`${base}?play=m16&quality=low&dynres=0&debug=1&lang=${lang}&${s.q}`);
    await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
    await page.waitForTimeout(2000);
    if (s.letter) {
      await page.evaluate(() => { const A = window.__marchia.app; A.debugStart = false; A.newGame('m16'); });
      await page.waitForTimeout(1500);
    } else {
      const start = page.locator('.letter [data-a="start"]');
      if (await start.count()) { await start.first().click(); await page.waitForTimeout(800); }
      await page.waitForTimeout(1500);
    }
    if (s.haul) {
      // east first at 0:00, then the app's own loop to the given second (the pace and fleet logs sample every tick)
      const k = await page.evaluate(([sec, sheet]) => {
        const A = window.__marchia.app;
        A.loop.enqueue({ t: 'castleFirst', castle: 5 }); A.loop.flushCommands();
        while (A.world.state.tick < sec * 10) A.loop.tickOnce();
        return A.world.state.tick;
      }, [s.haul, !!s.sheet]);
      await page.waitForTimeout(2000);
      // the sheet as the player gets it: one tap on the card
      if (s.sheet) {
        await page.locator('.stall-eye').first().click();
        // software GL renders a frame every few seconds after the forward: wait for the entrance (two frames), then
        // drop the class that only animates it
        await page.waitForFunction(() => !document.querySelector('#sheets .sheet.is-entering'), null, { timeout: 30000 }).catch(() => {});
        await page.evaluate(() => document.querySelectorAll('#sheets .sheet.is-entering').forEach((e) => e.classList.remove('is-entering')));
        await page.waitForFunction(() => [...document.querySelectorAll('#sheets .sheet')].every((e) => getComputedStyle(e).opacity === '1'), null, { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(4000);
      }
      if (!(await page.locator('.stall-row.is-pace').count())) errors.push(`${s.what} ${tag}: no pace card at tick ${k}`);
    }
    if (s.tap) {
      const btn = page.locator('[data-act="first:5"]');
      if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(1200); }
      else errors.push(`${s.what} ${tag}: no switch on the castle card`);
    }
    const info = await page.evaluate(() => ({
      letter: document.querySelector('.letter')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 160) ?? null,
      card: document.querySelector('.stall-card')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      waybill: document.querySelector('.wb-castles')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      sheet: document.querySelector('#sheets .sheet:last-child')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 400) ?? null,
    }));
    console.log(s.what, tag, JSON.stringify(info));
    await page.screenshot({ path: `docs/shots/m16-${s.what}-${tag}.jpg`, type: 'jpeg', quality: 70, timeout: 120000 });
    await ctx.close();
  }
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
