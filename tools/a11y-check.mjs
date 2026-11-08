#!/usr/bin/env node
// Accessibility check in a real browser (BACKLOG P3; layout-check covers target sizes ≥ 48 px per screen).
// Reads Chromium's accessibility tree over CDP (Accessibility.getFullAXTree) and the computed styles:
//   live      the HUD has polite live regions (toasts, the screen-reader line) and the notice is a status
//   pins      every stall pin is a button whose accessible name is "<building>: <cause>"
//   dialog    an open sheet is a named NON-modal dialog (D-118: the map and HUD work beside it), focus moves into it
//             and returns on close
//   letter    the opening letter is a named modal dialog with focus on its action, the rest of the UI is inert (D-118)
//   ring      the focus ring is painted around a chamfered (.cf) button, read from the pixels (D-137); round on
//             the stall card's eye and a pin's head (D-147)
//   motion    with prefers-reduced-motion: reduce every running CSS animation / transition lasts ≤ 1 ms
//   forced    in forced colors (dark system palette) every visible woodcut icon sits on a Canvas plate and the
//             contract bars keep an outline (D-348)
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
  const ctx = await browser.newContext({
    viewport: opts.viewport ?? { width: 412, height: 915 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference',
    ...(opts.forced ? { forcedColors: 'active', colorScheme: opts.forced === 'light' ? 'light' : 'dark' } : {}),
  });
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
  // --- a pin hidden under the HUD (short landscape: under the rail or the card) is no Tab stop (D-143)
  {
    const { ctx, page } = await open('play=m1&ff=90&speed=0&view=flat', { viewport: { width: 915, height: 412 } });
    await page.waitForTimeout(1500);
    const under = await page.$$eval('button.bubble.is-under', (els) => els.length);
    let hit = 0;
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement?.matches('.bubble.is-under') ?? false)) hit++;
    }
    ok(hit === 0, `pins: no Tab stop on the ${under} pin(s) under the HUD at 915x412 (${hit} stops)`);
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
    // focus moves in on the next animation frame: under load a frame can take longer than the evaluate round trip
    const inside = await page.waitForFunction(() => !!document.activeElement?.closest('.sheet'), null, { timeout: 5000 }).then(() => true, () => false);
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
  // --- the focus ring is painted, not only computed (D-137, ui audit day 9 P1): Tab to the wine fix button (a
  //     chamfered .cf surface, whose clip-path used to clip the ring) and read the pixels just outside its edges:
  //     the ink line at 2-4 px and the outer pale band at 4-6 px must both be there along the top and the bottom edge
  {
    const { ctx, page } = await open('play=m11&ff=300&speed=0&quality=low&dynres=0&view=flat');
    await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelector('.stall-eye')?.click());
    await page.waitForSelector('.sheet .fix-btn', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(600);
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      await page.keyboard.press('Tab');
      found = await page.evaluate(() => document.activeElement?.classList.contains('fix-btn') ?? false);
    }
    ok(found, 'ring: Tab reaches the fix button');
    if (found) {
      await page.evaluate(() => document.activeElement.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => { const b = document.activeElement.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
      const pad = 12;
      const clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.w + 2 * pad, height: r.h + 2 * pad };
      const png = (await page.screenshot({ clip })).toString('base64');
      const res = await page.evaluate(async ({ png, r, clip }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${png}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const sx = img.width / clip.width;
        const lum = (x, y) => { const d = g.getImageData(Math.round((x - clip.x) * sx), Math.round((y - clip.y) * sx), 1, 1).data; return 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]; };
        let ink = 0, pale = 0, n = 0;
        for (let k = 1; k <= 10; k++) {
          const x = r.x + 16 + (k * (r.w - 32)) / 11;
          for (const [yi, yp] of [[r.y - 3, r.y - 5], [r.y + r.h + 3, r.y + r.h + 5]]) {
            n++;
            if (lum(x, yi) < 70) ink++;
            if (lum(x, yp) > 190) pale++;
          }
        }
        return { ink, pale, n };
      }, { png, r, clip });
      ok(res.ink >= res.n - 2 && res.pale >= res.n - 2, `ring: painted around the focused fix button (ink ${res.ink}/${res.n}, pale ${res.pale}/${res.n})`);
    }
    await ctx.close();
  }
  // --- round rings (D-147, ui audit day 9 P3-3): on the stall card's eye and on a pin the two-tone ring follows the
  //     round shape. Pixels: the ink line on a circle 3 px outside the disc, and no ink where a square ring's
  //     corner would be (the eye sits on the parchment card, so a corner without a ring reads light)
  {
    const { ctx, page } = await open('play=m7&ff=90&speed=0&quality=low&dynres=0&view=flat');
    await page.waitForTimeout(800);
    const read = async (page, sel, head) => {
      await page.keyboard.press('Shift');
      const r = await page.evaluate(({ sel, head }) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        el.focus();
        if (!el.matches(':focus-visible')) return null;
        const b = (head ? el.querySelector(head) : el).getBoundingClientRect();
        // the pin's head is the top 40 x 40 of its 40 x 48 image (scaled for minor pins)
        const d = b.width;
        return { cx: b.left + b.width / 2, cy: b.top + d / 2, rad: d / 2, x: b.left, y: b.top };
      }, { sel, head });
      if (!r) return null;
      await page.waitForTimeout(250);
      const pad = 14;
      const clip = { x: Math.max(0, r.cx - r.rad - pad), y: Math.max(0, r.cy - r.rad - pad), width: 2 * (r.rad + pad), height: 2 * (r.rad + pad) };
      const png = (await page.screenshot({ clip })).toString('base64');
      return page.evaluate(async ({ png, r, clip }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${png}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const sx = img.width / clip.width;
        const lum = (x, y) => { const d = g.getImageData(Math.round((x - clip.x) * sx), Math.round((y - clip.y) * sx), 1, 1).data; return 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]; };
        let ink = 0, n = 0;
        for (let k = 0; k < 12; k++) {
          const a = (k * Math.PI) / 6 + 0.2;
          n++;
          // 3 px outside the disc: the ink band; the darkest of 2.5 / 3 / 3.5 px absorbs rounding
          if (Math.min(...[2.5, 3, 3.5].map((o) => lum(r.cx + Math.cos(a) * (r.rad + o), r.cy + Math.sin(a) * (r.rad + o)))) < 70) ink++;
        }
        const s = r.rad + 3;
        const corners = [[r.cx - s, r.cy - s], [r.cx + s, r.cy - s]].filter(([x, y]) => lum(x, y) < 70).length;
        return { ink, n, corners };
      }, { png, r, clip });
    };
    const eye = await read(page, '.stall-row:not([hidden]) .stall-eye', null);
    ok(!!eye && eye.ink >= eye.n - 2 && eye.corners === 0, `ring: round around the stall card's eye (ink ${eye?.ink}/${eye?.n}, square corners ${eye?.corners})`);
    await ctx.close();
    // mission I's red pins (VII's sit off the portrait view)
    const m1 = await open('play=m1&ff=90&speed=0&quality=low&dynres=0&view=flat');
    const pinSel = 'button.bubble.is-shown:not(.is-under):not(.is-minor):not(.is-wagon)';
    await m1.page.waitForSelector(pinSel, { timeout: 20000 }).catch(() => null);
    await m1.page.waitForTimeout(400); // the pin fades in (150 ms) and settles its breathe
    const pin = await read(m1.page, pinSel, '.bb');
    ok(!!pin && pin.ink >= pin.n - 2, `ring: round around a pin's head (ink ${pin?.ink}/${pin?.n})`);
    await m1.ctx.close();
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
  // --- forced colors (dark palette): icons are plated like text, bars outlined
  {
    const { ctx, page } = await open('play=m1&bot=1&ff=120&speed=0', { forced: true });
    await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelector('.letter [data-a="start"]')?.click());
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const vis = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !el.closest('[hidden]'); };
      const icons = [...document.querySelectorAll('svg[role="img"]')].filter(vis);
      const bare = icons.filter((el) => /rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(el).backgroundColor));
      const bars = [...document.querySelectorAll('.kbar')].filter(vis);
      return { forced: matchMedia('(forced-colors: active)').matches, icons: icons.length, bare: bare.length,
        bars: bars.length, outlined: bars.filter((el) => parseFloat(getComputedStyle(el).borderTopWidth) >= 1).length };
    });
    ok(r.forced && r.icons > 0 && r.bare === 0, `forced: ${r.icons} icons on a Canvas plate (${r.bare} bare)`);
    ok(r.bars > 0 && r.outlined === r.bars, `forced: ${r.outlined}/${r.bars} contract bars outlined`);
    await ctx.close();
  }
  // --- forced colors (light palette, D-354): the primary button keeps an edge, the focus ring is 3 px Highlight
  {
    const { ctx, page } = await open('play=m1&speed=0', { forced: 'light' });
    await page.waitForSelector('.letter [data-a="start"]', { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.focus('.letter [data-a="start"]');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const b = document.querySelector('.letter [data-a="start"]');
      const cs = getComputedStyle(b);
      return { focused: document.activeElement === b, border: parseFloat(cs.borderTopWidth), borderStyle: cs.borderTopStyle,
        ring: parseFloat(cs.outlineWidth), ringStyle: cs.outlineStyle };
    });
    ok(r.border >= 2 && r.borderStyle === 'solid', `forced light: primary button border ${r.border}px ${r.borderStyle}`);
    ok(r.focused && r.ring >= 3 && r.ringStyle === 'solid', `forced light: focus ring ${r.ring}px ${r.ringStyle} on the primary button`);
    await ctx.close();
  }
} finally {
  await browser.close();
  if (server) await server.close();
}
ok(errors.length === 0, `console: ${errors.length} errors${errors.length ? ` (${errors.slice(0, 2).join(' | ')})` : ''}`);
console.log(`A11Y failed=${failures.length}`);
process.exit(failures.length ? 1 : 0);
