// UI audit of the day 8c-9 additions (research 2026-11-05): pace card kinds (producer VII, mud III, ice-ahead IV,
// fleet XI) on the HUD and in the producer's "Naprawa", the pickup cue on a yard sheet (D-128), the loss letter's
// action line (D-130), pins (D-121) and the focus ring (D-123), the wagon card's disabled sell (D-131), the
// short-landscape cause chain with its subject row. States come from tools/day8c/9a/9b/8d-shots.mjs and
// tools/chain-shots.mjs; the measurement is layout-check.mjs's own `measure()` (read from that file, not copied),
// plus a few per-scene probes.
// Usage: node tools/ui9-audit.mjs <outdir> [--url http://127.0.0.1:5195/] [--only regex] [--three]
//        CONC=3 (parallel pages). Writes <outdir>/ui9-<scene>-<view>-<lang>.jpg and <outdir>/ui9-report.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'docs/research/shots-ui9';
const URL0 = arg('--url') ?? 'http://127.0.0.1:5195/';
const ONLY = arg('--only') ? new RegExp(arg('--only')) : null;
const THREE = argv.includes('--three');
const CONC = Number(process.env.CONC ?? 3);
mkdirSync(out, { recursive: true });

const lsrc = readFileSync(resolve(root, 'tools/layout-check.mjs'), 'utf8');
const MEASURE = lsrc.slice(lsrc.indexOf('function measure()'), lsrc.indexOf('// ------------------------------------------------------------------ runner'));

const VIEWS = [
  { id: '904x1000', w: 904, h: 1000 },
  { id: 'flip360x380', w: 360, h: 380 },
  { id: '412x915', w: 412, h: 915 },
  { id: '915x412', w: 915, h: 412 },
];
const LANGS = (arg('--lang') ?? 'pl,de,ar,pseudo').split(',');

const eye = async (p) => { await p.evaluate(() => document.querySelector('.stall-eye')?.click()); await p.waitForTimeout(1200); };
const buy2 = (p) => p.evaluate(() => { const a = window.__marchia.app; a.buyWagonFromRail(); a.buyWagonFromRail(); a.loop.flushCommands(); });
const kbFocus = (sel) => async (p) => {
  await p.keyboard.press('Shift');
  await p.evaluate((s) => { const el = document.querySelector(s); el?.focus(); el?.scrollIntoView?.({ block: 'nearest' }); }, sel);
  await p.waitForTimeout(400);
};
const SCENES = [
  { name: 'm7-card', q: 'play=m7&ff=90&speed=0' },
  { name: 'm7-sheet', q: 'play=m7&ff=90&speed=0', act: eye },
  { name: 'm3-card', q: 'play=m3&ff=170&speed=0' },
  { name: 'm3-sheet', q: 'play=m3&ff=170&speed=0', act: eye },
  { name: 'm4-card', q: 'play=m4&ff=60&speed=0', act: async (p) => { await buy2(p); await p.waitForTimeout(1200); } },
  { name: 'm4-sheet', q: 'play=m4&ff=60&speed=0', act: async (p) => { await buy2(p); await p.waitForTimeout(1200); await eye(p); } },
  { name: 'm11-card', q: 'play=m11&ff=300&speed=0' },
  { name: 'm11-sheet', q: 'play=m11&ff=300&speed=0', act: eye },
  // D-128: the sheet of a yard waiting for pickup that is NOT the one the card names (falls back to the named one)
  { name: 'm11-yard', q: 'play=m11&ff=300&speed=0', act: async (p) => {
    await p.evaluate(() => {
      const a = window.__marchia.app, bs = a.world.state.buildings;
      const named = document.querySelector('.stall-row:not([hidden]) .stall-card')?.textContent ?? '';
      const w = bs.filter((b) => b.status?.k === 'WAITING_PICKUP');
      const pick = w.find((b) => !named.includes(String(b.type))) ?? w[0];
      if (pick) a.go('building', pick.id, true);
    });
    await p.waitForTimeout(1200);
  } },
  { name: 'm1-lost', q: 'play=m1&ff=730&speed=0', letter: true },
  { name: 'pins', q: 'play=m1&ff=90&speed=0' },
  { name: 'ring-map', q: 'play=m1&ff=90&speed=0', act: kbFocus('button.bubble.is-shown') },
  { name: 'ring-eye', q: 'play=m7&ff=90&speed=0', act: kbFocus('.stall-eye') },
  { name: 'ring-fix', q: 'play=m11&ff=300&speed=0', act: async (p) => { await eye(p); await kbFocus('#sheets .sheet:last-child .fix-btn')(p); } },
  { name: 'wagon', q: 'play=m1&bot=1&ff=150&speed=0&wagon=1' },
  { name: 'chain-m6', q: 'play=m6&ff=110&speed=0&open=farm' },
  { name: 'chain-m6-open', q: 'play=m6&ff=110&speed=0&open=farm', act: async (p) => {
    await p.evaluate(() => document.querySelector('#sheets .sheet:last-child .c-more-btn')?.click()); await p.waitForTimeout(1000);
  } },
  { name: 'chain-m13', q: 'play=m13&ff=10&speed=0&open=castle' },
];

