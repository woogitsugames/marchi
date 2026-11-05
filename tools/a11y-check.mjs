#!/usr/bin/env node
// Accessibility check in a real browser (BACKLOG P3; layout-check covers target sizes ≥ 48 px per screen).
// Reads Chromium's accessibility tree over CDP (Accessibility.getFullAXTree) and the computed styles:
//   live      the HUD has polite live regions (toasts, the screen-reader line) and the notice is a status
//   pins      every stall pin is a button whose accessible name is "<building>: <cause>"
//   dialog    an open sheet is a named NON-modal dialog (D-118: the map and HUD work beside it), focus moves into it
//             and returns on close
//   letter    the opening letter is a named modal dialog with focus on its action, the rest of the UI is inert (D-118)
//   motion    with prefers-reduced-motion: reduce every running CSS animation / transition lasts ≤ 1 ms
// Exit 1 on any failure. Usage: npm run a11y   (A11Y_URL=http://127.0.0.1:5173/ to use a running server)
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let server = null;
let base = process.env.A11Y_URL;
if (!base) {
  const { createServer } = await import('vite');
  server = await createServer({ root, server: { port: 5177, strictPort: false, host: '127.0.0.1', hmr: false }, logLevel: 'warn' });
  await server.listen();
  base = server.resolvedUrls.local[0];
}
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const failures = [];
const errors = [];
const ok = (cond, what) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`); if (!cond) failures.push(what); };

async function open(q, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}?debug=1&lang=pl&${q}`);
  await page.waitForFunction(() => window.__marchia?.ready, null, { timeout: 90000 });
  return { ctx, page };
}

async function axNodes(page) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  await cdp.detach();
  const prop = (n, name) => n.properties?.find((p) => p.name === name)?.value?.value;
  return nodes.filter((n) => !n.ignored).map((n) => ({
    role: n.role?.value ?? '', name: n.name?.value ?? '', live: prop(n, 'live'), modal: prop(n, 'modal'),
  }));
}

