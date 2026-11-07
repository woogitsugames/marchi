// Perf day 13 (D-296/D-297): cold cost of the menu terrain pieces in and out of the first frame, and of the tree
// re-bucket that syncNetwork used to force. One cold process per run (the JIT state is the point), thread CPU ms.
//   npx esbuild tools/defer-probe.ts --bundle --platform=node --format=esm --outfile=/tmp/dp.mjs \
//     --define:import.meta.env.BASE_URL='"/"' --define:import.meta.env.DEV=false
//   [THREAD_CPU=1] node /tmp/dp.mjs <mode: all|split>   (prints one JSON line)
import { readFileSync } from 'node:fs';
import { Group, Vector3 } from 'three';
import { menuWorld } from '../src/game/menuScene';
import { Heightfield } from '../src/render/heightfield';
import { RoadField } from '../src/render/roads';
import { terrainGrid, TERRAIN_PIECES } from '../src/render/terrainGrid';
import { VegetationView } from '../src/render/vegetation';
import { treeBillboard, treeParts, TREE_KINDS, TREE_VARIANTS } from '../src/render/models/trees';

const noop: unknown = new Proxy(function () { return noop; }, { get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : noop), apply: () => noop });
(globalThis as Record<string, unknown>).document ??= {
  createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: (_t, k) => (k === 'getImageData' || k === 'createImageData' ? (_x: number, _y: number, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }) : noop), set: () => true }) }),
};
// THREAD_CPU=1: thread CPU time (schedstat, coarse at the scheduler tick); default wall clock
const clock = process.env.THREAD_CPU ? () => Number(readFileSync('/proc/thread-self/schedstat', 'utf8').split(' ')[0]) / 1e6 : () => performance.now();
const mode = process.argv[2] ?? 'all';
for (const k of TREE_KINDS) { treeBillboard(k); for (let v = 0; v < TREE_VARIANTS; v++) treeParts(k, v); }
const w = menuWorld();
const hf = new Heightfield(w.terrain);
const roads = new RoadField(hf.w, hf.h);
roads.rebuild(w);
// the pieces outside the menu's first frame in portrait 412x915 (measured in the app: terrain-0-0, terrain-2-1, W, E)
const OUT = [0, 5, 8, 9];
const out: Record<string, number> = {};
let t0 = clock();
if (mode === 'all') {
  for (let k = 0; k < TERRAIN_PIECES; k++) terrainGrid(hf, k);
  out.grids = clock() - t0;
} else {
  for (let k = 0; k < TERRAIN_PIECES; k++) if (!OUT.includes(k)) terrainGrid(hf, k);
  out.inView = clock() - t0;
  t0 = clock();
  for (const k of OUT) terrainGrid(hf, k);
  out.rest = clock() - t0;
}
const veg = new VegetationView(hf, new Group());
veg.rebuild(w, roads);
t0 = clock();
veg.update(new Vector3(hf.sizeX * 0.45, 230, hf.sizeZ * 0.5), true);
out.vegUpdate1 = clock() - t0; // the forced one (cold)
t0 = clock();
veg.update(new Vector3(hf.sizeX * 0.3, 60, hf.sizeZ * 0.4), true);
out.vegUpdate2 = clock() - t0; // what the first frame then redid
console.log(JSON.stringify({ mode, ...out }));
