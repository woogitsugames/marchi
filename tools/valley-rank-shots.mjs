// Free-valley rank card (D-152) screenshots: a fresh valley at 412x915 — the card, and the castle's sheet it opens.
// Usage: node tools/valley-rank-shots.mjs <baseUrl> [outDir] [lang]   (expects `vite preview` running; ?debug=1 handle)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = (process.argv[2] ?? 'http://127.0.0.1:5202/').replace(/\/?$/, '/');
const out = process.argv[3] ?? 'docs/shots';
const lang = process.argv[4] ?? 'pl';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(`${base}?play=sandbox&speed=0&quality=low&dynres=0&lang=${lang}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__marchia?.ready, null, { timeout: 60000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const A = window.__marchia.app;
  while (A.world.state.tick < 200) A.loop.tickOnce();
  document.querySelectorAll('.rank-letter-wrap, .notice-wrap, .tutorial').forEach((e) => e.remove());
});
await page.waitForTimeout(1500);
const card = await page.evaluate(() => document.querySelector('.stall-card')?.textContent?.trim() ?? '(none)');
console.log('card:', card);
await page.screenshot({ path: `${out}/valley-rank-card-412x915.jpg`, type: 'jpeg', quality: 82, timeout: 120000 });
await page.evaluate(() => document.querySelector('.stall-eye')?.click());
await page.waitForTimeout(1500);
const fix = await page.evaluate(() => document.querySelector('.fix-btn')?.textContent?.trim() ?? '(none)');
console.log('sheet fix:', fix);
await page.screenshot({ path: `${out}/valley-rank-sheet-412x915.jpg`, type: 'jpeg', quality: 82, timeout: 120000 });
console.log('errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close();
