/**
 * Procedural modelling kit shared by every model in `src/render/models/`.
 *
 * Models are assembled from simple three.js primitives that are transformed, jittered with a
 * seeded deterministic noise (so silhouettes are slightly irregular instead of CAD-perfect),
 * coloured per vertex (albedo × baked ground AO × dirt × colour noise) and finally merged into
 * one BufferGeometry per material kind. A model is therefore a short list of
 * `{ geometry, material }` parts, which is what the renderer needs to build one
 * `InstancedMesh` per part.
 *
 * Conventions: 1 unit = 1 metre, +Y up, a model's "front" faces +Z.
 * UVs are rewritten as a box projection in model space (1 UV unit = `UV_METRES` metres) so a
 * tiling PBR texture set can be applied later with consistent texel density.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  type ColorRepresentation,
  Euler,
  Matrix3,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MatKey } from './materials';

/** Metres per UV unit for the box-projected UVs. */
export const UV_METRES = 2;

export interface ModelPart {
  geometry: BufferGeometry;
  material: MatKey;
}

// ---------------------------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------------------------

/** mulberry32 — small seeded PRNG for render-side variation (never used by the sim). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer lattice hash → [0, 1). */
export function hash3(x: number, y: number, z: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Smooth 3-D value noise in [0, 1). */
export function vnoise(x: number, y: number, z: number, seed = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz, seed);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf),
    l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf),
    zf,
  );
}

/** Two-octave fractal noise in roughly [-1, 1]. */
export function fnoise(x: number, y: number, z: number, seed = 0): number {
  return (vnoise(x, y, z, seed) * 0.66 + vnoise(x * 2.03, y * 2.03, z * 2.03, seed + 17) * 0.34) * 2 - 1;
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------------------------
// Transforms
// ---------------------------------------------------------------------------------------------

const _q = new Quaternion();
const _e = new Euler();
const _s = new Vector3();
const _p = new Vector3();

/** Matrix from translation, Euler rotation (radians, order YXZ) and scale. */
export function trs(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): Matrix4 {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  return new Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

/**
 * Matrix that maps a primitive whose long axis is +Y (cylinder/box height), centred on the
 * origin with length 1, onto the segment a→b. `roll` spins it around the segment axis.
 */
export function between(a: Vector3, b: Vector3, roll = 0): Matrix4 {
  const dir = new Vector3().subVectors(b, a);
  const len = dir.length();
  dir.divideScalar(len || 1);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
  if (roll) q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), roll));
  const mid = new Vector3().addVectors(a, b).multiplyScalar(0.5);
  return new Matrix4().compose(mid, q, new Vector3(1, len, 1));
}

export const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);

// ---------------------------------------------------------------------------------------------
// Part builder
// ---------------------------------------------------------------------------------------------

export interface AddOpts {
  /** Albedo (sRGB hex or Color). */
  color: ColorRepresentation;
  /** Model-space transform applied to the primitive. */
  m?: Matrix4;
  /** Per-piece brightness variation (fraction). Default 0.06. */
  vary?: number;
  /** Per-vertex colour noise amplitude (fraction). Default 0.06. */
  noise?: number;
  /** Frequency of the colour noise, cycles per metre. Default 1.7. */
  noiseFreq?: number;
  /** Positional jitter amplitude in metres (smooth noise, coherent across seams). */
  jitter?: number;
  /** Jitter frequency, cycles per metre. Default 2.5. */
  jitterFreq?: number;
  /** Ground AO strength 0..1 (darkens near y = 0). Default: builder setting. */
  ao?: number;
  /** Mud tint near the ground 0..1. Default: builder setting. */
  dirt?: number;
  /** Keep the primitive's own UVs instead of the box projection. */
  keepUv?: boolean;
  /** Recompute vertex normals after jitter (use for strongly displaced shapes). */
  renormal?: boolean;
  /** Custom per-vertex colour tweak, model-space position and normal. */
  shade?: (p: Vector3, n: Vector3, c: Color) => void;
  /**
   * Skinning data for an animated model (the horse): called per vertex with the model-space
   * position, returns the `rig` vertex attribute (see `models/wagon.ts`).
   */
  rig?: (p: Vector3) => [number, number, number, number];
}

const MUD = new Color('#4a3c2e');

export interface BuilderSettings {
  seed?: number;
  /** Height over which ground AO fades out (m). */
  aoHeight?: number;
  /** Default AO strength. */
  ao?: number;
  /** Default dirt tint strength. */
  dirt?: number;
  /** Height over which the dirt tint fades out (m). */
  dirtHeight?: number;
}

/** Accumulates transformed, coloured primitives grouped by material kind. */
export class PartBuilder {
  private readonly groups = new Map<MatKey, BufferGeometry[]>();
  private readonly settings: Required<BuilderSettings>;
  readonly rand: () => number;
  private hasRig = false;

  constructor(settings: BuilderSettings = {}) {
    this.settings = {
      seed: settings.seed ?? 1,
      aoHeight: settings.aoHeight ?? 1.4,
      ao: settings.ao ?? 0.45,
      dirt: settings.dirt ?? 0.3,
      dirtHeight: settings.dirtHeight ?? 0.5,
    };
    this.rand = rng(this.settings.seed * 7919 + 13);
  }

  /** Random number in [a, b). */
  r(a = 0, b = 1): number {
    return a + (b - a) * this.rand();
  }

