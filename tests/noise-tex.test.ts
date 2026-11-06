// The baked shader noise (render/noiseTex.ts) blurs with a running sum since perf day 10 (D-221); the texture must
// stay byte-identical to the per-texel box sum it replaced, or every terrain / water / mist pixel would move.
import { rng } from '../src/render/models/kit';
import { noiseTexture } from '../src/render/noiseTex';
import { assert, eq, test } from './harness';

function blurWrapReference(src: Float32Array, n: number, r: number): Float32Array {
  const tmp = new Float32Array(n * n), out = new Float32Array(n * n);
  const k = 2 * r + 1;
  for (let pass = 0; pass < 2; pass++) {
    const a = pass === 0 ? src : out;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += a[y * n + ((x + i + n) % n)]!;
      tmp[y * n + x] = s / k;
    }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += tmp[((y + i + n) % n) * n + x]!;
      out[y * n + x] = s / k;
    }
  }
  return out;
}

function referenceData(): Uint8Array {
  const n = 256;
  const r = rng(9001);
  const data = new Uint8Array(n * n * 4);
  [10, 5, 2, 18].forEach((rad, ch) => {
    const white = new Float32Array(n * n);
    for (let i = 0; i < white.length; i++) white[i] = r();
    const b = blurWrapReference(white, n, rad);
    const f = blurWrapReference(white, n, Math.max(1, rad >> 2));
    for (let i = 0; i < b.length; i++) b[i] = b[i]! * 0.75 + f[i]! * 0.25 * 0.25;
    let lo = Infinity, hi = -Infinity;
    for (const v of b) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    for (let i = 0; i < b.length; i++) b[i] = (b[i]! - lo) / (hi - lo || 1);
    for (let i = 0; i < b.length; i++) data[i * 4 + ch] = Math.round(b[i]! * 255);
  });
  return data;
}

test('noise texture: running-sum blur bakes the same bytes as the per-texel box sum', () => {
  const got = noiseTexture().image.data as Uint8Array;
  const want = referenceData();
  eq(got.length, want.length, 'size');
  let diff = 0;
  for (let i = 0; i < want.length; i++) if (got[i] !== want[i]) diff++;
  assert(diff === 0, `${diff} bytes differ`);
});
