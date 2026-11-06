// Tileable multi-scale value noise baked once into a 256² RGBA texture for shaders
// (macro variation, edge breakup, puddles). Cheaper than ALU noise on mobile GPUs.
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, UnsignedByteType } from 'three';
import { rng } from './models/kit';

let tex: DataTexture | null = null;

/**
 * Two passes of a wrapping box blur of radius r (horizontal then vertical each pass), as a running sum:
 * O(n²) per pass instead of O(n²·r). Same Float32 output as the per-texel sum it replaced
 * (`blurWrapReference` in tests/noise-tex.test.ts: the baked texture is byte-identical).
 */
function blurWrap(src: Float32Array, n: number, r: number): Float32Array {
  const tmp = new Float32Array(n * n), out = new Float32Array(n * n);
  const k = 2 * r + 1;
  for (let pass = 0; pass < 2; pass++) {
    const a = pass === 0 ? src : out;
    for (let y = 0; y < n; y++) {
      const row = y * n;
      let s = 0;
      for (let i = -r; i <= r; i++) s += a[row + ((i + n) % n)]!;
      for (let x = 0; x < n; x++) {
        tmp[row + x] = s / k;
        s += a[row + ((x + r + 1) % n)]! - a[row + ((x - r + n) % n)]!;
      }
    }
    for (let x = 0; x < n; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += tmp[((i + n) % n) * n + x]!;
      for (let y = 0; y < n; y++) {
        out[y * n + x] = s / k;
        s += tmp[((y + r + 1) % n) * n + x]! - tmp[((y - r + n) % n) * n + x]!;
      }
    }
  }
  return out;
}

function normalise(a: Float32Array): void {
  let lo = Infinity, hi = -Infinity;
  for (const v of a) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let i = 0; i < a.length; i++) a[i] = (a[i]! - lo) / (hi - lo || 1);
}

export function noiseTexture(): DataTexture {
  if (tex) return tex;
  const n = 256;
  const r = rng(9001);
  const radii = [10, 5, 2, 18];
  const data = new Uint8Array(n * n * 4);
  radii.forEach((rad, ch) => {
    const white = new Float32Array(n * n);
    for (let i = 0; i < white.length; i++) white[i] = r();
    const b = blurWrap(white, n, rad);
    // add a finer octave for texture
    const f = blurWrap(white, n, Math.max(1, rad >> 2));
    for (let i = 0; i < b.length; i++) b[i] = b[i]! * 0.75 + f[i]! * 0.25 * 0.25;
    normalise(b);
    for (let i = 0; i < b.length; i++) data[i * 4 + ch] = Math.round(b[i]! * 255);
  });
  tex = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
