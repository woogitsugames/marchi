// Prints the mission map as ASCII for quick layout checks: npx tsx tools/ascii-map.ts [mission]
import { createWorld, net } from '../src/sim/index';
const w = createWorld(process.argv[2] ?? 'm1');
const t = w.terrain, st = w.state, c = net(w);
const sym: Record<string, string> = { woodcutter: 'W', sawmill: 'S', stable: 'H', farm: 'F', mill: 'M', bakery: 'B', warehouse: 'G', castle: 'C', charcoalBurner: 'K', fisher: 'P', malthouse: 'L', brewery: 'R', quarry: 'Q' };
let out = '    ' + Array.from({ length: t.w }, (_, x) => (x % 10 === 0 ? String(x / 10) : ' ')).join('') + '\n';
for (let y = 0; y < t.h; y++) {
  let row = String(y).padStart(3) + ' ';
  for (let x = 0; x < t.w; x++) {
    const i = y * t.w + x;
    const b = c.occupied[i]!;
    if (b >= 0) row += sym[st.buildings.find((q) => q.id === b)!.type];
    else if (c.gateOf[i]! >= 0) row += '@';
    else if (st.roads[i]) row += t.water[i] ? '=' : '#';
    else if (t.water[i]) row += '~';
    else if (t.forest[i]! > 0.5) row += 'T';
    else if (t.field[i]) row += ',';
    else row += t.cellH[i]! > 16 ? '^' : '.';
  }
  out += row + '\n';
}
console.log(out);
let min = Infinity, max = -Infinity;
for (const h of t.cellH) { min = Math.min(min, h); max = Math.max(max, h); }
console.log('height range', min.toFixed(1), max.toFixed(1));
