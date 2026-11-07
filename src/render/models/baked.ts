/**
 * The prebaked model catalogue (D-331): every procedural model the game builds on its way to the first frame comes
 * out of a binary file made at build time (`tools/bake-models.ts`, run by the Vite build) instead of being built
 * again on the device, where that code runs cold (perf day 15: the same models take ~3× longer the first time).
 *
 * The model functions (`buildingModel`, `treeParts`, `wagonModel`, …) wrap their build in `bakedOr(key, build)`: with
 * a catalogue installed and the key in it, the stored result is decoded (typed-array views into the file, a few
 * objects per part); otherwise the model is built as before. The file holds exactly the bytes a build makes, and
 * `tests/models-baked.test.ts` checks build → encode → decode → encode bit for bit. No catalogue (dev server, tests,
 * tools, a failed fetch) means the old path.
 *
 * File layout (little-endian): 'MGC1', u32 JSON length, the JSON (UTF-8, padded to 8), then the data block. The JSON
 * is `{ e: { key: value }, g: [geometry] }`; a value is plain data where a model part is `{ $p: geometry, m }`, a
 * Vector3 `{ $v: [x, y, z] }`, a plain object `{ $o: {...} }`, an undefined field `{ $u: 1 }` and a number JSON cannot
 * carry (-0, NaN, ±Infinity) `{ $n: "-0" }`. A geometry is `{ a: [[name, type, itemSize, normalized, offset,
 * length]], i: [type, offset, length] | null, bb: offset | null, bs: offset | null, u?: userData }` with offsets into
 * the data block (8-aligned; bounds as 6 / 4 doubles). A uv that is exactly the box projection of the geometry's
 * points (most of them: `PartBuilder` makes it so) has type 'boxuv' and is recomputed by the same function. Geometries shared between models are stored once and decode
 * to one object, as built.
 */
import { Box3, BufferAttribute, BufferGeometry, FloatType, Sphere, StaticDrawUsage, Vector3 } from 'three';
import { boxUvArray } from './kit';
import type { MatKey } from './materials';

const MAGIC = 0x3143474d; // 'MGC1'
/** Attribute type of a uv that is `boxUvArray(position, normal)`: derived at decode, not stored. */
const BOX_UV = 'boxuv';

type Typed = Float32Array | Float64Array | Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array;
const TYPES: Record<string, new (b: ArrayBuffer, off: number, len: number) => Typed> = {
  f32: Float32Array, f64: Float64Array, u8: Uint8Array, u16: Uint16Array, u32: Uint32Array, i8: Int8Array, i16: Int16Array, i32: Int32Array,
};
function typeName(a: Typed): string {
  for (const [k, C] of Object.entries(TYPES)) if (a.constructor === C) return k;
  throw new Error(`baked: unsupported array ${a.constructor.name}`);
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
interface GeomRec { a: [string, string, number, boolean, number, number][]; i: [string, number, number] | null; bb: number | null; bs: number | null; u?: Json }

// ------------------------------------------------------------------------------------------------- runtime

interface Catalogue { buf: ArrayBuffer; data: number; entries: Record<string, Json>; geoms: GeomRec[]; decoded: (BufferGeometry | undefined)[]; values: Map<string, unknown> }
let installed: Catalogue | null = null;
let recorder: Map<string, unknown> | null = null;

/**
 * The model `key` from the installed catalogue, or `build()` when there is none or the key is not in it. Call it
 * once per key (the model functions keep their own caches); the decoded value is shared like a built one.
 */
export function bakedOr<T>(key: string, build: () => T): T {
  const c = installed;
  if (c && key in c.entries) {
    let v = c.values.get(key);
    if (v === undefined) c.values.set(key, (v = decodeValue(c, c.entries[key]!)));
    return v as T;
  }
  const v = build();
  if (recorder) recorder.set(key, v);
  return v;
}

/** Installs a catalogue file (null: none). Returns the number of models it holds; throws on a malformed file. */
export function installBakedModels(buf: ArrayBuffer | null): number {
  if (!buf) { installed = null; return 0; }
  const dv = new DataView(buf);
  if (buf.byteLength < 8 || dv.getUint32(0, true) !== MAGIC) throw new Error('baked: not a model catalogue');
  const n = dv.getUint32(4, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, n))) as { e: Record<string, Json>; g: GeomRec[] };
  installed = { buf, data: align8(8 + n), entries: json.e, geoms: json.g, decoded: [], values: new Map() };
  return Object.keys(json.e).length;
}

