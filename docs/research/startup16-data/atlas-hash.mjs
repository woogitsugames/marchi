// Far-tree atlas texels (albedo + normal, level 0) after bakes at several (cell, bare, spring): FNV hash per atlas
// and the raw bytes saved for a texel diff. Usage: node atlas-hash.mjs <baseUrl> <outPrefix>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/workspace/marchi-billboard/package.json');
const { chromium } = require('playwright');
const [base, outp] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 0.5 })).newPage();
await page.goto(base + '?quality=high&debug=1');
await page.waitForFunction(() => performance.getEntriesByName('marchia:first-frame').length > 0, null, { timeout: 120000, polling: 50 });
const configs = [[128, 0, 0], [128, 0.5, 0.25], [128, 1, 0], [256, 0.25, 1], [256, 0, 0], [128, 0, 0]];
const res = [];
for (const [i, c] of configs.entries()) {
  const r = await page.evaluate(([cell, bare, spring, first, L]) => {
    const v = window.__marchia.app.view; const rr = v.renderer; const gl = rr.getContext();
    if (!first) v.vegetation.bake(rr, cell, bare, spring);
    let mat = null; v.scene.traverse((o) => { if (!mat && o.name && o.name.startsWith('tree-bb-')) mat = o.material; });
    const texA = mat.map; const texN = rr.properties.get(mat).uniforms.uBbNormal.value;
    const out = {};
    for (const [k, t] of [['A', texA], ['N', texN]]) {
      const w = Math.max(1, t.image.width >> L), h = Math.max(1, t.image.height >> L);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rr.properties.get(t).__webglTexture, L);
      const buf = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); rr.state.reset?.(); rr.resetState();
      let hsh = 2166136261; for (let j = 0; j < buf.length; j++) { hsh ^= buf[j]; hsh = Math.imul(hsh, 16777619); }
      let s = ''; for (let j = 0; j < buf.length; j += 8192) s += String.fromCharCode.apply(null, buf.subarray(j, j + 8192));
      out[k] = { w, h, hash: (hsh >>> 0).toString(16), b64: btoa(s) };
    }
    return out;
  }, [...c, i === 0, +(process.env.LEVEL ?? 0)]);
  for (const k of ['A', 'N']) fs.writeFileSync(`${outp}-${i}-${k}.bin`, Buffer.from(r[k].b64, 'base64'));
  res.push({ cfg: c, A: r.A.hash, N: r.N.hash, size: `${r.A.w}x${r.A.h}` });
}
console.log(JSON.stringify(res));
await browser.close();
