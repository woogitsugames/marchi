// Terrain + vegetation identity and cost probe (perf day 12, D-280..D-283): builds the render-side ground of several
// worlds the way View.setWorld / syncNetwork do (Heightfield, RoadField, TerrainView, WaterView, VegetationView,
// GroundCover reeds) and prints a SHA-256 of every terrain geometry attribute, water depth, tree list and tree
// instance matrices, plus the time of each step (median of N cold-ish runs in one process).
// Usage: npx tsx tools/terrain-hash.ts [reps=5] [worlds=menu,m2,m7,m12,sandbox,...] (mission[:seed])
import { createHash } from 'node:crypto';
import { Group, Mesh, Vector3 } from 'three';
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

// node: the leaf / bark textures draw on a canvas; a no-op 2D context is enough (they are not hashed)
const noop: unknown = new Proxy(function () { return noop; }, { get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : noop), apply: () => noop });
(globalThis as Record<string, unknown>).document ??= {
  createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: (_t, k) => (k === 'getImageData' || k === 'createImageData' ? (_x: number, _y: number, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }) : noop), set: () => true }) }),
};

const [repsS = '5', worldsS = 'menu,m2,m7,m12,sandbox'] = process.argv.slice(2);
const reps = Number(repsS);
const worlds: Record<string, () => World> = { menu: menuWorld };
// a world is a mission id, optionally with a seed: m2, sandbox:7
for (const id of worldsS.split(',')) if (id !== 'menu') { const [m, sd] = id.split(':'); worlds[id] = () => createWorld(m!, sd ? Number(sd) : undefined); }

type Arr = ArrayLike<number> & { buffer: ArrayBufferLike; byteOffset: number; byteLength: number };
const feed = (h: ReturnType<typeof createHash>, a: Arr) => h.update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1]!;

noiseTexture(); // built before `menu-start` in the app (boot), not part of the world build
// tree models are cached per process (kit.ts cost, measured by the model probes): time only the placement
for (const k of TREE_KINDS) { treeBillboard(k); for (let v = 0; v < TREE_VARIANTS; v++) treeParts(k, v); }
const times: Record<string, Record<string, number[]>> = {};
const hashes: Record<string, Record<string, string>> = {};
for (let r = 0; r < reps; r++) {
  for (const [name, mk] of Object.entries(worlds)) {
    const w = mk();
    const T = (times[name] ??= {});
    const lap = (k: string, t0: number) => { (T[k] ??= []).push(performance.now() - t0); };
    let t0 = performance.now();
    const hf = new Heightfield(w.terrain);
    lap('heightfield', t0);
    const roads = new RoadField(hf.w, hf.h);
    const overlay = new OverlayData(hf.w, hf.h);
    t0 = performance.now();
    const terrain = new TerrainView(hf, roads, overlay);
    lap('terrain', t0);
    t0 = performance.now();
    const water = new WaterView(hf);
    lap('water', t0);
    t0 = performance.now();
    const veg = new VegetationView(hf, new Group());
    lap('veg-apron', t0);
    const cover = new GroundCover(hf);
    roads.rebuild(w);
    terrain.updateGround(w);
    t0 = performance.now();
    veg.rebuild(w, roads);
    lap('veg-place', t0);
    t0 = performance.now();
    veg.update(new Vector3(hf.sizeX * 0.5, 80, hf.sizeZ * 0.6), true);
    lap('veg-update', t0);
    t0 = performance.now();
    cover.rebuild(w, roads);
    lap('reeds', t0);
    if (r === 0) {
      const H: Record<string, string> = {};
      const ht = createHash('sha256');
      for (const c of terrain.group.children) {
        const g = (c as Mesh).geometry;
        ht.update(c.name);
        for (const k of Object.keys(g.attributes)) { ht.update(k); feed(ht, g.attributes[k]!.array as Arr); }
        feed(ht, g.index!.array as Arr);
        const bs = g.boundingSphere!, bb = g.boundingBox!;
        ht.update(`${bs.radius},${bs.center.toArray()},${bb.min.toArray()},${bb.max.toArray()}`);
      }
      H.terrain = ht.digest('hex').slice(0, 16);
      // 300 000 scattered samples of height / base / detail (a fixed LCG, a little past the map edges)
      const hh = createHash('sha256'), smp = new Float64Array(3000);
      let q = 12345;
      const rnd = () => ((q = (Math.imul(q, 1103515245) + 12345) >>> 0) / 4294967296);
      for (let b = 0; b < 300; b++) {
        for (let i = 0; i < 1000; i++) {
          const x = -6 + rnd() * (hf.sizeX + 12), z = -6 + rnd() * (hf.sizeZ + 12);
          smp[i * 3] = hf.height(x, z); smp[i * 3 + 1] = hf.base(x, z); smp[i * 3 + 2] = hf.detail(x, z);
        }
        feed(hh, smp);
      }
      H.heights = hh.digest('hex').slice(0, 16);
      const hw = createHash('sha256');
      const wg = water.mesh.geometry;
      for (const k of Object.keys(wg.attributes)) { hw.update(k); feed(hw, wg.attributes[k]!.array as Arr); }
      if (wg.index) feed(hw, wg.index.array as Arr);
      H.water = hw.digest('hex').slice(0, 16);
      const v = veg as unknown as { trees: { x: number; y: number; z: number; kind: number; variant: number; m: { elements: number[] }; blob: { elements: number[] } }[]; apron: typeof v.trees; near: Mesh[][]; far: Mesh[] };
      const hv = createHash('sha256');
      for (const list of [v.trees, v.apron]) {
        hv.update(`n${list.length}`);
        for (const t of list) feed(hv, new Float64Array([t.x, t.y, t.z, t.kind, t.variant, ...t.m.elements, ...t.blob.elements]));
      }
      H.trees = hv.digest('hex').slice(0, 16);
      H.nTrees = `${v.trees.length}+${v.apron.length}`;
      const hi = createHash('sha256');
      for (const m of [...v.near.flat(), ...v.far] as unknown as { count: number; instanceMatrix: { array: Arr } }[]) {
        hi.update(`c${m.count}`);
        feed(hi, m.instanceMatrix.array);
      }
      H.instances = hi.digest('hex').slice(0, 16);
      const reeds = (cover as unknown as { reeds: { count: number; instanceMatrix: { array: Arr } } }).reeds;
      const hr = createHash('sha256');
      hr.update(`c${reeds.count}`);
      feed(hr, reeds.instanceMatrix.array);
      H.reeds = hr.digest('hex').slice(0, 16);
      hashes[name] = H;
    }
    terrain.dispose(); water.dispose(); veg.dispose(); cover.dispose();
  }
}
for (const name of Object.keys(worlds)) {
  const T = times[name]!;
  console.log(name.padEnd(8), JSON.stringify(hashes[name]), Object.entries(T).map(([k, a]) => `${k} ${med(a).toFixed(1)}`).join(' | '));
}
