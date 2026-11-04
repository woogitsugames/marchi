#!/usr/bin/env node
// Accessibility audit of the current build (research, 2026-11-04; report docs/research/2026-11-04-a11y-audit.md).
// Broader than tools/a11y-check.mjs (which is a pass/fail gate): per screen and viewport it dumps
//   ax        role / name / states of every interactive element (Chromium AX tree over CDP), flags unnamed
//             controls, clickable non-buttons, disabled buttons that carry information
//   target    hit boxes under 48 x 48 CSS px (visible, interactive)
//   contrast  text colour vs. the composited background behind it (WCAG ratio); text over the canvas/map or an
//             image background is reported separately as "over-map" with the colour of its own plate, if any
//   pins      map pins: sampled map pixels around each pin vs. the pin plate (non-text contrast, 3:1)
//   focus     Tab order (up to 60 stops): element, visible focus indicator, inside the viewport, inside the open dialog
//   scale     text scaled to 200 % (every computed font-size x2, as Android WebView textZoom does): clipped text,
//             controls pushed out of the viewport, then a screenshot
// No axe-core (not installed, not available offline): the checks are written here.
// Usage: node tools/a11y-audit.mjs <outdir> [WxH ...]   server: npx vite --port 5199 --strictPort
// Env: URL0 (default http://127.0.0.1:5199/), SCENES (comma list of scene ids), LANGS (default pl; e.g. pl,ar)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL0 = process.env.URL0 ?? 'http://127.0.0.1:5199/';
const out = process.argv[2] ?? 'docs/research/a11y-audit';
mkdirSync(out, { recursive: true });
const sizes = (process.argv.slice(3).length ? process.argv.slice(3) : ['412x915', '915x412']).map((s) => s.split('x').map(Number));
const langs = (process.env.LANGS ?? 'pl').split(',');

/** Scenes: query + an optional action after the page is ready. */
const SCENES = [
  { id: 'menu', q: '' },
  { id: 'settings', q: '', act: async (p) => { await clickFirst(p, '[data-a="settings"], [data-m="settings"], .menu [data-a*="sett"]'); } },
  { id: 'hud', q: 'play=m1&bot=1&ff=120&speed=0' },
  { id: 'why', q: 'play=m1&ff=90&speed=0&open=bakery' },
  { id: 'why-codex', q: 'play=m1&ff=90&speed=0&open=bakery', act: async (p) => { await clickFirst(p, '.sheet .codex-tog'); } },
  { id: 'wagon', q: 'play=m1&bot=1&ff=150&speed=0&wagon=1' },
  { id: 'castle', q: 'play=m1&bot=1&ff=120&speed=0&open=castle' },
  { id: 'tutorial', q: 'play=m1&tut=1' },
  { id: 'end', q: 'play=m1&bot=1&ff=600', wait: 2500 },
  { id: 'winter', q: 'play=m7&bot=1&ff=400&speed=0' },
].filter((s) => !process.env.SCENES || process.env.SCENES.split(',').includes(s.id));

async function clickFirst(page, sel) {
  const ok = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return false; el.click(); return true; }, sel);
  await page.waitForTimeout(600);
  return ok;
}

// ---------------------------------------------------------------- in-page collectors (serialised into the page)

/** Tags interactive elements with data-a11y-i and returns geometry + style facts for each. */
function collectInteractive() {
  const sel = 'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="switch"], [role="checkbox"], [role="slider"], [tabindex], summary, [data-act], [data-go], [data-a], [data-wb], [data-set]';
  const seen = new Set();
  const list = [];
  const all = [...document.querySelectorAll(sel)];
  // clickable-looking elements that are none of the above
  for (const el of document.querySelectorAll('#ui *, body > *')) {
    if (seen.has(el) || all.includes(el)) continue;
    if (getComputedStyle(el).cursor === 'pointer' && !el.closest(sel)) all.push(el);
  }
  let i = 0;
  for (const el of all) {
    if (seen.has(el)) continue;
    seen.add(el);
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    let vis = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && el.closest('[hidden]') === null;
    for (let p = el; p && vis; p = p.parentElement) { const c = getComputedStyle(p); if (c.display === 'none' || Number(c.opacity) === 0) vis = false; }
    const inView = r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
    el.setAttribute('data-a11y-i', String(i));
    list.push({
      i: i++, tag: el.tagName.toLowerCase(), cls: [...el.classList].slice(0, 4).join('.'),
      attrs: ['role', 'tabindex', 'aria-label', 'aria-pressed', 'aria-expanded', 'aria-hidden', 'disabled', 'data-act', 'data-go', 'data-a', 'data-wb']
        .filter((a) => el.hasAttribute(a)).map((a) => `${a}=${(el.getAttribute(a) ?? '').slice(0, 40)}`).join(' '),
      text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
      w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top),
      vis, inView, pointer: cs.cursor === 'pointer', pe: cs.pointerEvents,
      inDialog: !!el.closest('[role="dialog"]'),
    });
  }
  return list;
}

