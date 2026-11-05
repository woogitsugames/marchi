// Focus ring on the primary (wine) fix button, reached with real Tab presses (ui audit day 9, finding P1).
// Usage: node tools/ui9-ring-probe.mjs [out.png]   (server: npx vite preview --port 5195 --strictPort)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--disable-gpu'] });
const p = await (await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true })).newPage();
await p.goto('http://127.0.0.1:5195/?play=m11&ff=300&speed=0&quality=low&dynres=0&debug=1&view=flat&lang=pl');
await p.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
await p.waitForTimeout(1000);
await p.evaluate(() => document.querySelector('.stall-eye')?.click()); await p.waitForTimeout(1200);
// true keyboard: Tab until the fix button
for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); if (await p.evaluate(() => document.activeElement?.classList.contains('fix-btn'))) break; }
await p.waitForTimeout(300);
const info = await p.evaluate(() => {
  const a = document.activeElement; const out = { el: a.className, fv: a.matches(':focus-visible') };
  const chain = [];
  for (let e = a; e && e !== document.body; e = e.parentElement) { const c = getComputedStyle(e); chain.push(`${e.tagName}.${e.className.toString().slice(0,30)} clip=${c.clipPath} ov=${c.overflow} filter=${c.filter.slice(0,30)} cont=${c.contain}`); }
  out.chain = chain; const r = a.getBoundingClientRect(); out.r = [r.left, r.top, r.right, r.bottom];
  const bf = getComputedStyle(a, '::before'); out.before = `${bf.content} ${bf.inset} z=${bf.zIndex} bg=${bf.backgroundImage.slice(0,40)}`;
  return out;
});
console.log(JSON.stringify(info, null, 1));
await p.screenshot({ path: '' + (process.argv[2] ?? 'ringtab.png') + '', clip: { x: 0, y: info.r[1] - 30, width: 412, height: 120 } });
await b.close();
