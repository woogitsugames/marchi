// Render-side terrain surface: a smooth bicubic (Catmull-Rom) interpolation of the sim's
// corner heights plus a little deterministic detail noise, so the 4 m grid never shows.
// Along the river the cell-carved channel is replaced by a profile of a smooth signed
// distance (blurred water mask + low-frequency wobble), so the waterline is a natural curve
// with irregular bays instead of stair steps along cell edges.
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
  /** Gaussian-blurred water mask (cell centres), 0..1. */
  private readonly wm: Float32Array;

  constructor(readonly t: Terrain) {
    this.w = t.w;
    this.h = t.h;
    this.cw = t.w + 1;
    this.sizeX = t.w * CELL;
    this.sizeZ = t.h * CELL;
    this.waterLevel = t.waterLevel;
    this.c = Float32Array.from(t.corners);
    this.waterDist = waterDistance(t);
    this.wm = blurMask(t);
    this.far = farFromWater(this.wm, t.w, t.h);
  }

  /**
   * far[(iz + 1) * (w + 1) + ix + 1] = 1 when the 4 x 4 taps `cellField` reads around its (ix, iz) =
   * floor(x / CELL - 0.5), floor(z / CELL - 0.5) — cells ix - 1 … ix + 2, clamped — are all 0 in the blurred mask
   * (-1 ≤ ix < w, -1 ≤ iz < h covers every point of the map; D-280).
   */
  private readonly far: Uint8Array;

  /** Catmull-Rom sample of a cell-centred field. */
  private cellField(f: Float32Array, x: number, z: number): number {
    const gx = x / CELL - 0.5, gz = z / CELL - 0.5;
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const tx = gx - ix, tz = gz - iz;
    const W = this.w, H = this.h;
    const i0 = ix - 1 < 0 ? 0 : ix - 1 >= W ? W - 1 : ix - 1, i1 = ix < 0 ? 0 : ix >= W ? W - 1 : ix;
    const i2 = ix + 1 < 0 ? 0 : ix + 1 >= W ? W - 1 : ix + 1, i3 = ix + 2 < 0 ? 0 : ix + 2 >= W ? W - 1 : ix + 2;
    const wx0 = ((-tx + 2) * tx - 1) * tx * 0.5, wx1 = ((3 * tx - 5) * tx * tx + 2) * 0.5;
    const wx2 = ((-3 * tx + 4) * tx + 1) * tx * 0.5, wx3 = ((tx - 1) * tx * tx) * 0.5;
    let s = 0;
    for (let k = 0; k < 4; k++) {
      const j = iz - 1 + k;
      const row = (j < 0 ? 0 : j >= H ? H - 1 : j) * W;
      const r = wx0 * f[row + i0]! + wx1 * f[row + i1]! + wx2 * f[row + i2]! + wx3 * f[row + i3]!;
      const wz = k === 0 ? ((-tz + 2) * tz - 1) * tz * 0.5 : k === 1 ? ((3 * tz - 5) * tz * tz + 2) * 0.5 : k === 2 ? ((-3 * tz + 4) * tz + 1) * tz * 0.5 : ((tz - 1) * tz * tz) * 0.5;
      s += r * wz;
    }
    return s;
  }

  /**
   * Smooth signed distance to the river bank in metres (> 0 on land), valid within ~±6 m;
   * saturates further out. Includes a low-frequency wobble so the banks are not parallel.
   */
  shoreDist(x: number, z: number): number {
    // inland shortcut (D-280): when every tap of the blurred mask is 0, cellField returns ±0 (< 0.004) — skip the
    // 16-tap interpolation; the cell index is the one cellField computes, so the answer is the same
    const ix = Math.floor(x / CELL - 0.5), iz = Math.floor(z / CELL - 0.5);
    if (ix >= -1 && ix < this.w && iz >= -1 && iz < this.h && this.far[(iz + 1) * (this.w + 1) + ix + 1] === 1) return 12;
    const m = this.cellField(this.wm, x, z);
    if (m < 0.004) return 12;
    const wob = (vnoise(x / 26, z / 19, 1.5, 91) - 0.5) * 3.8 + (vnoise(x / 7.5, z / 6.5, 2.5, 92) - 0.5) * 1.1;
    // far side of the blur: push past the blend range so the profile hands over continuously
    return (0.5 - m) * 11.5 + wob + 6 * (1 - smooth(0, 0.1, m));
  }

  private hb: { min: number; max: number } | null = null;
  /**
   * Conservative bounds of `height` over the whole map (metres). Catmull-Rom weights sum to 1 with |w| summing to at
   * most 1.25 per axis, so `raw` stays within 1.5625 x the half-range of the corners around their mid; `base`
   * blends it with the bank profile (WL - 1.43 .. WL + 0.56) and `detail` adds at most +-0.22; 1 m of slack on top.
   * Used to cull wagons before sampling the ground (research 2026-11-04 "Poprawki" #2).
   */
  bounds(): { min: number; max: number } {
    if (this.hb) return this.hb;
    let lo = Infinity, hi = -Infinity;
    for (const v of this.c) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const mid = (lo + hi) / 2, half = ((hi - lo) / 2) * 1.5625;
    const WL = this.waterLevel;
    this.hb = { min: Math.min(mid - half, WL - 1.5) - 1.25, max: Math.max(mid + half, WL + 0.6) + 1.25 };
    return this.hb;
  }

  /** Smooth base surface (no noise). x, z in metres. */
  base(x: number, z: number): number {
    return this.baseAt(x, z, this.shoreDist(x, z));
  }

  /** `base` with the shore distance at (x, z) already known. */
  private baseAt(x: number, z: number, s: number): number {
    const raw = this.raw(x, z);
    if (s >= 8) return raw;
    const WL = this.waterLevel;
    // bank: gentle rise out of the water; bed: shelving down to ~1.3 m in mid-channel
    let hb = WL - 0.06 + 0.62 * Math.tanh(s / 2.6);
    if (s < 0) hb -= 0.75 * smooth(1.2, 7.5, -s);
    const k = smooth(2.5, 8, s);
    return hb + (raw - hb) * k;
  }

  /** Bicubic interpolation of the sim's corner heights. */
  raw(x: number, z: number): number {
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
    // the 4 x 4 corner taps, clamped to the map once per column and row (D-281: was 16 `corner` calls, 32 clamps)
    const W = this.w, H = this.h, CW = this.cw, c = this.c;
    const c0 = ix - 1 < 0 ? 0 : ix - 1 > W ? W : ix - 1, c1 = ix < 0 ? 0 : ix > W ? W : ix;
    const c2 = ix + 1 < 0 ? 0 : ix + 1 > W ? W : ix + 1, c3 = ix + 2 < 0 ? 0 : ix + 2 > W ? W : ix + 2;
    const r0 = (iz - 1 < 0 ? 0 : iz - 1 > H ? H : iz - 1) * CW, r1 = (iz < 0 ? 0 : iz > H ? H : iz) * CW;
    const r2 = (iz + 1 < 0 ? 0 : iz + 1 > H ? H : iz + 1) * CW, r3 = (iz + 2 < 0 ? 0 : iz + 2 > H ? H : iz + 2) * CW;
    let s = 0;
    s += (wx0 * c[r0 + c0]! + wx1 * c[r0 + c1]! + wx2 * c[r0 + c2]! + wx3 * c[r0 + c3]!) * wz0;
    s += (wx0 * c[r1 + c0]! + wx1 * c[r1 + c1]! + wx2 * c[r1 + c2]! + wx3 * c[r1 + c3]!) * wz1;
    s += (wx0 * c[r2 + c0]! + wx1 * c[r2 + c1]! + wx2 * c[r2 + c2]! + wx3 * c[r2 + c3]!) * wz2;
    s += (wx0 * c[r3 + c0]! + wx1 * c[r3 + c1]! + wx2 * c[r3 + c2]! + wx3 * c[r3 + c3]!) * wz3;
    return s;
  }

  /** Detail displacement amplitude falls off near water (keeps the shoreline calm). */
  detail(x: number, z: number): number {
    return this.detailAt(x, z, this.shoreDist(x, z));
  }

  private detailAt(x: number, z: number, s: number): number {
    const amp = smooth(3, 9.5, s);
    if (amp <= 0) return 0;
    const n = (vnoise(x / 9, z / 9, 0.5, 71) - 0.5) * 0.34 + (vnoise(x / 2.6, z / 2.6, 3.5, 72) - 0.5) * 0.09;
    return n * amp;
  }

  /** Rendered ground height at (x, z) metres. */
  height(x: number, z: number): number {
    // one shore-distance sample for both terms (D-255: it was evaluated twice per height; same value)
    const s = this.shoreDist(x, z);
    return this.baseAt(x, z, s) + this.detailAt(x, z, s);
  }

  /** Approximate surface normal (finite differences of `height`), written into out[0..2]. */
  normal(x: number, z: number, out: { x: number; y: number; z: number }, e = 0.6): void {
    const hx = this.height(x + e, z) - this.height(x - e, z);
    const hz = this.height(x, z + e) - this.height(x, z - e);
    const nx = -hx, ny = 2 * e, nz = -hz;
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz); // Math.hypot boxes its arguments
    out.x = nx / l; out.y = ny / l; out.z = nz / l;
  }

  inside(x: number, z: number): boolean {
    return x >= 0 && z >= 0 && x <= this.sizeX && z <= this.sizeZ;
  }
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** See `Heightfield.far`: per cellField (ix, iz), are all its 4 x 4 clamped mask taps exactly 0? */
function farFromWater(wm: Float32Array, W: number, H: number): Uint8Array {
  const far = new Uint8Array((W + 1) * (H + 1));
  for (let iz = -1; iz < H; iz++) for (let ix = -1; ix < W; ix++) {
    let zero = true;
    for (let k = 0; k < 4 && zero; k++) {
      const j = iz - 1 + k < 0 ? 0 : iz - 1 + k >= H ? H - 1 : iz - 1 + k;
      for (let l = 0; l < 4; l++) {
        const i = ix - 1 + l < 0 ? 0 : ix - 1 + l >= W ? W - 1 : ix - 1 + l;
        if (wm[j * W + i] !== 0) { zero = false; break; }
      }
    }
    far[(iz + 1) * (W + 1) + ix + 1] = zero ? 1 : 0;
  }
  return far;
}

/** Separable Gaussian blur (σ ≈ 1.1 cells) of the water mask. */
function blurMask(t: Terrain): Float32Array {
  const W = t.w, H = t.h;
  const R = 3, sig = 1.1;
  const k: number[] = [];
  let sum = 0;
  for (let i = -R; i <= R; i++) { const v = Math.exp(-(i * i) / (2 * sig * sig)); k.push(v); sum += v; }
  for (let i = 0; i < k.length; i++) k[i] = k[i]! / sum;
  const a = new Float32Array(W * H), b = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) a[i] = t.water[i] ? 1 : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0;
    for (let i = -R; i <= R; i++) v += a[y * W + Math.min(W - 1, Math.max(0, x + i))]! * k[i + R]!;
    b[y * W + x] = v;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0;
    for (let i = -R; i <= R; i++) v += b[Math.min(H - 1, Math.max(0, y + i)) * W + x]! * k[i + R]!;
    a[y * W + x] = v;
  }
  return a;
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