/** Text contrast: every element with its own visible text. */
function collectContrast() {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
  };
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const out = [];
  for (const el of document.querySelectorAll('#ui *, body > div *')) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || el.closest('[hidden], .sr-only, [aria-hidden="true"]')) continue;
    let hidden = false;
    for (let p = el; p; p = p.parentElement) { const c = getComputedStyle(p); if (c.display === 'none' || Number(c.opacity) === 0) { hidden = true; break; } }
    if (hidden) continue;
    let fg = parse(cs.color);
    if (!fg) continue;
    // walk up collecting backgrounds until an opaque one
    const layers = [];
    let image = false, base = null, mapUnder = true;
    for (let p = el; p; p = p.parentElement) {
      const c = getComputedStyle(p);
      if (c.backgroundImage !== 'none' && !/gradient/.test(c.backgroundImage)) { image = true; }
      const bg = parse(c.backgroundColor);
      if (bg && bg[3] > 0) { layers.push(bg); if (bg[3] >= 0.999) { base = bg; mapUnder = false; break; } }
      if (image) break;
    }
    let bg = base ?? [128, 128, 128, 1];
    for (let k = layers.length - (base ? 2 : 1); k >= 0; k--) bg = over(layers[k], bg);
    if (fg[3] < 1) fg = over(fg, bg);
    const size = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    out.push({
      text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 50), sel: `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 3).join('.')}`,
      parent: el.parentElement ? `${el.parentElement.tagName.toLowerCase()}.${[...el.parentElement.classList].slice(0, 2).join('.')}` : '',
      fg: cs.color, size, bold, large, image, mapUnder: mapUnder && !image,
      ratio: image || (mapUnder && !layers.length) ? null : Math.round(ratio(fg, bg) * 100) / 100,
      shadow: cs.textShadow !== 'none',
    });
  }
  return out;
}

/** Overflow after the 200 % text scale. */
function scaleText() {
  const els = [...document.querySelectorAll('#ui *, body > div *')];
  const sizes = els.map((el) => parseFloat(getComputedStyle(el).fontSize));
  els.forEach((el, k) => { el.style.setProperty('font-size', `${sizes[k] * 2}px`, 'important'); });
  return els.length;
}
function scaleIssues() {
  const issues = [];
  for (const el of document.querySelectorAll('#ui *, body > div *')) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || el.closest('[hidden]')) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    const clipX = (cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 2;
    const clipY = cs.overflowY === 'hidden' && el.scrollHeight > el.clientHeight + 2;
    const interactive = el.matches('button, [role="button"], a[href], input, select');
    const off = interactive && (r.right > innerWidth + 1 || r.left < -1 || r.top > innerHeight - 4 || r.bottom < 0);
    if ((own && (clipX || clipY)) || off) {
      issues.push({ sel: `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 3).join('.')}`, text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 40), clipX, clipY, off, w: Math.round(r.width), x: Math.round(r.left), y: Math.round(r.top) });
    }
  }
  return issues;
}

/** One Tab stop: what got focus, does it show it, is it on screen. */
function focusInfo() {
  const el = document.activeElement;
  if (!el || el === document.body) return { tag: 'body' };
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow !== 'none' && /focus|0px 0px 0px/.test(cs.boxShadow + ''));
  return {
    tag: el.tagName.toLowerCase(), cls: [...el.classList].slice(0, 3).join('.'),
    name: (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
    outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, shadow: cs.boxShadow.slice(0, 60), ring,
    inView: r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight && r.width > 0,
    inDialog: !!el.closest('[role="dialog"]'), dialogOpen: !!document.querySelector('[role="dialog"]'),
    x: Math.round(r.left), y: Math.round(r.top),
  };
}

// ---------------------------------------------------------------- node side

