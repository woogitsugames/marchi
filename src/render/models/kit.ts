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
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  type ColorRepresentation,
  Euler,
  Matrix3,
  Matrix4,
  Quaternion,
  Sphere,
  Vector3,
} from 'three';
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
  return mix3(Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647) + Math.imul(seed | 0, 1442695041));
}

/** hash3's mixing step, from the sum of its four lattice products. */
function mix3(sum: number): number {
  let h = sum | 0;
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
  // no closures: this runs per wagon per frame through Heightfield.height (GC audit, frame-cost item 5)
  // hash3 of the 8 lattice corners with its 7 distinct products worked out once (D-281: was 32 Math.imul); the
  // products are int32, so their sums are exact in a double and the hashes are bit for bit hash3's
  const X0 = Math.imul(xi | 0, 374761393), X1 = Math.imul((xi + 1) | 0, 374761393);
  const Y0 = Math.imul(yi | 0, 668265263), Y1 = Math.imul((yi + 1) | 0, 668265263);
  const Z0 = Math.imul(zi | 0, 2147483647), Z1 = Math.imul((zi + 1) | 0, 2147483647);
  const S = Math.imul(seed | 0, 1442695041);
  const c000 = mix3(X0 + Y0 + Z0 + S), c100 = mix3(X1 + Y0 + Z0 + S);
  const c010 = mix3(X0 + Y1 + Z0 + S), c110 = mix3(X1 + Y1 + Z0 + S);
  const c001 = mix3(X0 + Y0 + Z1 + S), c101 = mix3(X1 + Y0 + Z1 + S);
  const c011 = mix3(X0 + Y1 + Z1 + S), c111 = mix3(X1 + Y1 + Z1 + S);
  const a0 = c000 + (c100 - c000) * xf, b0 = c010 + (c110 - c010) * xf;
  const a1 = c001 + (c101 - c001) * xf, b1 = c011 + (c111 - c011) * xf;
  const z0 = a0 + (b0 - a0) * yf, z1 = a1 + (b1 - a1) * yf;
  return z0 + (z1 - z0) * zf;
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
// Primitive templates
// ---------------------------------------------------------------------------------------------

type PrimCtor = new (...a: never[]) => BufferGeometry;
const prims = new Map<PrimCtor, Map<string, BufferGeometry>>();

/**
 * A shared, read-only three.js primitive for `PartBuilder.add`, built once per constructor and argument list
 * (perf day 15, D-320): the menu's models ask for ~2000 primitives of ~360 distinct shapes, and three builds each
 * one through JS arrays converted to typed arrays (the largest garbage source of the model build). `add` only reads
 * its source, so one template serves every piece of that shape; never mutate what this returns.
 */
export function prim<C extends PrimCtor>(Ctor: C, ...args: ConstructorParameters<C>): BufferGeometry {
  let byArgs = prims.get(Ctor);
  if (!byArgs) prims.set(Ctor, (byArgs = new Map()));
  const key = args.join(',');
  let g = byArgs.get(key);
  if (!g) byArgs.set(key, (g = new Ctor(...(args as never[]))));
  return g;
}

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

interface PieceAttr {
  array: Float32Array;
  itemSize: number;
  normalized: boolean;
}

/** One transformed, coloured primitive waiting for `build()`: an index and attributes in insertion order. */
interface Piece {
  index: Uint32Array;
  count: number;
  attrs: Record<string, PieceAttr>;
}

/** Accumulates transformed, coloured primitives grouped by material kind. */
export class PartBuilder {
  private readonly groups = new Map<MatKey, Piece[]>();
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
    // a plain copy of the index and the attributes we merge (D-255): `src.clone()` first ran the primitive's own
    // constructor with default parameters (a 32 x 16 sphere for every SphereGeometry piece), copied every attribute
    // twice and kept the groups and bounds, all thrown away again. Since D-321 a piece is plain typed arrays, not a
    // BufferGeometry (a uuid and an attribute object each, ~2000 per menu)
    const m = o.m;
    // the piece index is always 32-bit (one element kind for the merge loop; the merged index width is decided there)
    let index: Uint32Array;
    const attrs: Record<string, PieceAttr> = {};
    if (plainFloat3(src.attributes.position) && plainFloat3(src.attributes.normal)) {
      // copy and transform in one pass (D-321): the same double operations as `applyMatrix4` (Vector3.applyMatrix4,
      // and Vector3.applyNormalMatrix with the matrix's normal matrix) without the per-vertex attribute accessors;
      // the uv is a placeholder (the source's, not copied) unless kept: boxUv replaces it, the key order stays
      for (const name of Object.keys(src.attributes)) {
        const a = src.attributes[name] as BufferAttribute;
        const arr = a.array as Float32Array;
        if (name === 'position') attrs[name] = { array: m ? transformPoints(arr, m) : arr.slice(), itemSize: 3, normalized: false };
        else if (name === 'normal') attrs[name] = { array: m ? transformNormals(arr, m) : arr.slice(), itemSize: 3, normalized: false };
        else if (name === 'uv') attrs[name] = { array: o.keepUv ? arr.slice() : arr, itemSize: a.itemSize, normalized: a.normalized };
      }
      index = src.index ? Uint32Array.from(src.index.array as Uint16Array) : iota(attrs.position!.array.length / 3);
    } else {
      const g = new BufferGeometry();
      if (src.index) g.setIndex(new BufferAttribute(src.index.array.slice(), 1));
      for (const name of Object.keys(src.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv') continue;
        const a = src.attributes[name]!;
        g.setAttribute(name, (a as BufferAttribute).isBufferAttribute ? new BufferAttribute(a.array.slice(), a.itemSize, a.normalized) : a.clone());
      }
      if (!g.index) g.setIndex(new BufferAttribute(iota(g.getAttribute('position').count), 1));
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      if (m) g.applyMatrix4(m);
      index = Uint32Array.from(g.index!.array as Uint16Array);
      for (const name of Object.keys(g.attributes)) {
        const a = g.attributes[name]!;
        attrs[name] = { array: a.array as Float32Array, itemSize: a.itemSize, normalized: a.normalized };
      }
    }

    const pa = attrs.position!.array, na = attrs.normal!.array;
    const count = pa.length / 3;
    const seed = this.settings.seed;

    // vertices at the same spot (a box's 24 corners are 8 points, a cylinder's seam and caps repeat its rings) get
    // the same jitter and the same colour noise: worked out once per point (D-322), copied bit for bit to the others
    const rep = firstAt(pa, count);

    if (o.jitter) {
      const f = o.jitterFreq ?? 2.5;
      const a = o.jitter;
      for (let i = 0; i < count; i++) {
        const r = rep[i]!;
        if (r !== i) {
          pa[i * 3] = pa[r * 3]!; pa[i * 3 + 1] = pa[r * 3 + 1]!; pa[i * 3 + 2] = pa[r * 3 + 2]!;
          continue;
        }
        const x = pa[i * 3]!, y = pa[i * 3 + 1]!, z = pa[i * 3 + 2]!;
        pa[i * 3] = x + fnoise(x * f, y * f, z * f, seed + 1) * a;
        pa[i * 3 + 1] = y + fnoise(x * f + 31.7, y * f, z * f, seed + 2) * a;
        pa[i * 3 + 2] = z + fnoise(x * f, y * f + 57.1, z * f, seed + 3) * a;
      }
      if (o.renormal) {
        // three's computeVertexNormals rewrites the existing normal array in place
        const t = new BufferGeometry();
        t.setIndex(new BufferAttribute(index, 1));
        t.setAttribute('position', new BufferAttribute(pa, 3));
        t.setAttribute('normal', new BufferAttribute(na, 3));
        t.computeVertexNormals();
      }
    }

    // vertex colours
    const base = baseColor(o.color);
    const vary = o.vary ?? 0.06;
    const pieceK = 1 + (this.rand() * 2 - 1) * vary;
    const noiseA = o.noise ?? 0.06;
    const nf = o.noiseFreq ?? 1.7;
    const aoK = o.ao ?? this.settings.ao;
    const dirtK = o.dirt ?? this.settings.dirt;
    const aoH = this.settings.aoHeight, dirtH = this.settings.dirtHeight;
    const col = new Float32Array(count * 3);
    if (noiseScratch.length < count) noiseScratch = new Float64Array(Math.max(count, noiseScratch.length * 2));
    const noiseK = noiseScratch;
    const shade = o.shade;
    const c = shadeColor;
    const p = new Vector3();
    const n = new Vector3();
    // plain array reads (same values as getX/getY/getZ: the attributes are not normalized); the colour arithmetic
    // in scalars, the same operations as Color.copy / multiplyScalar / lerp (D-321)
    for (let i = 0; i < count; i++) {
      const px = pa[i * 3]!, py = pa[i * 3 + 1]!, pz = pa[i * 3 + 2]!, ny = na[i * 3 + 1]!;
      let r = base.r, gg = base.g, bb = base.b;
      if (shade) {
        p.set(px, py, pz);
        n.set(na[i * 3]!, ny, na[i * 3 + 2]!);
        c.copy(base);
        shade(p, n, c);
        r = c.r; gg = c.g; bb = c.b;
      }
      const r0 = rep[i]!;
      const k = r0 !== i ? noiseK[r0]! : (noiseK[i] = pieceK * (1 + fnoise(px * nf, py * nf, pz * nf, seed + 9) * noiseA));
      const ao = 1 - aoK * (1 - smoothstep(0, aoH, py));
      // faces pointing down receive less sky light
      const down = ny < 0 ? 1 + ny * 0.25 : 1;
      const s = k * ao * down;
      r *= s; gg *= s; bb *= s;
      const d = dirtK * (1 - smoothstep(0, dirtH, py));
      if (d > 0) { r += (MUD.r - r) * d; gg += (MUD.g - gg) * d; bb += (MUD.b - bb) * d; }
      col[i * 3] = r;
      col[i * 3 + 1] = gg;
      col[i * 3 + 2] = bb;
    }
    attrs.color = { array: col, itemSize: 3, normalized: false };

    // box projection unless the primitive's own UVs are kept (and exist); assigning an existing key keeps its order
    if (!o.keepUv || !attrs.uv) attrs.uv = { array: boxUvArray(pa, na), itemSize: 2, normalized: false };

    // the skinning attribute only for rigged pieces; build() gives the others zeros when the model has a rig
    // (D-255: an all-zero array per piece was merged and then deleted for every unrigged model)
    if (o.rig) {
      this.hasRig = true;
      const rg = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) rg.set(o.rig(p.set(pa[i * 3]!, pa[i * 3 + 1]!, pa[i * 3 + 2]!)), i * 4);
      attrs.rig = { array: rg, itemSize: 4, normalized: false };
    }

    let list = this.groups.get(mat);
    if (!list) this.groups.set(mat, (list = []));
    list.push({ index, count, attrs });
    return this;
  }

/** Merge everything added so far into one geometry per material kind. */
  build(): ModelPart[] {
    const out: ModelPart[] = [];
    for (const [material, list] of this.groups) {
      if (this.hasRig) for (const pc of list) if (!pc.attrs.rig) pc.attrs.rig = { array: new Float32Array(pc.count * 4), itemSize: 4, normalized: false };
      const merged = mergePieces(list);
      computeBounds(merged);
      out.push({ geometry: merged, material });
    }
    return out;
  }
}

