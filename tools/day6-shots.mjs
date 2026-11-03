// Day 6 screenshots: cold-start menu (empty profile), won end letter with "Next mission".
// Usage: node tools/day6-shots.mjs <outdir> [WxH ...]  (server: npx vite preview --port 5194)
// Env: URL0 (default http://127.0.0.1:5194/), LANG (pl), WHAT (menu,end)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL0 = process.env.URL0 ?? 'http://127.0.0.1:5194/';
const lang = process.env.LANG_Q ?? 'pl';
const what = (process.env.WHAT ?? 'menu,end').split(',');
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const sizes = (process.argv.slice(3).length ? process.argv.slice(3) : ['412x915', '915x412']).map((s) => s.split('x').map(Number));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [w, h] of sizes) {
  const tag = `${w}x${h}-${lang}`;
  if (what.includes('menu')) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(`${URL0}?debug=1&lang=${lang}&quality=low`);
    await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 120000 });
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => {
      const s = document.querySelector('.menu-settings')?.getBoundingClientRect();
      const st = document.querySelector('.menu-item.is-start')?.textContent;
      return { settings: s ? [Math.round(s.top), Math.round(s.bottom)] : null, vh: innerHeight, start: st };
    });
    console.log(tag, 'menu', JSON.stringify(info));
    await page.screenshot({ path: `${out}/menu-${tag}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
    await ctx.close();
  }
  if (what.includes('end')) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(`${URL0}?debug=1&lang=${lang}&quality=low&play=m1`);
    await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    // screenshot only: end the contract as won (the debug handle; not a game path)
    await page.evaluate(() => { const st = window.__marchia.app.world.state; st.mission.result = 'won'; st.mission.endTick = st.tick; });
    await page.waitForSelector('.letter [data-a="next"]', { timeout: 60000 }).catch(() => {});
    // the letter fades in; under SwiftShader frames are slow, so wait until it is fully opaque
    await page.waitForFunction(() => { const l = document.querySelector('.scrim'); return l && getComputedStyle(l).opacity === '1'; }, null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const btns = await page.evaluate(() => [...document.querySelectorAll('.letter button')].map((b) => `${b.dataset.a}:${b.textContent.trim()}:${Math.round(b.getBoundingClientRect().height)}`));
    console.log(tag, 'end', btns.join(' | '));
    await page.screenshot({ path: `${out}/end-${tag}.jpg`, type: 'jpeg', quality: 60, timeout: 120000 });
    if (process.env.TAP_NEXT === '1') {
      await page.locator('.letter [data-a="next"]').click();
      await page.waitForFunction(() => window.__marchia.app.world.state.mission.id === 'm2', null, { timeout: 30000 });
      console.log(tag, 'next ->', await page.evaluate(() => window.__marchia.app.world.state.mission.id), 'letter', await page.locator('.letter [data-a="start"]').count());
    }
    await ctx.close();
  }
}
await browser.close();