/** Whether a catalogue is installed (startup probe / debug). */
export function bakedModelsInstalled(): boolean {
  return installed !== null;
}

function decodeValue(c: Catalogue, v: Json): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => decodeValue(c, x));
  if ('$p' in v) return { geometry: decodeGeom(c, v.$p as number), material: v.m as MatKey };
  if ('$v' in v) { const [x, y, z] = (v.$v as Json[]).map((t) => decodeValue(c, t) as number); return new Vector3(x, y, z); }
  if ('$n' in v) return Number(v.$n);
  if ('$u' in v) return undefined;
  if ('$g' in v) return decodeGeom(c, v.$g as number);
  const o: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v.$o as Record<string, Json>)) o[k] = decodeValue(c, x);
  return o;
}

function decodeGeom(c: Catalogue, gi: number): BufferGeometry {
  const hit = c.decoded[gi];
  if (hit) return hit;
  const r = c.geoms[gi]!;
  const g = new BufferGeometry();
  const view = (t: string, off: number, len: number): Typed => new TYPES[t]!(c.buf, c.data + off, len);
  if (r.i) g.setIndex(new BufferAttribute(view(r.i[0], r.i[1], r.i[2]), 1));
  const arrays = new Map<string, Typed>();
  for (const [name, t, , , off, len] of r.a) if (t !== BOX_UV) arrays.set(name, view(t, off, len));
  for (const [name, t, itemSize, normalized] of r.a) {
    const a = t === BOX_UV ? boxUvArray(arrays.get('position') as Float32Array, arrays.get('normal') as Float32Array) : arrays.get(name)!;
    g.setAttribute(name, new BufferAttribute(a, itemSize, normalized));
  }
  if (r.bb !== null) {
    const d = view('f64', r.bb, 6) as Float64Array;
    g.boundingBox = new Box3(new Vector3(d[0], d[1], d[2]), new Vector3(d[3], d[4], d[5]));
  }
  if (r.bs !== null) {
    const d = view('f64', r.bs, 4) as Float64Array;
    g.boundingSphere = new Sphere(new Vector3(d[0], d[1], d[2]), d[3]);
  }
  if (r.u !== undefined) g.userData = JSON.parse(JSON.stringify(r.u)) as Record<string, unknown>;
  c.decoded[gi] = g;
  return g;
}

function align8(n: number): number {
  return (n + 7) & ~7;
}

// ------------------------------------------------------------------------------------------------- bake side

/**
 * Runs `fn` and returns every model built through `bakedOr` meanwhile, in build order (nested builds first). Only
 * meaningful in a fresh process: a model a function already holds in its own cache is not built again.
 */
export function recordModels(fn: () => void): Map<string, unknown> {
  const prev = recorder;
  const rec = new Map<string, unknown>();
  recorder = rec;
  try { fn(); } finally { recorder = prev; }
  return rec;
}