const _mv = new Vector3();
const _nm = new Matrix3();

function plainFloat3(a: BufferGeometry['attributes'][string] | undefined): boolean {
  return !!a && (a as BufferAttribute).isBufferAttribute === true && a.itemSize === 3 && !a.normalized && a.array instanceof Float32Array;
}

function iota(n: number): Uint32Array {
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  return idx;
}

/**
 * For every vertex the first vertex at the bit-identical position (itself when it is the first): an open-addressing
 * table over the float bits. Pure functions of the position (jitter, colour noise) are worked out at those only.
 */
let firstTable = new Int32Array(256);
/** Colour noise per first vertex (PartBuilder.add scratch). */
let noiseScratch = new Float64Array(128);
let firstRep = new Int32Array(128);

function firstAt(pa: Float32Array, count: number): Int32Array {
  const u = new Uint32Array(pa.buffer, pa.byteOffset, count * 3);
  let size = 16;
  while (size < count * 2) size <<= 1;
  const mask = size - 1;
  // scratch arrays shared by every add (grown, never shrunk): the result is only read until the next call
  if (firstTable.length < size) firstTable = new Int32Array(size);
  if (firstRep.length < count) firstRep = new Int32Array(Math.max(count, firstRep.length * 2));
  const table = firstTable.fill(-1, 0, size);
  const rep = firstRep;
  for (let i = 0; i < count; i++) {
    const a = u[i * 3]!, b = u[i * 3 + 1]!, c = u[i * 3 + 2]!;
    let h = Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca77) ^ Math.imul(c, 0xc2b2ae3d);
    h = (h ^ (h >>> 15)) & mask;
    for (;;) {
      const j = table[h]!;
      if (j < 0) { table[h] = i; rep[i] = i; break; }
      if (u[j * 3] === a && u[j * 3 + 1] === b && u[j * 3 + 2] === c) { rep[i] = j; break; }
      h = (h + 1) & mask;
    }
  }
  return rep;
}

