// Playwright screenshots of the save confirmations (D-36) -> docs/shots/saves-<scene>-<size>.png
// Usage: node tools/shots-saves.mjs [scene...]     (own Vite server; ?quality=low&dynres=0)
//        SAVES_SIZE=412x915 node tools/shots-saves.mjs restart   (one size only)
// Scenes are staged in the page through window.__marchia.app. The menu scenes put a fake unfinished
// save into the app's in-memory list only: nothing is written to IndexedDB.
import { mkdirSync, realpathSync } from 'node:fs';
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
];
const LOW = 'quality=low&dynres=0&lang=pl';

/** Runs in the page: an unfinished mission III save (12:40 played, an hour ago) in the menu. */
function fakeSave() {
  const A = window.__marchia.app;
  A.unfinished.set('m3', { missionId: 'm3', tick: 12 * 600 + 40 * 10, slot: 'auto-m3', savedAt: Date.now() - 3600e3 });
  A.renderMenu();
}

const SCENES = {
  /** Pause menu of a contract: "Start over" asked in the row. */
  restart: {
    q: `play=m3&speed=0&${LOW}`,
    async act(page) {
      await page.evaluate(() => {
        const A = window.__marchia.app;
        A.world.state.tick = 12 * 600 + 40 * 10;
        A.openGameMenu();
      });
      await page.waitForTimeout(1500);
      await page.click('.sheet [data-a="ask"]');
    },
  },
  /** Main menu: mission III row says "w toku". */
  menu: {
    q: LOW,
    async act(page) { await page.evaluate(fakeSave); },
  },
  /** Mission III tapped: Continue / Start over. */
  mission: {
    q: LOW,
    async act(page) {
      await page.evaluate(fakeSave);
      await page.evaluate(() => window.__marchia.app.pickMission('m3'));
    },
  },
  /** ... and "Start over" tapped: the in-row question. */
  missionAsk: {
    q: LOW,
    async act(page) {
      await page.evaluate(fakeSave);
      await page.evaluate(() => window.__marchia.app.pickMission('m3'));
      await page.waitForTimeout(1500);
      await page.click('.sheet [data-a="ask"]');
    },
  },
};

async function ensureServer() {
  const { createServer } = await import('vite');
  const server = await createServer({ root, server: {
    port: 5177, strictPort: false, host: '127.0.0.1', hmr: false,
    // worktrees may symlink node_modules: let Vite serve the fonts from its real path
    fs: { allow: [root, realpathSync(resolve(root, 'node_modules'))] },
  }, logLevel: 'warn' });
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
  for (const [name, scene] of Object.entries(SCENES)) {
    if (filters.length && !filters.includes(name)) continue;
    for (const size of SIZES) {
      if (process.env.SAVES_SIZE && size.id !== process.env.SAVES_SIZE) continue;
      const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1, isMobile: size.mobile, hasTouch: size.mobile });
      try {
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errors.push(`${name} ${size.id}: ${e.message}`));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} ${size.id}: ${m.text()}`); });
        await page.goto(`${url}?${scene.q}`, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 180000 });
        await page.waitForTimeout(1500);
        await scene.act(page);
        await page.waitForTimeout(2500); // sheet slides in; software GL keeps the main thread busy
        const file = resolve(outDir, `saves-${name}-${size.id}.png`);
        await page.screenshot({ path: file, timeout: 180000 });
        console.log('shot', file.replace(root + '/', ''));
      } catch (e) {
        errors.push(`${name} ${size.id}: ${String(e.message ?? e).split('\n')[0]}`);
      } finally {
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
  await close();
}
if (errors.length) { console.log('PAGE ERRORS:\n' + errors.join('\n')); process.exitCode = 1; }
