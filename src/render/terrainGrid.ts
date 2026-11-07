// Terrain mesh grids (pure, no textures or materials): the 6 map chunks — 3 vertices per 4 m cell edge, heights from
// Heightfield — and the 4 pieces of the apron ring beyond the map edge, with normals and bounds; and the apron height
// itself. Split from terrain.ts (D-280) so the tests can build and compare the grids without the texture loaders.
import { Box3, BufferAttribute, BufferGeometry, Sphere, Vector3 } from 'three';
import { CELL, type Heightfield } from './heightfield';

const SUB = 3;
export const CHUNKS_X = 3, CHUNKS_Z = 2;
export const APRON = 280;

/** Height outside the map: clamp to the border and rise into wooded hills. */
export function apronHeight(hf: Heightfield, x: number, z: number): number {
  const cx = Math.min(hf.sizeX, Math.max(0, x)), cz = Math.min(hf.sizeZ, Math.max(0, z));
  return apronFrom(hf, x, z, cx, cz, hf.base(cx, cz));
}

/**
 * `apronHeight` of the grid x = x0 + i * step, z = z0 + j * step into `out[j * vx + i]`, asking `hf.base` once per
 * distinct border point: a point repeats the one left of it (a row clamped to the west/east border) or the one
 * above it (a column clamped to the north/south border) — `base` is a pure function, so the values are the same.
 */
function apronGrid(hf: Heightfield, x0: number, z0: number, vx: number, vz: number, step: number, out: Float32Array): void {
  const colX = new Float64Array(vx).fill(NaN), colZ = new Float64Array(vx).fill(NaN), colB = new Float64Array(vx);
  for (let j = 0; j < vz; j++) {
    const z = z0 + j * step;
    let lx = NaN, lz = NaN, lb = 0;
    for (let i = 0; i < vx; i++) {
      const x = x0 + i * step;
      const cx = Math.min(hf.sizeX, Math.max(0, x)), cz = Math.min(hf.sizeZ, Math.max(0, z));
      let b: number;
      if (cx === lx && cz === lz) b = lb;
      else if (cx === colX[i] && cz === colZ[i]) b = colB[i]!;
      else b = hf.base(cx, cz);
      lx = cx; lz = cz; lb = b;
      colX[i] = cx; colZ[i] = cz; colB[i] = b;
      out[j * vx + i] = apronFrom(hf, x, z, cx, cz, b);
    }
  }
}

/**
 * `apronHeight` along a row of points, reusing `hf.base` while consecutive points clamp to the same border point
 * (a row west or east of the map clamps to one point per row). Same values: `base` is pure.
 */
export class ApronRow {
  private lx = NaN;
  private lz = NaN;
  private lb = 0;

  constructor(private readonly hf: Heightfield) {}

  at(x: number, z: number): number {
    const hf = this.hf;
    const cx = Math.min(hf.sizeX, Math.max(0, x)), cz = Math.min(hf.sizeZ, Math.max(0, z));
    if (cx !== this.lx || cz !== this.lz) { this.lx = cx; this.lz = cz; this.lb = hf.base(cx, cz); }
    return apronFrom(hf, x, z, cx, cz, this.lb);
  }
}

function apronFrom(hf: Heightfield, x: number, z: number, cx: number, cz: number, b: number): number {
  const out = Math.hypot(x - cx, z - cz);
  if (out <= 0) return b - 0.35; // under the real terrain (hides seams)
  // keep the river channel low where it leaves the map
  const riverK = Math.min(1, Math.max(0, (b - hf.waterLevel - 0.2) / 2.5));
  const n = Math.sin(x * 0.013 + Math.cos(z * 0.011) * 2) * 0.5 + Math.sin(z * 0.017 - x * 0.006) * 0.5;
  const rise = out * (0.07 + 0.05 * n) + Math.max(0, out - 60) * 0.12;
  return b - 0.35 + rise * (0.25 + 0.75 * riverK);
}

