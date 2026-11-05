// Tables for docs/research/2026-11-05-frame-cost-day9.md from tools/frame9-cost.mjs JSON files.
// Usage: node tools/frame9-table.mjs docs/research/frame9-data
// Every ms figure is "ms of desktop CPU per game second at x4 / 60 fps" (median of the synthetic seconds of one run);
// with two runs the cell shows "run1 / run2" medians, so the spread between processes is visible.
import { readdirSync, readFileSync } from 'node:fs';
const dir = process.argv[2] ?? 'docs/research/frame9-data';
const runs = new Map();
for (const f of readdirSync(dir)) {
  const m = f.match(/^(.+)-(low|high)-r(\d)\.json$/);
  if (!m) continue;
  let d; try { d = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')); } catch { continue; }
  const k = `${m[1]} ${m[2]}`;
  if (!runs.has(k)) runs.set(k, []);
  runs.get(k).push(d);
}
const order = ['sandbox50 low', 'sandbox50 high', 'sandbox100 low', 'sandbox100 high', 'sandbox200 low', 'sandbox200 high', 'm13 high', 'm12 low', 'm12 high'];
const keys = [...runs.keys()].sort((a, b) => (order.indexOf(a) + 99 * (order.indexOf(a) < 0)) - (order.indexOf(b) + 99 * (order.indexOf(b) < 0)));
const f1 = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
const both = (rs, cam, get) => rs.map((d) => (d.cams[cam] ? get(d.cams[cam]) : null)).filter((x) => x !== null && x !== undefined);
const cell = (vals) => (vals.length ? vals.map((v) => (typeof v === 'number' ? f1(v) : v)).join(' / ') : '—');
const spread = (rs, cam, k) => { const t = both(rs, cam, (c) => c.timing[k]); if (!t.length) return '—'; const lo = Math.min(...t.map((x) => x.min)), hi = Math.max(...t.map((x) => x.max)); return `${f1(lo)}–${f1(hi)}`; };

for (const cam of ['near', 'mid']) {
  console.log(`\n### Kamera ${cam === 'near' ? '60 m' : '160 m'} — ms CPU na sekundę gry (×4, 60 kl.), mediana przebiegu 1 / 2\n`);
  console.log('| scena | jakość | razem | rozrzut razem (min–max) | sim | afterTick | onTick UI | wagons.frame | render() | z tego cień | view inne | hud | pinezki | ranking | App inne | ms/kl. |');
  console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const k of keys) {
    const rs = runs.get(k); const [sc, q] = k.split(' ');
    const g = (n) => cell(both(rs, cam, (c) => c.timing[n].med));
    console.log(`| ${sc} | ${q} | ${g('wall')} | ${spread(rs, cam, 'wall')} | ${g('sim')} | ${g('afterTick')} | ${g('onTickOther')} | ${g('wagonsFrame')} | ${g('render')} | ${g('shadow')} | ${g('viewOther')} | ${g('hud')} | ${g('markers')} | ${g('rank')} | ${g('appRest')} | ${cell(both(rs, cam, (c) => c.timing.wall.med / 60))} |`);
  }
  console.log(`\n### Kamera ${cam === 'near' ? '60 m' : '160 m'} — liczniki (przebieg 1)\n`);
  console.log('| scena | jakość | wozy (jedzie) | rys. mid/far | piny | przestoje | draw main/cień | tris main/cień | przebudowy progr./render | upload KB/kl. | alloc MB/s gry | KB/kl. | GC ms/s | style+layout ms/kl. (realne) |');
  console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const k of keys) {
    const rs = runs.get(k); const [sc, q] = k.split(' ');
    const c = rs[0].cams[cam]; if (!c) continue;
    const t = c.timing, s = c.scene;
    const gc = both(rs, cam, (x) => (x.profile.buckets.find((b) => b[0] === 'GC') ?? [0, 0])[1]);
    console.log(`| ${sc} | ${q} | ${s.wagons} (${s.moving}) | ${s.drawnMid}/${s.drawnFar} | ${s.pins} | ${s.stalls} | ${t.draws.med.toFixed(0)}/${t.drawsShadow.med.toFixed(0)} | ${(t.tris.med / 1000).toFixed(0)}k/${(t.trisShadow.med / 1000).toFixed(0)}k | ${t.cpkPerRender.med} | ${t.uploadKB.med.toFixed(1)} | ${cell(both(rs, cam, (x) => x.alloc.MBperGameS))} | ${c.alloc.KBperFrame} | ${cell(gc)} | ${(c.realFrames.recalcStyleMsPerFrame + c.realFrames.layoutMsPerFrame).toFixed(2)} |`);
  }
}
console.log('\n### Profil CPU (przebieg 1): kubełki ms/s gry\n');
for (const k of keys) for (const cam of ['near', 'mid']) {
  const c = runs.get(k)[0].cams[cam]; if (!c) continue;
  console.log(`- **${k} ${cam === 'near' ? '60 m' : '160 m'}** (próbkowane ${c.profile.sampledMsPerS} ms/s): ` + c.profile.buckets.slice(0, 12).map(([n, v]) => `${n} ${v}`).join('; '));
}
console.log('\n### Alokacje (przebieg 1): KB/s gry\n');
for (const k of keys) for (const cam of ['near', 'mid']) {
  const c = runs.get(k)[0].cams[cam]; if (!c) continue;
  console.log(`- **${k} ${cam === 'near' ? '60 m' : '160 m'}** ${c.alloc.MBperGameS} MB/s: ` + c.alloc.top.slice(0, 8).map(([n, v]) => `${n} ${v}`).join('; '));
}
