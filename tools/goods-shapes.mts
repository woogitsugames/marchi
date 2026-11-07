// Goods icon sheet in grayscale + pairwise silhouette similarity of the goods icons at 18 px (order 81, D-342).
// Usage: npx tsx tools/goods-shapes.mts <outdir> [tag]  -> <outdir>/goods-sheet-<tag>.html (screenshot it) and goods-sim-<tag>.txt
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { iconSvg, struckIconSvg, type IconId } from '../src/ui/icons';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const GOODS: IconId[] = ['wood', 'planks', 'grain', 'flour', 'bread', 'fish', 'stone', 'charcoal', 'malt', 'beer'];
const out = process.argv[2]!; const tag = process.argv[3] ?? 'now';
const SIZES = [16, 18, 24, 48];
const row = (s: number, f: (g: IconId) => string) => `<tr><th>${s}px</th>${GOODS.map((g) => `<td>${f(g)}</td>`).join('')}</tr>`;
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:12px;background:#e4dccb;color:#2a2118;font:12px serif;filter:grayscale(1)}
table{border-collapse:collapse} td,th{padding:6px 8px;text-align:center} th{font-weight:400;color:#6b5e4c}
.dark{background:#3b2f24;color:#e4dccb}
</style><table><tr><th></th>${GOODS.map((g) => `<th>${g}</th>`).join('')}</tr>
${SIZES.map((s) => row(s, (g) => iconSvg(g, s))).join('')}
${row(18, (g) => struckIconSvg(g, 18))}
<tbody class="dark">${row(18, (g) => iconSvg(g, 18))}${row(24, (g) => iconSvg(g, 24))}</tbody></table>`;
writeFileSync(`${out}/goods-sheet-${tag}.html`, html);
// silhouette similarity at 18 px: IoU of ink masks and mean abs difference
async function mask(g: IconId, px: number): Promise<Float32Array> {
  const svg = iconSvg(g, px).replace('<svg ', '<svg style="color:#000" ').replace(/currentColor/g, '#000');
  const { data } = await sharp(Buffer.from(svg), { density: 72 }).resize(px, px).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const m = new Float32Array(px * px);
  for (let i = 0; i < px * px; i++) m[i] = data[i * 4 + 3] / 255;
  return m;
}
const res: [string, number, number][] = [];
for (const px of [18]) {
  const ms = new Map<IconId, Float32Array>();
  for (const g of GOODS) ms.set(g, await mask(g, px));
  for (let i = 0; i < GOODS.length; i++) for (let j = i + 1; j < GOODS.length; j++) {
    const a = ms.get(GOODS[i]!)!, b = ms.get(GOODS[j]!)!;
    let inter = 0, uni = 0;
    for (let k = 0; k < a.length; k++) { inter += Math.min(a[k]!, b[k]!); uni += Math.max(a[k]!, b[k]!); }
    // blurred (coarse shape) similarity: 6x6 cells
    const cell = (m: Float32Array) => { const c = new Float32Array(36); for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) c[Math.floor(y * 6 / px) * 6 + Math.floor(x * 6 / px)] += m[y * px + x]! / ((px / 6) ** 2); return c; };
    const ca = cell(a), cb = cell(b); let d = 0; for (let k = 0; k < 36; k++) d += Math.abs(ca[k]! - cb[k]!); d /= 36;
    res.push([`${GOODS[i]}–${GOODS[j]}`, inter / uni, d]);
  }
}
res.sort((x, y) => y[1] - x[1]);
const lines = res.map(([p, iou, d]) => `${p.padEnd(18)} IoU ${iou.toFixed(2)}  coarse-diff ${d.toFixed(3)}`);
writeFileSync(`${out}/goods-sim-${tag}.txt`, lines.join('\n') + '\n');
console.log(lines.slice(0, 12).join('\n'));
