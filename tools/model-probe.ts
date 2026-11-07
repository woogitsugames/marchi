// Model build cost probe (perf day 15, D-320..D-322): the procedural models the menu builds before `ready` (every
// tree kind and variant with its far card, the bush, the menu world's building kinds, the near wagon rig and the
// far wagon), timed per group in a cold process (the JIT state is the point: run it many times, interleaved).
// With HASH=1 it also prints an FNV hash of every attribute and index of every model part (identity proof).
//   npx esbuild tools/model-probe.ts --bundle --platform=node --format=esm --outfile=/tmp/mp.mjs \
//     --define:import.meta.env.BASE_URL='"/"' --define:import.meta.env.DEV=false
//   [THREAD_CPU=1] [HASH=1] node /tmp/mp.mjs      (prints one JSON line: ms per group)
import { readFileSync } from 'node:fs';
import type { BufferGeometry } from 'three';
import { menuWorld } from '../src/game/menuScene';
import { treeBillboard, treeParts, TREE_KINDS, TREE_VARIANTS } from '../src/render/models/trees';
import { buildingModel, BUILDING_KINDS, castleUpgradeParts, propParts, PROP_KINDS, tradePostClosedParts, tradePostOpenParts, type BuildingKind } from '../src/render/models/buildings';
import { wagonLod1, wagonModel } from '../src/render/models/wagon';
import { CARGO_GOODS, cargoUnitParts } from '../src/render/models/cargo';
import { bridgeEndParts, bridgeParts } from '../src/render/models/bridges';
import type { ModelPart } from '../src/render/models/kit';

const clock = process.env.THREAD_CPU ? () => Number(readFileSync('/proc/thread-self/schedstat', 'utf8').split(' ')[0]) / 1e6 : () => performance.now();
const types = [...new Set(menuWorld().state.buildings.map((b) => b.type as BuildingKind))];
const out: Record<string, number> = {};
let t0 = clock();
const lap = (k: string) => { const t = clock(); out[k] = +(t - t0).toFixed(2); t0 = t; };
const all: [string, ModelPart[]][] = [];
for (const k of TREE_KINDS) for (let v = 0; v < TREE_VARIANTS; v++) all.push([`tree:${k}${v}`, treeParts(k, v)]);
lap('trees');
for (const k of TREE_KINDS) all.push([`bb:${k}`, treeBillboard(k)]);
lap('billboards');
for (const t of types) all.push([`b:${t}`, buildingModel(t).parts]);
lap('buildings');
const wm = wagonModel();
all.push(['wagon:body', wm.body], ['wagon:horse', wm.horse], ['wagon:wf', wm.wheelFront], ['wagon:wr', wm.wheelRear], ['wagon:driver', wm.driver], ['wagon:lod1', wagonLod1()]);
lap('wagon');
let s = 0;
for (const x of Object.values(out)) s += x;
out.sum = +s.toFixed(2);
if (process.env.HASH) {
  // the rest of the catalogue too (not timed): every building kind, prop, cargo, bridge, the mid wagon
  for (const t of BUILDING_KINDS) all.push([`b:${t}`, buildingModel(t).parts]);
  all.push(['castleUp', castleUpgradeParts()], ['postOpen', tradePostOpenParts()], ['postClosed', tradePostClosedParts()]);
  for (const p of PROP_KINDS) all.push([`prop:${p}`, propParts(p)]);
  for (const g of CARGO_GOODS) all.push([`cargo:${g}`, cargoUnitParts(g)]);
  for (const k of ['wood', 'stone'] as const) all.push([`bridge:${k}`, bridgeParts(k)], [`bridgeEnd:${k}`, bridgeEndParts(k)]);
  const wmid = wagonModel('mid');
  all.push(['mid:body', wmid.body], ['mid:horse', wmid.horse], ['mid:driver', wmid.driver]);
  const fnv = (g: BufferGeometry): string => {
    let h = 0x811c9dc5;
    const eat = (a: ArrayLike<number> & { buffer: ArrayBufferLike; byteOffset: number; byteLength: number }) => {
      const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
      for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i]!, 16777619);
    };
    const parts: string[] = [];
    if (g.index) { eat(g.index.array as Uint16Array); parts.push(`i${g.index.array.constructor.name[0]}${g.index.count}`); }
    for (const n of Object.keys(g.attributes).sort()) { const a = g.getAttribute(n); eat(a.array as Float32Array); parts.push(`${n}${a.itemSize}${a.array.constructor.name[0]}`); }
    const bs = g.boundingSphere, bb = g.boundingBox;
    const extra = `${bs ? [bs.center.x, bs.center.y, bs.center.z, bs.radius].join(',') : '-'}|${bb ? [bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z].join(',') : '-'}`;
    return `${(h >>> 0).toString(16)} ${parts.join(' ')} ${extra}`;
  };
  const seen = new Set<string>();
  for (const [name, parts] of all) {
    if (seen.has(name)) continue;
    seen.add(name);
    for (const p of parts) console.log(`${name} ${p.material} ${fnv(p.geometry)}`);
  }
}
console.log(JSON.stringify(out));
