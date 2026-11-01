// Playwright screenshots of every UI screen at 412x915, 915x412 and 904x1000 -> docs/shots/ui-<screen>-<w>x<h>.png
// Usage: npm run shots            (starts its own Vite server on :5175, or reuses one)
//        SHOTS_URL=http://localhost:5173/ npm run shots
//        npm run shots -- menu why  (only screens whose name contains one of the args)
//        npm run shots -- --fold [class...]  foldable set -> docs/shots/fold-<class>-<screen>.png
//                                            plus the live fold/unfold sequence fold-seq-<n>-<state>.png
import { mkdirSync, writeFileSync } from 'node:fs';
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

const FOLD = process.argv.includes('--fold');
const filters = process.argv.slice(2).filter((a) => a !== '--fold');
const { url, close } = await ensureServer();
// experimental web platform features: Viewport Segments emulation (window.viewport.segments, env(viewport-segment-*))
const launch = () => chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-experimental-web-platform-features'] });
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

// ---------------------------------------------------------------- foldables (D-16)
// CSS px at the devices' default display scale. Sources: Samsung spec sheets (Z Fold 8 / Fold 8 Ultra:
// 8.0" inner, 6.5" 2520x1080 cover; Z Flip 7: 6.9" 2520x1080 main, 4.1" 948x1048 FlexWindow),
// older Fold 5/6 cover 904x2316. Heights already exclude nothing: the game runs edge-to-edge.
const FOLD_CLASSES = [
  { id: 'fold-cover', w: 412, h: 960, dpr: 2.625 },            // Fold 8 / 8 Ultra cover, 21:9
  { id: 'fold-cover-old', w: 344, h: 882, dpr: 2.625 },        // Fold 5/6 cover, 23:9, narrow
  { id: 'fold-inner-land', w: 874, h: 787, dpr: 2.5 },         // Fold 8 inner 2184x1968, landscape
  { id: 'fold-inner-port', w: 787, h: 874, dpr: 2.5 },         // same, book orientation
  { id: 'fold-ultra-land', w: 911, h: 820, dpr: 2.75 },        // Fold 8 Ultra inner ~2504x2256
  { id: 'fold-flex', w: 874, h: 787, dpr: 2.5, hinge: 393 },   // Flex mode: half-folded, horizontal hinge
  { id: 'flip-main', w: 412, h: 1004, dpr: 2.625 },            // Flip main 22:9
  { id: 'flip-flex', w: 412, h: 1004, dpr: 2.625, hinge: 502 }, // Flip in Flex mode
  { id: 'flip-cover', w: 360, h: 380, dpr: 2.625 },            // Flip FlexWindow ~4"
  { id: 'phone', w: 412, h: 915, dpr: 2.625 },
  { id: 'phone-land', w: 915, h: 412, dpr: 2.625 },
  { id: 'tablet', w: 904, h: 1000, dpr: 2 },
];
const FOLD_Q = 'quality=low&dynres=0&lang=pl';
const FOLD_SCREENS = [
  { name: 'menu', q: '' },
  { name: 'hud', q: 'play=m1&bot=1&ff=120&speed=0' },
  { name: 'why', q: 'play=m1&ff=90&speed=0&open=bakery' },
  { name: 'wagon', q: 'play=m1&bot=1&ff=150&speed=0&wagon=1' },
];

async function metrics(cdp, c) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: c.w, height: c.h, deviceScaleFactor: c.dpr, mobile: true,
    ...(c.hinge ? { displayFeature: { orientation: 'horizontal', offset: c.hinge, maskLength: 0 } } : {}),
  });
}

async function foldPage(c) {
  const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h }, deviceScaleFactor: c.dpr, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await metrics(cdp, c);
  return { ctx, page, cdp };
}

/** CDP capture: page.screenshot() would re-apply Playwright's own device metrics and drop the
 *  emulated hinge (display feature) right before the capture. Output is in CSS px. */
async function cdpShot(cdp, page, file) {
  const m = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio }));
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png', clip: { x: 0, y: 0, width: m.w, height: m.h, scale: 1 / m.dpr },
  });
  writeFileSync(file, Buffer.from(data, 'base64'));
}

async function state(page) {
  return page.evaluate(() => {
    const cv = document.getElementById('scene');
    const sh = document.querySelector('.sheet');
    const r = sh ? sh.getBoundingClientRect() : null;
    return {
      vp: `${innerWidth}x${innerHeight}@${devicePixelRatio}`,
      body: document.body.className, screen: document.body.dataset.screen,
      canvas: `${cv.width}x${cv.height} css ${cv.clientWidth}x${cv.clientHeight}`,
      segs: window.viewport?.segments?.length ?? 0,
      sheet: r ? `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}` : null,
    };
  });
}

