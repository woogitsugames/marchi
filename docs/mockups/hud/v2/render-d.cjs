// Usage: node docs/mockups/hud/v2/render-d.cjs <outDir>  -> D-412x915.png, D-915x412.png (DPR 2)
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || __dirname;
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[412, 915], [915, 412]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('requestfailed', (r) => errs.push('FAIL ' + r.url()));
    await p.goto(`file://${__dirname}/hud-d.html`);
    await p.waitForSelector('body[data-ready="1"]');
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(out, `D-${w}x${h}.png`) });
    if (errs.length) console.log(w, errs.join(' | '));
    await p.close();
  }
  await b.close(); console.log('done');
})();
