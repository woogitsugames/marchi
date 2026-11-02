// Store screenshots v2: genuine playable scenes only; never synthesize game HUD or status.
// Usage: node tools/store-shots-v2.mjs [--lang=all|pl|en] [--shot=all|1,2,...] [--orientation=all|portrait|landscape]
// Requires Playwright in the dev environment; CI installs Chromium separately.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync, renameSync, statSync, readdirSync } from 'node:fs';
import sharp from 'sharp';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = join(root, 'docs/store/shots');
const SCENES = [
  { id: 1, slug: 'valley-contract', q: 'play=m1&bot=1&ff=170&speed=0' },
  { id: 2, slug: 'worst-stall', q: 'play=m1&bot=1&ff=170&speed=0' },
  { id: 3, slug: 'bridge-jam', q: 'play=m2&speed=0' },
  { id: 4, slug: 'river-ice', q: 'play=m4&ff=240&speed=0' },
  { id: 5, slug: 'free-valley-market', q: 'play=sandbox&ff=240&speed=0&market=1' },
  { id: 6, slug: 'castellan-letter', q: 'play=m1&bot=1&ff=900&speed=0' },
];
const SIZES = {
  portrait: { cssW: 412, cssH: 732, dpr: 2, w: 1080, h: 1920 },
  landscape: { cssW: 960, cssH: 540, dpr: 1.5, w: 1920, h: 1080 },
  app: { cssW: 430, cssH: 932, dpr: 2, w: 1290, h: 2796 },
};
const FEATURE = { w: 1024, h: 500 };
const BUDGET = 25_000_000;
const FEATURE_SUBTITLE = { pl: 'Szlaki Królestwa', en: 'Roads of the Kingdom' };

function parseOptions() {
  const options = { lang: 'all', shot: 'all', orientation: 'all' };
  for (const arg of process.argv.slice(2)) {
    const match = /^--(lang|shot|orientation)=(.+)$/.exec(arg);
    if (!match) throw new Error(`Unknown argument: ${arg}`);
    options[match[1]] = match[2];
  }
  if (!['all', 'pl', 'en'].includes(options.lang)) throw new Error('Invalid --lang');
  if (!['all', 'portrait', 'landscape', 'app'].includes(options.orientation)) throw new Error('Invalid --orientation');
  if (options.shot !== 'all') {
    const ids = options.shot.split(',');
    if (!ids.length || ids.some((id) => !/^[1-6]$/.test(id))) throw new Error('Invalid --shot: use 1,2,...,6');
    options.shot = [...new Set(ids.map(Number))];
  }
  return options;
}

function captionsFromPlan() {
  const plan = readFileSync(join(root, 'docs/store/screenshots-plan.md'), 'utf8');
  const rows = new Map();
  for (const line of plan.split(/\r?\n/)) {
    if (!/^\|\s*[1-6]\s*\|/.test(line)) continue;
    const cells = line.split('|').map((x) => x.trim());
    const id = Number(cells[1]);
    const captions = { pl: cells[3], en: cells[4] };
    for (const [lang, caption] of Object.entries(captions)) {
      if (!caption || [...caption].length > 40) throw new Error(`Invalid ${lang} caption for shot #${id} (max 40 characters)`);
    }
    if (rows.has(id)) throw new Error(`Duplicate screenshot #${id} in plan`);
    rows.set(id, captions);
  }
  if (rows.size !== 6) throw new Error(`Expected six screenshot captions; found ${rows.size}`);
  return rows;
}

