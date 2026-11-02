// Playwright screenshots for brief 06 (polish batch): docs/shots/s6-<scene>-<lang>-<size>.png
// Usage: node tools/shots-s6.mjs [--lang pl|ar] [scene...]   (own Vite server on a free port, closed at the end)
// Fails (exit 1) on console errors or page errors.
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const li = args.indexOf('--lang');
const lang = li >= 0 ? args[li + 1] : 'pl';
const filters = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--lang'));
const outDir = resolve(root, 'docs/shots');
mkdirSync(outDir, { recursive: true });

const SIZES = [{ id: '412x915', w: 412, h: 915 }, { id: '915x412', w: 915, h: 412 }];

/** Opening letter: a real start from the menu (debug ?play= starts skip it). */
async function startFromMenu(page, n) {
  await page.locator('.menu-list .menu-item').nth(n).click();
  await page.waitForTimeout(2500);
}

const SCENES = {
  'letter-open': { q: '', act: (p) => startFromMenu(p, 0) },
  'letter-open-m7': { q: '', act: (p) => startFromMenu(p, 6) },
  'letter-won': { q: 'play=m1&bot=1&ff=600', wait: 3000 },
  'letter-lost': { q: 'play=m1&ff=720', wait: 3000 },
  // D-44: mission I with no silver left -> "the road cannot be saved" within 5 s of game time
  'deadend': { q: 'play=m1&speed=4', act: async (p) => { await p.evaluate(() => { window.__marchia.app.world.state.coins = 0; }); await p.waitForFunction(() => document.querySelector('.deadend-scrim'), null, { timeout: 60000 }); await p.waitForTimeout(3000); } },
  // mission X: sawmill waiting for a 2-wood load (D-43 thin-load note)
  'thin': { q: 'play=m10&ff=209&speed=0&open=sawmill', wait: 3000 },
};

async function server() {
  const { createServer } = await import('vite');
  const s = await createServer({ root, server: { port: 5190, strictPort: false, host: '127.0.0.1', hmr: false, fs: { strict: false } }, logLevel: 'warn' });
  await s.listen();
  return { url: `http://127.0.0.1:${s.httpServer.address().port}/`, close: () => s.close() };
}

const { url, close } = await server();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  for (const [name, s] of Object.entries(SCENES)) {
    if (filters.length && !filters.includes(name)) continue;
    for (const size of SIZES) {
      const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      try {
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errors.push(`${name} ${size.id}: ${e.message}`));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} ${size.id}: ${m.text()}`); });
        await page.goto(`${url}?${[s.q, `quality=low&dynres=0&lang=${lang}`].filter(Boolean).join('&')}`, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 120000 });
        await page.waitForTimeout(1500);
        if (s.act) await s.act(page);
        await page.waitForTimeout(s.wait ?? 1000);
        const file = resolve(outDir, `s6-${name}-${lang}-${size.id}.png`);
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
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exitCode = 1; }
