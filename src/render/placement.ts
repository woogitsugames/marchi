// Where the trees and the reeds stand (split from vegetation.ts / groundCover.ts, D-311 / D-312): pure placement with
// no materials or textures, so the tests can run it headless. Placement is deterministic per cell and skips water,
// fields, buildings and roads. The ground-only work (heights, field clearance, matrices, the reed scan) is kept per
// ground (groundCache.ts) and filtered per world.
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { Terrain, World } from '../sim/index';
import { net } from '../sim/index';
import { groundMemo, sameGround } from './groundCache';
import { CELL, type Heightfield } from './heightfield';
import { hash3, rng, vnoise } from './models/kit';
import { TREE_KINDS, TREE_SIZE, TREE_VARIANTS, type TreeKind } from './models/treeKinds';
import type { RoadField } from './roads';
import { apronHeight } from './terrainGrid';

export interface Tree {
  x: number;
  y: number;
  z: number;
  kind: number;
  /** Geometry variant (near LOD). */
  variant: number;
  m: Matrix4;
  /** Contact-shadow decal under a far card (flat, crown-sized). */
  blob: Matrix4;
}

const _q = new Quaternion();
const _v = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);

const _e = new Euler();

export function makeTree(x: number, y: number, z: number, kind: number, rot: number, scale: number): Tree {
  // per-tree shape variety without extra draw calls: crown width vs height, a slight lean
  const h1 = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
  const h2 = Math.abs(Math.sin(x * 39.3468 + z * 11.1351) * 24634.6345) % 1;
  const h3 = Math.abs(Math.sin(x * 73.156 + z * 52.235) * 12345.678) % 1;
  const sy = scale * (0.88 + h1 * 0.26);
  const sxz = scale * (0.88 + h2 * 0.24);
  const tilt = 0.1 * (h3 - 0.5);
  _e.set(tilt, rot, -tilt * (h1 - 0.5) * 2, 'YXZ');
  _q.setFromEuler(_e);
  const m = new Matrix4().compose(_v.set(x, y - 0.15, z), _q, _s.set(sxz, sy, sxz));
  // contact shadow: shrubs a crown wide, trees a small pool around the trunk foot
  const r = TREE_SIZE[TREE_KINDS[kind]!].radius * sxz * (TREE_KINDS[kind] === 'bush' ? 0.8 : 0.5);
  _q.setFromAxisAngle(_up, rot);
  const blob = new Matrix4().compose(_v.set(x, y + 0.05, z), _q, _s.set(r, 1, r));
  const variant = Math.floor(h3 * 997) % TREE_VARIANTS;
  return { x, y, z, kind, variant, m, blob };
}

export const K = (k: TreeKind) => TREE_KINDS.indexOf(k);

export function pickKind(r: number, north: boolean): number {
  if (north) return r < 0.58 ? K('spruce') : r < 0.93 ? K('pine') : K('birch');
  return r < 0.42 ? K('oak') : r < 0.78 ? K('birch') : K('pine');
}

/** Chamfer distance (cells, capped) from cells where `src` is true. */
export function cellDistance(W: number, H: number, src: (i: number) => boolean, cap: number): Float32Array {
  const d = new Float32Array(W * H).fill(cap);
  for (let i = 0; i < W * H; i++) if (src(i)) d[i] = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let v = d[i]!;
    if (x > 0) v = Math.min(v, d[i - 1]! + 1);
    if (y > 0) v = Math.min(v, d[i - W]! + 1);
    if (x > 0 && y > 0) v = Math.min(v, d[i - W - 1]! + 1.414);
    if (x < W - 1 && y > 0) v = Math.min(v, d[i - W + 1]! + 1.414);
    d[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x;
    let v = d[i]!;
    if (x < W - 1) v = Math.min(v, d[i + 1]! + 1);
    if (y < H - 1) v = Math.min(v, d[i + W]! + 1);
    if (x < W - 1 && y < H - 1) v = Math.min(v, d[i + W + 1]! + 1.414);
    if (x > 0 && y < H - 1) v = Math.min(v, d[i + W - 1]! + 1.414);
    d[i] = Math.min(cap, v);
  }
  return d;
}

