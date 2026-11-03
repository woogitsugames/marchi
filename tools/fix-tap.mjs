// The why-sheet fix button survives the sheet's per-second refresh and a real tap applies it (D-100, items 4-5).
// Usage: node tools/fix-tap.mjs [WxH] (server: npx vite preview --port 5196 --strictPort; env URL0, LANG_Q, Q)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL0 = process.env.URL0 ?? 'http://127.0.0.1:5196/';
const [w, h] = (process.argv[2] ?? '915x412').split('x').map(Number);
const q = process.env.Q ?? 'play=m1&ff=90&speed=1&open=bakery';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
let errors = 0;
page.on('pageerror', (e) => { errors++; console.log('PAGEERROR', e.message); });
page.on('console', (m) => { if (m.type() === 'error') { errors++; console.log('CONSOLE', m.text()); } });
await page.goto(`${URL0}?debug=1&lang=${process.env.LANG_Q ?? 'pl'}&quality=low&dynres=0&${q}`);
await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
const start = page.locator('.letter [data-a="start"]');
if (await start.count()) { await start.first().click(); await page.waitForTimeout(800); }
await page.waitForSelector('#sheets .sheet .fix-btn', { timeout: 60000 });
const tick = () => page.evaluate(() => window.__marchia?.app?.world?.state?.tick ?? -1);
const btn = await page.$('#sheets .sheet:last-child .fix-btn');
const t0 = await tick();
await page.waitForTimeout(4000);
const t1 = await tick();
const alive = await btn.evaluate((el) => el.isConnected);
console.log(`${w}x${h} ticks ${t0} -> ${t1}; fix button node kept across refreshes: ${alive}`);
const label = await btn.evaluate((el) => el.textContent.trim());
const before = await page.evaluate(() => JSON.stringify({ coins: window.__marchia?.app?.world?.state?.coins, wagons: window.__marchia?.app?.world?.state?.wagons?.length, net: window.__marchia?.app?.world?.state?.netVersion }));
const box = await btn.boundingBox();
await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(2500);
const after = await page.evaluate(() => JSON.stringify({ coins: window.__marchia?.app?.world?.state?.coins, wagons: window.__marchia?.app?.world?.state?.wagons?.length, net: window.__marchia?.app?.world?.state?.netVersion }));
console.log(`tap "${label}": ${before} -> ${after}`);
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, type: 'jpeg', quality: 60 });
await browser.close();
console.log('ERRORS', errors);
