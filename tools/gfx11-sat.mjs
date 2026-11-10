// Graphics audit 11: colour statistics of screenshots against docs/ART_DIRECTION.md (terrain S < 35 %).
// node tools/gfx11-sat.mjs <file.jpg>... -> per file: mean HSL saturation, share of pixels with S > 35 % (and their
// hue bands), mean luminance. Pixels darker than L 8 % or lighter than L 92 % are skipped (no reliable hue).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
for (const f of process.argv.slice(2)) {
  const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
  let n = 0, sSum = 0, lSum = 0, hi = 0;
  const band = { green: 0, yellow: 0, orange: 0, blue: 0, other: 0 };
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (l < 0.08 || l > 0.92) continue;
    const d = mx - mn, s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d > 0) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    n++; sSum += s; lSum += l;
    if (s > 0.35) {
      hi++;
      if (h < 35 || h >= 330) band.orange++; else if (h < 65) band.yellow++; else if (h < 160) band.green++; else if (h < 260) band.blue++; else band.other++;
    }
  }
  const pc = (x) => ((100 * x) / n).toFixed(1);
  console.log(`${f.split('/').pop().padEnd(52)} S=${(100 * sSum / n).toFixed(1)}% L=${(100 * lSum / n).toFixed(1)}% S>35%: ${pc(hi)}% (orange ${pc(band.orange)} yellow ${pc(band.yellow)} green ${pc(band.green)} blue ${pc(band.blue)})`);
}