function fontFaces() {
  const fonts = [
    ['StoreSans', 'alegreya-sans', 700],
    ['StoreGothic', 'grenze-gotisch', 700],
  ];
  let css = '';
  for (const [family, name, weight] of fonts) {
    for (const [subset, range] of [
      ['latin', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'],
      ['latin-ext', 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF'],
    ]) {
      const file = join(root, 'node_modules', '@fontsource', name, 'files', `${name}-${subset}-${weight}-normal.woff2`);
      if (!existsSync(file)) throw new Error(`Missing store caption font: ${file}; run npm ci`);
      css += `@font-face{font-family:${family};font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${readFileSync(file).toString('base64')}) format('woff2');unicode-range:${range}}\n`;
    }
  }
  return css;
}

async function freePort() {
  const server = createServer();
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
  const port = server.address().port;
  await new Promise((ok) => server.close(ok));
  return port;
}

async function runPreview() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  console.log('[store-shots] npm run build');
  const build = spawnSync(npm, ['run', 'build'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (build.error || build.status !== 0) throw new Error(`Build failed: ${build.error?.message ?? build.status}`);
  const port = await freePort();
  const vite = join(root, 'node_modules/vite/bin/vite.js');
  const server = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  for (const stream of [server.stdout, server.stderr]) stream.on('data', (b) => { log = (log + String(b)).slice(-10000); });
  const url = `http://127.0.0.1:${port}/`;
  try {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (server.exitCode !== null) throw new Error(`vite preview exited: ${log}`);
      try {
        const res = await fetch(url);
        if (res.ok) return { url, stop: () => server.kill() };
      } catch { /* preview starting */ }
      await new Promise((ok) => setTimeout(ok, 250));
    }
    throw new Error(`vite preview did not start: ${log}`);
  } catch (err) { server.kill(); throw err; }
}

async function openGame(browser, url, scene, lang, size) {
  const context = await browser.newContext({
    viewport: { width: size.cssW, height: size.cssH }, deviceScaleFactor: size.dpr,
    isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const params = new URLSearchParams(scene.q);
    params.set('lang', lang);
    params.set('quality', 'high');
    params.set('dynres', '0');
    params.set('debug', '1'); // production preview: window.__marchia.app only with ?debug=1 (D-51)
    await page.goto(url + '?' + params, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 120000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    if (errors.length) throw new Error(`Game page errors: ${errors.join('; ')}`);
    const view = await page.evaluate(() => document.body.dataset.view);
    if (view !== 'three') throw new Error(`Expected real 3D game rendering, got ${view || 'unknown'} (WebGL may be unavailable)`);
    return { context, page, errors };
  } catch (e) { await context.close(); throw e; }
}

// Advance the real simulation only; inventory, statuses and visuals are never edited.
async function seekEvidence(page, id) {
  const evidence = await page.evaluate((scene) => {
    const app = window.__marchia.app;
    const s = app.world.state;
    const loaded = () => s.wagons.filter((w) => w.cargoQty > 0 && w.cargoGood);
    const jam = () => s.wagons.find((w) => w.status.k === 'BRIDGE_JAM');
    const valid = () => {
      if (scene === 6) return s.mission.id === 'm1' && s.mission.result === 'won' &&
        !!document.querySelector('.letter .seals .kseal');
      if (s.mission.result !== 'running') return false;
      switch (scene) {
        case 1: return s.mission.id === 'm1' && !!s.mission.contract && loaded().length > 0;
        case 2: return s.mission.id === 'm1' && !!document.querySelector('.stall-eye') &&
          s.buildings.some((b) => b.status.k !== 'WORKING' && b.status.k !== 'IDLE');
        case 3: return s.mission.id === 'm2' && !!jam();
        case 4: return s.mission.id === 'm4' && s.ice.some((w) => s.tick >= w.start && s.tick < w.end);
        case 5: return s.mission.id === 'sandbox' && Number.isInteger(s.town.rank) &&
          !!document.querySelector('.ms-prices');
        case 6: return false; // checked before 'running' guard: completion letter
        default: return false;
      }
    };
    const limit = ({1: 2500, 2: 1800, 3: 2700, 4: 0, 5: 0, 6: 0})[scene]; // M2 bot observes 45s
    let steps = 0;
    while (!valid() && steps < limit && s.mission.result === 'running') {
      app.loop.tickOnce();
      steps++;
    }
    const waiting = jam();
    return {
      ok: valid(), scene, tick: s.tick, mission: s.mission.id, result: s.mission.result,
      loaded: loaded().length, jamWagon: waiting?.id ?? null, rank: s.town?.rank ?? null,
      iceActive: s.ice?.some((w) => s.tick >= w.start && s.tick < w.end) ?? false,
      storePrices: !!document.querySelector('.ms-prices'), letterVisible: !!document.querySelector('.letter'),
    };
  }, id);
  if (!evidence.ok) throw new Error('No authentic game state for screenshot #' + id + ': ' + JSON.stringify(evidence));
  return evidence;
}

async function prepareScene(page, id, evidence) {
  if (id === 2) {
    await page.evaluate(() => {
      const button = document.querySelector('.stall-eye');
      if (!button || button.disabled) throw new Error('Worst-stall eye is missing/disabled');
      button.click();
    });
    await page.waitForTimeout(650);
    const panel = await page.evaluate(() => {
      const sheet = document.querySelector('.sheet-body');
      return { visible: !!sheet, text: sheet?.textContent?.trim() ?? '' };
    });
    if (!panel.visible || panel.text.length < 20) {
      throw new Error('Worst-stall did not open a real explanatory sheet: ' + JSON.stringify(panel));
    }
  }
  if (id === 3) {
    await page.evaluate((wagon) => window.__marchia.app.go('wagon', wagon, true), evidence.jamWagon);
    await page.waitForTimeout(500);
    const shown = await page.evaluate(() => !!document.querySelector('.sheet-body .status-line.bad'));
    if (!shown) throw new Error('Bridge-jam screenshot does not show a real waiting status');
  }
  if (id === 4) {
    const ice = await page.evaluate(() => window.__marchia.app.world.state.ice
      .some((w) => { const tick = window.__marchia.app.world.state.tick; return tick >= w.start && tick < w.end; }));
    if (!ice) throw new Error('River ice is not currently active in mission IV');
  }
  if (id === 5) {
    const present = await page.evaluate(() => !!document.querySelector('.ms-prices') &&
      !!document.querySelector('.plaque-wrap'));
    if (!present) throw new Error('Real Free Valley market and rank HUD must both exist');
  }
  if (id === 6) {
    const letter = await page.evaluate(() => ({
      text: document.querySelector('.letter')?.textContent?.trim() ?? '',
      seals: document.querySelectorAll('.letter .seals .kseal').length,
    }));
    if (letter.text.length < 40 || letter.seals !== 3) throw new Error('Castellan victory letter does not show three genuine seals');
  }
  await page.waitForTimeout(750);
  const issues = await page.evaluate(() => ({
    perf: !!document.querySelector('.perf'), debug: !!document.querySelector('[data-debug]'),
  }));
  if (issues.perf || issues.debug) throw new Error('Debug UI visible in screenshot');
}

function htmlEscape(value) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// The frames from order #20 are not yet in this branch. This fallback uses the
// actual UI_STYLE colours, chamfered edges, and locally bundled game typefaces.
function frameHtml(png, caption, kind, fonts) {
  const portrait = kind !== 'landscape';
  const dims = SIZES[kind];
  const box = kind === 'app'
    ? { x: 60, y: 215, w: 1170, h: 2520, capY: 30, capH: 150 }
    : kind === 'portrait'
      ? { x: 54, y: 174, w: 972, h: 1728, capY: 18, capH: 142 }
      : { x: 120, y: 120, w: 1680, h: 945, capY: 15, capH: 91 };
  const captionSize = kind === 'app' ? 60 : portrait ? 54 : 46;
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><style>
    ${fonts}
    *{box-sizing:border-box}html,body{margin:0;width:${dims.w}px;height:${dims.h}px;overflow:hidden;background:#2b2620}
    body{font-family:StoreSans,serif}
    .caption{position:absolute;left:${box.x}px;top:${box.capY}px;width:${box.w}px;height:${box.capH}px;
      background:#e4dccb;color:#2b2620;padding:${portrait ? '15px 26px' : '10px 24px'};
      clip-path:polygon(12px 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px),0 12px);
      box-shadow:5px 5px 0 #4a4843;display:flex;align-items:center;gap:22px}
    .seal{width:${portrait ? 32 : 30}px;height:${portrait ? 32 : 30}px;flex:0 0 auto;
      background:#8c4a2f;clip-path:polygon(7% 3%,79% 0,100% 22%,95% 90%,47% 100%,4% 88%,0 43%)}
    .copy{min-width:0;display:flex;flex-direction:column;justify-content:center}
    .brand{font:700 ${portrait ? 20 : 16}px StoreGothic,serif;letter-spacing:3px;color:#8c4a2f;line-height:1.1}
    .heading{font:700 ${captionSize}px/1.04 StoreSans,serif;letter-spacing:-.4px}
    .shot{position:absolute;left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;
      border:5px solid #4a4843;outline:2px solid #cfc5b0;box-shadow:7px 7px 0 #15120f;overflow:hidden;background:#15120f}
    .shot img{width:100%;height:100%;object-fit:fill;display:block}
    </style></head><body>
    <div class="caption"><i class="seal"></i><div class="copy"><div class="brand">MARCHIA</div><div class="heading">${htmlEscape(caption)}</div></div></div>
    <div class="shot"><img src="data:image/png;base64,${png.toString('base64')}" alt=""></div>
    </body></html>`;
}

async function compose(browser, rawPng, caption, orientation, fonts, target) {
  const { w, h } = SIZES[orientation];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  try {
    const page = await ctx.newPage();
    await page.setContent(frameHtml(rawPng, caption, orientation, fonts), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: target, timeout: 90000, animations: 'disabled' });
  } finally { await ctx.close(); }
}

async function compress(file, colors = 160) {
  const tmp = file + '.palette.png';
  await sharp(file).png({ palette: true, colors, effort: 2, compressionLevel: 6, dither: 0.1 }).toFile(tmp);
  renameSync(tmp, file);
  return statSync(file).size;
}

function listImages(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name);
    return item.isDirectory() ? listImages(path) : item.name.endsWith('.png') ? [path] : [];
  });
}

async function enforceBudget() {
  const images = listImages(outRoot);
  let sum = images.reduce((n, file) => n + statSync(file).size, 0);
  for (const palette of [128, 96, 64]) {
    if (sum <= BUDGET) break;
    console.log('[store-shots-v2] Optimizing all screenshots further to ' + palette + ' colors');
    for (const file of images) await compress(file, palette);
    sum = images.reduce((n, file) => n + statSync(file).size, 0);
  }
  if (sum > BUDGET) throw new Error('Output PNG size exceeds 25 MiB budget: ' + sum);
  return sum;
}

async function composeFeature(browser, png, lang, fonts, target) {
  const ctx = await browser.newContext({ viewport: FEATURE, deviceScaleFactor: 1 });
  try {
    const page = await ctx.newPage();
    const html = `<!doctype html><html lang="${lang}"><meta charset="utf-8"><style>
      ${fonts}
      *{box-sizing:border-box}html,body{margin:0;width:1024px;height:500px;overflow:hidden;background:#211c19}
      img{position:absolute;width:100%;height:100%;object-fit:cover}
      .shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(24,20,17,.96) 0%,rgba(24,20,17,.88) 30%,rgba(24,20,17,.08) 78%)}
      .copy{position:absolute;left:64px;top:148px;width:720px;color:#e4dccb}
      h1{margin:0;font:700 106px/1.1 StoreGothic,serif;letter-spacing:1px;text-shadow:2px 3px 2px #17120e}
      p{margin:12px 0 0;font:700 46px/1.1 StoreSans,serif;color:#eadfc6}
      .line{position:absolute;left:64px;top:126px;width:124px;height:6px;background:#995236}
    </style><body><img src="data:image/png;base64,${png.toString('base64')}" alt="">
      <div class="shade"></div><div class="line"></div><div class="copy"><h1>Marchia</h1>
      <p>${htmlEscape(FEATURE_SUBTITLE[lang])}</p></div></body></html>`;
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: target, timeout: 90000, animations: 'disabled' });
  } finally { await ctx.close(); }
}

async function main() {
  const opts = parseOptions(), captions = captionsFromPlan(), fonts = fontFaces();
  const langs = opts.lang === 'all' ? ['pl', 'en'] : [opts.lang];
  const scenes = SCENES.filter((scene) => opts.shot === 'all' || opts.shot.includes(scene.id));
  const kinds = opts.orientation === 'all' ? ['portrait', 'landscape', 'app'] : [opts.orientation];
  const { chromium } = await import('playwright');
  const preview = await runPreview();
  let browser;
  const manifest = [];
  const failures = [];
  try {
    browser = await chromium.launch({ args: [
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage',
    ] });
    // One actual deterministic simulation per scene and language. Resizing the SAME game
    // context renders the real responsive UI for Play, landscape and App Store.
    // In particular, do not fast-forward or reassign the mission for each output size.
    captures: for (const lang of langs) for (const scene of scenes) {
      const variants = kinds.filter((kind) => kind !== 'landscape' || [1, 5].includes(scene.id));
      if (!variants.length) continue;
      let game;
      try {
        game = await openGame(browser, preview.url, scene, lang, SIZES[variants[0]]);
        if (scene.id === 3) {
          await game.page.evaluate(() => {
            const app = window.__marchia.app;
            const stable = app.world.state.buildings.find((b) => b.type === 'stable');
            if (!stable) throw new Error('Mission II stable missing');
            app.buyWagon(stable.id);
            app.buyWagon(stable.id);
          });
        }
        const evidence = await seekEvidence(game.page, scene.id);
        await prepareScene(game.page, scene.id, evidence);
        if (game.errors.length) throw new Error('Page errors: ' + game.errors.join('; '));
        for (const kind of variants) {
          const dims = SIZES[kind];
          const viewport = game.page.viewportSize();
          if (viewport.width !== dims.cssW || viewport.height !== dims.cssH) {
            await game.page.setViewportSize({ width: dims.cssW, height: dims.cssH });
            await game.page.waitForTimeout(1150);
          }
          if (game.errors.length) throw new Error('Page errors after resize: ' + game.errors.join('; '));
          const file = join(outRoot, lang, String(scene.id).padStart(2, '0') + '-' + dims.w + 'x' + dims.h + '.png');
          console.log('[store-shots-v2] ' + lang + ' scene #' + scene.id + ' / ' + kind);
          const raw = await game.page.screenshot({ timeout: 90000, animations: 'disabled' });
          mkdirSync(dirname(file), { recursive: true });
          await compose(browser, raw, captions.get(scene.id)[lang], kind, fonts, file);
          const meta = await sharp(file).metadata();
          if (meta.width !== dims.w || meta.height !== dims.h) throw new Error('Unexpected PNG dimensions');
          await compress(file);
          manifest.push({
            file: file.slice(root.length + 1).replaceAll('\\', '/'), lang, kind,
            caption: captions.get(scene.id)[lang], ...evidence,
          });
          if (scene.id === 1 && kind === 'landscape') {
            const feature = join(outRoot, lang, 'feature-1024x500.png');
            await composeFeature(browser, raw, lang, fonts, feature);
            await compress(feature);
            manifest.push({
              file: feature.slice(root.length + 1).replaceAll('\\', '/'), lang,
              kind: 'feature', source: 'actual mission I scene at landscape viewport',
            });
          }
        }
      } catch (e) {
        const msg = lang + '/#' + scene.id + ': ' + (e.stack ?? e);
        console.error(msg);
        failures.push(msg);
        if (process.env.CI) break captures;
      } finally { await game?.context.close(); }
    }
  } finally { await browser?.close(); preview.stop(); }
  mkdirSync(outRoot, { recursive: true });
  const bytes = await enforceBudget();
  writeFileSync(join(outRoot, 'manifest.json'), JSON.stringify({
    generator: 'tools/store-shots-v2.mjs', source: 'authentic Marchia gameplay', bytes,
    shots: manifest, failures,
  }, null, 2) + '\n');
  if (failures.length) {
    console.error('[store-shots-v2] ' + failures.length + ' capture(s) failed; see manifest.json');
    process.exitCode = 1;
  } else {
    const full = opts.lang === 'all' && opts.orientation === 'all' && opts.shot === 'all';
    if (full && manifest.length !== 30) throw new Error('Expected 30 PNGs, got ' + manifest.length);
    console.log('[store-shots-v2] ' + manifest.length + ' verified PNGs, ' + bytes + ' bytes');
  }
}

main().catch((err) => { console.error('[store-shots]', err); process.exitCode = 1; });
