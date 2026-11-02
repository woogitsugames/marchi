// Renders the palette x style mockups: node render-pxs.cjs [P1-S1,P2-S3,...] [outdir]
const { chromium } = require('playwright');
const path = require('path');
const dir = __dirname;
const all = []; for (const p of ['P1', 'P2', 'P3', 'P4']) for (const s of ['S1', 'S2', 'S3']) all.push(`${p}-${s}`);
const list = process.argv[2] ? process.argv[2].split(',') : all;
const out = process.argv[3] || dir;
require('fs').mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('requestfailed', (r) => errs.push('FAILED ' + r.url()));
  for (const k of list) {
    const [p, s] = k.split('-');
    await page.goto(`file://${dir}/pxs.html?p=${p}&s=${s}`);
    await page.waitForSelector('body[data-ready="1"]');
    await page.waitForTimeout(150);
    const fonts = await page.evaluate(() => [document.fonts.check('700 20px "Grenze Gotisch"', 'L'), document.fonts.check('700 20px "Alegreya Sans"', 'ó')]);
    if (!fonts[0] || !fonts[1]) errs.push(k + ' fonts ' + fonts);
    await page.screenshot({ path: path.join(out, `${k}.jpg`), type: 'jpeg', quality: 85 });
  }
  if (errs.length) console.log(errs.join('\n'));
  await b.close(); console.log('rendered', list.length);
})();
