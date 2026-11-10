// Readability audit (D-450): the recent stall cards and their sheets on three sizes. Each scene is a free-valley
// world written by tools/read-states.ts (state + terrain), staged in a built page through window.__marchia.app
// (speed 0, no ticks run): the HUD card, then the sheet its eye opens.
// Built game: npm run build; npx vite preview --port 5196 --strictPort.
//   npx tsx tools/read-states.ts <statesDir>
//   node tools/read-shots.mjs <statesDir> [baseUrl] [WxH ...] [--only k1,k2] -> docs/shots/read-<k>-{card,sheet}-<w>x<h>.jpg
// Prints per shot the card's kicker/text, the sheet's fix hint/button, every button under 48 px and every clipped
// text box (scrollWidth > clientWidth or scrollHeight > clientHeight on a non-scrolling element).
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const dir = resolve(args[0] ?? 'read-states');
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5196/';
const picked = args.filter((a) => /^\d+x\d+$/.test(a)).map((s) => s.split('x').map(Number));
const sizes = picked.length ? picked : [[412, 915], [915, 412], [904, 1000]];
const oi = args.indexOf('--only');
const only = oi >= 0 ? args[oi + 1].split(',') : null;
const lang = args.includes('--en') ? 'en' : 'pl';
const KINDS = ['filling', 'granaryFilling', 'cutOff', 'cutOffCrit', 'stoneDig', 'stoneComing', 'stoneIce']
  .filter((k) => (!only || only.includes(k)) && existsSync(resolve(dir, `${k}.json`)));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
let bad = 0;

/** In the page: small buttons and clipped text inside the card and the top sheet. */
function probe() {
  const out = { small: [], clipped: [] };
  const roots = [document.querySelector('.stall-row'), document.querySelector('#sheets .sheet:last-child')].filter(Boolean);
  for (const r of roots) {
    for (const b of r.querySelectorAll('button, [role=button], a')) {
      const q = b.getBoundingClientRect();
      if (!q.width || !q.height || getComputedStyle(b).visibility === 'hidden') continue;
      if (q.width < 47.5 || q.height < 47.5) out.small.push(`${b.className || b.tagName} ${Math.round(q.width)}x${Math.round(q.height)} "${(b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 30)}"`);
    }
    for (const e of r.querySelectorAll('*')) {
      const cs = getComputedStyle(e);
      if (!e.childNodes.length || cs.display === 'none') continue;
      const scroll = /(auto|scroll)/.test(cs.overflowY + cs.overflowX);
      if (scroll) continue;
      if ((cs.overflow !== 'visible' || cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none') &&
        (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)) {
        out.clipped.push(`${e.className || e.tagName} ${e.clientWidth}x${e.clientHeight} < ${e.scrollWidth}x${e.scrollHeight} "${(e.textContent || '').trim().slice(0, 40)}"`);
      }
    }
  }
  // the card off-screen or under another HUD piece
  const card = document.querySelector('.stall-row');
  if (card && !card.hidden) {
    const q = card.getBoundingClientRect();
    if (q.left < 0 || q.top < 0 || q.right > innerWidth + 0.5 || q.bottom > innerHeight + 0.5) out.clipped.push(`stall-row off-screen ${Math.round(q.left)},${Math.round(q.top)},${Math.round(q.right)},${Math.round(q.bottom)}`);
  }
  return out;
}

for (const k of KINDS) {
  const snap = readFileSync(resolve(dir, `${k}.json`), 'utf8');
  for (const [w, h] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.setDefaultNavigationTimeout(180000);
    page.on('pageerror', (e) => errors.push(`${k} ${w}x${h}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${k} ${w}x${h}: ${m.text()}`); });
    await page.goto(`${base}?play=sandbox&speed=0&quality=low&dynres=0&debug=1&lang=${lang}&view=flat`);
    await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
    await page.waitForTimeout(500);
    const focus = await page.evaluate((raw) => {
      const s = JSON.parse(raw);
      const A = window.__marchia.app;
      A.enterGame({ terrain: s.terrain, state: s.state, cache: null, scratch: null, seasons: true });
      A.loop.speed = 0;
      A.hud?.setSpeed(0);
      return s.focus;
    }, snap);
    await page.waitForTimeout(2000);
    const card = await page.evaluate(() => {
      const row = document.querySelector('.stall-row');
      return {
        cls: row?.className ?? null,
        kick: document.querySelector('.sc-kick')?.textContent?.trim() ?? null,
        text: document.querySelector('.sc-text')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        cure: [...document.querySelectorAll('.is-cure')].map((e) => e.getAttribute('data-tool') ?? e.className).join(','),
      };
    });
    const pc = await page.evaluate(probe);
    console.log(`${k} ${w}x${h} card ${JSON.stringify(card)}`);
    for (const s of pc.small) console.log(`   small: ${s}`);
    for (const s of pc.clipped) console.log(`   clipped: ${s}`);
    if (!card.text) bad++;
    const suffix = lang === 'pl' ? '' : `-${lang}`;
    await page.screenshot({ path: `docs/shots/read-${k}-card-${w}x${h}${suffix}.jpg`, type: 'jpeg', quality: 62, timeout: 120000 });
    // the card's eye: the camera goes there and the sheet opens (as the player's one tap)
    if (await page.$('.stall-eye')) await page.click('.stall-eye');
    else await page.evaluate((id) => window.__marchia.app.go('building', id, true), focus);
    // the camera flies first, then the sheet slides in: wait until it stands and no animation runs
    await page.waitForFunction(() => {
      const sh = document.querySelector('#sheets .sheet:last-child');
      return !!sh && document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity);
    }, null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const sheet = await page.evaluate(() => {
      const sh = document.querySelector('#sheets .sheet:last-child');
      return {
        title: sh?.querySelector('h2, .s-title')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        status: sh?.querySelector('.s-status, .status')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        hint: [...(sh?.querySelectorAll('.fix .s-hint, .s-hint') ?? [])].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).join(' | ') || null,
        btn: [...(sh?.querySelectorAll('.fix-btn, .btn') ?? [])].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).join(' | ') || null,
      };
    });
    const ps = await page.evaluate(probe);
    console.log(`${k} ${w}x${h} sheet ${JSON.stringify(sheet)}`);
    for (const s of ps.small) console.log(`   small: ${s}`);
    for (const s of ps.clipped) console.log(`   clipped: ${s}`);
    await page.screenshot({ path: `docs/shots/read-${k}-sheet-${w}x${h}${suffix}.jpg`, type: 'jpeg', quality: 62, timeout: 120000 });
    await ctx.close();
  }
}
await browser.close();
console.log(`console errors: ${errors.length}`);
for (const e of errors) console.log('  ', e);
process.exit(bad || errors.length ? 1 : 0);
