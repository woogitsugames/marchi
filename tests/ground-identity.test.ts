// Perf day 12 (D-280..D-282): the leaner ground build must give the same numbers as the code it replaced. Each test
// keeps a copy of the replaced code as the reference and compares bit for bit (Object.is, so -0 and NaN count).
import { BufferAttribute, BufferGeometry, type TypedArray } from 'three';
import { createWorld, type Terrain } from '../src/sim/index';
import { menuWorld } from '../src/game/menuScene';
import { clearGroundMemo, groundMemo, sameGround } from '../src/render/groundCache';
import { CELL, Heightfield } from '../src/render/heightfield';
import { fnoise, hash3, vnoise } from '../src/render/models/kit';
import { APRON, apronHeight, gridGeometry, terrainGrids } from '../src/render/terrainGrid';
import { WaterView } from '../src/render/water';
import { assert, eq, test } from './harness';

const same = (a: ArrayLike<number>, b: ArrayLike<number>, what: string): void => {
  eq(a.length, b.length, `${what}: length`);
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) throw new Error(`${what}[${i}]: ${a[i]} != ${b[i]}`);
};

// --- reference: kit.ts hash3 / vnoise before D-281 -------------------------------------------------------------
function refHash3(x: number, y: number, z: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = (t: number) => t * t * (3 - 2 * t);
function refVnoise(x: number, y: number, z: number, seed = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
  const c000 = refHash3(xi, yi, zi, seed), c100 = refHash3(xi + 1, yi, zi, seed);
  const c010 = refHash3(xi, yi + 1, zi, seed), c110 = refHash3(xi + 1, yi + 1, zi, seed);
  const c001 = refHash3(xi, yi, zi + 1, seed), c101 = refHash3(xi + 1, yi, zi + 1, seed);
  const c011 = refHash3(xi, yi + 1, zi + 1, seed), c111 = refHash3(xi + 1, yi + 1, zi + 1, seed);
  const a0 = c000 + (c100 - c000) * xf, b0 = c010 + (c110 - c010) * xf;
  const a1 = c001 + (c101 - c001) * xf, b1 = c011 + (c111 - c011) * xf;
  const z0 = a0 + (b0 - a0) * yf, z1 = a1 + (b1 - a1) * yf;
  return z0 + (z1 - z0) * zf;
}

let q = 99;
const rnd = () => ((q = (Math.imul(q, 1103515245) + 12345) >>> 0) / 4294967296);

test('ground identity: vnoise / hash3 / fnoise equal the per-corner hash3 reference', () => {
  const scales = [1, 37, 1e4, 3e9, 1e13];
  for (let n = 0; n < 150_000; n++) {
    const s = scales[n % scales.length]!;
    const x = (rnd() - 0.5) * s, y = (rnd() - 0.5) * s, z = (rnd() - 0.5) * s, seed = Math.floor((rnd() - 0.5) * 2 ** 33);
    const v = vnoise(x, y, z, seed), r = refVnoise(x, y, z, seed);
    if (!Object.is(v, r)) throw new Error(`vnoise(${x}, ${y}, ${z}, ${seed}) ${v} != ${r}`);
    const f = fnoise(x, y, z, seed), rf = (refVnoise(x, y, z, seed) * 0.66 + refVnoise(x * 2.03, y * 2.03, z * 2.03, seed + 17) * 0.34) * 2 - 1;
    if (!Object.is(f, rf)) throw new Error(`fnoise(${x}, ${y}, ${z}, ${seed})`);
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    if (!Object.is(hash3(xi, yi, zi, seed), refHash3(xi, yi, zi, seed))) throw new Error(`hash3(${xi}, ${yi}, ${zi}, ${seed})`);
  }
});

const grounds = (): [string, Terrain][] => [
  ['menu', menuWorld().terrain],
  ['m2', createWorld('m2').terrain],
  ['m3', createWorld('m3').terrain],
  ['sandbox:7', createWorld('sandbox', 7).terrain],
];

// --- reference: Heightfield.raw (16 clamped corner reads) and shoreDist (always the 16-tap mask) before D-280/281 ---
type HfPrivate = { cellField(f: Float32Array, x: number, z: number): number; wm: Float32Array };
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** shoreDist past the mask test, as before D-280. */
const refShore = (m: number, x: number, z: number) =>
  (0.5 - m) * 11.5 + ((refVnoise(x / 26, z / 19, 1.5, 91) - 0.5) * 3.8 + (refVnoise(x / 7.5, z / 6.5, 2.5, 92) - 0.5) * 1.1) + 6 * (1 - smooth(0, 0.1, m));
function refRaw(t: Terrain, x: number, z: number): number {
  const corner = (ix: number, iz: number) => {
    if (ix < 0) ix = 0; else if (ix > t.w) ix = t.w;
    if (iz < 0) iz = 0; else if (iz > t.h) iz = t.h;
    return Math.fround(t.corners[iz * (t.w + 1) + ix]!);
  };
  const gx = x / CELL, gz = z / CELL;
  const ix = Math.floor(gx), iz = Math.floor(gz);
  const tx = gx - ix, tz = gz - iz;
  const wx0 = ((-tx + 2) * tx - 1) * tx * 0.5, wx1 = ((3 * tx - 5) * tx * tx + 2) * 0.5;
  const wx2 = ((-3 * tx + 4) * tx + 1) * tx * 0.5, wx3 = ((tx - 1) * tx * tx) * 0.5;
  const wz0 = ((-tz + 2) * tz - 1) * tz * 0.5, wz1 = ((3 * tz - 5) * tz * tz + 2) * 0.5;
  const wz2 = ((-3 * tz + 4) * tz + 1) * tz * 0.5, wz3 = ((tz - 1) * tz * tz) * 0.5;
  let s = 0;
  for (let k = 0; k < 4; k++) {
    const zz = iz - 1 + k;
    const r = wx0 * corner(ix - 1, zz) + wx1 * corner(ix, zz) + wx2 * corner(ix + 1, zz) + wx3 * corner(ix + 2, zz);
    s += r * (k === 0 ? wz0 : k === 1 ? wz1 : k === 2 ? wz2 : wz3);
  }
  return s;
}

test('ground identity: Heightfield raw and the inland shore shortcut equal the full computation', () => {
  for (const [name, t] of grounds()) {
    const hf = new Heightfield(t), p = hf as unknown as HfPrivate;
    let inland = 0;
    for (let n = 0; n < 60_000; n++) {
      // mostly on the map, some beyond the edges (wagons and the apron clamp, but `height` must not care)
      const x = -12 + rnd() * (hf.sizeX + 24), z = -12 + rnd() * (hf.sizeZ + 24);
      const r = hf.raw(x, z), rr = refRaw(t, x, z);
      if (!Object.is(r, rr)) throw new Error(`${name} raw(${x}, ${z}) ${r} != ${rr}`);
      const m = p.cellField(p.wm, x, z);
      const ref = m < 0.004 ? 12 : refShore(m, x, z);
      const s = hf.shoreDist(x, z);
      if (!Object.is(s, ref)) throw new Error(`${name} shoreDist(${x}, ${z}) ${s} != ${ref}`);
      if (m < 0.004) inland++;
      const h = hf.height(x, z);
      if (!Object.is(h, hf.base(x, z) + hf.detail(x, z))) throw new Error(`${name} height(${x}, ${z})`);
    }
    assert(inland > 30_000 && inland < 60_000, `${name}: both shore branches sampled (${inland} inland)`);
  }
});

// --- reference: terrain.ts gridGeometry before D-280..D-282 (closure per vertex, three's bounds) ------------------
function refGrid(hf: Heightfield, x0: number, z0: number, nx: number, nz: number, step: number, apron: boolean): BufferGeometry {
  const vx = nx + 1, vz = nz + 1;
  const pos = new Float32Array(vx * vz * 3), nor = new Float32Array(vx * vz * 3), hs = new Float32Array(vx * vz);
  const H = apron ? (x: number, z: number) => apronHeight(hf, x, z) : (x: number, z: number) => hf.height(x, z);
  for (let j = 0; j < vz; j++) for (let i = 0; i < vx; i++) {
    const x = x0 + i * step, z = z0 + j * step, k = j * vx + i, y = H(x, z);
    hs[k] = y;
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
  }
  const e = step;
  for (let j = 0; j < vz; j++) for (let i = 0; i < vx; i++) {
    const k = j * vx + i, x = x0 + i * step, z = z0 + j * step;
    const hl = i > 0 ? hs[k - 1]! : H(x - e, z), hr = i < nx ? hs[k + 1]! : H(x + e, z);
    const hu = j > 0 ? hs[k - vx]! : H(x, z - e), hd = j < nz ? hs[k + vx]! : H(x, z + e);
    const ax = -(hr - hl), ay = 2 * e, az = -(hd - hu), l = Math.hypot(ax, ay, az);
    nor[k * 3] = ax / l; nor[k * 3 + 1] = ay / l; nor[k * 3 + 2] = az / l;
  }
  const idx = vx * vz > 65535 ? new Uint32Array(nx * nz * 6) : new Uint16Array(nx * nz * 6);
  let p = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * vx + i, b = a + 1, c = a + vx, d = c + 1;
    if ((i + j) & 1) { idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d; }
    else { idx[p++] = a; idx[p++] = c; idx[p++] = d; idx[p++] = a; idx[p++] = d; idx[p++] = b; }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nor, 3));
  g.setIndex(new BufferAttribute(idx, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

function refGrids(hf: Heightfield): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  const cw = Math.ceil(hf.w / 3), ch = Math.ceil(hf.h / 2);
  for (let jz = 0; jz < 2; jz++) for (let ix = 0; ix < 3; ix++) {
    const x0 = ix * cw, x1 = Math.min(hf.w, x0 + cw), z0 = jz * ch, z1 = Math.min(hf.h, z0 + ch);
    out.push(refGrid(hf, x0 * CELL, z0 * CELL, (x1 - x0) * 3, (z1 - z0) * 3, CELL / 3, false));
  }
  const A = APRON;
  for (const [x, z, sx, sz] of [[-A, -A, hf.sizeX + 2 * A, A + 8], [-A, hf.sizeZ - 8, hf.sizeX + 2 * A, A + 8], [-A, -8, A + 8, hf.sizeZ + 16], [hf.sizeX - 8, -8, A + 8, hf.sizeZ + 16]] as const) {
    out.push(refGrid(hf, x, z, Math.round(sx / 8), Math.round(sz / 8), 8, true));
  }
  return out;
}

const sameGeometry = (g: BufferGeometry, r: BufferGeometry, what: string): void => {
  eq(Object.keys(g.attributes).join(','), Object.keys(r.attributes).join(','), `${what}: attributes`);
  for (const k of Object.keys(r.attributes)) same(g.attributes[k]!.array as TypedArray, r.attributes[k]!.array as TypedArray, `${what} ${k}`);
  eq(g.index!.array.constructor.name, r.index!.array.constructor.name, `${what}: index type`);
  same(g.index!.array, r.index!.array, `${what} index`);
  if (r.boundingBox) same([...g.boundingBox!.min.toArray(), ...g.boundingBox!.max.toArray()], [...r.boundingBox.min.toArray(), ...r.boundingBox.max.toArray()], `${what} box`);
  same([...g.boundingSphere!.center.toArray(), g.boundingSphere!.radius], [...r.boundingSphere!.center.toArray(), r.boundingSphere!.radius], `${what} sphere`);
};

test('ground identity: terrain chunks and apron equal the per-vertex reference (positions, normals, index, bounds)', () => {
  for (const [name, t] of grounds().slice(0, 3)) {
    const hf = new Heightfield(t);
    const grids = terrainGrids(hf), ref = refGrids(hf);
    eq(grids.length, ref.length, `${name}: grid count`);
    grids.forEach((d, k) => sameGeometry(gridGeometry(d), ref[k]!, `${name} grid ${k}`));
  }
});

// --- reference: water.ts strip before D-281 (number[] pushes, setIndex(array), apronHeight per point) ------------
function refStrip(hf: Heightfield): BufferGeometry {
  const WL = hf.waterLevel;
  let zmin = Infinity, zmax = -Infinity;
  for (let y = 0; y < hf.h; y++) for (let x = 0; x < hf.w; x++) if (hf.waterDist[y * hf.w + x]! < 0.5) { zmin = Math.min(zmin, y); zmax = Math.max(zmax, y); }
  if (!isFinite(zmin)) { zmin = 0; zmax = 0; }
  const z0 = (zmin - 3) * CELL, z1 = (zmax + 4) * CELL, x0 = -APRON, x1 = hf.sizeX + APRON, S = 1;
  const nx = Math.ceil((x1 - x0) / S), nz = Math.ceil((z1 - z0) / S);
  const verts: number[] = [], depth: number[] = [], idx: number[] = [];
  const vid = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
  const H = (x: number, z: number) => (hf.inside(x, z) ? hf.height(x, z) : apronHeight(hf, x, z));
  const depthAt = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) depthAt[j * (nx + 1) + i] = WL - H(x0 + i * S, z0 + j * S);
  const vertex = (i: number, j: number) => {
    const k = j * (nx + 1) + i;
    if (vid[k]! >= 0) return vid[k]!;
    vid[k] = verts.length / 3;
    verts.push(x0 + i * S, WL, z0 + j * S);
    depth.push(depthAt[k]!);
    return vid[k]!;
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * (nx + 1) + i;
    if (Math.max(depthAt[k]!, depthAt[k + 1]!, depthAt[k + nx + 1]!, depthAt[k + nx + 2]!) < -0.35) continue;
    const a = vertex(i, j), b = vertex(i + 1, j), c = vertex(i, j + 1), d = vertex(i + 1, j + 1);
    idx.push(a, c, b, b, c, d);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  g.setAttribute('depth', new BufferAttribute(new Float32Array(depth), 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

test('ground identity: the water strip equals the number[] reference', () => {
  clearGroundMemo();
  for (const [name, t] of grounds()) {
    const hf = new Heightfield(t);
    const w = new WaterView(hf);
    sameGeometry(w.mesh.geometry, refStrip(hf), `${name} water`);
    w.dispose();
  }
});

test('ground identity: the ground memo hands back the same data only for the same ground', () => {
  clearGroundMemo();
  // the sim caches terrain per map id, so the menu and mission I share one object; missions II / IV share a ground
  // under two map ids (two objects)
  const menu = menuWorld().terrain, m2 = createWorld('m2').terrain, m4 = createWorld('m4').terrain, m3 = createWorld('m3').terrain;
  assert(m2 !== m4 && sameGround(m2, m4), 'missions II and IV share their ground');
  assert(!sameGround(menu, m2) && !sameGround(m2, m3), 'the menu valley, mission II and mission III have three grounds');
  const bumped = { ...m4, corners: m4.corners.slice() };
  bumped.corners[17] = bumped.corners[17]! + 1e-9;
  assert(!sameGround(m2, bumped), 'one corner off by 1e-9 is another ground');
  const wet = { ...m4, water: m4.water.slice() };
  wet.water[5] = wet.water[5] ? 0 : 1;
  assert(!sameGround(m2, wet), 'one water cell more or less is another ground');
  let built = 0;
  const builds = (): number => built; // (a function: TS would narrow a plain counter to a literal)
  const build = (t: Terrain) => groundMemo('test', t, () => { built++; return terrainGrids(new Heightfield(t)); });
  const a = build(menu), b = build(m2);
  eq(builds(), 2, 'two grounds built');
  assert(build(menu) === a && builds() === 2, 'back on the menu: kept');
  assert(build(m4) === b && builds() === 2, 'mission IV on mission II\'s ground: kept');
  const c = build(m3);
  assert(c !== a && c !== b && builds() === 3, 'a third ground: built');
  build(menu);
  eq(builds(), 4, 'two grounds per kind: the menu (least recent) was dropped for mission III');
  assert(build(m3) === c && builds() === 4, 'mission III still kept');
  // what a world on the same ground gets is what it would have built itself
  const fresh = terrainGrids(new Heightfield(m4));
  build(m2).forEach((d, k) => sameGeometry(gridGeometry(d), gridGeometry(fresh[k]!), `memo grid ${k}`));
  clearGroundMemo();
});