/** Encodes recorded models into a catalogue file (deterministic: same models, same bytes). */
export function encodeBakedModels(models: Map<string, unknown>): Uint8Array {
  const geoms: GeomRec[] = [];
  const ids = new Map<BufferGeometry, number>();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const put = (a: Typed): number => {
    const off = size;
    chunks.push(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
    size += a.byteLength;
    const pad = align8(size) - size;
    if (pad) { chunks.push(new Uint8Array(pad)); size += pad; }
    return off;
  };
  const geom = (g: BufferGeometry): number => {
    let id = ids.get(g);
    if (id !== undefined) return id;
    checkPlain(g);
    const rec: GeomRec = { a: [], i: null, bb: null, bs: null };
    if (g.index) { const a = g.index.array as Typed; rec.i = [typeName(a), put(a), a.length]; }
    for (const [name, attr] of Object.entries(g.attributes)) {
      const a = attr.array as Typed;
      if (name === 'uv' && derivedUv(g)) rec.a.push([name, BOX_UV, 2, false, -1, a.length]);
      else rec.a.push([name, typeName(a), attr.itemSize, attr.normalized, put(a), a.length]);
    }
    if (g.boundingBox) { const { min, max } = g.boundingBox; rec.bb = put(new Float64Array([min.x, min.y, min.z, max.x, max.y, max.z])); }
    if (g.boundingSphere) { const { center: s, radius } = g.boundingSphere; rec.bs = put(new Float64Array([s.x, s.y, s.z, radius])); }
    if (Object.keys(g.userData).length) rec.u = g.userData as Json;
    id = geoms.length;
    geoms.push(rec);
    ids.set(g, id);
    return id;
  };
  const num = (x: number): Json => (Number.isFinite(x) && !Object.is(x, -0) ? x : { $n: Object.is(x, -0) ? '-0' : String(x) });
  const enc = (v: unknown, path: string): Json => {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'number') return num(v);
    if (Array.isArray(v)) return v.map((x, i) => enc(x, `${path}[${i}]`));
    if (v instanceof Vector3) return { $v: [num(v.x), num(v.y), num(v.z)] };
    if (v instanceof BufferGeometry) return { $g: geom(v) };
    if (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
      const o = v as Record<string, unknown>;
      const keys = Object.keys(o);
      if (o.geometry instanceof BufferGeometry && typeof o.material === 'string' && keys.length === 2) return { $p: geom(o.geometry), m: o.material };
      const out: Record<string, Json> = {};
      for (const k of keys) out[k] = o[k] === undefined ? { $u: 1 } : enc(o[k], `${path}.${k}`);
      return { $o: out };
    }
    throw new Error(`baked: cannot store ${path} (${typeof v === 'object' ? (v as object).constructor?.name : typeof v})`);
  };
  const entries: Record<string, Json> = {};
  for (const [k, v] of models) entries[k] = enc(v, k);
  const json = new TextEncoder().encode(JSON.stringify({ e: entries, g: geoms }));
  const head = align8(8 + json.length);
  const out = new Uint8Array(head + size);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, json.length, true);
  out.set(json, 8);
  let o = head;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

/** Re-encodes an installed catalogue's every model from its decoded form (round-trip check). */
export function decodeAllBaked(): Map<string, unknown> {
  const c = installed;
  const out = new Map<string, unknown>();
  if (!c) return out;
  for (const k of Object.keys(c.entries)) out.set(k, bakedOr(k, () => { throw new Error('unreachable'); }));
  return out;
}

/** Whether a geometry's uv is exactly `boxUvArray` of its points and normals (then it is not stored, but derived). */
function derivedUv(g: BufferGeometry): boolean {
  const uv = g.getAttribute('uv'), p = g.getAttribute('position'), n = g.getAttribute('normal');
  if (!uv || !p || !n || uv.itemSize !== 2 || uv.normalized || !(uv.array instanceof Float32Array)) return false;
  if (!(p.array instanceof Float32Array) || !(n.array instanceof Float32Array) || p.itemSize !== 3 || n.itemSize !== 3 || p.normalized || n.normalized) return false;
  const d = boxUvArray(p.array, n.array);
  if (d.length !== uv.array.length) return false;
  for (let i = 0; i < d.length; i++) if (!Object.is(d[i], uv.array[i])) return false;
  return true;
}

/** The catalogue stores what `geom` records and nothing else: anything else on a model geometry must be default. */
function checkPlain(g: BufferGeometry): void {
  const bad = (what: string): never => { throw new Error(`baked: geometry with ${what} cannot be stored`); };
  if (g.name !== '') bad('a name');
  if (g.groups.length) bad('groups');
  if (Object.keys(g.morphAttributes).length || g.morphTargetsRelative) bad('morph targets');
  if (g.drawRange.start !== 0 || g.drawRange.count !== Infinity) bad('a draw range');
  if (g.indirect) bad('an indirect buffer');
  for (const a of [g.index, ...Object.values(g.attributes)]) {
    if (!a) continue;
    if (!(a instanceof BufferAttribute)) bad('an interleaved attribute');
    const b = a as BufferAttribute;
    if (b.name !== '' || b.usage !== StaticDrawUsage || b.updateRanges.length || b.gpuType !== FloatType) bad('a non-default attribute');
    if (b.array.length !== b.count * b.itemSize) bad('an attribute count');
  }
}
