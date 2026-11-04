// Smoke: menu + every mission + sandbox at quality=low; fails on any console error / pageerror.
// Usage: node tools/smoke.cjs [baseUrl=http://localhost:5193/]  (serve dist with `npx vite preview --port 5193`)
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:5193/';
const ids = ['', ...Array.from({ length: 13 }, (_, i) => 'm' + (i + 1)), 'sandbox'];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let bad = 0;
  for (const id of ids) {
    const page = await (await browser.newContext({ viewport: { width: 412, height: 915 } })).newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(String(e)));
    const url = id ? `${base}?play=${id}&quality=low&dynres=0&speed=4` : base;
    try { await page.goto(url, { timeout: 60000 }); await page.waitForTimeout(id ? 6000 : 3000); }
    catch (e) { errs.push('goto: ' + e.message); }
    console.log(`${(id || 'menu').padEnd(8)} ${errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : 'ok'}`);
    if (errs.length) bad++;
    await page.context().close();
  }
  await browser.close();
  console.log(`SMOKE bad=${bad}`);
  process.exit(bad ? 1 : 0);
})();