/** Parsed albedo per colour value (setStyle parses the string and converts sRGB to linear on every call). */
const colors = new Map<string | number, Color>();

function baseColor(v: ColorRepresentation): Color {
  if (typeof v !== 'string' && typeof v !== 'number') return v;
  let c = colors.get(v);
  if (!c) colors.set(v, (c = new Color(v)));
  return c;
}

/**
 * The colour handed to `AddOpts.shade`. Its `set` with a CSS string copies the cached parse (D-322: shades set a
 * literal colour per vertex, each a setStyle parse and an sRGB conversion); the result is the same.
 */
const shadeColor = new Color();
const colorSet = Color.prototype.set;
shadeColor.set = function (this: Color, r: ColorRepresentation, g?: number, b?: number): Color {
  return typeof r === 'string' && g === undefined && b === undefined ? this.copy(baseColor(r)) : colorSet.call(this, r as number, g as number, b as number);
} as Color['set'];

/** A copy of `src` with Vector3.applyMatrix4(m) applied to every point (bit for bit BufferAttribute.applyMatrix4). */
function transformPoints(src: Float32Array, m: Matrix4): Float32Array {
  const e = m.elements;
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i]!, y = src[i + 1]!, z = src[i + 2]!;
    const w = 1 / (e[3]! * x + e[7]! * y + e[11]! * z + e[15]!);
    out[i] = (e[0]! * x + e[4]! * y + e[8]! * z + e[12]!) * w;
    out[i + 1] = (e[1]! * x + e[5]! * y + e[9]! * z + e[13]!) * w;
    out[i + 2] = (e[2]! * x + e[6]! * y + e[10]! * z + e[14]!) * w;
  }
  return out;
}