/**
 * The ground-only half of the tree placement (D-312): every tree `placeTrees` could put on this ground, in placement
 * order, with the tests that depend on the ground alone already applied (inside the map, not on a water or field cell,
 * clear of fields, above the water line; the forest, scrub-belt, hedgerow, bank and copse rules). What is left for each
 * world is cheap: skip the trees on cells with a building, its yard or a road, too close to a road, the bank shrubs
 * near the network and the copses near it. Kept per ground (with its forest and fields), so a road change or a world
 * on the same ground (menu -> mission I) does not redo the heights, the matrices and the field tests.
 */
interface TreePlan {
  /**
   * Candidate trees: per map cell its own (main), then its bank shrubs; then the copses, each in order. Tested and
   * built on first use (many candidates stand where a world has a road or a building): undefined = not yet, null =
   * fails a ground test (too close to a field, under the water line).
   */
  trees: (Tree | null | undefined)[];
  /** Per candidate: x, the field clearance it needs (m), z, kind, rotation, scale. */
  arg: Float64Array;
  /** Per candidate: the road clearance it needs (m) and the map cell it stands on. */
  clear: Float64Array;
  cell: Int32Array;
  /** Per map cell i: its main candidates are [at[i], bank[i]), its bank shrubs [bank[i], at[i + 1]). */
  at: Int32Array;
  bank: Int32Array;
  /** Copses that pass the ground tests: the copse's centre cell and its candidates [from, to). */
  copses: { ci: number; from: number; to: number }[];
}

/** Same ground for the tree plan: `sameGround` plus the same forest density and fields. */
function sameTreeGround(a: Terrain, b: Terrain): boolean {
  if (!sameGround(a, b)) return false;
  if (a === b) return true;
  const fa = a.forest, fb = b.forest, la = a.field, lb = b.field;
  if (fa.length !== fb.length || la.length !== lb.length) return false;
  for (let i = 0; i < fa.length; i++) if (!Object.is(fa[i], fb[i])) return false;
  for (let i = 0; i < la.length; i++) if (la[i] !== lb[i]) return false;
  return true;
}

/** Is (px, pz) at least `need` metres from every tilled field cell? */
export function fieldClear(t: Terrain, px: number, pz: number, need: number): boolean {
  const W = t.w, H = t.h;
  const cx = Math.floor(px / CELL), cz = Math.floor(pz / CELL), rr = Math.ceil(need / CELL);
  for (let y = cz - rr; y <= cz + rr; y++) for (let x = cx - rr; x <= cx + rr; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H || !t.field[y * W + x]) continue;
    const dx = Math.max(x * CELL - px, 0, px - (x + 1) * CELL), dz = Math.max(y * CELL - pz, 0, pz - (y + 1) * CELL);
    if (dx * dx + dz * dz < need * need) return false;
  }
  return true;
}

