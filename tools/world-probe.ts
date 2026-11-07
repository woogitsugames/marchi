// World build cost probe (perf day 14, D-310..D-312): the render-side steps of View.setWorld + syncNetwork for one
// world, in the order the view runs them, timed in a cold process (the JIT state is the point: run it many times).
// No hashing (tools/terrain-hash.ts proves identity); the tree and building models are built first and not timed
// unless MODELS=1.
//   npx esbuild tools/world-probe.ts --bundle --platform=node --format=esm --outfile=/tmp/wp.mjs \
//     --define:import.meta.env.BASE_URL='"/"' --define:import.meta.env.DEV=false
//   [THREAD_CPU=1] node /tmp/wp.mjs [world=menu] [twice=0]   (prints one JSON line: ms per step)
//   twice=1 builds a second world (m2) after the first, warm, to show the mission-load cost after the menu.
import { readFileSync } from 'node:fs';
import { Group, Vector3 } from 'three';
import { createWorld, type World } from '../src/sim/index';
import { menuWorld } from '../src/game/menuScene';
import { Heightfield } from '../src/render/heightfield';
import { RoadField } from '../src/render/roads';
import { OverlayData } from '../src/render/overlay';
import { TerrainView } from '../src/render/terrain';
import { WaterView } from '../src/render/water';
import { VegetationView } from '../src/render/vegetation';
import { GroundCover } from '../src/render/groundCover';
import { noiseTexture } from '../src/render/noiseTex';
import { treeBillboard, treeParts, TREE_KINDS, TREE_VARIANTS } from '../src/render/models/trees';

const noop: unknown = new Proxy(function () { return noop; }, { get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : noop), apply: () => noop });
(globalThis as Record<string, unknown>).document ??= {
  createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: (_t, k) => (k === 'getImageData' || k === 'createImageData' ? (_x: number, _y: number, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }) : noop), set: () => true }) }),
};
const clock = process.env.THREAD_CPU ? () => Number(readFileSync('/proc/thread-self/schedstat', 'utf8').split(' ')[0]) / 1e6 : () => performance.now();
const [name = 'menu', twice = '0'] = process.argv.slice(2);
const mk = (id: string): World => (id === 'menu' ? menuWorld() : createWorld(id));

noiseTexture();
for (const k of TREE_KINDS) { treeBillboard(k); for (let v = 0; v < TREE_VARIANTS; v++) treeParts(k, v); }

function build(w: World, tag: string, out: Record<string, number>): void {
  let t0 = clock();
  const lap = (k: string) => { const t = clock(); out[tag + k] = +(t - t0).toFixed(2); t0 = t; };
  const hf = new Heightfield(w.terrain); lap('heightfield');
  const roads = new RoadField(hf.w, hf.h); const overlay = new OverlayData(hf.w, hf.h); lap('fields');
  const terrain = new TerrainView(hf, roads, overlay); lap('terrain');
  const water = new WaterView(hf); lap('water');
  const veg = new VegetationView(hf, new Group()); lap('vegApron');
  const cover = new GroundCover(hf); lap('cover');
  roads.rebuild(w); lap('roads');
  terrain.updateGround(w); lap('ground');
  veg.rebuild(w, roads); lap('vegPlace');
  cover.rebuild(w, roads); lap('reeds');
  veg.update(new Vector3(hf.sizeX * 0.5, 80, hf.sizeZ * 0.6), true); lap('vegUpdate');
  let s = 0;
  for (const [k, v] of Object.entries(out)) if (k.startsWith(tag)) s += v;
  out[tag + 'sum'] = +s.toFixed(2);
}
const out: Record<string, number> = {};
build(mk(name), '', out);
if (twice === '1') build(mk('m2'), 'm2.', out);
console.log(JSON.stringify(out));
