const { chromium } = require('playwright');
const dir = process.argv[2]; const vs = (process.argv[3] || 'A1,A2,B1,B2,C1,C2').split(',');
(async () => {
  const b = await chromium.launch();
  for (const v of vs) for (const [w, h] of [[412, 915], [915, 412]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await p.goto(`file://${dir}/hud.html?v=${v}`);
    await p.waitForSelector('body[data-ready="1"]');
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${dir}/out/${v}-${w}x${h}.png` });
    if (errs.length) console.log(v, w, errs.join(' | '));
    await p.close();
  }
  await b.close(); console.log('done');
})();
