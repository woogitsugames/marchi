// Playwright screenshots of the valley-chain UI (brief 04, task A) -> docs/shots/ui5-<scene>-<size>.png
// Usage: node tools/shots-ui5.mjs [scene...]     (own Vite server; ?quality=low&dynres=0)
//        UI5_SIZE=412x915 node tools/shots-ui5.mjs contested   (one size only)
// Scenes are staged in the page through window.__marchia.app (screenshot-only state edits: rank, coins,
// stone in the granary, a placed charcoal burner, a status shown as contested). Nothing is saved.
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'docs/shots');
mkdirSync(outDir, { recursive: true });

const SIZES = [
  { id: '412x915', w: 412, h: 915, mobile: true },
  { id: '915x412', w: 915, h: 412, mobile: true },
  { id: 'fold-inner-land', w: 874, h: 787, mobile: true },
];
const Q = 'play=sandbox&speed=0&quality=low&dynres=0&lang=pl';

/** Runs in the page: common staging (rank 5 open, silver), returns nothing. */
function stage() {
  const A = window.__marchia.app;
  const st = A.world.state;
  st.coins = 2000;
  st.town.rank = 5;
  const T = 600; // ticks per minute
  st.town.rankTicks = [0, 9.8 * T, 25.3 * T, 44.4 * T, 75.6 * T, 120.5 * T].map(Math.round);
}

/** Runs in the page: drop the rank-up letter the staged rank triggers (it would cover the scene). */
function noLetter() {
  const A = window.__marchia.app;
  if (A.hud && A.hud.rankLetter) { A.hud.rankLetter.remove(); A.hud.rankLetter = null; }
  for (const el of document.querySelectorAll('.rank-letter-wrap')) el.remove();
}

/** Runs in the page: put the camera straight over a cell (no smooth move; software GL frames are slow). */
function look([cell, zoom]) {
  const A = window.__marchia.app;
  const W = A.world.terrain.w, x = cell % W, y = Math.floor(cell / W);
  A.view.rig.set((x + 0.5) * 4, (y + 0.5) * 4, 230 * zoom, -0.3);
}

/** Staging common to all scenes: rank/silver, then wait for the HUD's rank letter and drop it. */
async function prep(page) {
  await page.evaluate(stage);
  await page.waitForTimeout(1500);
  await page.evaluate(noLetter);
}

/** Centre the camera on a cell and let a few frames render. */
async function settle(page, cell, zoom) {
  await page.evaluate(look, [cell, zoom]);
  await page.waitForTimeout(1500);
}

