// Day 7 screenshots: the calm codex fold (D-98) and the watch-mode seal forecast variants (D-99).
// Usage: node tools/day7-shots.mjs <outdir> [WxH ...]  (server: npx vite preview --port 5194)
// Env: URL0 (default http://127.0.0.1:5194/), LANG_Q (pl), WHAT (codex,flip)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL0 = process.env.URL0 ?? 'http://127.0.0.1:5194/';
const lang = process.env.LANG_Q ?? 'pl';
const what = (process.env.WHAT ?? 'codex').split(',');
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const sizes = (process.argv.slice(3).length ? process.argv.slice(3) : ['412x915', '915x412']).map((s) => s.split('x').map(Number));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function open(w, h, query) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(`${URL0}?debug=1&lang=${lang}&quality=low&${query}`);
  await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 180000 });
  // the mission letter: start (the sim stays at speed 0)
  const start = page.locator('.letter [data-a="start"]');
  if (await start.count()) { await start.first().click(); await page.waitForTimeout(800); }
  return { ctx, page };
}

// codex: a calm full yard (m4 woodcutter, surplus; m8 quarry, stone stored) against one still worth a wagon (m8 sawmill)
const codexCases = [
  { id: 'calm-m4', query: 'play=m4&ff=108&speed=0&open=woodcutter' },
  { id: 'calm-m8-quarry', query: 'play=m8&ff=192&speed=0&open=quarry' },
  { id: 'wagon-m8-sawmill', query: 'play=m8&ff=274&speed=0&open=sawmill' },
];
// flip: the folded waybill (watch mode) with a forecast line on the seal, variant A / B (URL flag only)
const flipCases = [
  { id: 'none', query: 'play=m3&ff=240&speed=0&collapsed=1' },
  { id: 'a', query: 'play=m3&ff=240&speed=0&collapsed=1&sealpace=a' },
  { id: 'b', query: 'play=m3&ff=240&speed=0&collapsed=1&sealpace=b' },
];

for (const [w, h] of sizes) {
  const tag = `${w}x${h}${lang === 'pl' ? '' : '-' + lang}`;
  if (what.includes('codex')) for (const c of (process.env.CASES ? codexCases.filter((x) => process.env.CASES.split(',').includes(x.id)) : codexCases)) {
    const { ctx, page } = await open(w, h, c.query);
    await page.waitForSelector('#sheets .sheet .codex-tog', { timeout: 60000 }).catch(() => {});
    const tog = page.locator('#sheets .sheet:last-child .codex-tog');
    if (await tog.count()) { await tog.click(); await page.waitForTimeout(600); await page.locator('#sheets .sheet:last-child .codex-body').scrollIntoViewIfNeeded().catch(() => {}); }
    await page.waitForTimeout(1200);
    const info = await page.evaluate(() => ({
      calm: document.querySelector('#sheets .sheet:last-child .calm-hint')?.textContent?.trim() ?? null,
      name: document.querySelector('#sheets .sheet:last-child .codex-name')?.textContent?.trim() ?? null,
      fix1: document.querySelector('#sheets .sheet:last-child .codex-fixes li')?.textContent?.trim() ?? null,
    }));
    console.log(tag, c.id, JSON.stringify(info));
    await page.screenshot({ path: `${out}/codex-${c.id}-${tag}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
    await ctx.close();
  }
  if (what.includes('flip')) for (const c of flipCases) {
    const { ctx, page } = await open(w, h, c.query);
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => ({ seal: document.querySelector('.waybill-wrap .seal-only')?.textContent?.replace(/\s+/g, ' ').trim() ?? null, mini: document.body.classList.contains('is-mini') }));
    console.log(tag, 'flip', c.id, JSON.stringify(info));
    await page.screenshot({ path: `${out}/flip-${c.id}-${tag}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
    await ctx.close();
  }
}
await browser.close();
