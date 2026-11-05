// Trees from terrain.forest density: instanced full models near the camera (two geometry
// variants per kind), camera-facing cards (atlas baked from the same models) further away and on
// the apron hills, with a dithered crossfade band between the two.
// Placement is deterministic per cell and skips water, fields, buildings and roads.
import {
  CustomBlending,
  Euler,
  DstColorFactor,
  InstancedMesh,
  Matrix4,
  type Material,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type WebGLRenderer,
  ZeroFactor,
} from 'three';
import type { World } from '../sim/index';
import { net } from '../sim/index';
import { CELL, type Heightfield } from './heightfield';
import { markInstances } from './instancedParts';
import { rng, vnoise } from './models/kit';
import { modelMaterial, shareInstancedDepth, treeUniforms } from './models/materials';
import { bakeTreeBillboards, billboardDepthMaterial, treeBillboard, treeLodFactor, treeParts, TREE_KINDS, TREE_SIZE, TREE_VARIANTS, type TreeKind } from './models/trees';
import type { RoadField } from './roads';
import { apronHeight } from './terrain';

interface Tree {
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

// Soft contact shadow under far-tree cards: a flat quad multiplied onto the ground (darkening
// toward its centre), so a distant clump reads as standing on the meadow. Unlit, no depth write;
// fades out with distance where the fog takes over.
const BLOB_VERT = /* glsl */ `
varying vec2 vP;
varying float vFar;
void main() {
  vP = position.xy;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position.x, 0.0, -position.y, 1.0);
  vFar = distance(cameraPosition, wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const BLOB_FRAG = /* glsl */ `
varying vec2 vP;
varying float vFar;
void main() {
  float r = length(vP);
  float a = 1.0 - smoothstep(0.15, 1.0, r);
  a *= a * (1.0 - smoothstep(320.0, 700.0, vFar));
  gl_FragColor = vec4(vec3(1.0 - 0.3 * a), 1.0);
}`;

function blobMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: BLOB_VERT,
    fragmentShader: BLOB_FRAG,
    transparent: true,
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: DstColorFactor,
    blendDst: ZeroFactor,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    fog: false,
  });
}

const _q = new Quaternion();
const _v = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);

export class VegetationView {
  readonly group: import('three').Group;
  private trees: Tree[] = [];
  private apron: Tree[] = [];
  /** near[kind * TREE_VARIANTS + variant] = one mesh per material part. */
  private near: InstancedMesh[][] = [];
  private far: InstancedMesh[] = [];
  /** Contact shadows under far cards (one draw call; off in low quality). */
  private blobs: InstancedMesh | null = null;
  private blobGeo = new PlaneGeometry(2, 2);
  private blobMat = blobMaterial();
  private blobsOn = true;
  private lastX = Infinity;
  private lastZ = Infinity;
  private lastR = 0;
  private castShadows = true;
  nearDist = 85;
  /** Width (m) of the dithered crossfade between full trees and far cards. */
  fadeBand = 12;

  constructor(private readonly hf: Heightfield, group: import('three').Group) {
    this.group = group;
    this.apron = placeApron(hf);
  }

  /** Bake (or re-bake at another cell size) the far-card atlases. */
  bake(renderer: WebGLRenderer, cellPx: number): void {
    bakeTreeBillboards(renderer, cellPx);
  }

  setShadows(on: boolean): void {
    this.castShadows = on;
    // the contact-shadow decals belong to the shadowed (high/ultra) look; low stays as cheap
    if (this.blobsOn !== on) { this.blobsOn = on; this.lastX = Infinity; }
    for (const l of this.near) for (const m of l) m.castShadow = on;
    for (const m of this.far) m.castShadow = on;
  }

  rebuild(world: World, roads: RoadField): void {
    this.trees = placeTrees(world, this.hf, roads);
    // (re)allocate instanced meshes sized to the counts
    for (const l of this.near) for (const m of l) { this.group.remove(m); m.dispose(); }
    for (const m of this.far) { this.group.remove(m); m.dispose(); }
    if (this.blobs) { this.group.remove(this.blobs); this.blobs.dispose(); }
    this.near = [];
    this.far = [];
    this.blobs = new InstancedMesh(this.blobGeo, this.blobMat, Math.max(1, this.trees.length + this.apron.length));
    this.blobs.count = 0;
    this.blobs.name = 'tree-blob';
    this.blobs.renderOrder = 1;
    this.blobs.frustumCulled = false;
    this.group.add(this.blobs);
    TREE_KINDS.forEach((kind, k) => {
      const n = this.trees.filter((t) => t.kind === k).length;
      const na = this.apron.filter((t) => t.kind === k).length;
      for (let v = 0; v < TREE_VARIANTS; v++) {
        const nv = this.trees.filter((t) => t.kind === k && t.variant === v).length;
        this.near.push(
          treeParts(kind, v).map((p) => {
            const m = new InstancedMesh(p.geometry, modelMaterial(p.material) as Material, Math.max(1, nv));
            m.count = 0;
            m.castShadow = this.castShadows;
            m.receiveShadow = true;
            m.name = `tree-${kind}${v}-${p.material}`;
            shareInstancedDepth(m);
            this.group.add(m);
            return m;
          }),
        );
      }
      const bb = treeBillboard(kind)[0]!;
      const fm = new InstancedMesh(bb.geometry, modelMaterial(bb.material) as Material, Math.max(1, n + na));
      fm.count = 0;
      fm.castShadow = this.castShadows;
      fm.receiveShadow = true;
      fm.customDepthMaterial = billboardDepthMaterial();
      fm.name = `tree-bb-${kind}`;
      this.group.add(fm);
      this.far.push(fm);
    });
    this.lastX = Infinity;
  }

  /** Re-bucket near/far when the camera moved noticeably. */
  update(camPos: Vector3, force = false): void {
    treeUniforms.uLodNear.value = this.nearDist;
    treeUniforms.uLodBand.value = this.fadeBand;
    const dx = camPos.x - this.lastX, dz = camPos.z - this.lastZ;
    if (!force && dx * dx + dz * dz < 36 && Math.abs(this.nearDist - this.lastR) < 1) return;
    this.lastX = camPos.x;
    this.lastZ = camPos.z;
    this.lastR = this.nearDist;
    // Trees inside the crossfade band (plus a margin for the 6 m re-bucket step) go into both
    // lists; the shaders dither them per pixel from the exact camera distance.
    const MARGIN = 7;
    const nK = TREE_KINDS.length;
    const nearIn = new Float32Array(nK), farOut = new Float32Array(nK), blobOut = new Float32Array(nK);
    TREE_KINDS.forEach((k, i) => {
      const f = treeLodFactor(k);
      const R = this.nearDist * f, B = this.fadeBand * f;
      nearIn[i] = (R + MARGIN) ** 2;
      farOut[i] = Math.max(0, R - B - MARGIN) ** 2;
      blobOut[i] = Math.max(0, R - B * 0.5) ** 2;
    });
    const counts = new Int32Array(nK * TREE_VARIANTS);
    const fcounts = new Int32Array(nK);
    const blobs = this.blobsOn ? this.blobs : null;
    let nb = 0;
    const cy = camPos.y;
    for (const t of this.trees) {
      const ddx = t.x - camPos.x, ddy = t.y - cy, ddz = t.z - camPos.z;
      const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
      if (d2 < nearIn[t.kind]!) {
        const slot = t.kind * TREE_VARIANTS + t.variant;
        const i = counts[slot]!++;
        for (const m of this.near[slot]!) m.setMatrixAt(i, t.m);
      }
      if (d2 > farOut[t.kind]!) {
        this.far[t.kind]!.setMatrixAt(fcounts[t.kind]!++, t.m);
        if (blobs && d2 > blobOut[t.kind]!) blobs.setMatrixAt(nb++, t.blob);
      }
    }
    for (const t of this.apron) {
      this.far[t.kind]!.setMatrixAt(fcounts[t.kind]!++, t.m);
      if (blobs) blobs.setMatrixAt(nb++, t.blob);
    }
    if (this.blobs) {
      this.blobs.count = nb;
      this.blobs.visible = nb > 0;
      markInstances(this.blobs.instanceMatrix, nb);
    }
    this.near.forEach((list, slot) => {
      for (const m of list) {
        m.count = counts[slot]!;
        markInstances(m.instanceMatrix, m.count);
        m.visible = m.count > 0;
        m.computeBoundingSphere();
      }
    });
    this.far.forEach((f, i) => {
      f.count = fcounts[i]!;
      markInstances(f.instanceMatrix, f.count);
      f.visible = f.count > 0;
      f.computeBoundingSphere();
    });
  }

  /** Per-frame: wind clock for the tree shaders. */
  tick(timeSec: number): void {
    treeUniforms.uTreeTime.value = timeSec;
  }

  dispose(): void {
    for (const l of this.near) for (const m of l) m.dispose();
    for (const m of this.far) m.dispose();
    this.blobs?.dispose();
    this.blobGeo.dispose();
    this.blobMat.dispose();
  }
}

const _e = new Euler();

function makeTree(x: number, y: number, z: number, kind: number, rot: number, scale: number): Tree {
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
  /** Is (px, pz) at least `need` metres from every tilled field cell? */
  const fieldClear = (px: number, pz: number, need: number): boolean => {
    const cx = Math.floor(px / CELL), cz = Math.floor(pz / CELL), rr = Math.ceil(need / CELL);
    for (let y = cz - rr; y <= cz + rr; y++) for (let x = cx - rr; x <= cx + rr; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H || !t.field[y * W + x]) continue;
      const dx = Math.max(x * CELL - px, 0, px - (x + 1) * CELL), dz = Math.max(y * CELL - pz, 0, pz - (y + 1) * CELL);
      if (dx * dx + dz * dz < need * need) return false;
    }
    return true;
  };
  const put = (px: number, pz: number, kind: number, scale: number, rot: number) => {
    const bush = kind === K('bush');
    const crown = TREE_SIZE[TREE_KINDS[kind]!].radius * scale;
    // shrubs keep their whole crown off the track and its verge; trees may overhang a little
    const clear = bush ? Math.min(5.8, 2.7 + crown * 0.8) : 2.6 + crown * 0.35;
    if (roads.distAt(px, pz) < clear) return;
    if (!hf.inside(px, pz)) return;
    const cx = Math.floor(px / CELL), cz = Math.floor(pz / CELL);
    if (blocked(cz * W + cx)) return;
    // nothing grows out over ploughed soil: shrubs keep their crown off it, trees their trunk
    if (!fieldClear(px, pz, bush ? crown * 0.75 : 1.6)) return;
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
    if (r() > 0.42) continue;
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
    // a tight rim of shrubs hugging the copse, not a scatter around it
    const nB = 3 + Math.floor(r() * 4);
    for (let k = 0; k < nB; k++) {
      const a = r() * 6.28, d = spread * (0.65 + r() * 0.35);
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
