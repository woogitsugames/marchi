// Playwright screenshots for the RTL layout (D-37): docs/shots/rtl-<lang>-<scene>-<size>.png
// Usage: node tools/shots-rtl.mjs [--lang ar|pl] [--out docs/shots] [--prefix rtl] [scene...]
//        UI5_SIZE=412x915 node tools/shots-rtl.mjs --lang ar why      (one size only)
// Own Vite server on the checkout the script lives in; ?quality=low&dynres=0.
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const lang = opt('lang', 'ar');
const outDir = resolve(root, opt('out', 'docs/shots'));
const prefix = opt('prefix', 'rtl');
const filters = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
mkdirSync(outDir, { recursive: true });

const SIZES = [
  { id: '412x915', w: 412, h: 915 },
  { id: '915x412', w: 915, h: 412 },
  { id: 'fold-inner-land', w: 874, h: 787 },
];
const Q = `quality=low&dynres=0&lang=${lang}`;

async function openLedger(page) {
  // free valley "Księgi osad" (save slots) from the main menu; the ledgers are read from IndexedDB first
  await page.evaluate(() => window.__marchia.app.openValley());
  await page.waitForTimeout(4000);
}

const SCENES = [
  { name: 'menu', q: '' },
  { name: 'why', q: 'play=m1&ff=90&speed=0&open=bakery', wait: 4000 },
  { name: 'wagon', q: 'play=m1&bot=1&ff=150&speed=0&wagon=1', wait: 4000 },
  { name: 'market', q: 'play=sandbox&ff=240&speed=0&market=1', wait: 4000 },
  { name: 'build', q: 'play=sandbox&speed=0&tool=build&pick=sawmill', wait: 2500 },
  { name: 'ledger', q: '', act: openLedger },
];

async function ensureServer() {
  const { createServer } = await import('vite');
  const server = await createServer({ root, server: { port: 5177, strictPort: false, host: '127.0.0.1', hmr: false, fs: { strict: false } }, logLevel: 'warn' });
  await server.listen();
  const addr = server.httpServer.address();
  return { url: `http://127.0.0.1:${addr.port}/`, close: () => server.close() };
}

const { url, close } = await ensureServer();
const launch = () => chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let browser = await launch();
const errors = [];
try {
  for (const s of SCENES) {
    if (filters.length && !filters.includes(s.name)) continue;
    for (const size of SIZES) {
      if (process.env.UI5_SIZE && size.id !== process.env.UI5_SIZE) continue;
      for (let attempt = 1; attempt <= 2; attempt++) {
        const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        try {
          const page = await ctx.newPage();
          page.on('pageerror', (e) => errors.push(`${s.name} ${size.id}: ${e.message}`));
          await page.goto(`${url}?${[s.q, Q].filter(Boolean).join('&')}`, { waitUntil: 'load' });
          await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 120000 });
          await page.waitForTimeout(1500);
          if (s.act) await s.act(page);
          await page.waitForTimeout(s.wait ?? 1500);
          const file = resolve(outDir, `${prefix}-${lang}-${s.name}-${size.id}.png`);
          await page.screenshot({ path: file, timeout: 180000 });
          console.log('shot', file.replace(root + '/', ''));
          break;
        } catch (e) {
          console.warn(`  ${s.name} ${size.id} attempt ${attempt} failed: ${String(e.message ?? e).split('\n')[0]}`);
          if (!browser.isConnected()) browser = await launch();
          if (attempt === 2) errors.push(`${s.name} ${size.id}: ${String(e.message ?? e).split('\n')[0]}`);
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
