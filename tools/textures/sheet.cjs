// usage: node sheet.cjs <textures_root> <out_png> [raw_dir]
// With raw_dir (process.py --tiers output) the tiles come from the graded 4k sources
// (<raw>/<set>__albedo_preview.jpg) and each set also shows a 1:1 crop of its largest size
// (<raw>/<set>__albedo_crop.png); without it, from the shipped 512 terrain JPGs (model sets ship
// no albedo since D-22 and are skipped).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const root = path.resolve(process.argv[2]);
const out = path.resolve(process.argv[3]);
const names = ['meadow','mud_track','cobblestone','riverbank','forest_floor','wood_planks','thatch','fieldstone_wall','bark','plaster_daub'];
const palette = [['Torf','#2b2620'],['Błoto','#5a4a39'],['Strzecha','#9a8058'],['Łąka','#56603f'],['Bór','#2f3a2c'],['Kamień polny','#8a8478'],['Rzeka','#4c5b5c'],['Mgła','#c9c6bb'],['Glina','#8c4a2f'],['Ochra','#b8893a']];
const raw = process.argv[4] ? path.resolve(process.argv[4]) : null;
const v = fs.statSync(path.join(root, names[0], 'albedo_512.jpg')).mtimeMs;
const big = (n) => (n === 'bark' ? 2048 : 4096);
const cells = names.filter(n => raw || fs.existsSync(path.join(root, n, 'albedo_512.jpg'))).map(n => raw
  ? `<figure><div class="t" style="background-image:url('file://${raw}/${n}__albedo_preview.jpg?${v}')"></div>` +
    `<div class="t crop" style="background-image:url('file://${raw}/${n}__albedo_crop.png?${v}')"></div>` +
    `<figcaption>${n} · ${big(n)} px<br><small>top: 2×2 tiles · bottom: 1:1 pixels</small></figcaption></figure>`
  : `<figure><div class="t" style="background-image:url('file://${root}/${n}/albedo_512.jpg?${v}')"></div><figcaption>${n}</figcaption></figure>`).join('');
const sw = palette.map(([n,h]) => `<div class="sw"><span style="background:${h}"></span>${n}</div>`).join('');
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#2b2620;color:#c9c6bb;font:14px Georgia,serif;width:1352px}
.grid{display:grid;grid-template-columns:repeat(5,256px);gap:16px 18px}
figure{margin:0}.t{width:256px;height:256px;background-size:128px 128px;background-repeat:repeat}
figcaption{margin-top:6px}.crop{margin-top:6px;background-size:auto;background-repeat:no-repeat;background-position:-384px -384px}.pal{display:flex;gap:14px;margin-top:22px;flex-wrap:wrap}
.sw{display:flex;align-items:center;gap:6px}.sw span{width:28px;height:28px;display:inline-block}
h1{font-size:18px;font-weight:normal;margin:0 0 14px}
</style><h1>MARCHIA albedo set (graded${raw ? ', from 4k Poly Haven sources' : ''}) + palette</h1><div class="grid">${cells}</div><div class="pal">${sw}</div>`;
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