function probe() {
  const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width < 1 ? null : [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
  const txt = (e) => e?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  const s = document.querySelector('#sheets .sheet:last-child');
  const card = document.querySelector('.stall-row:not([hidden]) .stall-card');
  const fix = s?.querySelector('.fix-btn');
  const dock = s?.querySelector('.fix-dock');
  const body = s?.querySelector('.sheet-body');
  const subj = s?.querySelector('.chain > li:first-child');
  const subjInner = subj?.firstElementChild;
  const a = document.activeElement;
  const ring = a && a !== document.body ? getComputedStyle(a) : null;
  const act = document.querySelector('.letter .end-act, .letter [class*="act"]');
  const sell = document.querySelector('.sell-btn');
  const pins = [...document.querySelectorAll('button.bubble.is-shown')];
  return {
    dir: document.documentElement.dir, body: document.body.className,
    card: card ? { r: R(card), t: txt(card), cls: card.className, sw: card.scrollWidth, cw: card.clientWidth, sh: card.scrollHeight, ch: card.clientHeight } : null,
    eye: R(document.querySelector('.stall-row:not([hidden]) .stall-eye')),
    sheet: s ? { r: R(s.querySelector('.sheet-paper') ?? s), title: txt(s.querySelector('.sheet-title, h2')), bodyR: R(body), scroll: body ? [body.scrollHeight, body.clientHeight, body.scrollTop] : null } : null,
    fix: fix ? { r: R(fix), t: txt(fix), sw: fix.scrollWidth, cw: fix.clientWidth, dis: fix.getAttribute('aria-disabled') ?? fix.disabled } : null,
    fixNote: txt(s?.querySelector('.fix-note, .fix-why')),
    dock: R(dock),
    subject: subj ? { tag: subjInner?.tagName, cls: subjInner?.className, r: R(subj), inBody: body && dock ? R(subj)?.[1] >= body.getBoundingClientRect().top - 1 && R(subj)?.[3] <= dock.getBoundingClientRect().top + 1 : null } : null,
    more: R(s?.querySelector('.c-more-btn')),
    letter: R(document.querySelector('.letter')), letterScroll: (() => { const l = document.querySelector('.letter'); return l ? [l.scrollHeight, l.clientHeight] : null; })(),
    act: act ? { r: R(act), t: txt(act) } : null,
    lossTxt: txt(document.querySelector('.letter')),
    sell: sell ? { r: R(sell), t: txt(sell), sw: sell.scrollWidth, cw: sell.clientWidth, hint: txt(document.querySelector('.sell-hint')), hintR: R(document.querySelector('.sell-hint')) } : null,
    focus: ring ? { el: `${a.tagName.toLowerCase()}.${[...a.classList].slice(0, 2).join('.')}`, r: R(a), outline: `${ring.outlineStyle} ${ring.outlineWidth} ${ring.outlineColor} off ${ring.outlineOffset}`, shadow: ring.boxShadow.slice(0, 120) } : null,
    pins: pins.slice(0, 4).map((b) => ({ r: R(b), n: b.getAttribute('aria-label'), cls: b.className })),
  };
}

async function run(browser, v, lang, sc) {
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const tag = `${sc.name}|${v.id}|${lang}`;
  const errors = [];
  try {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${URL0}?${sc.q}&quality=low&dynres=0&debug=1${THREE ? '' : '&view=flat'}&lang=${lang}`, { timeout: 120000 });
    await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
    await page.waitForTimeout(1200);
    if (sc.letter) await page.waitForSelector('.letter', { timeout: 60000 }).catch(() => null);
    else {
      const start = await page.$('.letter [data-a="start"]');
      if (start) { await page.evaluate(() => document.querySelector('.letter [data-a="start"]').click()); await page.waitForTimeout(600); }
    }
    if (sc.act) await sc.act(page);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(700);
    await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => 0))));
    await page.waitForTimeout(300);
    const m = await page.evaluate(`(${MEASURE})()`);
    const pr = await page.evaluate(probe);
    await page.screenshot({ path: `${out}/ui9-${sc.name}-${v.id}-${lang}.jpg`, type: 'jpeg', quality: 62, timeout: 180000 });
    return { tag, ...m, probe: pr, console: errors };
  } catch (e) {
    return { tag, error: String(e.message).split('\n')[0], console: errors };
  } finally { await ctx.close().catch(() => {}); }
}

const jobs = [];
// the full matrix is 288 jobs; the default plan: pl everywhere, pseudo without the focus/pin scenes, ar on the
// two portrait sizes, de (new keys still English, PENDING_KEYS) on the phone only. --all for everything.
const PLAN = (sc, v, lang) => argv.includes('--all') || lang === 'pl'
  || (lang === 'pseudo' && !/^(ring|pins)/.test(sc.name))
  || (lang === 'ar' && /412x915|904x1000/.test(v.id) && !/^(ring|pins|chain-m13)/.test(sc.name))
  || (lang === 'de' && /412x915|915x412/.test(v.id) && /^(m7-card|m3-sheet|m11-sheet|m1-lost|wagon|chain-m6)$/.test(sc.name));
for (const v of VIEWS) for (const lang of LANGS) for (const sc of SCENES) {
  if (ONLY && !ONLY.test(`${sc.name}|${v.id}|${lang}`)) continue;
  if (!PLAN(sc, v, lang)) continue;
  jobs.push([v, lang, sc]);
}
// the flat (Canvas2D) map needs no GL: without a GPU process the pages stay cheap on a shared 4-core box
const browser = await chromium.launch({ args: THREE || process.env.GL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--disable-gpu'] });
const results = [];
let k = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (k < jobs.length) {
    const [v, lang, sc] = jobs[k++];
    const r = await run(browser, v, lang, sc);
    results.push(r);
    const n = (r.offscreen?.length ?? 0) + (r.overlap?.length ?? 0) + (r.small?.length ?? 0) + (r.overflow?.length ?? 0);
    console.log(`${results.length}/${jobs.length} ${r.tag} ${r.error ? 'ERROR ' + r.error : `issues=${n}`} console=${r.console.length}`);
  }
}));
await browser.close();
results.sort((a, b) => a.tag.localeCompare(b.tag));
const file = resolve(out, arg('--report') ?? 'ui9-report.json');
writeFileSync(file, JSON.stringify(results, null, 1));
console.log('report', file);