const SCENES = {
  // quarry ghost over the north ridge: rock cells cross-hatched, refusal text when off the rock
  async quarry(page) {
    await prep(page);
    await settle(page, 50 * 96 + 66, 0.42);
    await page.evaluate(() => { const A = window.__marchia.app; A.setTool('build'); A.build.pick('quarry'); });
  },
  // fisher ghost by the river: waterside cells cross-hatched
  async fisher(page) {
    await prep(page);
    await settle(page, 30 * 96 + 22, 0.42);
    await page.evaluate(() => { const A = window.__marchia.app; A.setTool('build'); A.build.pick('fisher'); });
  },
  // cobble draft: silver plus stone, with what the granaries hold
  async cobble(page) {
    await prep(page);
    await page.evaluate(() => {
      const A = window.__marchia.app, st = A.world.state;
      const g = st.buildings.find((b) => b.type === 'warehouse');
      g.stock.stone += 2; st.ledger.produced.stone += 2;
    });
    await settle(page, 26 * 96 + 38, 0.45);
    await page.evaluate(() => window.__marchia.app.setTool('cobble'));
    const pts = await page.evaluate(() => {
      const v = window.__marchia.app.view;
      const a = v.cellToScreen(26 * 96 + 33), b = v.cellToScreen(26 * 96 + 43);
      return [[a.x, a.y], [b.x, b.y]];
    });
    await page.mouse.move(pts[0][0], pts[0][1]);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(pts[0][0] + ((pts[1][0] - pts[0][0]) * i) / 12, pts[0][1] + ((pts[1][1] - pts[0][1]) * i) / 12);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(300);
    const tag = await page.evaluate(() => { const d = document.querySelector('.draft-tag'); return d ? `${d.className} | ${d.textContent}` : 'no .draft-tag'; });
    console.log('  cobble draft:', JSON.stringify(pts), tag);
    return async () => { await page.mouse.up(); };
  },
  // sawmill whose wood is promised to the charcoal burner: CONTESTED with the rival in the chain
  async contested(page) {
    await prep(page);
    await page.evaluate(() => {
      const A = window.__marchia.app;
      A.loop.enqueue({ t: 'place', type: 'charcoalBurner', x: 22, y: 25, facing: 2 });
      A.loop.flushCommands();
      if (!A.world.state.buildings.some((b) => b.type === 'charcoalBurner')) throw new Error('charcoal burner not placed');
    });
    // the placement toast / selection settle first, then the sawmill card is opened
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const A = window.__marchia.app, st = A.world.state;
      const burner = st.buildings.find((b) => b.type === 'charcoalBurner');
      const saw = st.buildings.find((b) => b.type === 'sawmill');
      saw.stock.wood = 0; saw.progress = -1;
      saw.status = { k: 'NO_INPUT', good: 'wood', cause: 'CONTESTED', blockedBy: burner.id };
      saw.stalledTicks = 260;
      burner.status = { k: 'WAITING_DELIVERY', good: 'wood', wagon: st.wagons[0].id };
      A.sheets.closeAll();
      A.go('building', saw.id, true);
    });
    await page.waitForTimeout(4000); // the sheet slides in; software GL keeps the main thread busy
  },
  // granary card: stone reserve for cobbles and stone bridges
  async granary(page) {
    await prep(page);
    await page.evaluate(() => {
      const A = window.__marchia.app, st = A.world.state;
      const g = st.buildings.find((b) => b.type === 'warehouse');
      for (const [k, n] of [['stone', 7], ['planks', 9], ['fish', 4], ['beer', 3]]) { g.stock[k] += n; st.ledger.produced[k] += n; }
      A.go('building', g.id, true);
    });
    await page.waitForTimeout(4000);
  },
  // market sheet: ten goods, ranks 4-5 and the castle upgrade in the history
  async market(page) {
    await prep(page);
    await page.evaluate(() => {
      const A = window.__marchia.app, st = A.world.state;
      st.town.rank = 4;
      st.town.rankTicks[5] = -1;
      A.openMarket();
    });
    await page.waitForTimeout(4000);
  },
  // castle level 1 (extra tower and pennant) with a smoking charcoal burner and brewery beside it
  async castle(page) {
    await prep(page);
    await page.evaluate(() => {
      const A = window.__marchia.app, st = A.world.state;
      A.loop.enqueue({ t: 'place', type: 'charcoalBurner', x: 55, y: 25, facing: 2 });
      A.loop.enqueue({ t: 'place', type: 'brewery', x: 64, y: 25, facing: 2 });
      A.loop.enqueue({ t: 'place', type: 'malthouse', x: 59, y: 25, facing: 2 });
      A.loop.flushCommands();
      for (const b of st.buildings) if (b.type === 'charcoalBurner' || b.type === 'brewery' || b.type === 'malthouse') { b.status = { k: 'WORKING' }; b.progress = 10; }
      A.sheets.closeAll(); // placing selects the new building; this shot is about the scene
    });
    await page.evaluate(look, [21 * 96 + 61, 0.3]);
    await page.waitForTimeout(5000); // smoke needs a few seconds to rise
  },
};

async function ensureServer() {
  const { createServer } = await import('vite');
  const server = await createServer({ root, server: { port: 5176, strictPort: false, host: '127.0.0.1', hmr: false }, logLevel: 'warn' });
  await server.listen();
  const addr = server.httpServer.address();
  return { url: `http://127.0.0.1:${addr.port}/`, close: () => server.close() };
}

const filters = process.argv.slice(2);
const { url, close } = await ensureServer();
const launch = () => chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let browser = await launch();
const errors = [];
try {
  for (const [name, act] of Object.entries(SCENES)) {
    if (filters.length && !filters.includes(name)) continue;
    for (const size of SIZES) {
      if (process.env.UI5_SIZE && size.id !== process.env.UI5_SIZE) continue;
      for (let attempt = 1; attempt <= 2; attempt++) {
        const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1, isMobile: size.mobile, hasTouch: size.mobile });
        try {
          const page = await ctx.newPage();
          page.on('pageerror', (e) => errors.push(`${name} ${size.id}: ${e.message}`));
          page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} ${size.id}: ${m.text()}`); });
          await page.goto(`${url}?${Q}`, { waitUntil: 'load' });
          await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 120000 });
          await page.waitForTimeout(1200);
          const after = await act(page);
          await page.waitForTimeout(900);
          await page.evaluate(noLetter); // the HUD may raise the rank letter a few frames after staging
          const file = resolve(outDir, `ui5-${name}-${size.id}.png`);
          await page.screenshot({ path: file, timeout: 180000 });
          if (typeof after === 'function') await after();
          console.log('shot', file.replace(root + '/', ''));
          break;
        } catch (e) {
          console.warn(`  ${name} ${size.id} attempt ${attempt} failed: ${String(e.message ?? e).split('\n')[0]}`);
          if (!browser.isConnected()) browser = await launch();
          if (attempt === 2) errors.push(`${name} ${size.id}: ${String(e.message ?? e).split('\n')[0]}`);
        } finally {
          await ctx.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  await close();
}
if (errors.length) { console.log('PAGE ERRORS:\n' + errors.join('\n')); process.exitCode = 1; }