/** A copy of `src` with Vector3.applyNormalMatrix(normal matrix of m) applied (bit for bit applyNormalMatrix). */
function transformNormals(src: Float32Array, m: Matrix4): Float32Array {
  const e = _nm.getNormalMatrix(m).elements;
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i]!, y = src[i + 1]!, z = src[i + 2]!;
    const nx = e[0]! * x + e[3]! * y + e[6]! * z;
    const ny = e[1]! * x + e[4]! * y + e[7]! * z;
    const nz = e[2]! * x + e[5]! * y + e[8]! * z;
    const k = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
    out[i] = nx * k;
    out[i + 1] = ny * k;
    out[i + 2] = nz * k;
  }
  return out;
}

/**
 * computeBoundingBox + computeBoundingSphere in two plain loops (D-321): the same box (Math.min/max per axis), its
 * centre and the largest squared distance to it as three's, which walk the positions twice for the box and once
 * more for the radius through the attribute accessors. Geometries without morph targets only.
 */
export function computeBounds(g: BufferGeometry): void {
  const pa = g.getAttribute('position').array as Float32Array;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < pa.length; i += 3) {
    const x = pa[i]!, y = pa[i + 1]!, z = pa[i + 2]!;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y); z1 = Math.max(z1, z);
  }
  const box = new Box3(new Vector3(x0, y0, z0), new Vector3(x1, y1, z1));
  const center = box.getCenter(new Vector3());
  const cx = center.x, cy = center.y, cz = center.z;
  let r2 = 0;
  for (let i = 0; i < pa.length; i += 3) {
    const dx = cx - pa[i]!, dy = cy - pa[i + 1]!, dz = cz - pa[i + 2]!;
    r2 = Math.max(r2, dx * dx + dy * dy + dz * dz);
  }
  g.boundingBox = box;
  g.boundingSphere = new Sphere(center, Math.sqrt(r2));
}

/**
 * Merge indexed geometries with the same attributes into one, optionally baking a transform per geometry and
 * keeping only some attributes. The result is bit-identical to three's `mergeGeometries(list, false)` of
 * `list[i].clone().applyMatrix4(mats[i])` (the same Vector3 operations, the same index width rule), without the
 * clones, the JS index array and its conversion back to a typed array (D-255: the largest part of the model
 * merge cost before the menu was ready).
 */