function planTrees(hf: Heightfield): TreePlan {
  const t = hf.t;
  const W = t.w, H = t.h;
  // growable typed arrays (number[] pushes of mixed doubles cost more than the placement itself, cold)
  let cap = 4096, count = 0;
  let arg = new Float64Array(cap * 6), clear = new Float64Array(cap), cell = new Int32Array(cap);
  const at = new Int32Array(W * H + 1), bank = new Int32Array(W * H);
  const copses: TreePlan['copses'] = [];
  // the ground part of `blocked` (water, fields); buildings, yards and roads are tested per world
  const groundBlocked = (i: number) => !!(t.water[i] || t.field[i]);
  const fd = cellDistance(W, H, (i) => t.forest[i]! > 0.3, 8);
  // the old `put` up to its cheap tests (inside the map, not on a water or field cell); the road and building tests are
  // per world, the field clearance and the water line are done by `placeTrees` on first use (D-312)
  const put = (px: number, pz: number, kind: number, scale: number, rot: number) => {
    const bush = kind === K('bush');
    const crown = TREE_SIZE[TREE_KINDS[kind]!].radius * scale;
    // shrubs keep their whole crown off the track and its verge; trees may overhang a little
    const need = bush ? Math.min(5.8, 2.7 + crown * 0.8) : 2.6 + crown * 0.35;
    if (!hf.inside(px, pz)) return;
    const cx = Math.floor(px / CELL), cz = Math.floor(pz / CELL);
    if (groundBlocked(cz * W + cx)) return;
    if (count === cap) {
      cap *= 2;
      const a2 = new Float64Array(cap * 6), c2 = new Float64Array(cap), e2 = new Int32Array(cap);
      a2.set(arg); c2.set(clear); e2.set(cell);
      arg = a2; clear = c2; cell = e2;
    }
    const a = count * 6;
    // nothing grows out over ploughed soil: shrubs keep their crown off it, trees their trunk
    arg[a] = px; arg[a + 1] = bush ? crown * 0.75 : 1.6; arg[a + 2] = pz; arg[a + 3] = kind; arg[a + 4] = rot; arg[a + 5] = scale;
    clear[count] = need;
    cell[count] = cz * W + cx;
    count++;
  };
  const bushes = (x: number, y: number, n: number, r: () => number, s0 = 0.7) => {
    for (let k = 0; k < n; k++) put((x + r()) * CELL, (y + r()) * CELL, K('bush'), s0 + r() * 0.55, r() * 6.28);
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      at[i] = count;
      bank[i] = count;
      if (groundBlocked(i)) continue;
      const r = rng(i * 7919 + 17);
      const f = t.forest[i]!;
      if (f >= 0.05) {
        let n = Math.floor(f * 1.3 + r() * 0.9);
        if (n > 2) n = 2;
        for (let k = 0; k < n; k++) {
          const kind = pickKind(r(), y < 22 && f > 0.2);
          put((x + 0.1 + r() * 0.8) * CELL, (y + 0.1 + r() * 0.8) * CELL, kind, 0.72 + r() * 0.45, r() * Math.PI * 2);
        }
        // understorey shrubs thicken toward the edge of the wood
        if (f < 0.6 && r() < 0.9 - f) bushes(x, y, 1 + (r() < 0.5 ? 1 : 0), r);
        bank[i] = count;
      } else {
        // scrub belt: shrubs and young trees thinning out away from the forest, in clumps
        // (noise-gated) rather than an even sprinkle over the meadow
        const d = fd[i]!;
        if (d < 3.5) {
          const p = Math.pow(1 - d / 3.5, 1.4);
          const clump = vnoise(x / 3, y / 3, 2.5, 85) + p * 0.45;
          if (clump > 0.62 && r() < p + 0.25) bushes(x, y, 1 + (r() < p ? 1 : 0) + (r() < p * 0.5 ? 1 : 0), r, 0.6);
          if (clump > 0.55 && r() < p * 0.35) put((x + 0.2 + r() * 0.6) * CELL, (y + 0.2 + r() * 0.6) * CELL, r() < 0.6 ? K('birch') : y < 22 ? K('spruce') : K('pine'), 0.55 + r() * 0.3, r() * 6.28);
        }
        // hedgerow along field edges, with gaps
        const fieldN = (x > 0 && t.field[i - 1]) || (x < W - 1 && t.field[i + 1]) || (y > 0 && t.field[i - W]) || (y < H - 1 && t.field[i + W]);
        if (fieldN && vnoise(x / 3.5, y / 3.5, 0.5, 81) > 0.36) {
          bushes(x, y, 3, r, 0.85);
          if (r() < 0.28) put((x + 0.5) * CELL, (y + 0.5) * CELL, r() < 0.6 ? K('oak') : K('birch'), 0.7 + r() * 0.35, r() * 6.28);
        }
        bank[i] = count;
        // shrubs along the river bank (alder/willow scrub stand-in) — kept only where the network is > 2 cells away
        // (`rd`, per world); the last use of this cell's generator, so skipping them changes nothing after
        const wd = hf.waterDist[i]!;
        if (wd >= 1 && wd < 2.5 && vnoise(x / 4, y / 4, 1.5, 83) > 0.55) {
          bushes(x, y, 1 + (r() < 0.4 ? 1 : 0), r, 0.7);
          if (r() < 0.12) put((x + 0.5) * CELL, (y + 0.5) * CELL, K('birch'), 0.65 + r() * 0.3, r() * 6.28);
        }
      }
    }
  }
  at[W * H] = count;

  // copses: a few clumps of oak and birch in the open meadow, ringed by shrubs (kept only away from buildings,
  // yards and the network, per world)
  const G = 12;
  for (let by = 0; by < H; by += G) for (let bx = 0; bx < W; bx += G) {
    const r = rng((by * 131 + bx) * 7 + 99);
    if (r() > 0.42) continue;
    const cx = bx + Math.floor(r() * G), cy = by + Math.floor(r() * G);
    if (cx >= W || cy >= H) continue;
    const ci = cy * W + cx;
    if (groundBlocked(ci) || t.forest[ci]! > 0.05 || fd[ci]! < 5 || hf.waterDist[ci]! < 3) continue;
    const from = count;
    const ox = (cx + 0.5) * CELL, oz = (cy + 0.5) * CELL;
    const nT = 3 + Math.floor(r() * 5);
    const spread = 4 + nT * 0.9;
    for (let k = 0; k < nT; k++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * spread;
      const q = r();
      put(ox + Math.cos(a) * d, oz + Math.sin(a) * d, q < 0.5 ? K('oak') : q < 0.88 ? K('birch') : K('pine'), 0.65 + r() * 0.45, r() * 6.28);
    }
    // a tight rim of shrubs hugging the copse, not a scatter around it
    const nB = 3 + Math.floor(r() * 4);
    for (let k = 0; k < nB; k++) {
      const a = r() * 6.28, d = spread * (0.65 + r() * 0.35);
      put(ox + Math.cos(a) * d, oz + Math.sin(a) * d, K('bush'), 0.6 + r() * 0.6, r() * 6.28);
    }
    copses.push({ ci, from, to: count });
  }
  return { trees: new Array<Tree | null | undefined>(count), arg: arg.slice(0, count * 6), clear: clear.slice(0, count), cell: cell.slice(0, count), at, bank, copses };
}