async function foldShoot(c, s) {
  const { ctx, page, cdp } = await foldPage(c);
  try {
    page.on('pageerror', (e) => errors.push(`${c.id} ${s.name}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${c.id} ${s.name}: ${m.text()}`); });
    await page.goto(url + '?' + [s.q, FOLD_Q].filter(Boolean).join('&'), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 120000 });
    if (c.hinge) await metrics(cdp, c); // Playwright re-applies its own metrics on navigation, dropping the display feature
    await page.waitForTimeout(Number(process.env.SHOTS_SETTLE ?? 1500));
    const file = resolve(outDir, `fold-${c.id}-${s.name}.png`);
    await cdpShot(cdp, page, file);
    console.log('shot', file.replace(root + '/', ''), JSON.stringify(await state(page)));
  } finally {
    await ctx.close();
  }
}

/** One session: cover -> unfold (DPR change, open sheet, road draft in progress) -> Flex -> flat -> cover. */
async function foldSequence() {
  const cover = FOLD_CLASSES.find((c) => c.id === 'fold-cover');
  const inner = FOLD_CLASSES.find((c) => c.id === 'fold-inner-port');
  const flex = FOLD_CLASSES.find((c) => c.id === 'fold-flex');
  const innerLand = FOLD_CLASSES.find((c) => c.id === 'fold-inner-land');
  const { ctx, page, cdp } = await foldPage(cover);
  try {
    page.on('pageerror', (e) => errors.push(`seq: ${e.message}`));
    await page.goto(url + '?play=m1&bot=1&ff=150&speed=0&wagon=1&' + FOLD_Q, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__marchia && window.__marchia.ready === true, null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    let n = 0;
    const snap = async (label) => {
      await page.waitForTimeout(700);
      const file = resolve(outDir, `fold-seq-${++n}-${label}.png`);
      await cdpShot(cdp, page, file);
      console.log('shot', file.replace(root + '/', ''), JSON.stringify(await state(page)));
    };
    await snap('cover-wagon');
    // start a road draft on the cover screen and unfold mid-gesture
    await page.evaluate(() => document.querySelector('[data-tool="road"]')?.click());
    await page.mouse.move(150, 300);
    await page.mouse.down();
    await page.mouse.move(200, 340, { steps: 4 });
    await snap('cover-drafting');
    await metrics(cdp, inner);
    await snap('unfolded-inner');
    await page.mouse.move(400, 420, { steps: 4 }); // finger keeps moving: must not resume the draft
    await page.mouse.up();
    const draftShown = await page.evaluate(() => document.querySelector('.draft-tag')?.classList.contains('is-shown'));
    console.log('  draft label after unfold:', draftShown ? 'SHOWN (bug)' : 'hidden (ok)');
    await page.evaluate(() => document.querySelector('[data-tool="road"]')?.click());
    await metrics(cdp, innerLand);
    await snap('inner-landscape');
    await metrics(cdp, flex);
    await snap('flex');
    // native fallback path: no segments, MainActivity's event instead
    await metrics(cdp, innerLand);
    await page.evaluate(() => {
      window.__marchiaFold = { state: 'HALF_OPENED', orientation: 'HORIZONTAL', x: 0, y: 393, w: 874, h: 0 };
      window.dispatchEvent(new CustomEvent('marchia:fold', { detail: window.__marchiaFold }));
    });
    await snap('flex-native-event');
    await page.evaluate(() => {
      window.__marchiaFold = { state: 'FLAT', orientation: 'HORIZONTAL', x: 0, y: 393, w: 874, h: 0 };
      window.dispatchEvent(new CustomEvent('marchia:fold', { detail: window.__marchiaFold }));
    });
    await snap('flat-again');
    await metrics(cdp, cover);
    await snap('folded-cover');
  } finally {
    await ctx.close();
  }
}

if (FOLD) {
  try {
    for (const c of FOLD_CLASSES) {
      if (filters.length && !filters.some((f) => c.id === f || f === 'seq')) continue;
      for (const s of FOLD_SCREENS) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try { await foldShoot(c, s); break; } catch (e) {
            console.warn(`  ${c.id} ${s.name} attempt ${attempt} failed: ${String(e.message ?? e).split('\n')[0]}`);
            if (!browser.isConnected()) browser = await launch();
            if (attempt === 2) errors.push(`${c.id} ${s.name}: ${String(e.message ?? e).split('\n')[0]}`);
          }
        }
      }
    }
    if (!filters.length || filters.includes('seq')) await foldSequence();
  } finally {
    await browser.close();
    await close();
  }
  if (errors.length) { console.log('PAGE ERRORS:\n' + errors.join('\n')); process.exitCode = 1; }
  process.exit();
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
