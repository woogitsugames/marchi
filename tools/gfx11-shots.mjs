// Graphics audits 11-13 (D-500.., D-690..): the main scenes against docs/ART_DIRECTION.md, before / after.
// Built game: npm run build; npx vite preview --port 5199 --strictPort.
//   node tools/gfx11-shots.mjs <baseUrl> <tag> [scene,...] [quality,...] [viewport,...]
// -> docs/shots/<prefix>-<tag>-<scene>-<quality>-<w>x<h>.jpg (prefix: env GFX_PREFIX, default gfx11; audit 12 uses gfx12)
// Scenes: menu; missions I, VII, XIII, XVII at their opening (I with the menu bot's bridge and wagons, so the roads
// carry traffic); the free valley with the bench road network (tools/frame-cost-bench.json) in each season at noon,
// and in autumn at dawn / morning / dusk / night. Valley shots hide the HUD (the scene is judged), missions keep it.
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'docs/shots');
mkdirSync(outDir, { recursive: true });
const prefix = process.env.GFX_PREFIX || 'gfx11';
const [base = 'http://127.0.0.1:5199/', tag = 'before', only = '', qualS = 'low,high', vpS = '412x915,915x412'] = process.argv.slice(2);

// season ticks (TICK_HZ 10, 15 min seasons, spring first); spring after the thaw so the ground is not wet
const SPRING = 6500, SUMMER = 9000 + 4500, AUTUMN = 18000 + 4500, WINTER = 27000 + 4500;
const valley = (tick, time, dist = 110, yaw = 0.9, rain = false) => ({ q: 'play=sandbox&ff=30', valley: true, tick, time, dist, yaw, hide: true, rain });
const SCENES = {
  menu: { q: '', menu: true },
  m1: { q: 'play=m1&bot=1&ff=150' },
  // mission I in its first seconds, no bot (what a player sees under / right after the letter, D-542)
  'm1-open': { q: 'play=m1&ff=2' },
  m7: { q: 'play=m7&ff=60' },
  m13: { q: 'play=m13&ff=60' },
  m17: { q: 'play=m17&ff=60' },
  // audit 13 (D-690..): the late missions X..XVII at 60 s, with the HUD
  m10: { q: 'play=m10&ff=60' },
  m11: { q: 'play=m11&ff=60' },
  m12: { q: 'play=m12&ff=60' },
  m14: { q: 'play=m14&ff=60' },
  m15: { q: 'play=m15&ff=60' },
  m16: { q: 'play=m16&ff=60' },
  'valley-spring': valley(SPRING, 0.45),
  'valley-summer': valley(SUMMER, 0.45),
  'valley-autumn': valley(AUTUMN, 0.45),
  'valley-winter': valley(WINTER, 0.45),
  // audit 13: weather — a rain spell forced on for the shot (summer noon and autumn noon), and the morning mist peak
  'valley-rain': valley(SUMMER, 0.45, 110, 0.9, true),
  'valley-rain-autumn': valley(AUTUMN, 0.45, 110, 0.9, true),
  'valley-fog': valley(AUTUMN, 0.27),
  // late autumn (58 % of the season): the crowns at their rust peak just before the leaf fall (D-540)
  'valley-autumn-late': valley(18000 + 5220, 0.45),
  'valley-dawn': valley(AUTUMN, 0.26),
  'valley-morning': valley(AUTUMN, 0.32),
  'valley-dusk': valley(AUTUMN, 0.73),
  'valley-night': valley(AUTUMN, 0.9),
  // far zoom: do roads and wagons still read?
  'valley-far': valley(AUTUMN, 0.45, 230, 0.9),
  // close: materials up close
  'valley-close': valley(AUTUMN, 0.45, 38, 1.4),
};

const benchCmds = JSON.parse(readFileSync(resolve(root, 'tools/frame-cost-bench.json'), 'utf8'));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const [name, sc] of Object.entries(SCENES)) {
  if (only && !only.split(',').includes(name)) continue;
  for (const vp of vpS.split(',')) {
    const [vw, vh] = vp.split('x').map(Number);
    for (const quality of qualS.split(',')) {
      const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${name} ${quality} ${vp}: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} ${quality} ${vp}: ${m.text()}`); });
      const q = sc.menu ? `quality=${quality}&dynres=0&debug=1&lang=pl` : `${sc.q}&speed=1&quality=${quality}&dynres=0&debug=1&lang=pl`;
      await page.goto(`${base}?${q}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 120000 });
      const info = await page.evaluate(new Function('sc', `
        const a = window.__marchia.app, w = a.world;
        if (sc.menu) return { menu: true };
        if (sc.hide) for (const el of Object.values(a.layers ?? {})) if (el && el.style) el.style.visibility = 'hidden';
        if (!sc.valley) return { tick: w.state.tick, wagons: w.state.wagons.length };
        w.state.coins = 1e9; w.state.town.rank = 5;
        // cobble needs stone the sandbox does not have: lay those stretches as dirt (as gfx10 does), else the failed
        // cobble rows leave lone road cells that draw as mud discs
        for (const c of sc.cmds) { if (c.t === 'road' && c.surface === 2) c.surface = 1; a.loop.enqueue(c); }
        a.loop.flushCommands();
        const stable = w.state.buildings.find((b) => b.type === 'stable');
        for (let i = 0; i < 10; i++) a.loop.enqueue({ t: 'buyWagon', stable: stable.id });
        a.loop.flushCommands();
        for (let i = 0; i < 900; i++) a.loop.tickOnce();
        w.seasons = true; w.state.tick = sc.tick; a.view.snapEnv = true; a.view.debug.forceTime = sc.time;
        if (sc.rain) w.state.rain.push({ start: 0, end: 1e9 });
        for (let i = 0; i < 5; i++) a.loop.tickOnce();
        a.loop.speed = 0;
        const castle = w.state.buildings.find((b) => b.type === 'castle');
        const c = a.view.buildings.info.get(castle.id).centre;
        window.__gfxCam = [c.x, c.z, sc.dist, sc.yaw];
        a.view.rig.set(...window.__gfxCam);
        return { tick: w.state.tick, wagons: w.state.wagons.length, roads: w.state.roads.filter((r) => r > 0).length };
      `), { ...sc, cmds: sc.valley ? benchCmds : [] });
      await page.waitForTimeout(sc.menu ? 5000 : 4000);
      if (await page.evaluate(() => { if (!window.__gfxCam) return false; const v = window.__marchia.app.view; v.rig.set(...window.__gfxCam); v.snapEnv = true; return true; })) await page.waitForTimeout(1500);
      const f = resolve(outDir, `${prefix}-${tag}-${name}-${quality}-${vp}.jpg`);
      await page.screenshot({ path: f, type: 'jpeg', quality: 80, timeout: 600000 });
      console.log(`${name} ${quality} ${vp}: ${JSON.stringify(info)} -> ${f.replace(root + '/', '')}`);
      await ctx.close();
    }
  }
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
