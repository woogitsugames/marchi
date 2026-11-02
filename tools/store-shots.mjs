// Store screenshots from live gameplay. No mock HUD or edited game state.
// Usage: node tools/store-shots.mjs [--lang=all|pl|en] [--shot=all|1,2,...] [--orientation=all|portrait|landscape]
// Requires Playwright in the dev environment; CI installs Chromium separately.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = join(root, 'art/store/screens');
const SCENES = [
  { id: 1, slug: 'valley', q: 'play=m1&bot=1&ff=150&speed=0' },
  { id: 2, slug: 'diagnosis', q: 'play=m1&ff=90&speed=0&open=bakery' },
  { id: 3, slug: 'cargo', q: 'play=m1&bot=1&ff=100&speed=0&wagon=1' },
  { id: 4, slug: 'roads-bridges', q: 'play=m1&bot=1&ff=30&speed=0&tool=road' },
  { id: 5, slug: 'bridge-jam', q: 'play=m2&speed=0' },
  { id: 6, slug: 'contract', q: 'play=m1&bot=1&ff=170&speed=0' },
];
const SIZES = {
  portrait: { cssW: 412, cssH: 732, dpr: 2.625, w: 1080, h: 1920 },
  landscape: { cssW: 960, cssH: 540, dpr: 2, w: 1920, h: 1080 },
};