export function mergeIndexed(list: BufferGeometry[], mats?: Matrix4[], keep?: ReadonlySet<string>): BufferGeometry {
  const first = list[0]!;
  const names = Object.keys(first.attributes).filter((k) => !keep || keep.has(k));
  let verts = 0, idx = 0;
  for (const g of list) {
    if (!g.index) throw new Error('mergeIndexed: every geometry must be indexed');
    verts += g.getAttribute('position').count;
    idx += g.index.count;
  }
  const out = new BufferGeometry();
  // three's setIndex(array) picks Uint32 when any index is >= 65535 (arrayNeedsUint32); the largest is verts - 1
  const index = verts - 1 >= 65535 ? new Uint32Array(idx) : new Uint16Array(idx);
  let io = 0, vo = 0;
  for (const g of list) {
    const ia = g.index!.array;
    for (let j = 0; j < ia.length; j++) index[io++] = ia[j]! + vo;
    vo += g.getAttribute('position').count;
  }
  out.setIndex(new BufferAttribute(index, 1));
  for (const name of names) {
    const a0 = first.getAttribute(name) as BufferAttribute;
    const size = a0.itemSize;
    const Arr = a0.array.constructor as Float32ArrayConstructor;
    const arr = new Arr(verts * size);
    let o = 0;
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!.getAttribute(name) as BufferAttribute;
      const src = a.array as Float32Array;
      const m = mats?.[i];
      if (m && name === 'position') {
        for (let k = 0; k < a.count; k++) {
          _mv.set(src[k * 3]!, src[k * 3 + 1]!, src[k * 3 + 2]!).applyMatrix4(m);
          arr[o + k * 3] = _mv.x; arr[o + k * 3 + 1] = _mv.y; arr[o + k * 3 + 2] = _mv.z;
        }
      } else if (m && name === 'normal') {
        _nm.getNormalMatrix(m);
        for (let k = 0; k < a.count; k++) {
          _mv.set(src[k * 3]!, src[k * 3 + 1]!, src[k * 3 + 2]!).applyNormalMatrix(_nm);
          arr[o + k * 3] = _mv.x; arr[o + k * 3 + 1] = _mv.y; arr[o + k * 3 + 2] = _mv.z;
        }
      } else arr.set(src, o);
      o += a.count * size;
    }
    out.setAttribute(name, new BufferAttribute(arr, size, a0.normalized));
  }
  return out;
}

/** `mergeIndexed` for PartBuilder pieces (no transforms): the same index width rule, attribute order and arrays. */
function mergePieces(list: Piece[]): BufferGeometry {
  const first = list[0]!;
  const names = Object.keys(first.attrs);
  let verts = 0, idx = 0;
  for (const pc of list) { verts += pc.count; idx += pc.index.length; }
  const out = new BufferGeometry();
  // one loop per index width: a single loop writing either kind runs on generic element access
  let index: Uint16Array | Uint32Array;
  if (verts - 1 >= 65535) index = offsetIndex32(list, idx);
  else index = offsetIndex16(list, idx);
  out.setIndex(new BufferAttribute(index, 1));
  for (const name of names) {
    const a0 = first.attrs[name]!;
    const arr = new (a0.array.constructor as Float32ArrayConstructor)(verts * a0.itemSize);
    let o = 0;
    for (const pc of list) {
      const src = pc.attrs[name]!.array;
      arr.set(src, o);
      o += pc.count * a0.itemSize;
    }
    out.setAttribute(name, new BufferAttribute(arr, a0.itemSize, a0.normalized));
  }
  return out;
}

function offsetIndex16(list: Piece[], n: number): Uint16Array {
  const index = new Uint16Array(n);
  let io = 0, vo = 0;
  for (const pc of list) {
    const ia = pc.index;
    for (let j = 0; j < ia.length; j++) index[io++] = ia[j]! + vo;
    vo += pc.count;
  }
  return index;
}

function offsetIndex32(list: Piece[], n: number): Uint32Array {
  const index = new Uint32Array(n);
  let io = 0, vo = 0;
  for (const pc of list) {
    const ia = pc.index;
    for (let j = 0; j < ia.length; j++) index[io++] = ia[j]! + vo;
    vo += pc.count;
  }
  return index;
}

/** Box-projected UVs in model space (dominant normal axis). */
export function boxUv(g: BufferGeometry): void {
  g.setAttribute('uv', new BufferAttribute(boxUvArray(g.getAttribute('position').array as Float32Array, g.getAttribute('normal').array as Float32Array), 2));
}

function boxUvArray(pa: Float32Array, na: Float32Array): Float32Array {
  const count = pa.length / 3;
  const uv = new Float32Array(count * 2);
  const s = 1 / UV_METRES;
  for (let i = 0; i < count; i++) {
    const ax = Math.abs(na[i * 3]!), ay = Math.abs(na[i * 3 + 1]!), az = Math.abs(na[i * 3 + 2]!);
    const x = pa[i * 3]!, y = pa[i * 3 + 1]!, z = pa[i * 3 + 2]!;
    let u: number, v: number;
    if (ay >= ax && ay >= az) { u = x; v = z; }
    else if (ax >= az) { u = z; v = y; }
    else { u = x; v = y; }
    uv[i * 2] = u * s;
    uv[i * 2 + 1] = v * s;
  }
  return uv;
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
    const m = geos.length === 1 ? unified[0]! : mergeIndexed(unified);
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
