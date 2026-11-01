// Trees from terrain.forest density: instanced full models near the camera, cross-quad
// billboards (atlas baked from the same models) further away and on the apron hills.
// Placement is deterministic per cell and skips water, fields, buildings and roads.
import { InstancedMesh, Matrix4, type Material, Quaternion, Vector3, type WebGLRenderer } from 'three';
import type { World } from '../sim/index';
import { net } from '../sim/index';
import { CELL, type Heightfield } from './heightfield';
import { rng, vnoise } from './models/kit';
import { modelMaterial } from './models/materials';
import { bakeTreeBillboards, treeBillboard, treeParts, TREE_KINDS, TREE_SIZE, type TreeKind } from './models/trees';
import type { RoadField } from './roads';
import { apronHeight } from './terrain';

interface Tree {
  x: number;
  y: number;
  z: number;
  kind: number;
  m: Matrix4;
}

const _q = new Quaternion();
const _v = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);

export class VegetationView {
  readonly group: import('three').Group;
  private trees: Tree[] = [];
  private apron: Tree[] = [];
  private near: InstancedMesh[][] = [];
  private far: InstancedMesh[] = [];
  private lastX = Infinity;
  private lastZ = Infinity;
  private lastR = 0;
  private castShadows = true;
  nearDist = 85;

  constructor(private readonly hf: Heightfield, group: import('three').Group) {
    this.group = group;
    this.apron = placeApron(hf);
  }

  bake(renderer: WebGLRenderer): void {
    bakeTreeBillboards(renderer);
  }

  setShadows(on: boolean): void {
    this.castShadows = on;
    for (const l of this.near) for (const m of l) m.castShadow = on;
    for (const m of this.far) m.castShadow = on;
  }

  rebuild(world: World, roads: RoadField): void {
    this.trees = placeTrees(world, this.hf, roads);
    // (re)allocate instanced meshes sized to the counts
    for (const l of this.near) for (const m of l) { this.group.remove(m); m.dispose(); }
    for (const m of this.far) { this.group.remove(m); m.dispose(); }
    this.near = [];
    this.far = [];
    TREE_KINDS.forEach((kind, k) => {
      const n = this.trees.filter((t) => t.kind === k).length;
      const na = this.apron.filter((t) => t.kind === k).length;
      this.near.push(
        treeParts(kind).map((p) => {
          const m = new InstancedMesh(p.geometry, modelMaterial(p.material) as Material, Math.max(1, n));
          m.count = 0;
          m.castShadow = this.castShadows;
          m.receiveShadow = true;
          m.name = `tree-${kind}-${p.material}`;
          this.group.add(m);
          return m;
        }),
      );
      const bb = treeBillboard(kind)[0]!;
      const fm = new InstancedMesh(bb.geometry, modelMaterial(bb.material) as Material, Math.max(1, n + na));
      fm.count = 0;
      fm.castShadow = this.castShadows;
      fm.receiveShadow = true;
      fm.name = `tree-bb-${kind}`;
      this.group.add(fm);
      this.far.push(fm);
    });
    this.lastX = Infinity;
  }

