// Playwright screenshots of every UI screen at 412x915, 915x412 and 904x1000 -> docs/shots/ui-<screen>-<w>x<h>.png
// Usage: npm run shots            (starts its own Vite server on :5175, or reuses one)
//        SHOTS_URL=http://localhost:5173/ npm run shots
//        npm run shots -- menu why  (only screens whose name contains one of the args)
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
  { w: 412, h: 915, mobile: true },
  { w: 915, h: 412, mobile: true },
  { w: 904, h: 1000, mobile: false },
];

const extra = process.env.SHOTS_PARAMS ?? '';
const SCREENS = [
  { name: 'menu', q: '' },
  { name: 'hud-start', q: 'play=m1&speed=0' },
  { name: 'game-3min', q: 'play=m1&bot=1&ff=180&speed=0' },
  { name: 'why-bakery', q: 'play=m1&ff=90&speed=0&open=bakery' },
  { name: 'wagon', q: 'play=m1&bot=1&ff=150&speed=0&wagon=1' },
  { name: 'road-steep', q: 'play=m1&speed=0&tool=road', act: steepDraft },
  { name: 'end', q: 'play=m1&bot=1&ff=600' },
  { name: 'settings', q: 'lang=en', act: openSettings },
  { name: 'end-lost', q: 'play=m1&ff=720&lang=en' },
];

async function steepDraft(page) {
  const d = await page.evaluate(() => window.__marchia.findSteepDraft());
  if (!d) { console.warn('  no steep draft found on screen'); return; }
  await page.mouse.move(d.from[0], d.from[1]);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(d.from[0] + ((d.to[0] - d.from[0]) * i) / steps, d.from[1] + ((d.to[1] - d.from[1]) * i) / steps);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(150);
  // screenshot is taken while the finger is still down
  return async () => { await page.mouse.up(); };
}

async function openSettings(page) {
  await page.locator('.menu-item').last().click();
  await page.waitForTimeout(350);
}

async function ensureServer() {
  if (process.env.SHOTS_URL) return { url: process.env.SHOTS_URL, close: async () => {} };
  // always our own server: a borrowed one may be restarted by someone else mid-run
  const { createServer } = await import('vite');
  const server = await createServer({ root, server: { port: 5175, strictPort: false, host: '127.0.0.1', hmr: false }, logLevel: 'warn' });
  await server.listen();
  const addr = server.httpServer.address();
  return { url: `http://127.0.0.1:${addr.port}/`, close: () => server.close() };
}

const filters = process.argv.slice(2);
const { url, close } = await ensureServer();
const launch = () => chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let browser = await launch();
const errors = [];

async function shoot(s, size) {
  const ctx = await browser.newContext({
    viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1, isMobile: size.mobile, hasTouch: size.mobile,
  });
  try {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${s.name} ${size.w}x${size.h}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${s.name} ${size.w}x${size.h}: ${m.text()}`); });
    const q = [s.q, s.q.includes('lang=') ? '' : 'lang=pl', extra].filter(Boolean).join('&');
    await page.goto(url + (q ? '?' + q : ''), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 90000 });
    await page.waitForTimeout(Number(process.env.SHOTS_SETTLE ?? 1500));
    const after = s.act ? await s.act(page) : null;
    await page.waitForTimeout(300);
    const file = resolve(outDir, `ui-${s.name}-${size.w}x${size.h}.png`);
    await page.screenshot({ path: file, timeout: 180000 });
    if (typeof after === 'function') await after();
    console.log('shot', file.replace(root + '/', ''));
  } finally {
    await ctx.close();
  }
}

try {
  for (const s of SCREENS) {
    if (filters.length && !filters.some((f) => s.name.includes(f))) continue;
    for (const size of SIZES) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await shoot(s, size);
          break;
        } catch (e) {
          console.warn(`  ${s.name} ${size.w}x${size.h} attempt ${attempt} failed: ${String(e.message ?? e).split('\n')[0]}`);
          if (!browser.isConnected()) browser = await launch();
          if (attempt === 2) errors.push(`${s.name} ${size.w}x${size.h}: ${String(e.message ?? e).split('\n')[0]}`);
        }
      }
    }
  }
} finally {
  await browser.close();
  await close();
}
if (errors.length) {
  console.log('PAGE ERRORS:\n' + errors.join('\n'));
  process.exitCode = 1;
}
