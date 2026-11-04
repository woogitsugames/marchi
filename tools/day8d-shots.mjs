// Day 8d screenshots: the a11y fix batch (docs/research/2026-11-04-a11y-audit.md).
// Built game: npm run build; npx vite preview --port 5211.
//   node tools/day8d-shots.mjs [baseUrl] [case ...] [WxH ...] [lang=xx] [out=dir] -> <out>/day8d-<case>-<w>x<h>[-xx].jpg
// Default out: docs/shots. Cases with "text200" scale every font-size x2 (as Android WebView textZoom does).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5211/';
const sizes = args.filter((a) => /^\d+x\d+$/.test(a)).map((s) => s.split('x').map(Number));
const lang = (args.find((a) => a.startsWith('lang=')) ?? 'lang=pl').slice(5);
const out = (args.find((a) => a.startsWith('out=')) ?? 'out=docs/shots').slice(4);

const tab = (n) => async (p) => { for (let k = 0; k < n; k++) await p.keyboard.press('Tab'); await p.waitForTimeout(300); };
const focus = (sel) => async (p) => {
  await p.keyboard.press('Shift'); // keyboard modality: programmatic focus shows the ring
  await p.evaluate((s) => { const el = document.querySelector(s); el?.focus(); el?.scrollIntoView?.({ block: 'nearest' }); }, sel);
  await p.waitForTimeout(400);
};
const scale2 = async (p) => {
  await p.evaluate(() => {
    const els = [...document.querySelectorAll('#ui *, body > div *')];
    const sizes = els.map((el) => parseFloat(getComputedStyle(el).fontSize));
    els.forEach((el, k) => { el.style.setProperty('font-size', `${sizes[k] * 2}px`, 'important'); });
  });
  await p.waitForTimeout(400);
};
const ALL = {
  // 1: the end letter with focus on its first action, the HUD inert under it
  end: { q: 'play=m1&bot=1&ff=600', wait: 2500, sel: '.letter[role="dialog"]' },
  // 3: settings with the shortcuts toggle; "h" hides the HUD and focuses "Pokaż przyciski"
  settings: { q: '', act: async (p) => { await p.evaluate(() => document.querySelector('.menu-settings')?.click()); await p.waitForTimeout(800); await p.evaluate(() => { const b = document.querySelector('.sheet-body'); if (b) b.scrollTop = b.scrollHeight; }); await p.waitForTimeout(300); } },
  clear: { q: 'play=m1&ff=90&speed=0', act: async (p) => { await p.evaluate(() => { window.__marchia.app.prefs.shortcuts = true; document.activeElement?.blur(); }); await p.keyboard.press('h'); await p.waitForTimeout(600); } },
  // 4: focus on the chain root above the docked "Naprawa"; 200 % text in the Why sheet
  'why-focus': { q: 'play=m1&ff=90&speed=0&open=bakery', act: focus('.sheet .link.is-root') },
  'why-text200': { q: 'play=m1&ff=90&speed=0&open=bakery', act: scale2 },
  'why-codex-focus': { q: 'play=m1&ff=90&speed=0&open=bakery', act: async (p) => { await p.evaluate(() => document.querySelector('.sheet .codex-tog')?.click()); await p.waitForTimeout(600); await focus('.sheet .link.is-root')(p); } },
  // 5: the focus ring on parchment (sheet) and over the map (pin, tool card)
  'ring-sheet': { q: 'play=m1&ff=90&speed=0&open=bakery', act: focus('.sheet .codex-tog') },
  'ring-map': { q: 'play=m1&ff=90&speed=0', act: focus('button.bubble.is-shown') },
  'ring-rail': { q: 'play=m1&ff=90&speed=0', act: focus('.rail .tool') },
  // 6: pins by day, at night, in winter
  'pins-day': { q: 'play=m1&ff=90&speed=0' },
  'pins-night': { q: 'play=m1&ff=90&speed=0', act: async (p) => { await p.evaluate(() => { window.__marchia.app.view.debug.forceTime = 0.1; }); await p.waitForTimeout(900); } },
  'pins-winter': { q: 'play=m4&ff=108&speed=0' },
  // 7: contrast: menu subtitles, "brak N" on the hatched card, the wagon ETA
  menu: { q: '' },
  hud: { q: 'play=m1&bot=1&ff=120&speed=0' },
  wagon: { q: 'play=m1&bot=1&ff=150&speed=0&wagon=1' },
};
const pick = args.filter((a) => ALL[a]);
const cases = pick.length ? pick : Object.keys(ALL);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const [w, h] of sizes.length ? sizes : [[412, 915], [915, 412]]) for (const id of cases) {
  const c = ALL[id];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.on('pageerror', (e) => errors.push(`${id} ${w}x${h}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${id} ${w}x${h}: ${m.text()}`); });
  await page.goto(`${base}?quality=low&dynres=0&debug=1&lang=${lang}${c.q ? '&' + c.q : ''}`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(c.wait ?? 1500);
  if (c.sel) { await page.waitForSelector(c.sel, { timeout: 60000 }).catch(() => null); await page.waitForTimeout(500); }
  if (c.q && !c.q.includes('ff=600')) {
    const start = await page.$('.letter [data-a="start"]');
    if (start) { await start.click(); await page.waitForTimeout(600); }
  }
  if (c.act) await c.act(page);
  const info = await page.evaluate(() => {
    const a = document.activeElement;
    return {
      focus: a && a !== document.body ? `${a.tagName.toLowerCase()}.${[...a.classList].slice(0, 2).join('.')} "${(a.getAttribute('aria-label') ?? a.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)}"` : 'body',
      inert: [...document.querySelectorAll('[inert]')].map((e) => e.id || e.className).join(','),
      pins: [...document.querySelectorAll('button.bubble.is-shown')].slice(0, 3).map((b) => b.getAttribute('aria-label')),
    };
  });
  console.log(`${id} ${w}x${h}`, JSON.stringify(info));
  await page.screenshot({ path: `${out}/day8d-${id}-${w}x${h}${lang === 'pl' ? '' : '-' + lang}.jpg`, type: 'jpeg', quality: 55, timeout: 120000 });
  await ctx.close();
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