  /** Re-bucket near/far when the camera moved noticeably. */
  update(camPos: Vector3, force = false): void {
    const dx = camPos.x - this.lastX, dz = camPos.z - this.lastZ;
    if (!force && dx * dx + dz * dz < 36 && Math.abs(this.nearDist - this.lastR) < 1) return;
    this.lastX = camPos.x;
    this.lastZ = camPos.z;
    this.lastR = this.nearDist;
    const r2 = this.nearDist * this.nearDist;
    // shrubs are cheap and read badly as cross-quads from above: keep full models further out
    const bushK = K('bush');
    const rb = Math.max(this.nearDist, this.nearDist * 1.9);
    const rb2 = rb * rb;
    const counts = new Int32Array(TREE_KINDS.length);
    const fcounts = new Int32Array(TREE_KINDS.length);
    const cy = camPos.y;
    for (const t of this.trees) {
      const ddx = t.x - camPos.x, ddy = t.y - cy, ddz = t.z - camPos.z;
      const near = ddx * ddx + ddy * ddy + ddz * ddz < (t.kind === bushK ? rb2 : r2);
      if (near) {
        const list = this.near[t.kind]!;
        const i = counts[t.kind]!++;
        for (const m of list) m.setMatrixAt(i, t.m);
      } else {
        this.far[t.kind]!.setMatrixAt(fcounts[t.kind]!++, t.m);
      }
    }
    for (const t of this.apron) this.far[t.kind]!.setMatrixAt(fcounts[t.kind]!++, t.m);
    TREE_KINDS.forEach((_k, i) => {
      for (const m of this.near[i]!) {
        m.count = counts[i]!;
        m.instanceMatrix.needsUpdate = true;
        m.visible = m.count > 0;
        m.computeBoundingSphere();
      }
      const f = this.far[i]!;
      f.count = fcounts[i]!;
      f.instanceMatrix.needsUpdate = true;
      f.visible = f.count > 0;
      f.computeBoundingSphere();
    });
  }

  dispose(): void {
    for (const l of this.near) for (const m of l) m.dispose();
    for (const m of this.far) m.dispose();
  }
}

function makeTree(x: number, y: number, z: number, kind: number, rot: number, scale: number): Tree {
  _q.setFromAxisAngle(_up, rot);
  const m = new Matrix4().compose(_v.set(x, y - 0.15, z), _q, _s.set(scale, scale * (0.9 + Math.abs((x * 13.7 + z * 7.1) % 1) * 0.2), scale));
  return { x, y, z, kind, m };
}

const K = (k: TreeKind) => TREE_KINDS.indexOf(k);

function pickKind(r: number, north: boolean): number {
  if (north) return r < 0.58 ? K('spruce') : r < 0.93 ? K('pine') : K('birch');
  return r < 0.42 ? K('oak') : r < 0.78 ? K('birch') : K('pine');
}

