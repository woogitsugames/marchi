// Screenshots of tools/model-preview.html for each view → docs/shots/models-<view>.png
// usage: node tools/model-shots.mjs [view ...]
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const views = process.argv.slice(2).length ? process.argv.slice(2) : ['overview', 'wagons', 'close', 'far', 'buildings', 'bwest', 'castle', 'trees', 'bridges', 'props'];
const server = await createServer({ server: { port: 5199, host: '127.0.0.1', hmr: false }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
for (const v of views) {
  const t = Date.now();
  await page.goto(`http://127.0.0.1:5199/tools/model-preview.html?view=${v}&still`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `docs/shots/models-${v}.png` });
  if (v === views[0]) console.log((await page.evaluate(() => window.__stats)).join('\n'));
  console.log(`shot ${v} in ${Date.now() - t} ms`);
}
await browser.close();
await server.close();