async function axFor(page, count) {
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const res = [];
  for (let i = 0; i < count; i++) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-a11y-i="${i}"]` });
    if (!nodeId) { res.push(null); continue; }
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
    const n = nodes[0];
    const props = Object.fromEntries((n.properties ?? []).map((p) => [p.name, p.value?.value]));
    res.push({ ignored: n.ignored, role: n.role?.value ?? '', name: n.name?.value ?? '', props });
  }
  await cdp.detach();
  return res;
}

async function pinContrast(page) {
  const pins = await page.$$eval('button.bubble.is-shown:not(.is-under)', (els) => els.map((e) => {
    const r = e.querySelector('.bb').getBoundingClientRect();
    return { name: e.getAttribute('aria-label'), crit: e.classList.contains('is-critical'), minor: e.classList.contains('is-minor'), x: r.left, y: r.top, w: r.width, h: r.height };
  }));
  if (!pins.length) return [];
  const png = (await page.screenshot({ type: 'png', timeout: 180000 })).toString('base64');
  return page.evaluate(async ({ png, pins }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const L = (p) => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
    const sx = img.width / innerWidth;
    const px = (x, y) => g.getImageData(Math.round(x * sx), Math.round(y * sx), 1, 1).data;
    const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    return pins.map((p) => {
      // pin plate: the parchment disc in the pin head; map: a ring 6 px outside the pin box
      const plate = L(px(p.x + p.w / 2, p.y + p.h * 0.12));
      const tip = L(px(p.x + p.w / 2, p.y + p.h * 0.85));
      const ringPts = [];
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        ringPts.push([p.x + p.w / 2 + Math.cos(a) * (p.w / 2 + 6), p.y + p.h / 2 + Math.sin(a) * (p.h / 2 + 6)]);
      }
      const ls = ringPts.filter(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight).map(([x, y]) => L(px(x, y)));
      const worst = Math.min(...ls.map((l) => ratio(l, plate)));
      const worstTip = Math.min(...ls.map((l) => ratio(l, tip)));
      return { name: p.name, crit: p.crit, minor: p.minor, plateVsMap: Math.round(worst * 100) / 100, tipVsMap: Math.round(worstTip * 100) / 100 };
    });
  }, { png, pins });
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = [];
try {
  for (const lang of langs) {
    for (const [w, h] of sizes) {
      for (const s of SCENES) {
        const tag = `${s.id}-${w}x${h}${lang === 'pl' ? '' : '-' + lang}`;
        const entry = { tag, scene: s.id, lang, w, h };
        for (const mode of ['base', 'scale']) {
          const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
          const page = await ctx.newPage();
          const errs = [];
          page.on('pageerror', (e) => errs.push(e.message));
          await page.goto(`${URL0}?debug=1&lang=${lang}&quality=low&dynres=0${s.q ? '&' + s.q : ''}`);
          await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
          await page.waitForTimeout(s.wait ?? 1500);
          if (!s.q.includes('tut=1') && !s.q.includes('ff=600')) {
            const start = await page.$('.letter [data-a="start"]');
            if (start) { await start.click(); await page.waitForTimeout(600); }
          }
          if (s.act) await s.act(page);
          await page.waitForTimeout(400);
          if (mode === 'base') {
            const inter = await page.evaluate(collectInteractive);
            const ax = await axFor(page, inter.length);
            entry.controls = inter.map((c, k) => ({ ...c, ax: ax[k] }));
            entry.contrast = await page.evaluate(collectContrast);
            entry.pins = await pinContrast(page).catch((e) => [{ error: String(e) }]);
            await page.screenshot({ path: `${out}/${tag}.jpg`, type: 'jpeg', quality: 55, timeout: 180000 });
            // focus order (keyboard / switch access)
            const stops = [];
            for (let k = 0; k < 60; k++) {
              await page.keyboard.press('Tab');
              const f = await page.evaluate(focusInfo);
              stops.push(f);
              if (k > 2 && f.tag !== 'body' && stops.slice(0, -1).some((q) => q.tag === f.tag && q.cls === f.cls && q.x === f.x && q.y === f.y && q.name === f.name)) break;
            }
            entry.focus = stops;
          } else {
            await page.evaluate(scaleText);
            await page.waitForTimeout(300);
            entry.scale = await page.evaluate(scaleIssues);
            await page.screenshot({ path: `${out}/${tag}-text200.jpg`, type: 'jpeg', quality: 55, timeout: 180000 });
          }
          entry.errors = [...(entry.errors ?? []), ...errs];
          await ctx.close();
        }
        report.push(entry);
        const c = entry.controls;
        const vis = c.filter((q) => q.vis && q.inView && q.pe !== 'none');
        console.log(tag,
          `controls=${vis.length}`,
          `unnamed=${vis.filter((q) => q.ax && !q.ax.ignored && !q.ax.name.trim()).length}`,
          `small=${vis.filter((q) => q.w < 48 || q.h < 48).length}`,
          `lowContrast=${entry.contrast.filter((q) => q.ratio !== null && q.ratio < (q.large ? 3 : 4.5)).length}`,
          `pins=${entry.pins.length}`,
          `focusStops=${entry.focus.length}`, `noRing=${entry.focus.filter((f) => f.tag !== 'body' && !f.ring).length}`,
          `scaleIssues=${entry.scale.length}`, `errors=${entry.errors.length}`);
        writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
      }
    }
  }
} finally {
  await browser.close();
}
console.log('DONE', report.length);
