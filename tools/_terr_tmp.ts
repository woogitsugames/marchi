import { createWorld } from '../src/sim/index';
const w = createWorld('sandbox'); const t = w.terrain;
let s = '';
for (let y = 0; y < t.h; y++) {
  let line = String(y).padStart(2) + ' ';
  for (let x = 0; x < t.w; x++) {
    const i = y * t.w + x;
    if (t.water[i]) { line += '~'; continue; }
    const hgt = t.cellH[i]! - t.waterLevel;
    line += hgt >= 10 ? '#' : String(Math.max(0, Math.floor(hgt)));
  }
  s += line + '\n';
}
console.log(s);