try {
  // --- live regions and pins on a running contract (bot builds, stalls appear)
  {
    const { ctx, page } = await open('play=m1&ff=90&speed=0');
    await page.waitForTimeout(1500);
    const ax = await axNodes(page);
    const polite = ax.filter((n) => n.live === 'polite');
    ok(polite.length >= 2, `live: ${polite.length} polite live regions (toasts + screen-reader line)`);
    const pins = await page.$$eval('button.bubble', (els) => els.filter((e) => e.style.visibility !== 'hidden').map((e) => e.getAttribute('aria-label') ?? ''));
    ok(pins.length > 0, `pins: ${pins.length} stall pins on screen`);
    ok(pins.every((l) => /\S.*: \S/.test(l)), `pins: every pin is named "<building>: <cause>" (${pins.slice(0, 2).join(' | ')})`);
    const axPins = ax.filter((n) => n.role === 'button' && pins.includes(n.name));
    ok(axPins.length === pins.length, `pins: all ${pins.length} reach the accessibility tree as buttons (${axPins.length})`);
    await ctx.close();
  }
  // --- a sheet is a named non-modal dialog (D-118); focus in and back
  {
    const { ctx, page } = await open('play=m1&ff=90&speed=0');
    await page.waitForTimeout(800);
    const before = await page.evaluate(() => { const b = document.querySelector('.stall-eye'); b?.focus(); return !!b; });
    ok(before, 'dialog: worst-stall eye button present');
    await page.evaluate(() => document.querySelector('.stall-eye')?.click());
    await page.waitForSelector('.sheet[role="dialog"]', { timeout: 10000 }).catch(() => null);
    const ax = await axNodes(page);
    const dlg = ax.find((n) => n.role === 'dialog');
    ok(!!dlg && dlg.modal !== true && dlg.name.trim().length > 0, `dialog: non-modal dialog named "${dlg?.name ?? ''}"`);
    const inside = await page.evaluate(() => !!document.activeElement?.closest('.sheet'));
    ok(inside, 'dialog: focus moved into the sheet');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    if (process.env.A11Y_DEBUG) console.log(await page.evaluate(() => ({ sheets: document.querySelectorAll('.sheet').length, active: document.activeElement?.outerHTML.slice(0, 120) })));
    let back = await page.evaluate(() => document.activeElement?.classList.contains('stall-eye') ?? false);
    if (!back) {
      // Escape may not close every sheet: use its close button, as a player would
      await page.evaluate(() => document.querySelector('.sheet .close, .sheet [data-a="close"]')?.click());
      await page.waitForTimeout(400);
      back = await page.evaluate(() => document.activeElement?.classList.contains('stall-eye') ?? false);
    }
    ok(back, 'dialog: focus returned to the eye button that opened it');
    await ctx.close();
  }
  // --- a letter is a real modal: named, focus on its action, everything under it inert, released on close
  {
    const { ctx, page } = await open('play=m1&tut=1');
    await page.waitForSelector('.letter[role="dialog"]', { timeout: 30000 }).catch(() => null);
    await page.waitForTimeout(400);
    const ax = await axNodes(page);
    const dlg = ax.find((n) => n.role === 'dialog');
    ok(!!dlg && dlg.modal === true && dlg.name.trim().length > 0, `letter: modal dialog named "${dlg?.name ?? ''}"`);
    ok(await page.evaluate(() => !!document.activeElement?.closest('.letter')), 'letter: focus on the letter');
    ok(await page.evaluate(() => !!document.querySelector('#hud')?.closest('[inert]')), 'letter: the HUD under it is inert');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    ok(await page.evaluate(() => document.querySelectorAll('[inert]').length === 0), 'letter: nothing inert once it is closed');
    await ctx.close();
  }
  // --- the end letter: the dimmed HUD under its scrim is inert (out of the AX tree), so its low contrast there is
  //     by design; every visible text outside the letter must sit in an inert subtree (day 9b, D-131)
  {
    const { ctx, page } = await open('play=m1&ff=730&speed=0');
    await page.waitForSelector('.letter[role="dialog"]', { timeout: 60000 }).catch(() => null);
    await page.waitForTimeout(600);
    const ax = await axNodes(page);
    const dlg = ax.find((n) => n.role === 'dialog');
    ok(!!dlg && dlg.modal === true && dlg.name.trim().length > 0, `end letter: modal dialog named "${dlg?.name ?? ''}"`);
    const loose = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('#ui *')) {
        if (el.closest('.scrim, [inert], [hidden], [aria-hidden="true"], .sr-only')) continue;
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        const r = el.getBoundingClientRect();
        if (own && r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden') out.push(el.textContent.trim().slice(0, 30));
      }
      return out;
    });
    ok(loose.length === 0, `end letter: no live text outside the letter${loose.length ? ` (${loose.slice(0, 4).join(' | ')})` : ''}`);
    await ctx.close();
  }
  // --- reduced motion: everything that moves finishes at once
  {
    const { ctx, page } = await open('play=m1&bot=1&ff=150&speed=0', { reduced: true });
    await page.waitForTimeout(800);
    // open and close a sheet and raise a toast so transitions and animations are in flight
    await page.evaluate(() => document.querySelector('.stall-eye')?.click());
    await page.waitForTimeout(50);
    const slow = await page.evaluate(() => {
      const ms = (v) => Math.max(...v.split(',').map((x) => (x.trim().endsWith('ms') ? parseFloat(x) : parseFloat(x) * 1000)));
      const out = [];
      for (const el of document.querySelectorAll('#ui *')) {
        for (const pseudo of [null, '::before', '::after']) {
          const cs = getComputedStyle(el, pseudo);
          const a = cs.animationName !== 'none' ? ms(cs.animationDuration) : 0;
          const t = cs.transitionProperty !== 'none' ? ms(cs.transitionDuration) : 0;
          if (a > 1 || t > 1) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}${pseudo ?? ''} anim ${a} ms trans ${t} ms`);
        }
      }
      return out;
    });
    ok(slow.length === 0, `motion: no animation or transition over 1 ms with reduced motion${slow.length ? ` (${slow.slice(0, 3).join('; ')})` : ''}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  if (server) await server.close();
}
ok(errors.length === 0, `console: ${errors.length} errors${errors.length ? ` (${errors.slice(0, 2).join(' | ')})` : ''}`);
console.log(`A11Y failed=${failures.length}`);
process.exit(failures.length ? 1 : 0);
