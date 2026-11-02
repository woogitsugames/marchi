// Renders matrix.html into matrix.jpg: node render-matrix.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
  await p.goto(`file://${__dirname}/matrix.html`);
  await p.waitForSelector('body[data-ready="1"]');
  const el = await p.$('body');
  await el.screenshot({ path: `${__dirname}/matrix.jpg`, type: 'jpeg', quality: 82 });
  await b.close();
})();