/**
 * Forest from terrain.forest; a scrub belt whose density falls off away from the forest edge;
 * hedgerows (bushes with the odd oak or birch) along field edges; small copses in the open
 * meadow; a few shrubs on the river banks. No random solitary trees. The ground's plan (`planTrees`) filtered by
 * this world's buildings, yards and roads — the same trees in the same order as placing them from scratch.
 */
export function placeTrees(world: World, hf: Heightfield, roads: RoadField): Tree[] {
  const t = world.terrain, st = world.state;
  const occ = net(world).occupied;
  const out: Tree[] = [];
  const W = t.w, H = t.h;
  // keep a clear yard around buildings
  const yard = new Uint8Array(W * H);
  for (const b of st.buildings) {
    const r = b.type === 'castle' ? 3 : 2;
    for (let y = b.y - r; y < b.y + b.h + r; y++) for (let x = b.x - r; x < b.x + b.w + r; x++) {
      if (x >= 0 && y >= 0 && x < W && y < H) yard[y * W + x] = 1;
    }
  }
  // the world part of the old `blocked` (the plan already left out water and field cells)
  const blocked = (i: number) => !!(occ[i] !== -1 || st.roads[i] || yard[i]);
  const rd = cellDistance(W, H, (i) => st.roads[i]! > 0 || occ[i] !== -1, 8);
  const plan = groundMemo('tree-plan', hf.t, () => planTrees(hf), sameTreeGround);
  const { trees, arg, clear, cell, at, bank } = plan;
  const take = (from: number, to: number) => {
    for (let k = from; k < to; k++) {
      const a = k * 6, px = arg[a]!, pz = arg[a + 2]!;
      if (roads.distAt(px, pz) < clear[k]!) continue;
      if (blocked(cell[k]!)) continue;
      let tr = trees[k];
      if (tr === undefined) {
        // the old put's remaining tests, once per candidate and ground: field clearance, then the water line
        const kind = arg[a + 3]! | 0; // an int, as the old put passed it (a Smi field in Tree, not a double)
        let py = 0;
        if (!fieldClear(t, px, pz, arg[a + 1]!) || (py = hf.height(px, pz)) < hf.waterLevel + (kind === K('bush') ? 0.3 : 0.45)) tr = null;
        else tr = makeTree(px, py, pz, kind, arg[a + 4]!, arg[a + 5]!);
        trees[k] = tr;
      }
      if (tr) out.push(tr);
    }
  };
  for (let i = 0; i < W * H; i++) {
    if (blocked(i)) continue;
    take(at[i]!, bank[i]!);
    if (rd[i]! > 2) take(bank[i]!, at[i + 1]!);
  }
  for (const c of plan.copses) {
    if (blocked(c.ci) || rd[c.ci]! < 3) continue;
    take(c.from, c.to);
  }
  return out;
}