  add(mat: MatKey, src: BufferGeometry, o: AddOpts): this {
    let g = src.index ? src.clone() : src.clone();
    if (!g.index) {
      const n = g.getAttribute('position').count;
      const idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      g.setIndex(new BufferAttribute(idx, 1));
    }
    // keep only the attributes we merge
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    if (o.m) g.applyMatrix4(o.m);

    const pos = g.getAttribute('position') as BufferAttribute;
    const nor = g.getAttribute('normal') as BufferAttribute;
    const count = pos.count;
    const seed = this.settings.seed;

    if (o.jitter) {
      const f = o.jitterFreq ?? 2.5;
      const a = o.jitter;
      for (let i = 0; i < count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        pos.setXYZ(
          i,
          x + fnoise(x * f, y * f, z * f, seed + 1) * a,
          y + fnoise(x * f + 31.7, y * f, z * f, seed + 2) * a,
          z + fnoise(x * f, y * f + 57.1, z * f, seed + 3) * a,
        );
      }
      if (o.renormal) g.computeVertexNormals();
    }

    // vertex colours
    const base = new Color(o.color);
    const vary = o.vary ?? 0.06;
    const pieceK = 1 + (this.rand() * 2 - 1) * vary;
    const noiseA = o.noise ?? 0.06;
    const nf = o.noiseFreq ?? 1.7;
    const aoK = o.ao ?? this.settings.ao;
    const dirtK = o.dirt ?? this.settings.dirt;
    const col = new Float32Array(count * 3);
    const c = new Color();
    const p = new Vector3();
    const n = new Vector3();
    for (let i = 0; i < count; i++) {
      p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      n.set(nor.getX(i), nor.getY(i), nor.getZ(i));
      c.copy(base);
      if (o.shade) o.shade(p, n, c);
      const k = pieceK * (1 + fnoise(p.x * nf, p.y * nf, p.z * nf, seed + 9) * noiseA);
      const ao = 1 - aoK * (1 - smoothstep(0, this.settings.aoHeight, p.y));
      // faces pointing down receive less sky light
      const down = n.y < 0 ? 1 + n.y * 0.25 : 1;
      c.multiplyScalar(k * ao * down);
      const d = dirtK * (1 - smoothstep(0, this.settings.dirtHeight, p.y));
      if (d > 0) c.lerp(MUD, d);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new BufferAttribute(col, 3));

    if (!o.keepUv) boxUv(g);
    else if (!g.getAttribute('uv')) boxUv(g);

    if (o.rig) this.hasRig = true;
    const rg = new Float32Array(count * 4);
    if (o.rig) for (let i = 0; i < count; i++) rg.set(o.rig(p.set(pos.getX(i), pos.getY(i), pos.getZ(i))), i * 4);
    g.setAttribute('rig', new BufferAttribute(rg, 4));

    let list = this.groups.get(mat);
    if (!list) this.groups.set(mat, (list = []));
    list.push(g);
    return this;
  }

  /** Merge everything added so far into one geometry per material kind. */
  build(): ModelPart[] {
    const out: ModelPart[] = [];
    for (const [material, list] of this.groups) {
      const merged = mergeGeometries(list, false);
      if (!merged) throw new Error(`merge failed for ${material}`);
      if (!this.hasRig) merged.deleteAttribute('rig');
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      out.push({ geometry: merged, material });
    }
    return out;
  }
}

/** Box-projected UVs in model space (dominant normal axis). */
export function boxUv(g: BufferGeometry): void {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  const s = 1 / UV_METRES;
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let u: number, v: number;
    if (ay >= ax && ay >= az) { u = x; v = z; }
    else if (ax >= az) { u = z; v = y; }
    else { u = x; v = y; }
    uv[i * 2] = u * s;
    uv[i * 2 + 1] = v * s;
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
}

/** Merge several part lists (e.g. building + props) into one list, one geometry per material. */
export function mergeParts(...lists: ModelPart[][]): ModelPart[] {
  const by = new Map<MatKey, BufferGeometry[]>();
  for (const l of lists) for (const p of l) {
    let a = by.get(p.material);
    if (!a) by.set(p.material, (a = []));
    a.push(p.geometry);
  }
  const out: ModelPart[] = [];
  for (const [material, geos] of by) {
    const names = new Set(Object.keys(geos[0].attributes));
    const unified = geos.map((g) => {
      const c = g.clone();
      for (const k of Object.keys(c.attributes)) if (!names.has(k)) c.deleteAttribute(k);
      return c;
    });
    const m = geos.length === 1 ? unified[0] : mergeGeometries(unified, false);
    if (!m) throw new Error(`mergeParts failed for ${material}`);
    m.computeBoundingBox();
    m.computeBoundingSphere();
    out.push({ geometry: m, material });
  }
  return out;
}

/** Bake a transform into a copy of every part. */
export function transformParts(parts: ModelPart[], m: Matrix4): ModelPart[] {
  return parts.map((p) => {
    const g = p.geometry.clone().applyMatrix4(m);
    g.computeBoundingSphere();
    return { geometry: g, material: p.material };
  });
}

export function triangles(parts: ModelPart[] | BufferGeometry): number {
  const list = Array.isArray(parts) ? parts.map((p) => p.geometry) : [parts];
  let n = 0;
  for (const g of list) n += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  return n;
}

export { Matrix3 };