/** Chamfer distance (cells, capped) from cells where `src` is true. */
function cellDistance(W: number, H: number, src: (i: number) => boolean, cap: number): Float32Array {
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
 * Forest from terrain.forest; a scrub belt whose density falls off away from the forest edge;
 * hedgerows (bushes with the odd oak or birch) along field edges; small copses in the open
 * meadow; a few shrubs on the river banks. No random solitary trees.
 */
function placeTrees(world: World, hf: Heightfield, roads: RoadField): Tree[] {
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
  const blocked = (i: number) => !!(t.water[i] || t.field[i] || occ[i] !== -1 || st.roads[i] || yard[i]);
  const fd = cellDistance(W, H, (i) => t.forest[i]! > 0.3, 8);
  const rd = cellDistance(W, H, (i) => st.roads[i]! > 0 || occ[i] !== -1, 8);
  const put = (px: number, pz: number, kind: number, scale: number, rot: number) => {
    const clear = (kind === K('bush') ? 1.9 : 2.6) + TREE_SIZE[TREE_KINDS[kind]!].radius * scale * 0.35;
    if (roads.distAt(px, pz) < clear) return;
    if (!hf.inside(px, pz)) return;
    const cx = Math.floor(px / CELL), cz = Math.floor(pz / CELL);
    if (blocked(cz * W + cx)) return;
    const py = hf.height(px, pz);
    if (py < hf.waterLevel + (kind === K('bush') ? 0.3 : 0.45)) return;
    out.push(makeTree(px, py, pz, kind, rot, scale));
  };
  const bushes = (x: number, y: number, n: number, r: () => number, s0 = 0.7) => {
    for (let k = 0; k < n; k++) put((x + r()) * CELL, (y + r()) * CELL, K('bush'), s0 + r() * 0.55, r() * 6.28);
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (blocked(i)) continue;
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
      } else {
        // scrub belt: shrubs and young trees thinning out away from the forest
        const d = fd[i]!;
        if (d < 4.5) {
          const p = Math.pow(1 - d / 4.5, 1.4);
          if (r() < p * 0.95) bushes(x, y, 1 + (r() < p ? 1 : 0) + (r() < p * 0.5 ? 1 : 0), r, 0.6);
          if (r() < p * 0.35) put((x + 0.2 + r() * 0.6) * CELL, (y + 0.2 + r() * 0.6) * CELL, r() < 0.6 ? K('birch') : y < 22 ? K('spruce') : K('pine'), 0.55 + r() * 0.3, r() * 6.28);
        }
        // hedgerow along field edges, with gaps
        const fieldN = (x > 0 && t.field[i - 1]) || (x < W - 1 && t.field[i + 1]) || (y > 0 && t.field[i - W]) || (y < H - 1 && t.field[i + W]);
        if (fieldN && vnoise(x / 3.5, y / 3.5, 0.5, 81) > 0.36) {
          bushes(x, y, 3, r, 0.85);
          if (r() < 0.28) put((x + 0.5) * CELL, (y + 0.5) * CELL, r() < 0.6 ? K('oak') : K('birch'), 0.7 + r() * 0.35, r() * 6.28);
        }
        // shrubs along the river bank (alder/willow scrub stand-in)
        const wd = hf.waterDist[i]!;
        if (wd >= 1 && wd < 2.5 && rd[i]! > 2 && vnoise(x / 4, y / 4, 1.5, 83) > 0.55) {
          bushes(x, y, 1 + (r() < 0.4 ? 1 : 0), r, 0.7);
          if (r() < 0.12) put((x + 0.5) * CELL, (y + 0.5) * CELL, K('birch'), 0.65 + r() * 0.3, r() * 6.28);
        }
      }
    }
  }

  // copses: a few clumps of oak and birch in the open meadow, ringed by shrubs
  const G = 12;
  for (let by = 0; by < H; by += G) for (let bx = 0; bx < W; bx += G) {
    const r = rng((by * 131 + bx) * 7 + 99);
    if (r() > 0.55) continue;
    const cx = bx + Math.floor(r() * G), cy = by + Math.floor(r() * G);
    if (cx >= W || cy >= H) continue;
    const ci = cy * W + cx;
    if (blocked(ci) || t.forest[ci]! > 0.05 || fd[ci]! < 5 || rd[ci]! < 3 || hf.waterDist[ci]! < 3) continue;
    const ox = (cx + 0.5) * CELL, oz = (cy + 0.5) * CELL;
    const nT = 3 + Math.floor(r() * 5);
    const spread = 4 + nT * 0.9;
    for (let k = 0; k < nT; k++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * spread;
      const q = r();
      put(ox + Math.cos(a) * d, oz + Math.sin(a) * d, q < 0.5 ? K('oak') : q < 0.88 ? K('birch') : K('pine'), 0.65 + r() * 0.45, r() * 6.28);
    }
    const nB = 4 + Math.floor(r() * 6);
    for (let k = 0; k < nB; k++) {
      const a = r() * 6.28, d = spread * (0.7 + r() * 0.6);
      put(ox + Math.cos(a) * d, oz + Math.sin(a) * d, K('bush'), 0.6 + r() * 0.6, r() * 6.28);
    }
  }
  return out;
}

function placeApron(hf: Heightfield): Tree[] {
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
      const dens = north ? 0.8 : 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(px * 0.021 + Math.cos(pz * 0.017) * 3));
      if (r() > dens) continue;
      const y = apronHeight(hf, px, pz);
      if (y < hf.waterLevel + 0.6) continue;
      out.push(makeTree(px, y, pz, pickKind(r(), north), r() * 6.28, 0.8 + r() * 0.4));
    }
  }
  return out;
}
