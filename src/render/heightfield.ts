// Render-side terrain surface: a smooth bicubic (Catmull-Rom) interpolation of the sim's
// corner heights plus a little deterministic detail noise, so the 4 m grid never shows.
// Everything that sits on the ground (terrain mesh, trees, buildings, wagons, picking) uses
// this one function, so objects stay glued to what is drawn.
import type { Terrain } from '../sim/index';
import { vnoise } from './models/kit';

export const CELL = 4;

export class Heightfield {
  readonly w: number;
  readonly h: number;
  readonly cw: number; // corners per row
  readonly sizeX: number;
  readonly sizeZ: number;
  readonly waterLevel: number;
  private readonly c: Float32Array;
  /** Distance (cells) to the nearest water cell, capped at 8; per cell. */
  readonly waterDist: Float32Array;

  constructor(readonly t: Terrain) {
    this.w = t.w;
    this.h = t.h;
    this.cw = t.w + 1;
    this.sizeX = t.w * CELL;
    this.sizeZ = t.h * CELL;
    this.waterLevel = t.waterLevel;
    this.c = Float32Array.from(t.corners);
    this.waterDist = waterDistance(t);
  }

  private corner(ix: number, iz: number): number {
    if (ix < 0) ix = 0; else if (ix > this.w) ix = this.w;
    if (iz < 0) iz = 0; else if (iz > this.h) iz = this.h;
    return this.c[iz * this.cw + ix]!;
  }

  /** Smooth base surface (no noise). x, z in metres. */
  base(x: number, z: number): number {
    const gx = x / CELL, gz = z / CELL;
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const tx = gx - ix, tz = gz - iz;
    // Catmull-Rom weights
    const wx0 = ((-tx + 2) * tx - 1) * tx * 0.5;
    const wx1 = ((3 * tx - 5) * tx * tx + 2) * 0.5;
    const wx2 = ((-3 * tx + 4) * tx + 1) * tx * 0.5;
    const wx3 = ((tx - 1) * tx * tx) * 0.5;
    const wz0 = ((-tz + 2) * tz - 1) * tz * 0.5;
    const wz1 = ((3 * tz - 5) * tz * tz + 2) * 0.5;
    const wz2 = ((-3 * tz + 4) * tz + 1) * tz * 0.5;
    const wz3 = ((tz - 1) * tz * tz) * 0.5;
    let s = 0;
    for (let k = 0; k < 4; k++) {
      const zz = iz - 1 + k;
      const r = wx0 * this.corner(ix - 1, zz) + wx1 * this.corner(ix, zz) + wx2 * this.corner(ix + 1, zz) + wx3 * this.corner(ix + 2, zz);
      s += r * (k === 0 ? wz0 : k === 1 ? wz1 : k === 2 ? wz2 : wz3);
    }
    return s;
  }

  /** Detail displacement amplitude falls off near water (keeps the shoreline calm). */
  detail(x: number, z: number): number {
    const cx = Math.min(this.w - 1, Math.max(0, Math.floor(x / CELL)));
    const cz = Math.min(this.h - 1, Math.max(0, Math.floor(z / CELL)));
    const wd = this.waterDist[cz * this.w + cx]!;
    const amp = Math.min(1, Math.max(0, (wd - 1) / 3));
    if (amp <= 0) return 0;
    const n = (vnoise(x / 9, z / 9, 0.5, 71) - 0.5) * 0.34 + (vnoise(x / 2.6, z / 2.6, 3.5, 72) - 0.5) * 0.09;
    return n * amp;
  }

  /** Rendered ground height at (x, z) metres. */
  height(x: number, z: number): number {
    return this.base(x, z) + this.detail(x, z);
  }

  /** Approximate surface normal (finite differences of `height`), written into out[0..2]. */
  normal(x: number, z: number, out: { x: number; y: number; z: number }, e = 0.6): void {
    const hx = this.height(x + e, z) - this.height(x - e, z);
    const hz = this.height(x, z + e) - this.height(x, z - e);
    const nx = -hx, ny = 2 * e, nz = -hz;
    const l = Math.hypot(nx, ny, nz);
    out.x = nx / l; out.y = ny / l; out.z = nz / l;
  }

  inside(x: number, z: number): boolean {
    return x >= 0 && z >= 0 && x <= this.sizeX && z <= this.sizeZ;
  }
}

function waterDistance(t: Terrain): Float32Array {
  const n = t.w * t.h;
  const d = new Float32Array(n).fill(8);
  // two-pass chamfer distance (cells)
  for (let i = 0; i < n; i++) if (t.water[i]) d[i] = 0;
  const W = t.w, H = t.h;
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
    d[i] = Math.min(8, v);
  }
  return d;
}
