// Idle wagons at the stable (BACKLOG P3, D-43): m1 with the bot's bridge and a dozen extra wagons bought
// (debug: silver topped up), camera on the stable -> docs/shots/stable-<tag>-<size>.jpg at 412x915, 915x412,
// 904x1000. Prints how many wagons wait at the gate and how many distinct drawn positions they have.
// Usage: node tools/stable-shots.mjs <baseUrl> <tag>
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
];

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const size of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1, isMobile: size.mobile, hasTouch: size.mobile });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${size.w}x${size.h}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${size.w}x${size.h}: ${m.text()}`); });
  await page.goto(`${url}?play=m1&quality=low&dynres=0&speed=0&bot=1&lang=pl`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 90000 });
  await page.evaluate(() => {
    const app = window.__marchia.app;
    const st = app.world.state;
    const stable = st.buildings.find((b) => b.type === 'stable');
    st.coins += 100000; // debug: a fleet bigger than the mission budget
    for (let i = 0; i < 12; i++) app.loop.enqueue({ t: 'buyWagon', stable: stable.id });
    app.loop.flushCommands();
    for (let i = 0; i < 40; i++) app.loop.tickOnce();
    const W = app.world.terrain.w;
    const cx = (stable.x + stable.w / 2) * 4, cz = (stable.y + stable.h / 2 + 1) * 4;
    app.view.rig.set(cx, cz, 70, -0.35);
    void W;
  });
  // the drawn rigs ease into their places in render time (a few frames a second in software GL): wait for it
  for (let k = 0; k < 120; k++) {
    await page.waitForTimeout(500);
    const moving = await page.evaluate(() => {
      const v = window.__marchia.app.view;
      let n = 0;
      for (const w of window.__marchia.app.world.state.wagons) {
        const s = v.wagons.get(w.id);
        if (s && s.park && (Math.hypot(s.fx - s.park.x, s.fz - s.park.z) > 0.3 || Math.abs(Math.sin(s.heading - s.park.heading)) > 0.05)) n++;
      }
      return n;
    });
    if (moving === 0) break;
  }
  const info = await page.evaluate(() => {
    const app = window.__marchia.app;
    const st = app.world.state;
    const stable = st.buildings.find((b) => b.type === 'stable');
    const waiting = st.wagons.filter((w) => w.next < 0 && w.at === stable.gate);
    const pos = new Set(waiting.map((w) => { const s = app.view.wagons.get(w.id); return s && s.visible ? `${Math.round(s.fx)},${Math.round(s.fz)}` : 'hidden'; }));
    const hidden = waiting.filter((w) => !app.view.wagons.get(w.id)?.visible).length;
    return { waiting: waiting.length, places: [...pos].filter((p) => p !== 'hidden').length, hidden };
  });
  console.log(`${size.w}x${size.h}: ${info.waiting} wagons waiting at the stable gate, ${info.places} distinct drawn places, ${info.hidden} hidden`);
  const f = resolve(outDir, `stable-${tag}-${size.w}x${size.h}.jpg`);
  await page.screenshot({ path: f, type: 'jpeg', quality: 80 });
  console.log('shot', f.replace(root + '/', ''));
  await ctx.close();
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
