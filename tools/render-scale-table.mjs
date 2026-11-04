// Markdown tables from tools/render-scale.mjs outputs (one JSON per file in a directory).
// Usage: node tools/render-scale-table.mjs <dir> [cmpDir]   (cmpDir: same file names, printed as "base -> cmp")
import { readdirSync, readFileSync } from 'node:fs';
const [dir, cmp] = process.argv.slice(2);
const load = (d) => Object.fromEntries(readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => {
  try { return [f, JSON.parse(readFileSync(`${d}/${f}`, 'utf8'))]; } catch { return [f, null]; }
}).filter(([, v]) => v));
const A = load(dir), B = cmp ? load(cmp) : null;
const k = (x) => (x >= 1e5 ? `${(x / 1e3).toFixed(0)}k` : x >= 1e3 ? `${(x / 1e3).toFixed(1)}k` : `${+x.toFixed(x < 10 ? 2 : 0)}`);
const qo = { low: 0, high: 1, ultra: 2 };
const files = Object.keys(A).sort((a, b) => (qo[A[a].quality] - qo[A[b].quality]) || (A[a].pins - A[b].pins) || (A[a].wagons - A[b].wagons));
const cell = (f, cam, get) => {
  const a = A[f]?.cams[cam]; if (!a) return '—';
  const va = get(a); if (va === undefined || va === null) return '—';
  if (!B) return k(va);
  const b = B[f]?.cams[cam]; const vb = b ? get(b) : undefined;
  return vb === undefined ? k(va) : `${k(va)} → ${k(vb)}`;
};
const cols = [
  ['wozy (rys. mid/far)', (r) => null],
  ['GL draw main', (r) => r.gl.drawsMain], ['GL draw cień', (r) => r.gl.drawsShadow],
  ['tris main', (r) => r.gl.trisMain], ['tris cień', (r) => r.gl.trisShadow],
  ['upload KB/kl.', (r) => r.gl.uploadKBPerFrame], ['wywołań GL/kl.', (r) => r.gl.callsPerFrame],
  ['wagons.frame ms', (r) => r.micro.wagonsFrame], ['render() ms', (r) => r.micro.render],
  ['afterTick ms/tick', (r) => r.micro.viewAfterTick], ['markers ms', (r) => r.micro.markers],
  ['autosave sync ms', (r) => r.micro.autosaveSync],
  ['alloc KB/kl. (wagons.frame+render)', (r) => r.microAlloc.wagonsFrame + r.microAlloc.render],
  ['alloc KB/tick', (r) => r.microAlloc.tick],
  ['piny (wozy)', (r) => null], ['DOM', (r) => r.dom], ['heap MB', (r) => r.heapMB],
];
for (const cam of ['near', 'far']) {
  console.log(`\n### Kamera ${cam}\n`);
  console.log(`| jakość | wozy | ${cols.map((c) => c[0]).join(' | ')} |`);
  console.log(`|---|---:|${cols.map(() => '---:').join('|')}|`);
  for (const f of files) {
    const d = A[f]; const r = d.cams[cam]; if (!r) continue;
    const row = cols.map(([name, get]) => {
      if (name.startsWith('wozy')) return `${r.wagons.mid + r.wagons.near}/${r.wagons.far} (${r.wagons.moving} jedzie)`;
      if (name.startsWith('piny')) return `${r.pins.shown} (${r.pins.wagon})`;
      return cell(f, cam, get);
    });
    console.log(`| ${d.quality}${d.pins ? ` +${d.setup.placed} pin` : ''} | ${d.wagons} | ${row.join(' | ')} |`);
  }
}
console.log('\n### Pamięć GPU (szac. z wywołań GL, MB) i liczniki three.js\n');
console.log('| jakość | wozy | tekstury | bufory | renderbuffery | canvas (szac.) | info.geometries | info.textures | programy |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const f of files) {
  const d = A[f]; const r = d.cams.far ?? d.cams.near; if (d.pins) continue;
  console.log(`| ${d.quality} | ${d.wagons} | ${r.memMB.textures.toFixed(1)} | ${r.memMB.buffers.toFixed(1)} | ${r.memMB.renderbuffers.toFixed(1)} | ${r.memMB.canvasEst.toFixed(1)} | ${r.info.geometries} | ${r.info.textures} | ${r.info.programs} |`);
}
console.log('\n### Okno czasowe (prawdziwe klatki, SwiftShader; styl/layout z CDP)\n');
console.log('| plik | kamera | fps | ticki/kl. | recalc style /s | ms /s | layout /s | ms /s | GC ms/s | alloc MB/s |');
console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const f of files) for (const [cam, r] of Object.entries(A[f].cams)) {
  console.log(`| ${f.replace('.json', '')} | ${cam} | ${r.fps} | ${r.ticksPerFrame} | ${r.cdp.recalcStylePerS.toFixed(1)} | ${r.cdp.recalcStyleMsPerS.toFixed(1)} | ${r.cdp.layoutPerS.toFixed(1)} | ${r.cdp.layoutMsPerS.toFixed(1)} | ${r.profile.gcMsPerS} | ${r.alloc.MBperS} |`);
}
