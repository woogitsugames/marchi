const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:5176/?lang=pl&play=m1&ff=90&speed=0');
  await p.waitForFunction(() => window.__marchia && window.__marchia.ready, null, { timeout: 90000 });
  const id = await p.evaluate(() => { const a = window.__marchia.app; const b = a.world.state.buildings.find((q) => q.type === 'bakery'); a.view.camera.focusCell(b.gate); return b.id; });
  await p.waitForTimeout(2500);
  const pt = await p.evaluate((id) => { const v = window.__marchia.app.view; const an = v.anchorOf('building', id);
    for (let dy = 0; dy < 160; dy += 4) { const r = v.pick(an.x, an.y + dy); if (r && r.kind === 'building' && r.id === id) return [an.x, an.y + dy, dy]; } return null; }, id);
  console.log('pick point below anchor', pt);
  if (pt) { await p.mouse.click(pt[0], pt[1]); await p.waitForTimeout(800);
    console.log('sheet:', await p.evaluate(() => document.querySelector('.sheet h3')?.textContent)); }
  // bubble tap
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  const bub = await p.evaluate(() => { const e = document.querySelector('.bubble.is-shown'); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + 18, e.dataset.k]; });
  console.log('bubble', bub);
  if (bub) { await p.mouse.click(bub[0], bub[1]); await p.waitForTimeout(800); console.log('sheet from bubble:', await p.evaluate(() => document.querySelector('.sheet h3')?.textContent)); }
  await b.close();
})();