/** Positions, normals, index and bounds of one terrain grid (shared, read-only once built). */
export interface GridData {
  pos: Float32Array;
  nor: Float32Array;
  idx: Uint16Array | Uint32Array;
  box: Box3;
  sphere: Sphere;
}

/** Number of terrain grids of a ground: the 6 map chunks (row by row), then the 4 apron pieces (N, S, W, E). */
export const TERRAIN_PIECES = CHUNKS_X * CHUNKS_Z + 4;

/** Apron sample step (m). */
const APRON_STEP = 8;

/** The grid of a piece: origin (m), quads per axis, vertex step (m). */
function pieceSpec(hf: Heightfield, k: number): { x0: number; z0: number; nx: number; nz: number; step: number; apron: boolean } {
  if (k < CHUNKS_X * CHUNKS_Z) {
    const cw = Math.ceil(hf.w / CHUNKS_X), ch = Math.ceil(hf.h / CHUNKS_Z);
    const ix = k % CHUNKS_X, jz = Math.floor(k / CHUNKS_X);
    const x0 = ix * cw, x1 = Math.min(hf.w, x0 + cw);
    const z0 = jz * ch, z1 = Math.min(hf.h, z0 + ch);
    return { x0: x0 * CELL, z0: z0 * CELL, nx: (x1 - x0) * SUB, nz: (z1 - z0) * SUB, step: CELL / SUB, apron: false };
  }
  // apron: coarse ring beyond the map edge (4 pieces so it can be culled)
  const S = APRON_STEP, A = APRON;
  const pieces: [number, number, number, number][] = [
    [-A, -A, hf.sizeX + 2 * A, A + 8], // north
    [-A, hf.sizeZ - 8, hf.sizeX + 2 * A, A + 8], // south
    [-A, -8, A + 8, hf.sizeZ + 16], // west
    [hf.sizeX - 8, -8, A + 8, hf.sizeZ + 16], // east
  ];
  const [x, z, sx, sz] = pieces[k - CHUNKS_X * CHUNKS_Z]!;
  return { x0: x, z0: z, nx: Math.round(sx / S), nz: Math.round(sz / S), step: S, apron: true };
}

/** Grid `k` of a ground (0..TERRAIN_PIECES-1, the order of `terrainGrids`). */
export function terrainGrid(hf: Heightfield, k: number): GridData {
  const p = pieceSpec(hf, k);
  return gridData(hf, p.x0, p.z0, p.nx, p.nz, p.step, p.apron);
}

/** The 6 map chunks (row by row) and the 4 apron pieces (north, south, west, east) of a ground. */
export function terrainGrids(hf: Heightfield): GridData[] {
  const out: GridData[] = [];
  for (let k = 0; k < TERRAIN_PIECES; k++) out.push(terrainGrid(hf, k));
  return out;
}

/**
 * A box that holds grid `k` without building it (D-296): its x/z extent exactly, and heights from `hf.bounds()`
 * (the map chunks) or from `apronFrom`'s ceiling (the apron: border base - 0,35 plus a rise of at most 0,24 m per
 * metre beyond the border, the largest at a corner of the piece), with 1 m of slack.
 */
export function pieceBox(hf: Heightfield, k: number, out = new Box3()): Box3 {
  const p = pieceSpec(hf, k);
  const x1 = p.x0 + p.nx * p.step, z1 = p.z0 + p.nz * p.step;
  const b = hf.bounds();
  let y0 = b.min - 1, y1 = b.max + 1;
  if (p.apron) {
    let far = 0;
    for (const x of [p.x0, x1]) for (const z of [p.z0, z1]) {
      const cx = Math.min(hf.sizeX, Math.max(0, x)), cz = Math.min(hf.sizeZ, Math.max(0, z));
      far = Math.max(far, Math.sqrt((x - cx) * (x - cx) + (z - cz) * (z - cz)));
    }
    y0 = b.min - 0.35 - 1;
    y1 = b.max - 0.35 + 0.24 * far + 1;
  }
  out.min.set(p.x0, y0, p.z0);
  out.max.set(x1, y1, z1);
  return out;
}

