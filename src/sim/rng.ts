// sfc32 PRNG. The 4-word state lives inside SimState so saves continue identically.

export type RngState = [number, number, number, number];

export function seedRng(seed: number): RngState {
  // splitmix32 to spread the seed
  let x = seed >>> 0;
  const out: number[] = [];
  for (let i = 0; i < 4; i++) {
    x = (x + 0x9e3779b9) >>> 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    z = (z ^ (z >>> 16)) >>> 0;
    out.push(z);
  }
  const st = out as RngState;
  for (let i = 0; i < 12; i++) nextU32(st);
  return st;
}

/** Advances the state in place and returns a uint32. */
export function nextU32(s: RngState): number {
  let a = s[0], b = s[1], c = s[2], d = s[3];
  const t = (((a + b) >>> 0) + d) >>> 0;
  d = (d + 1) >>> 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) >>> 0;
  c = ((c << 21) | (c >>> 11)) >>> 0;
  c = (c + t) >>> 0;
  s[0] = a >>> 0; s[1] = b >>> 0; s[2] = c; s[3] = d;
  return t;
}

/** Float in [0, 1). */
export function nextFloat(s: RngState): number {
  return nextU32(s) / 4294967296;
}

/** Integer in [lo, hi]. */
export function nextInt(s: RngState, lo: number, hi: number): number {
  return lo + Math.floor(nextFloat(s) * (hi - lo + 1));
}

/** Stateless hash noise for terrain: integer lattice -> [0,1). */
export function hash2(seed: number, x: number, y: number): number {
  let h = (seed ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return h / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Smooth value noise in [0,1) using only polynomial interpolation (deterministic everywhere). */
export function valueNoise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const a = hash2(seed, x0, y0), b = hash2(seed, x0 + 1, y0);
  const c = hash2(seed, x0, y0 + 1), d = hash2(seed, x0 + 1, y0 + 1);
  const ab = a + (b - a) * fx, cd = c + (d - c) * fx;
  return ab + (cd - ab) * fy;
}

/** Fractal value noise, 3 octaves, roughly in [0,1). */
export function fbm(seed: number, x: number, y: number): number {
  return (valueNoise(seed, x, y) * 0.57 + valueNoise(seed + 17, x * 2.03, y * 2.03) * 0.29 + valueNoise(seed + 31, x * 4.1, y * 4.1) * 0.14);
}
