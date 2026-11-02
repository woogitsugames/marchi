// Usage: node docs/mockups/hud/v2/render-v2.cjs <outDir>  (PNG; convert to JPEG q85)
// Renders hud-v2.html concepts A/B/C in portrait + landscape at DPR 2.
const { chromium } = require('playwright');
const path = require('path');
const dir = __dirname; const out = process.argv[2] || dir;
(async () => {
  const b = await chromium.launch();
  for (const c of ['A', 'B', 'C']) for (const [w, h] of [[412, 915], [915, 412]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('requestfailed', (r) => errs.push('FAIL ' + r.url()));
    await p.goto(`file://${dir}/hud-v2.html?c=${c}`);
    await p.waitForSelector('body[data-ready="1"]');
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(out, `${c}-${w}x${h}.png`) });
    if (errs.length) console.log(c, w, errs.join(' | '));
    await p.close();
  }
  await b.close(); console.log('done');
})();