/** A geometry over a grid's (shared) arrays, with its own copies of the bounds. */
export function gridGeometry(d: GridData): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(d.pos, 3));
  g.setAttribute('normal', new BufferAttribute(d.nor, 3));
  g.setIndex(new BufferAttribute(d.idx, 1));
  g.boundingBox = d.box.clone();
  g.boundingSphere = d.sphere.clone();
  return g;
}

function gridData(
  hf: Heightfield,
  x0: number,
  z0: number,
  nx: number,
  nz: number,
  step: number,
  apron: boolean,
): GridData {
  const vx = nx + 1, vz = nz + 1;
  const pos = new Float32Array(vx * vz * 3);
  const nor = new Float32Array(vx * vz * 3);
  const hs = new Float32Array(vx * vz);
  const H = apron ? (x: number, z: number) => apronHeight(hf, x, z) : (x: number, z: number) => hf.height(x, z);
  // the apron asks hf.base once per border point its vertices clamp to (most of a ring row or column clamps to one)
  if (apron) apronGrid(hf, x0, z0, vx, vz, step, hs);
  else for (let j = 0; j < vz; j++) for (let i = 0; i < vx; i++) hs[j * vx + i] = hf.height(x0 + i * step, z0 + j * step);
  for (let j = 0; j < vz; j++) for (let i = 0; i < vx; i++) {
    const k = j * vx + i;
    pos[k * 3] = x0 + i * step; pos[k * 3 + 1] = hs[k]!; pos[k * 3 + 2] = z0 + j * step;
  }
  // normals from central differences (sampling outside the grid for seamless chunk edges)
  const e = step;
  for (let j = 0; j < vz; j++) for (let i = 0; i < vx; i++) {
    const k = j * vx + i;
    const x = x0 + i * step, z = z0 + j * step;
    const hl = i > 0 ? hs[k - 1]! : H(x - e, z);
    const hr = i < nx ? hs[k + 1]! : H(x + e, z);
    const hu = j > 0 ? hs[k - vx]! : H(x, z - e);
    const hd = j < nz ? hs[k + vx]! : H(x, z + e);
    const ax = -(hr - hl), ay = 2 * e, az = -(hd - hu);
    const l = Math.hypot(ax, ay, az);
    nor[k * 3] = ax / l; nor[k * 3 + 1] = ay / l; nor[k * 3 + 2] = az / l;
  }
  const idx = vx * vz > 65535 ? new Uint32Array(nx * nz * 6) : new Uint16Array(nx * nz * 6);
  let p = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * vx + i, b = a + 1, c = a + vx, d = c + 1;
    // alternate the diagonal for a less regular triangulation
    if ((i + j) & 1) { idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d; }
    else { idx[p++] = a; idx[p++] = c; idx[p++] = d; idx[p++] = a; idx[p++] = d; idx[p++] = b; }
  }
  return { pos, nor, idx, ...gridBounds(pos) };
}

/**
 * `computeBoundingBox()` + `computeBoundingSphere()` of a plain position array, with the same float operations as
 * three.js (Box3.expandByPoint's Math.min/max per axis, centre (min + max) * 0.5, the largest squared distance to
 * it, sqrt) but straight over the Float32Array instead of a Vector3 per vertex and per pass (D-281).
 */
export function gridBounds(pos: Float32Array): { box: Box3; sphere: Sphere } {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let k = 0; k < pos.length; k += 3) {
    const x = pos[k]!, y = pos[k + 1]!, z = pos[k + 2]!;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y); z1 = Math.max(z1, z);
  }
  const box = new Box3(new Vector3(x0, y0, z0), new Vector3(x1, y1, z1));
  const c = box.getCenter(new Vector3());
  const cx = c.x, cy = c.y, cz = c.z;
  let r2 = 0;
  for (let k = 0; k < pos.length; k += 3) {
    const dx = cx - pos[k]!, dy = cy - pos[k + 1]!, dz = cz - pos[k + 2]!;
    r2 = Math.max(r2, dx * dx + dy * dy + dz * dz);
  }
  return { box, sphere: new Sphere(c, Math.sqrt(r2)) };
}
