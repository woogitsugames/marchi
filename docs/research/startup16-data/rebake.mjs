// warm re-bake wall time incl. GPU (readPixels sync), median of N, fresh browser per rep
import { createRequire } from 'node:module';
const require = createRequire('/workspace/marchi-billboard/package.json');
const { chromium } = require('playwright');
const [base, repsS = '2', N = '12', X = '{}'] = process.argv.slice(2);
const all = [];
for (let r = 0; r < +repsS; r++) {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 0.5 })).newPage();
  await page.goto(base + '?quality=high&debug=1');
  await page.waitForFunction(() => window.__marchia && window.__marchia.ready, null, { timeout: 120000 });
  await page.waitForTimeout(4000);
  const res = await page.evaluate(async ([n, X]) => { window.__bbx = JSON.parse(X);
    const v = window.__marchia.app.view; const rr = v.renderer; const gl = rr.getContext(); const px = new Uint8Array(4);
    const out = [];
    for (let i = 0; i < n; i++) {
      await new Promise((ok) => setTimeout(ok, 50));
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const t0 = performance.now();
      v.vegetation.bake(rr, 128, i % 2 ? 0.25 : 0.5, 0);
      const t1 = performance.now();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      out.push([t1 - t0, performance.now() - t0]);
    }
    v.vegetation.bake(rr, 128, 0, 0);
    return out;
  }, [+N, X]);
  all.push(...res);
  await browser.close();
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return +s[(s.length - 1) >> 1].toFixed(1); };
console.log(JSON.stringify({ base, X, cpu: med(all.map((x) => x[0])), wall: med(all.map((x) => x[1])), n: all.length }));