export function placeApron(hf: Heightfield): Tree[] {
  const out: Tree[] = [];
  const r = rng(4242);
  const S = 6.5;
  const band = 150;
  for (let z = -band; z < hf.sizeZ + band; z += S) {
    for (let x = -band; x < hf.sizeX + band; x += S) {
      if (hf.inside(x, z)) continue;
      const px = x + r() * S, pz = z + r() * S;
      if (hf.inside(px, pz)) continue;
      const north = pz < 60;
      // groves with open ground between them (no even sprinkle of lone trees on the hills)
      const grove = 0.5 + 0.5 * Math.sin(px * 0.021 + Math.cos(pz * 0.017) * 3);
      const dens = north ? 0.8 : grove > 0.55 ? 0.3 + 0.55 * (grove - 0.55) / 0.45 : 0.03;
      if (r() > dens) continue;
      const y = apronHeight(hf, px, pz);
      if (y < hf.waterLevel + 0.6) continue;
      out.push(makeTree(px, y, pz, pickKind(r(), north), r() * 6.28, 0.8 + r() * 0.4));
    }
  }
  return out;
}

/**
 * Reed clumps that pass every ground-only test, in scan order (rows of 1 m, west to east), 5 numbers each: x, y, z,
 * rotation, scale. Only cells within 2,5 cells of water can hold one, so the scan visits just those cells' points —
 * the same points in the same order as the old scan of every metre of the map (D-311).
 */
export function reedCandidates(hf: Heightfield): Float64Array {
  const WL = hf.waterLevel, W = hf.w;
  const out: number[] = [];
  const S = 1.0; // one point per metre: x = cx * CELL + k exactly, as the old `x += S` from 0 gave
  for (let z = 0; z < hf.sizeZ; z += S) {
    const row = Math.floor(z / CELL) * W;
    for (let cx = 0; cx < W; cx++) {
      if (hf.waterDist[row + cx]! > 2.5) continue;
      for (let k = 0; k < CELL; k++) {
        const x = cx * CELL + k * S;
        const jx = x + hash3(Math.round(x * 4), Math.round(z * 4), 1, 5) * S;
        const jz = z + hash3(Math.round(x * 4), Math.round(z * 4), 2, 5) * S;
        const hy = hf.height(jx, jz), h = hy - WL; // (one sample for the test and the instance: D-281)
        if (h < -0.22 || h > 0.32) continue;
        // reed beds in patches, with gaps of open bank
        const patch = vnoise(jx / 11, jz / 9, 0.5, 61) + (vnoise(jx / 3, jz / 3, 1.5, 62) - 0.5) * 0.3;
        if (patch < 0.5) continue;
        const s = 0.75 + 0.6 * Math.min(1, (patch - 0.5) * 3) * (0.7 + hash3(Math.round(jx * 3), Math.round(jz * 3), 3, 5) * 0.5);
        out.push(jx, hy - 0.05, jz, hash3(Math.round(jx * 5), 0, Math.round(jz * 5), 7) * 6.28, s);
      }
    }
  }
  return Float64Array.from(out);
}