function parseOptions() {
  const options = { lang: 'all', shot: 'all', orientation: 'all' };
  for (const arg of process.argv.slice(2)) {
    const match = /^--(lang|shot|orientation)=(.+)$/.exec(arg);
    if (!match) throw new Error(`Unknown argument: ${arg}`);
    options[match[1]] = match[2];
  }
  if (!['all', 'pl', 'en'].includes(options.lang)) throw new Error('Invalid --lang');
  if (!['all', 'portrait', 'landscape'].includes(options.orientation)) throw new Error('Invalid --orientation');
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
    params.set('debug', '1'); // production preview: window.__marchia.app only with ?debug=1 (D-45)
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

// Step the game's genuine deterministic simulation, stopping at the first state that
// demonstrates the claimed feature. Do not fabricate cargo, stalls, routes or HUD.
async function seekEvidence(page, id) {
  const evidence = await page.evaluate((scene) => {
    const app = window.__marchia.app;
    const s = app.world.state;
    const maxTicks = ({ 1: 1000, 2: 2200, 3: 3500, 4: 0, 5: 450, 6: 3700 })[scene];
    const countCargo = () => s.wagons.filter((w) => w.cargoQty > 0 && w.cargoGood);
    const castleGoods = () => {
      const c = s.mission.contract;
      const castle = s.buildings.find((b) => b.id === c?.castle);
      return c && castle ? { planks: castle.stock.planks, bread: castle.stock.bread } : null;
    };
    const valid = () => {
      if (s.mission.result !== 'running') return false;
      if (scene === 1) return !!s.mission.contract && countCargo().length > 0;
      if (scene === 2) {
        const bakery = s.buildings.find((b) => b.type === 'bakery');
        const mill = s.buildings.find((b) => b.type === 'mill');
        return bakery?.status.k === 'NO_INPUT' && bakery.stock.flour === 0 && bakery.status.blockedBy === mill?.id;
      }
      if (scene === 3) return new Set(countCargo().map((w) => w.cargoGood)).size >= 2;
      if (scene === 4) return s.roads.some((road, cell) => road > 0 && app.world.terrain.water[cell] === 1);
      if (scene === 5) return s.wagons.some((w) => w.status.k === 'BRIDGE_JAM');
      if (scene === 6) {
        const c = s.mission.contract, delivered = castleGoods();
        return !!c && c.need.planks === 30 && c.need.bread === 20 &&
          !!delivered && (delivered.planks > 0 || delivered.bread > 0) &&
          (delivered.planks < c.need.planks || delivered.bread < c.need.bread);
      }
      return false;
    };
    let ticks = 0;
    while (!valid() && ticks < maxTicks && s.mission.result === 'running') { app.loop.tickOnce(); ticks++; }
    const cargo = countCargo();
    const jam = s.wagons.find((w) => w.status.k === 'BRIDGE_JAM');
    return {
      ok: valid(), scene, tick: s.tick, mission: s.mission.id, result: s.mission.result,
      goods: [...new Set(cargo.map((w) => w.cargoGood))], loadedWagons: cargo.length,
      jamWagon: jam?.id ?? null, delivered: castleGoods(),
      bakery: s.buildings.find((b) => b.type === 'bakery')?.status.k ?? null,
    };
  }, id);
  if (!evidence.ok) throw new Error(`No authentic screenshot state for #${id}: ${JSON.stringify(evidence)}`);
  return evidence;
}

async function prepareScene(page, id, evidence) {
  if (id === 2) {
    const condition = await page.evaluate(() => {
      const a = window.__marchia.app;
      const b = a.world.state.buildings.find((item) => item.type === 'bakery');
      const mill = a.world.state.buildings.find((item) => item.type === 'mill');
      if (!b || !mill) return { ok: false, why: 'No bakery or mill' };
      a.go('building', b.id, true);
      const hasChain = document.querySelectorAll('.sheet-body .chain li').length >= 2;
      const millInChain = !!document.querySelector(`.sheet-body .chain [data-go="building:${mill.id}"]`);
      return { ok: b.stock.flour === 0 && hasChain && millInChain, hasChain, millInChain };
    });
    if (!condition.ok) throw new Error(`Bakery lacks the required real cause chain: ${JSON.stringify(condition)}`);
  }
  if (id === 3) {
    await page.evaluate(() => {
      const a = window.__marchia.app;
      const wagons = a.world.state.wagons.filter((w) => w.cargoQty > 0 && w.cargoGood);
      if (wagons.length) a.go('wagon', wagons[0].id, true);
    });
    const shown = await page.evaluate(() => !!document.querySelector('.sheet-body .kv .eta'));
    if (!shown) throw new Error('Selected loaded wagon has no actual ETA in its panel');
  }
  if (id === 4) {
    const draft = await page.evaluate(() => {
      const a = window.__marchia.app;
      const w = innerWidth, h = innerHeight;
      const st = a.world.state, width = a.world.terrain.w;
      const points = new Map();
      for (let y = 105; y < h - 110; y += 6) for (let x = 20; x < w - 20; x += 6) {
        const c = a.view.cellAt(x, y);
        if (c >= 0 && !points.has(c)) points.set(c, { x, y });
      }
      const candidates = [];
      for (const [c, from] of points) {
        if (st.roads[c] === 0) continue;
        for (const neighbor of [c - width, c + width, c - 1, c + 1]) {
          const to = points.get(neighbor);
          if (!to || st.roads[neighbor] > 0) continue;
          const nearRiver = [c, neighbor].some((cell) => a.world.terrain.water[cell]);
          const center = Math.hypot(from.x - w / 2, from.y - h / 2);
          candidates.push({ from, to, score: center - (nearRiver ? 1000 : 0) });
        }
      }
      candidates.sort((x, y) => x.score - y.score);
      for (const { from, to } of candidates.slice(0, 200)) {
        a.draft.start(from.x, from.y);
        a.draft.move(to.x, to.y);
        const tag = document.querySelector('.draft-tag.is-shown');
        const cost = tag?.firstElementChild?.textContent?.trim() ?? '';
        if (tag && !tag.classList.contains('is-bad') && /[1-9]/.test(cost)) return { ok: true, from, to, cost };
        a.draft.cancel();
      }
      return { ok: false, candidates: candidates.length };
    });
    if (!draft.ok) throw new Error(`Could not find a real valid road draft with cost: ${JSON.stringify(draft)}`);
    evidence.draft = draft;
  }
  if (id === 5) {
    await page.evaluate((wagonId) => window.__marchia.app.go('wagon', wagonId, true), evidence.jamWagon);
    const waiting = await page.evaluate(() => !!document.querySelector('.sheet-body .status-line.bad'));
    if (!waiting) throw new Error('Bridge-jam panel is not showing the real waiting status');
  }
  if (id === 6) {
    const visible = await page.evaluate(() => !!document.querySelector('.wb-line') && !!document.querySelector('.wb-time'));
    if (!visible) throw new Error('Mission contract waybill is not visible');
  }
  await page.waitForTimeout(750); // settle camera, sheet transition, markers, and Three.js frame
  const issues = await page.evaluate(() => ({
    perf: !!document.querySelector('.perf'), debug: !!document.querySelector('[data-debug]'),
  }));
  if (issues.perf || issues.debug) throw new Error('Debug UI is visible in the store screenshot');
}

function htmlEscape(value) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// The frames from order #20 are not yet in this branch. This fallback uses the
// actual UI_STYLE colours, chamfered edges, and locally bundled game typefaces.
function frameHtml(png, caption, kind, fonts) {
  const portrait = kind === 'portrait';
  const dims = SIZES[kind];
  const box = portrait
    ? { x: 54, y: 174, w: 972, h: 1728, capY: 18, capH: 142 }
    : { x: 120, y: 120, w: 1680, h: 945, capY: 15, capH: 91 };
  const captionSize = portrait ? 54 : 46;
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

async function main() {
  const opts = parseOptions(), captions = captionsFromPlan();
  const fonts = fontFaces();
  const scenes = SCENES.filter((s) => opts.shot === 'all' || opts.shot.includes(s.id));
  const langs = opts.lang === 'all' ? ['pl', 'en'] : [opts.lang];
  const orientations = opts.orientation === 'all' ? ['portrait', 'landscape'] : [opts.orientation];
  const { chromium } = await import('playwright');
  const preview = await runPreview();
  let browser;
  const manifest = [];
  const errors = [];
  try {
    browser = await chromium.launch({ args: [
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage',
    ] });
    for (const lang of langs) for (const orientation of orientations) for (const scene of scenes) {
      const file = join(outRoot, lang, `${String(scene.id).padStart(2, '0')}-${scene.slug}-${orientation}.png`);
      console.log(`[store-shots] ${lang}/${orientation} #${scene.id}`);
      let game;
      try {
        game = await openGame(browser, preview.url, scene, lang, SIZES[orientation]);
        if (scene.id === 5) {
          // Reproduce the real M2 bridge traffic from tools/bot-m2.ts: buy two wagons.
          await game.page.evaluate(() => {
            const a = window.__marchia.app;
            const stable = a.world.state.buildings.find((b) => b.type === 'stable');
            if (!stable) throw new Error('M2 stable is missing');
            a.buyWagon(stable.id);
            a.buyWagon(stable.id);
          });
        }
        const evidence = await seekEvidence(game.page, scene.id);
        await prepareScene(game.page, scene.id, evidence);
        if (game.errors.length) throw new Error(`Game page errors: ${game.errors.join('; ')}`);
        const raw = await game.page.screenshot({ timeout: 90000, animations: 'disabled' });
        mkdirSync(dirname(file), { recursive: true });
        await compose(browser, raw, captions.get(scene.id)[lang], orientation, fonts, file);
        manifest.push({ file: file.slice(root.length + 1).replaceAll('\\', '/'), lang, orientation, caption: captions.get(scene.id)[lang], ...evidence });
        console.log(`  saved ${file.slice(root.length + 1)}`);
      } catch (e) {
        errors.push(`${lang}/${orientation} #${scene.id}: ${e.stack ?? e}`);
        console.error(`  ERROR: ${e.message ?? e}`);
      } finally { await game?.context.close(); }
    }
  } finally { await browser?.close(); preview.stop(); }
  mkdirSync(outRoot, { recursive: true });
  writeFileSync(join(outRoot, 'manifest.json'), JSON.stringify({ source: 'live Marchia game', shots: manifest, failures: errors }, null, 2) + '\n');
  if (errors.length) {
    console.error(`[store-shots] ${errors.length} screenshot(s) failed:\n${errors.join('\n')}`);
    process.exitCode = 1;
  } else console.log(`[store-shots] ${manifest.length} screenshots generated, all verified`);
}

main().catch((err) => { console.error('[store-shots]', err); process.exitCode = 1; });
