#!/usr/bin/env node
// Keyboard / screen-reader focus probes (research 2026-11-04, docs/research/2026-11-04-a11y-audit.md):
//   loss    focus a control inside an open Why sheet while the game runs (x1): is it still focused after 4 s,
//           or did a sheet refresh (setHtml -> innerHTML) drop it to <body>?
//   space   Space on a focused HUD button: does the global shortcut also toggle pause (app.ts onKey)?
//   trap    Tab from the last control of an aria-modal sheet: does focus leave the dialog?
// Usage: node tools/a11y-focus-probe.mjs   (server: npx vite --port 5199 --strictPort; URL0 to override)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL0 = process.env.URL0 ?? 'http://127.0.0.1:5199/';
const [w, h] = (process.argv[2] ?? '412x915').split('x').map(Number);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const desc = () => { const a = document.activeElement; return a ? `${a.tagName.toLowerCase()}.${[...a.classList].slice(0, 3).join('.')} "${(a.getAttribute('aria-label') ?? a.textContent ?? '').trim().slice(0, 40)}"` : 'none'; };
async function open(q) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${URL0}?debug=1&lang=pl&quality=low&dynres=0&${q}`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  return { ctx, page };
}
try {
  // loss: per focus target in the Why sheet, game running at x1
  for (const sel of ['.sheet .link.is-root', '.sheet .codex-tog', '.sheet .fix-btn', '.sheet .close']) {
    const { ctx, page } = await open('play=m1&ff=90&speed=1&open=bakery');
    await page.waitForSelector('.sheet', { timeout: 30000 }).catch(() => null);
    const ok = await page.evaluate((s) => { const el = document.querySelector(s); el?.focus(); return !!el && document.activeElement === el; }, sel);
    const before = await page.evaluate(desc);
    await page.waitForTimeout(4000);
    const after = await page.evaluate(desc);
    const kept = await page.evaluate((s) => document.activeElement === document.querySelector(s) && document.activeElement !== document.body, sel);
    console.log(`loss ${sel}: focused=${ok} before=${before} after4s=${after} kept=${kept}`);
    await ctx.close();
  }
  // space on a focused button
  {
    const { ctx, page } = await open('play=m1&ff=30&speed=1');
    const r = await page.evaluate(async () => {
      const b = document.querySelector('.rail .tool');
      b.focus();
      const speedBefore = window.__marchia.app.loop.speed;
      return { b: b.getAttribute('aria-label') ?? b.textContent.trim(), speedBefore };
    });
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ speed: window.__marchia.app.loop.speed, tool: window.__marchia.app.tool, pressed: document.querySelector('.rail .tool')?.getAttribute('aria-pressed') }));
    console.log(`space on "${r.b}": speed ${r.speedBefore} -> ${after.speed}, tool=${after.tool}, aria-pressed=${after.pressed}`);
    // character shortcut while focus is on a button: "h" hides the whole HUD
    await page.keyboard.press('h');
    await page.waitForTimeout(200);
    console.log(`key h: body.is-clear=${await page.evaluate(() => document.body.classList.contains('is-clear'))}`);
    await ctx.close();
  }
  // trap: Tab out of the sheet
  {
    const { ctx, page } = await open('play=m1&ff=90&speed=0&open=bakery');
    await page.waitForSelector('.sheet', { timeout: 30000 }).catch(() => null);
    const n = await page.evaluate(() => document.querySelectorAll('.sheet button:not([disabled])').length);
    await page.evaluate(() => { const bs = [...document.querySelectorAll('.sheet button:not([disabled])')]; bs[bs.length - 1]?.focus(); });
    await page.keyboard.press('Tab');
    const out = await page.evaluate(() => ({ inSheet: !!document.activeElement?.closest('.sheet'), modal: document.querySelector('.sheet')?.getAttribute('aria-modal'), at: document.activeElement?.tagName }));
    await page.keyboard.press('Tab');
    const out2 = await page.evaluate(desc);
    console.log(`trap: ${n} buttons in sheet; Tab after the last -> inSheet=${out.inSheet} (${out.at}), aria-modal=${out.modal}; next Tab -> ${out2}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
