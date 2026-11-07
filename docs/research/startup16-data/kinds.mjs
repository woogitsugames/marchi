import { createRequire } from 'node:module';
const require = createRequire('/workspace/marchi-billboard/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const q of ['', '&play=m1', '&play=m2', '&play=m7', '&play=m12', '&play=m16']) {
  const page = await (await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 0.5 })).newPage();
  await page.goto(process.argv[2] + '?quality=high&debug=1' + q);
  await page.waitForFunction(() => performance.getEntriesByName('marchia:first-frame').length > 0, null, { timeout: 120000, polling: 20 });
  const r = await page.evaluate(() => { const v = window.__marchia.app.view.vegetation; return { far: v.far.map((m) => m.count), trees: [0,1,2,3,4].map((k) => v.trees.filter((t) => t.kind === k).length), apron: [0,1,2,3,4].map((k) => v.apron.filter((t) => t.kind === k).length) }; });
  console.log(q || 'menu', JSON.stringify(r));
  await page.close();
}
await browser.close();
