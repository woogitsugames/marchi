// usage: node sheet.cjs <textures_root> <out_png>
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const root = path.resolve(process.argv[2]);
const out = path.resolve(process.argv[3]);
const names = ['meadow','mud_track','cobblestone','riverbank','forest_floor','wood_planks','thatch','fieldstone_wall','bark','plaster_daub'];
const palette = [['Torf','#2b2620'],['Błoto','#5a4a39'],['Strzecha','#9a8058'],['Łąka','#56603f'],['Bór','#2f3a2c'],['Kamień polny','#8a8478'],['Rzeka','#4c5b5c'],['Mgła','#c9c6bb'],['Glina','#8c4a2f'],['Ochra','#b8893a']];
const v = fs.statSync(path.join(root, names[0], 'albedo.jpg')).mtimeMs;
const cells = names.map(n => `<figure><div class="t" style="background-image:url('file://${root}/${n}/albedo.jpg?${v}')"></div><figcaption>${n}</figcaption></figure>`).join('');
const sw = palette.map(([n,h]) => `<div class="sw"><span style="background:${h}"></span>${n}</div>`).join('');
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#2b2620;color:#c9c6bb;font:14px Georgia,serif;width:1352px}
.grid{display:grid;grid-template-columns:repeat(5,256px);gap:16px 18px}
figure{margin:0}.t{width:256px;height:256px;background-size:128px 128px;background-repeat:repeat}
figcaption{margin-top:6px}.pal{display:flex;gap:14px;margin-top:22px;flex-wrap:wrap}
.sw{display:flex;align-items:center;gap:6px}.sw span{width:28px;height:28px;display:inline-block}
h1{font-size:18px;font-weight:normal;margin:0 0 14px}
</style><h1>MARCHIA albedo set (each cell = 2×2 tiles, graded) + palette</h1><div class="grid">${cells}</div><div class="pal">${sw}</div>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 800 } });
  const tmp = path.join(path.dirname(out), '.sheet.html');
  fs.writeFileSync(tmp, html);
  await p.goto('file://' + tmp);
  await p.waitForTimeout(500);
  await p.screenshot({ path: out, fullPage: true });
  fs.unlinkSync(tmp);
  await b.close();
})();
