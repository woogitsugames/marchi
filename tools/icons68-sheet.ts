/**
 * Order 68 (D-345): preview sheet of the state icons — each at 18 / 32 / 64 px on parchment, on dark oak, and the whole
 * row in grayscale, beside the existing icons it must not be mistaken for — plus an 18 px silhouette similarity
 * (IoU of ink masks) of every new icon against every other icon.
 * Run: npx tsx tools/icons68-sheet.ts [outPng]  (default docs/shots/icons68-sheet.png)
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ICON_IDS, iconSvg, type IconId } from '../src/ui/icons';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outPng = resolve(process.argv[2] ?? resolve(root, 'docs/shots/icons68-sheet.png'));
const NEW: IconId[] = ['wagon_due', 'market_full', 'grow', 'cut_road', 'tradePost', 'bottleneck'];
const NEIGHBOURS: IconId[] = ['wagon', 'buy_wagon', 'no_wagon', 'waiting', 'coin', 'output_full', 'storage_full', 'build', 'warehouse', 'no_road', 'road_dirt', 'contested'];
const require = createRequire(import.meta.url);
const sharp = require('sharp');

async function mask(id: IconId, px: number): Promise<Float32Array> {
  const svg = iconSvg(id, px).replace(/currentColor/g, '#000');
  const { data } = await sharp(Buffer.from(svg), { density: 72 }).resize(px, px).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const m = new Float32Array(px * px);
  for (let i = 0; i < px * px; i++) m[i] = data[i * 4 + 3] / 255;
  return m;
}
const masks = new Map<IconId, Float32Array>();
for (const id of ICON_IDS) masks.set(id, await mask(id, 18));
const iou = (a: Float32Array, b: Float32Array): number => {
  let i = 0, u = 0;
  for (let k = 0; k < a.length; k++) { i += Math.min(a[k]!, b[k]!); u += Math.max(a[k]!, b[k]!); }
  return i / u;
};
const nearest = NEW.map((id) => {
  const rows = ICON_IDS.filter((o) => o !== id && o !== 'strike').map((o) => [o, iou(masks.get(id)!, masks.get(o)!)] as const);
  rows.sort((x, y) => y[1] - x[1]);
  return { id, top: rows.slice(0, 3) };
});
for (const n of nearest) console.log(n.id.padEnd(12), n.top.map(([o, v]) => `${o} ${v.toFixed(2)}`).join('  '));

const sizes = [18, 32, 64];
const cell = (id: IconId) => `<figure><div class="row">${sizes.map((s) => iconSvg(id, s)).join('')}</div><figcaption>${id}</figcaption></figure>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Order 68 icons</title><style>
body{margin:0;padding:16px;background:#e4dccb;color:#2b2620;font:13px/1.25 Georgia,serif;width:1068px}
h2{font-size:14px;font-weight:400;margin:14px 0 6px;color:#4d453a}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
figure{margin:0;padding:8px;border:1px solid #cfc5b0}
.row{display:flex;align-items:flex-end;gap:14px}
figcaption{margin-top:4px;font-size:12px}
.dark{background:#3b3127;color:#ead6ad}.dark figure{border-color:#5a4a3a}
.gray{filter:grayscale(1)}
.strip{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.strip span{display:inline-flex;flex-direction:column;align-items:center;font-size:10px;gap:2px}
.rtl{direction:rtl}.rtl svg.ico-rtl{scale:-1 1}
td{padding:2px 10px 2px 0;font-size:12px}
</style></head><body>
<h2>New state icons (order 68) and the two that already had their own woodcut (D-170, D-171) — 18 / 32 / 64 px on parchment</h2>
<div class="grid">${NEW.map(cell).join('')}</div>
<h2>On dark oak</h2>
<div class="grid dark" style="padding:8px">${NEW.map(cell).join('')}</div>
<h2>Grayscale at 18 and 32 px: new icons, then the existing icons nearest in meaning</h2>
<div class="strip gray">${[...NEW, ...NEIGHBOURS].map((id) => `<span>${iconSvg(id, 32)}${iconSvg(id, 18)}${id}</span>`).join('')}</div>
<h2>RTL (dir=rtl, D-334): only wagon_due turns round</h2>
<div class="strip rtl">${NEW.map((id) => `<span>${iconSvg(id, 32)}${id}</span>`).join('')}</div>
<h2>Nearest silhouettes at 18 px (IoU of ink masks, 1 = identical)</h2>
<table>${nearest.map((n) => `<tr><td>${n.id}</td>${n.top.map(([o, v]) => `<td>${o} ${v.toFixed(2)}</td>`).join('')}</tr>`).join('')}</table>
</body></html>`;
const htmlPath = outPng.replace(/\.png$/, '.html');
writeFileSync(htmlPath, html);
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
await page.goto(pathToFileURL(htmlPath).href);
await page.screenshot({ path: outPng, fullPage: true });
await browser.close();
console.log('wrote', outPng);
