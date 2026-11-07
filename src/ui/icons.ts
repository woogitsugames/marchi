/**
 * MARCHIA icon set — drawn for this game in a woodcut / engraving idiom.
 *
 * Every icon is built on a 24 x 24 grid from filled polygons only (no strokes):
 *  - a firm ink silhouette with a slightly uneven, hand-cut contour,
 *  - white "gouge" cuts for detail and parallel white-line hatching on the lit side
 *    (light from the upper left), or thin ink hatching where the form sits on paper.
 *
 * Shared weights keep the set consistent: hatch pitch HATCH_PITCH, cut width CUT_W,
 * outline weight LINE_W. Geometry is generated once at module load from the drawing
 * functions below (deterministic: the contour jitter is seeded by the icon id).
 *
 * Fill rule: each layer is one <path> with the nonzero rule; ink polygons wind one way,
 * cuts wind the other way, so a cut removes ink only where a single ink polygon lies.
 */

export type IconId =
  // goods
  | 'wood'
  | 'planks'
  | 'grain'
  | 'flour'
  | 'bread'
  | 'fish'
  | 'stone'
  | 'charcoal'
  | 'malt'
  | 'beer'
  // buildings
  | 'woodcutter'
  | 'sawmill'
  | 'farm'
  | 'mill'
  | 'bakery'
  | 'warehouse'
  | 'stable'
  | 'castle'
  | 'fisher'
  | 'quarry'
  | 'charcoalBurner'
  | 'malthouse'
  | 'brewery'
  // free valley late game (D-170): the trading post across the river
  | 'tradePost'
  // stall reasons
  | 'no_road'
  | 'no_wagon'
  | 'bridge_jam'
  | 'output_full'
  | 'waiting'
  | 'no_input'
  | 'strike'
  | 'no_route'
  | 'storage_full'
  // free valley bottleneck card (D-171)
  | 'bottleneck'
  // tools / UI
  | 'road_dirt'
  | 'road_cobble'
  | 'demolish'
  | 'buy_wagon'
  | 'inspect'
  | 'eye'
  | 'overlay_load'
  | 'pause'
  | 'speed1'
  | 'speed2'
  | 'speed4'
  | 'close'
  | 'menu'
  | 'coin'
  | 'seal'
  | 'wagon'
  | 'sun'
  | 'rain'
  | 'back'
  | 'snow'
  | 'follow'
  // free valley / building (UI round 3)
  | 'build'
  | 'rotate'
  | 'undo'
  | 'bridge_ice'
  // valley chains (UI round 5)
  | 'contested'
  // two castles (D-289): the castle's pennant, "this castle first"
  | 'first';

// ---------------------------------------------------------------------------
// Geometry kit
// ---------------------------------------------------------------------------

type Pt = readonly [number, number];
type Poly = Pt[];
type WidthFn = (t: number) => number;

const HATCH_PITCH = 1.9;
const CUT_W = 0.8;
const LINE_W = 1.5;
const ROUGH = 0.11;
const DEG = Math.PI / 180;

function rng(seedText: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function area(p: Poly): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i]!;
    const [x2, y2] = p[(i + 1) % p.length]!;
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

function orient(p: Poly, positive: boolean): Poly {
  return area(p) > 0 === positive ? p : [...p].reverse();
}

/** Subdivide long edges and jitter vertices: the hand-cut contour. */
function roughen(p: Poly, r: () => number, amp: number, maxLen = 2.4): Poly {
  if (amp <= 0) return p;
  const out: Pt[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / maxLen));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push([
        a[0] + (b[0] - a[0]) * t + (r() * 2 - 1) * amp,
        a[1] + (b[1] - a[1]) * t + (r() * 2 - 1) * amp,
      ]);
    }
  }
  return out;
}

function rect(x: number, y: number, w: number, h: number): Poly {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

/** Points on an ellipse arc; angles in degrees, 0 = +x, 90 = down (screen space). */
function arcPts(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n?: number, rot = 0): Pt[] {
  const steps = n ?? Math.max(4, Math.ceil((Math.abs(a1 - a0) / 360) * Math.max(rx, ry) * 7));
  const out: Pt[] = [];
  const cr = Math.cos(rot * DEG);
  const sr = Math.sin(rot * DEG);
  for (let i = 0; i <= steps; i++) {
    const a = (a0 + ((a1 - a0) * i) / steps) * DEG;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
  }
  return out;
}

function ell(cx: number, cy: number, rx: number, ry: number, rot = 0): Poly {
  const pts = arcPts(cx, cy, rx, ry, 0, 360, Math.max(12, Math.ceil(Math.max(rx, ry) * 5)), rot);
  pts.pop();
  return pts;
}

function circ(cx: number, cy: number, r: number): Poly {
  return ell(cx, cy, r, r);
}

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 12): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

function quad(p0: Pt, p1: Pt, p2: Pt, n = 10): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
  }
  return out;
}

function seg(a: Pt, b: Pt, n = 6): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) out.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
  return out;
}

/** Width profile helpers for bands. */
const taper = (mid: number, end: number): WidthFn => (t) => end + (mid - end) * Math.sin(Math.PI * t);
const lerpW = (w0: number, w1: number): WidthFn => (t) => w0 + (w1 - w0) * t;

/** A thick line along a polyline turned into one filled polygon. */
function band(pts: Pt[], w: number | WidthFn): Poly {
  const wf: WidthFn = typeof w === 'number' ? () => w : w;
  const lens = [0];
  for (let i = 1; i < pts.length; i++) {
    lens.push(lens[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  }
  const total = lens[lens.length - 1]! || 1;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const hw = wf(lens[i]! / total) / 2;
    const p = pts[i]!;
    left.push([p[0] - ty * hw, p[1] + tx * hw]);
    right.push([p[0] + ty * hw, p[1] - tx * hw]);
  }
  return [...left, ...right.reverse()];
}

/** Inward offset of a (mostly convex) polygon. */
function shrink(p: Poly, d: number): Poly {
  const s = area(p) > 0 ? 1 : -1;
  const n = p.length;
  const out: Pt[] = [];
  const off = (i: number): [Pt, Pt] => {
    const a = p[i]!;
    const b = p[(i + 1) % n]!;
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    // inward normal for positive (screen-clockwise) orientation is (-dy, dx)
    const nx = -dy * s * d;
    const ny = dx * s * d;
    return [
      [a[0] + nx, a[1] + ny],
      [b[0] + nx, b[1] + ny],
    ];
  };
  for (let i = 0; i < n; i++) {
    const [a1, b1] = off((i - 1 + n) % n);
    const [a2, b2] = off(i);
    const d1x = b1[0] - a1[0];
    const d1y = b1[1] - a1[1];
    const d2x = b2[0] - a2[0];
    const d2y = b2[1] - a2[1];
    const den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-6) {
      out.push(a2);
    } else {
      const t = ((a2[0] - a1[0]) * d2y - (a2[1] - a1[1]) * d2x) / den;
      out.push([a1[0] + d1x * t, a1[1] + d1y * t]);
    }
  }
  return out;
}

/** Keep the part of a polygon where a*x + b*y <= c (Sutherland–Hodgman). */
function clipHalf(p: Poly, a: number, b: number, c: number): Poly {
  const out: Pt[] = [];
  const inside = (q: Pt) => a * q[0] + b * q[1] <= c;
  for (let i = 0; i < p.length; i++) {
    const cur = p[i]!;
    const prev = p[(i - 1 + p.length) % p.length]!;
    const ci = inside(cur);
    const pi = inside(prev);
    if (ci !== pi) {
      const fp = a * prev[0] + b * prev[1] - c;
      const fc = a * cur[0] + b * cur[1] - c;
      const t = fp / (fp - fc);
      out.push([prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t]);
    }
    if (ci) out.push(cur);
  }
  return out;
}

/** Parallel hatch segments clipped to a polygon region. */
function hatchSegs(region: Poly, angleDeg: number, pitch: number, phase = 0.5): [Pt, Pt][] {
  const ux = Math.cos(angleDeg * DEG);
  const uy = Math.sin(angleDeg * DEG);
  const nx = -uy;
  const ny = ux;
  let lo = Infinity;
  let hi = -Infinity;
  for (const q of region) {
    const v = q[0] * nx + q[1] * ny;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const segs: [Pt, Pt][] = [];
  for (let t = lo + pitch * phase; t < hi; t += pitch) {
    const hits: number[] = [];
    for (let i = 0; i < region.length; i++) {
      const a = region[i]!;
      const b = region[(i + 1) % region.length]!;
      const va = a[0] * nx + a[1] * ny - t;
      const vb = b[0] * nx + b[1] * ny - t;
      if ((va < 0 && vb >= 0) || (va >= 0 && vb < 0)) {
        const k = va / (va - vb);
        const x = a[0] + (b[0] - a[0]) * k;
        const y = a[1] + (b[1] - a[1]) * k;
        hits.push(x * ux + y * uy);
      }
    }
    hits.sort((m, n) => m - n);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      const s0 = hits[i]!;
      const s1 = hits[i + 1]!;
      if (s1 - s0 < 0.7) continue;
      segs.push([
        [nx * t + ux * s0, ny * t + uy * s0],
        [nx * t + ux * s1, ny * t + uy * s1],
      ]);
    }
  }
  return segs;
}

/** A gouge stroke: pointed at both ends, full width in the middle. */
function gouge(a: Pt, b: Pt, w: number): Poly {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const hw = w / 2;
  const tp = Math.min(l / 3, w * 0.9);
  return [
    a,
    [a[0] + ux * tp - uy * hw, a[1] + uy * tp + ux * hw],
    [b[0] - ux * tp - uy * hw, b[1] - uy * tp + ux * hw],
    b,
    [b[0] - ux * tp + uy * hw, b[1] - uy * tp - ux * hw],
    [a[0] + ux * tp + uy * hw, a[1] + uy * tp - ux * hw],
  ];
}

type Xf = (p: Pt) => Pt;
const idXf: Xf = (p) => p;
const scaleAt =
  (s: number, ox: number, oy: number, dx = 0, dy = 0): Xf =>
  (p) => [ox + (p[0] - ox) * s + dx, oy + (p[1] - oy) * s + dy];

interface Piece {
  poly: Poly;
  ink: boolean;
}

class Draw {
  readonly layers: Piece[][] = [[]];
  xf: Xf = idXf;
  constructor(private readonly r: () => number) {}

  layer(): this {
    if (this.cur.length) this.layers.push([]);
    return this;
  }
  private get cur(): Piece[] {
    return this.layers[this.layers.length - 1]!;
  }
  private put(p: Poly, ink: boolean, amp: number): void {
    if (p.length < 3) return;
    const t = p.map(this.xf);
    this.cur.push({ poly: orient(roughen(t, this.r, amp), ink), ink });
  }
  ink(...ps: Poly[]): this {
    for (const p of ps) this.put(p, true, ROUGH);
    return this;
  }
  /** ink with a finer jitter: for thin bands where a full jitter would wobble. */
  inkFine(...ps: Poly[]): this {
    for (const p of ps) this.put(p, true, ROUGH * 0.45);
    return this;
  }
  cut(...ps: Poly[]): this {
    for (const p of ps) this.put(p, false, ROUGH * 0.45);
    return this;
  }
  /** White-line hatching (cuts) inside a region of ink. */
  hatchCut(region: Poly, angle = -45, pitch = HATCH_PITCH, w = CUT_W, phase = 0.5): this {
    for (const [a, b] of hatchSegs(region, angle, pitch, phase)) this.put(gouge(a, b, w), false, 0);
    return this;
  }
  /** Ink hatching on paper. */
  hatchInk(region: Poly, angle = -45, pitch = HATCH_PITCH, w = 0.7, phase = 0.5): this {
    for (const [a, b] of hatchSegs(region, angle, pitch, phase)) this.put(gouge(a, b, w), true, 0);
    return this;
  }
  /** Outline ring of a closed shape: ink shape minus its inset. */
  outline(p: Poly, w = LINE_W): this {
    this.ink(p);
    this.cut(shrink(p, w));
    return this;
  }
  with(xf: Xf, fn: () => void): this {
    const prev = this.xf;
    this.xf = (p) => prev(xf(p));
    fn();
    this.xf = prev;
    return this;
  }
}

// ---------------------------------------------------------------------------
// Shared motifs
// ---------------------------------------------------------------------------

/** Spoked cart wheel. */
function wheel(d: Draw, cx: number, cy: number, r: number, spokes = 6): void {
  d.layer();
  d.ink(circ(cx, cy, r));
  d.cut(circ(cx, cy, r - Math.max(0.9, r * 0.24)));
  const inner = r - Math.max(0.9, r * 0.24) + 0.2;
  for (let i = 0; i < spokes; i++) {
    const a = (i * 360) / spokes + 15;
    const c = Math.cos(a * DEG);
    const s = Math.sin(a * DEG);
    d.inkFine(band(seg([cx, cy], [cx + c * inner, cy + s * inner], 3), Math.max(0.6, r * 0.18)));
  }
  d.ink(circ(cx, cy, Math.max(0.8, r * 0.26)));
}

/** Empty two-wheeled cart with shafts, side view (~x 1..22, y 7..21). */
function cart(d: Draw): void {
  d.layer();
  // slatted box
  const box: Poly = [
    [6, 7.6],
    [21.6, 7.6],
    [20.9, 13.6],
    [6.6, 13.6],
  ];
  d.ink(box);
  for (const x of [9.2, 12.3, 15.4, 18.5]) d.cut(gouge([x, 9], [x - 0.08, 12.4], 1.1));
  d.cut(gouge([7.4, 10.6], [20.3, 10.6], 0.55));
  // shafts
  d.inkFine(band(quad([7, 12.4], [3.5, 13.2], [0.8, 15.4], 6), lerpW(1.3, 0.7)));
  wheel(d, 13.8, 16.5, 4.6);
}

/** Dirt track in perspective. */
function dirtTrack(d: Draw): void {
  const vp: Pt = [12, -14];
  const at = (x0: number, y: number): Pt => [x0 + (vp[0] - x0) * ((22 - y) / (22 - vp[1])), y];
  // ruts
  d.ink(band(seg(at(6.2, 22), at(6.2, 3), 8), lerpW(3, 0.9)));
  d.ink(band(seg(at(17.8, 22), at(17.8, 3), 8), lerpW(3, 0.9)));
  // verges
  d.inkFine(band(seg(at(1, 22), at(1, 5), 6), lerpW(0.9, 0.5)));
  d.inkFine(band(seg(at(23, 22), at(23, 5), 6), lerpW(0.9, 0.5)));
  // grassy crown between the ruts: short horizontal hatch
  const crown: Poly = [at(9, 21.5), at(15, 21.5), at(15, 6), at(9, 6)];
  for (const [a, b] of hatchSegs(crown, 0, 2.6, 0.4)) {
    const mx = (a[0] + b[0]) / 2;
    const half = Math.min(1.1, (b[0] - a[0]) / 3);
    d.ink(gouge([mx - half, a[1]], [mx + half, a[1]], 0.75));
  }
  // puddle in the near rut
  d.cut(ell(6.6, 18.2, 0.9, 0.45));
}

function strikeBar(d: Draw): void {
  d.layer();
  d.ink(band(cubic([3.4, 2.8], [8.5, 8.6], [14, 14.6], [20.8, 21.2], 12), taper(2.5, 1.2)));
}

const STRIKE_A: Pt = [3.4, 2.8];
const STRIKE_B: Pt = [20.8, 21.2];

// ---------------------------------------------------------------------------
// Drawings
// ---------------------------------------------------------------------------

const DEFS: Record<IconId, (d: Draw) => void> = {
  // ---- goods -------------------------------------------------------------
  wood(d) {
    const cy = 12.8;
    const ry = 6.1;
    const ex = 17.6;
    const erx = 3.4;
    // bark body: rounded far end, concave near end hugging the end-grain face
    d.ink([
      ...arcPts(4.6, cy, 2.2, ry, 90, 270, 10),
      [10.5, cy - ry - 0.2],
      ...arcPts(ex, cy, erx, ry, -90, -270, 14),
      [10.5, cy + ry + 0.2],
    ]);
    // branch stub
    d.ink([
      [8.2, 7.6],
      [8.6, 5.2],
      [10.6, 4.8],
      [11.2, 7.4],
    ]);
    // bark gouges
    d.cut(gouge([4, 9.9], [9.4, 9.5], 0.85), gouge([10.6, 9.6], [14.2, 9.9], 0.85));
    d.cut(gouge([3.2, 12.7], [7.6, 12.9], 0.85), gouge([8.8, 12.8], [14.1, 12.5], 0.85));
    d.cut(gouge([4.2, 15.6], [11.6, 15.9], 0.85), gouge([12.6, 15.8], [14.5, 15.6], 0.7));
    d.cut(ell(9.6, 6.6, 0.75, 0.5));
    // end grain
    d.layer();
    d.ink(ell(ex, cy, erx, ry));
    d.cut(ell(ex, cy, erx - 0.95, ry - 1.1));
    d.ink(ell(ex + 0.1, cy, erx - 1.85, ry - 2.3));
    d.cut(ell(ex + 0.1, cy, erx - 2.55, ry - 3.3));
    d.ink(ell(ex + 0.15, cy + 0.1, 0.4, 0.55));
  },

  planks(d) {
    const bars: [number, number, number][] = [
      [7.6, 22.2, 4.4],
      [4.8, 19.4, 9.6],
      [1.8, 16.6, 14.8],
    ];
    for (const [x0, x1, y0] of bars) {
      const h = 3.7;
      d.ink([
        [x0, y0],
        [x1 - 1, y0],
        [x1, y0 + 0.8],
        [x1, y0 + h],
        [x0, y0 + h],
      ]);
      d.cut(gouge([x0 + 1, y0 + h * 0.52], [x1 - 3.4, y0 + h * 0.48], 0.75));
      d.cut(gouge([x1 - 1.9, y0 + 1.2], [x1 - 1.9, y0 + h - 0.6], 0.7));
    }
    // ground shadow
    d.hatchInk([[1.8, 19.8], [16.6, 19.8], [17.6, 21.6], [2.6, 21.6]], 0, 1.5, 0.6, 0.3);
  },

  grain(d) {
    // stalk bundle
    d.ink([
      [9.4, 13.2],
      [14.6, 13.2],
      [13.5, 16.4],
      [16.8, 21.7],
      [7.2, 21.7],
      [10.5, 16.4],
    ]);
    d.cut(gouge([9.9, 14.2], [14.1, 14.2], 0.6), gouge([10.3, 16.2], [13.7, 16.2], 0.6));
    for (const [x0, x1] of [
      [11.2, 9.6],
      [12, 12],
      [12.8, 14.4],
    ] as const) {
      d.cut(gouge([x0, 17.2], [x1, 21], 0.6));
    }
    // fan of ears
    const o: Pt = [12, 13.6];
    for (const a of [-140, -115, -90, -65, -40]) {
      const c = Math.cos(a * DEG);
      const s = Math.sin(a * DEG);
      d.inkFine(band(seg(o, [o[0] + c * 5.6, o[1] + s * 5.6], 3), 1));
      d.ink(ell(o[0] + c * 8, o[1] + s * 8, 2.9, 1.35, a));
      d.cut(gouge([o[0] + c * 6.4, o[1] + s * 6.4], [o[0] + c * 9.7, o[1] + s * 9.7], 0.55));
      // awn
      d.inkFine(band(seg([o[0] + c * 10.6, o[1] + s * 10.6], [o[0] + c * 11.9, o[1] + s * 11.9], 2), lerpW(0.6, 0.25)));
    }
  },

  flour(d) {
    // squat body
    d.ink([
      ...arcPts(6.4, 18.8, 2.6, 2.6, 90, 180, 5),
      [4, 12.4],
      ...arcPts(6.8, 12.2, 2.8, 2.4, 180, 250, 4),
      [10.2, 8.4],
      [13.8, 8.4],
      ...arcPts(17.2, 12.2, 2.8, 2.4, 290, 360, 4),
      [20, 12.4],
      ...arcPts(17.6, 18.8, 2.6, 2.6, 0, 90, 5),
    ]);
    // tie and tuft
    d.ink(rect(9.6, 6.4, 4.8, 1.6));
    d.ink([
      [10.2, 6.5],
      [8.4, 3.6],
      [10.5, 4.3],
      [12, 2.4],
      [13.5, 4.3],
      [15.6, 3.6],
      [13.8, 6.5],
    ]);
    d.cut(gouge([10, 8.25], [14, 8.25], 0.5));
    // folds from the neck
    d.cut(gouge([10.4, 9.6], [7.2, 12.2], 0.7), gouge([13.6, 9.6], [16.8, 12.2], 0.7));
    // lit side hatching
    d.hatchCut(clipHalf(rect(5.6, 12.4, 12.8, 7), 1, 1, 24.5), -45);
    // seam
    d.cut(gouge([6, 20.1], [18, 20.1], 0.55));
  },

  bread(d) {
    d.ink([
      ...arcPts(12, 15.6, 9.3, 8.2, 180, 360, 20),
      [21.3, 16.4],
      [20.4, 18.8],
      [18.8, 19.7],
      [5.2, 19.7],
      [3.6, 18.8],
      [2.7, 16.4],
    ]);
    // three scored cuts
    for (const cx of [7.4, 12, 16.6]) {
      const cyy = cx === 12 ? 11.4 : 12.4;
      const a = -58 * DEG;
      const h = 2.9;
      d.cut(band(seg([cx - Math.cos(a) * h, cyy - Math.sin(a) * h], [cx + Math.cos(a) * h, cyy + Math.sin(a) * h], 8), taper(1.7, 0.15)));
    }
    // crust foot line
    d.cut(gouge([4.4, 17.3], [19.6, 17.3], 0.75));
  },

  // ---- D-29 chain goods ----------------------------------------------------
  fish(d) {
    // body: blunt head at the left, deep back, narrowing to the tail root
    const body: Poly = [
      ...cubic([2, 12.6], [3.2, 8.6], [8.6, 6.8], [12.6, 7.4], 10),
      ...cubic([12.6, 7.4], [15.4, 7.9], [16.8, 10], [17.8, 11.6], 6).slice(1),
      [17.8, 13.4],
      ...cubic([17.8, 13.4], [15.6, 16], [11, 17.6], [7.4, 16.8], 8).slice(1),
      ...cubic([7.4, 16.8], [4.8, 16.2], [2.8, 14.8], [2, 13.2], 6).slice(1),
    ];
    d.ink(body);
    // forked tail
    d.ink([
      [16.8, 12.5],
      [22.6, 6.6],
      [21.4, 10.4],
      [20.4, 12.5],
      [21.4, 14.6],
      [22.6, 18.4],
    ]);
    // dorsal and belly fins
    d.ink([[8.6, 7.6], [10.4, 4.2], [12.2, 4.8], [14.6, 8.2]]);
    d.ink([[10, 16.6], [11.2, 19.6], [12.8, 19.2], [13.2, 16.4]]);
    // eye, mouth, gill arc, lateral line
    d.cut(circ(5.4, 11.2, 1));
    d.ink(circ(5.5, 11.3, 0.42));
    d.cut(gouge([2.3, 13], [4.4, 13.3], 0.55));
    d.cut(band(arcPts(5.2, 12.2, 3, 4.2, -55, 60, 8), taper(0.8, 0.25)));
    d.cut(gouge([9.4, 12.6], [17, 12.5], 0.5));
    // scales: short white arcs in rows on the lit back
    for (const [y, x0, x1] of [
      [9.6, 9.4, 15.2],
      [11.2, 9, 16.4],
    ] as const) {
      for (let x = x0; x <= x1; x += 1.9) d.cut(band(arcPts(x, y, 0.8, 0.8, 100, 260, 4), taper(0.55, 0.2)));
    }
    // fin rays
    d.cut(gouge([10.6, 6.4], [11.2, 7.6], 0.4), gouge([12.2, 6.2], [12.6, 7.6], 0.4));
  },

  stone(d) {
    // a rough-hewn block in three-quarter view: lit top, chiselled left face, dark right face
    const top: Pt[] = [[3.2, 8.4], [13.2, 4.8], [21.2, 8.2], [11.2, 12]];
    d.ink([[3.2, 8.4], [13.2, 4.8], [21.2, 8.2], [21, 17.8], [11, 21.6], [3.4, 17.6]]);
    // edges between the faces
    d.cut(gouge([3.8, 8.8], [11.2, 12.2], 0.6), gouge([11.2, 12.2], [20.6, 8.6], 0.6));
    d.cut(gouge([11.2, 12.6], [11, 20.8], 0.6));
    // top face: close white hatching (lit)
    d.hatchCut(shrink(top, 0.9), 22, 1.4, 0.65);
    // left face: chisel strokes
    for (const [x, y] of [
      [5.4, 12.2],
      [8, 13.6],
      [5.6, 15.6],
      [8.4, 17.2],
    ] as const) {
      d.cut(gouge([x, y], [x + 1.6, y + 0.9], 0.6));
    }
    // a split-off chip on the ground
    d.ink([[17.4, 20.6], [19.8, 19.6], [21.6, 20.6], [20.6, 22], [17.8, 22]]);
    d.cut(gouge([18.4, 20.8], [20.2, 20.2], 0.4));
  },

  charcoal(d) {
    // heap of angular lumps, each with a glint cut on its upper-left facet
    const lumps: Poly[] = [
      [[1.6, 21.6], [2.2, 17.6], [5.2, 15.8], [8.2, 17], [8.6, 21.6]],
      [[9.4, 21.6], [9.2, 17.8], [11.8, 15.6], [15, 16.4], [15.6, 21.6]],
      [[16.4, 21.6], [16.2, 17.2], [19.2, 15.4], [22.2, 17.4], [22.4, 21.6]],
      [[4.6, 15], [5.6, 11.4], [8.8, 10], [11.2, 12], [10.6, 15]],
      [[12, 15], [12.4, 11.6], [15.4, 10.2], [18.4, 12.2], [18, 15]],
      [[8.2, 9.4], [9.6, 5.4], [12.8, 4.2], [15.4, 6.4], [14.6, 9.4]],
    ];
    for (const l of lumps) {
      d.ink(l);
      const [a, b] = [l[1]!, l[2]!];
      d.cut([
        [a[0] + 0.7, a[1] + 0.6],
        [b[0] + 0.1, b[1] + 0.9],
        [a[0] + (b[0] - a[0]) * 0.4 + 0.6, a[1] + 2.1],
      ]);
    }
    // ground
    d.hatchInk([[1, 22.4], [23, 22.4], [23, 23.4], [1, 23.4]], 0, 1.2, 0.6);
  },

  malt(d) {
    // heap of malted grain on the kiln floor, its crest broken into grains; a malt shovel stuck in it
    const crest: Pt[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const x = 1.8 + t * 20.4;
      const y = 21.4 - Math.sin(Math.PI * t) * 9.4;
      crest.push([x, y + (i % 2 ? 0.55 : -0.25)]);
    }
    d.ink([...crest, [22.4, 21.6], [1.6, 21.6]]);
    // white seeds: rows of small slanted grains
    let row = 0;
    for (let y = 19.8; y > 13.2; y -= 1.7, row++) {
      const half = Math.max(0, (Math.asin(Math.min(1, (21.4 - y) / 9.4)) / Math.PI) * 20.4);
      const x0 = 1.8 + half + 1.3, x1 = 22.2 - half - 1.3;
      for (let x = x0 + (row % 2) * 0.9; x <= x1; x += 1.85) d.cut(ell(x, y, 0.64, 0.32, row % 2 ? 30 : -30));
    }
    // a few loose grains with rootlets on the floor
    for (const [x, a] of [
      [3.2, -20],
      [20.6, 25],
    ] as const) {
      d.ink(ell(x, 22.6, 0.7, 0.36, a));
    }
    // malt shovel: handle out of the crest, T-grip
    d.layer();
    d.ink(band(seg([14.4, 12.6], [19.6, 2.6], 4), lerpW(1.5, 1.2)));
    d.ink(band(seg([18, 2.2], [21.6, 3.6], 2), 1.3));
    d.cut(gouge([15.6, 10.6], [18.6, 4.8], 0.4));
  },

  beer(d) {
    // stave tankard with two hoops, a handle, and a head of foam over the rim
    d.ink([
      [5.6, 9],
      [16.4, 9],
      [17, 21.6],
      [5, 21.6],
    ]);
    for (const y of [11.2, 18.6]) d.cut(gouge([5.6, y], [16.6, y], 0.6), gouge([5.6, y + 1.3], [16.7, y + 1.3], 0.6));
    for (const x of [7.6, 9.8]) d.cut(gouge([x, 13.2], [x - 0.15, 17.6], 0.6));
    // handle
    d.ink(band(cubic([16.4, 11], [22.4, 10.4], [22.4, 18], [16.8, 18], 10), 1.9));
    // foam: bumpy crown spilling over the rim on one side
    d.ink([
      [4.4, 9.8],
      ...arcPts(6.4, 7.4, 2.4, 2.4, 160, 290, 6),
      ...arcPts(10.6, 5.4, 3, 2.8, 210, 330, 6),
      ...arcPts(15, 6.6, 2.6, 2.4, 250, 380, 6),
      [17.4, 9.8],
      [16.6, 10.4],
      [6.2, 10.4],
      [5.6, 12.8],
      [4.4, 12.6],
    ]);
    d.cut(circ(8.4, 6.6, 0.7), circ(12, 4.6, 0.55), circ(14.6, 7, 0.6), circ(10.6, 8, 0.45));
    d.cut(gouge([6, 9.8], [16.6, 9.8], 0.5));
  },

  // ---- buildings ---------------------------------------------------------
  woodcutter(d) {
    // stump
    d.ink([
      [5.8, 14.6],
      ...arcPts(12, 14.6, 6.2, 1.9, 180, 360, 10),
      [18.2, 14.6],
      [18.4, 19],
      [20.8, 21.7],
      [16, 21.1],
      [12, 21.8],
      [8, 21.1],
      [3.2, 21.7],
      [5.6, 19],
    ]);
    d.cut(ell(12, 14.7, 5.2, 1.15));
    for (const x of [7.6, 10.6, 13.6, 16.4]) d.cut(gouge([x, 17], [x + (x < 12 ? -0.3 : 0.3), 20.4], 0.7));
    // axe head bitten into the stump
    d.layer();
    d.ink([
      [7.4, 15.3],
      [12.6, 15.3],
      [13.3, 12.4],
      [11.8, 10.6],
      [9.4, 11.8],
      [7.8, 12.9],
    ]);
    d.cut(gouge([8.6, 14.1], [12.2, 13.9], 0.55));
    // haft
    d.ink(band(quad([12.2, 12.2], [15.8, 8.6], [19.8, 3.6], 8), lerpW(1.8, 1.4)));
    d.ink(circ(19.9, 3.4, 1.05));
    d.cut(gouge([13.6, 10.1], [17.8, 5.6], 0.45));
  },

  sawmill(d) {
    // the beam being sawn, with a kerf
    d.ink([
      [1.6, 17.6],
      [21.2, 17.6],
      [22.4, 18.6],
      [22.4, 21.8],
      [1.6, 21.8],
    ]);
    d.cut(gouge([2.6, 19.8], [12.2, 19.6], 0.7), gouge([20.6, 18.2], [20.6, 21.2], 0.6));
    d.cut(rect(14.1, 17.4, 1.1, 2.2));
    // sawdust
    d.ink(circ(12.6, 16.4, 0.5), circ(16.8, 16.2, 0.45), circ(11.2, 15.4, 0.4));
    // hand saw: tapered blade with large teeth
    d.layer();
    const blade: Pt[] = [
      [7.2, 3.6],
      [22.6, 10.6],
      [22, 12.6],
    ];
    const heel: Pt = [5.6, 9.2];
    const toe: Pt = [22, 12.6];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 0.55) / n;
      const p0: Pt = [toe[0] + (heel[0] - toe[0]) * t0, toe[1] + (heel[1] - toe[1]) * t0];
      const p1: Pt = [toe[0] + (heel[0] - toe[0]) * t1, toe[1] + (heel[1] - toe[1]) * t1];
      blade.push(p0, [p1[0] + 0.35, p1[1] + 1.7]);
    }
    blade.push(heel);
    d.ink(blade);
    d.hatchCut([[9.4, 5.6], [19.8, 10.4], [18.6, 11.2], [9, 7.4]], -45, HATCH_PITCH, 0.6);
    // open handle
    d.ink([
      [1.4, 4.6],
      [4.4, 2.2],
      [8.4, 3.2],
      [7, 9.8],
      [5.4, 11.4],
      [2, 10.8],
    ]);
    d.cut(ell(4.6, 6.6, 1.25, 2.2, 15));
    d.cut(gouge([6.8, 4.6], [6, 8.8], 0.4));
  },

  farm(d) {
    // barn behind the field
    d.ink([
      [12.6, 14],
      [12.6, 9.4],
      [11, 9.6],
      [16.6, 3.6],
      [22.2, 9.6],
      [20.6, 9.4],
      [20.6, 14],
    ]);
    d.cut(rect(15.4, 10.9, 2.4, 2.9));
    d.hatchCut(shrink([[12.4, 9.1], [16.6, 4.7], [20.8, 9.1]], 0.9), -90, 1.6, 0.6);
    d.cut(gouge([12.8, 9.9], [20.4, 9.9], 0.5));
    // a lone tree on the left horizon
    d.ink(ell(5, 9.4, 2.6, 3.3));
    d.inkFine(band(seg([5, 11.5], [5, 14.6], 2), 0.9));
    d.hatchCut(clipHalf(shrink(ell(5, 9.4, 2.6, 3.3), 0.7), 1, 1, 13.4), -45, 1.6, 0.55);
    // horizon
    d.inkFine(band(seg([1, 14.8], [23, 14.6], 8), 0.8));
    // furrows converging to the horizon
    d.layer();
    const vp: Pt = [12, 4];
    for (const x of [-3, 1.4, 5.8, 10.2, 14.6, 19, 23.4]) {
      const top: Pt = [x + (vp[0] - x) * (1 - 6.4 / 18), 15.6];
      const bot: Pt = [x, 22];
      const pts = seg(top, bot, 6).map((p): Pt => [Math.min(23.2, Math.max(0.8, p[0])), p[1]]);
      d.ink(band(pts, lerpW(0.6, 1.9)));
    }
  },

  mill(d) {
    // mill wall with stone courses
    d.ink(rect(19.6, 4.6, 3.6, 16));
    d.ink([
      [18.6, 5.2],
      [21.6, 1.8],
      [23.6, 4.2],
      [23.6, 5.2],
    ]);
    for (const y of [7.4, 10, 15.2, 17.8]) d.cut(gouge([20.2, y], [22.6, y], 0.6));
    // wheel
    d.layer();
    const c: Pt = [10, 12.4];
    d.ink(circ(c[0], c[1], 7.5));
    d.cut(circ(c[0], c[1], 6.2));
    for (let i = 0; i < 6; i++) {
      const a = i * 60 + 10;
      d.inkFine(band(seg(c, [c[0] + Math.cos(a * DEG) * 6.4, c[1] + Math.sin(a * DEG) * 6.4], 3), 0.95));
    }
    d.ink(circ(c[0], c[1], 1.7));
    d.cut(circ(c[0] - 0.3, c[1] - 0.3, 0.55));
    for (let i = 0; i < 12; i++) {
      const a = i * 30 + 10;
      const ca = Math.cos(a * DEG);
      const sa = Math.sin(a * DEG);
      const t: Pt = [-sa, ca];
      const r0 = 7.2;
      const r1 = 9.3;
      const hw = 0.75;
      d.ink([
        [c[0] + ca * r0 + t[0] * hw, c[1] + sa * r0 + t[1] * hw],
        [c[0] + ca * r1 + t[0] * hw, c[1] + sa * r1 + t[1] * hw],
        [c[0] + ca * r1 - t[0] * hw, c[1] + sa * r1 - t[1] * hw],
        [c[0] + ca * r0 - t[0] * hw, c[1] + sa * r0 - t[1] * hw],
      ]);
    }
    // axle into the wall
    d.ink(band(seg(c, [19.8, 12.4], 4), 1.4));
    // water
    d.layer();
    for (const [y, x0, x1] of [
      [19.6, 1, 23.4],
      [21.9, 2.4, 21.6],
    ] as const) {
      const pts: Pt[] = [];
      for (let x = x0; x <= x1 + 0.01; x += 0.5) pts.push([x, y + Math.sin((x - x0) * 1.2) * 0.45]);
      d.inkFine(band(pts, 1.1));
    }
  },

  bakery(d) {
    // chimney + smoke
    d.ink(rect(15.6, 4.2, 2.6, 6));
    d.inkFine(band(cubic([16.8, 3.4], [15.6, 2.4], [18.6, 2], [17.4, 0.6], 8), taper(0.9, 0.3)));
    // dome and hearth
    d.ink([...arcPts(12, 17, 9.2, 10, 180, 360, 24), [21.2, 17], [22.2, 17.4], [22.2, 20.8], [1.8, 20.8], [1.8, 17.4], [2.8, 17]]);
    // mouth
    d.cut([...arcPts(12, 13.4, 3.5, 3.5, 180, 360, 10), [15.5, 17.2], [8.5, 17.2]]);
    // fire
    d.ink([
      [9.2, 17.3],
      [9.8, 15],
      [10.7, 16],
      [11.4, 12.6],
      [12.4, 15.4],
      [13.3, 13.8],
      [14.1, 15.8],
      [14.8, 17.3],
    ]);
    // hearth line
    d.cut(gouge([2.6, 18.1], [8.2, 18.1], 0.6), gouge([15.8, 18.1], [21.4, 18.1], 0.6));
    // brick courses on the lit side
    for (const r of [7.6, 5.4]) {
      d.cut(band(arcPts(12, 17, r, r + 0.7, 196, 248, 8), taper(0.75, 0.2)));
    }
    d.hatchCut([[3.4, 16.4], [5.4, 11], [7.3, 13.4], [8, 16.4]], -45, HATCH_PITCH, CUT_W);
  },

  warehouse(d) {
    d.ink([
      [2.4, 21.6],
      [2.4, 10.6],
      [1.2, 10.8],
      [12, 2.4],
      [22.8, 10.8],
      [21.6, 10.6],
      [21.6, 21.6],
    ]);
    // eave line and loft hatch
    d.cut(band([[3, 10.3], [12, 3.7], [21, 10.3]], 0.55));
    d.cut(rect(10.8, 6.2, 2.4, 2.2));
    // door opening
    d.cut(rect(5.4, 11.4, 13.2, 9.6));
    // roof hatching
    d.hatchCut(clipHalf(shrink([[3.4, 9.6], [12, 4.6], [20.6, 9.6]], 0.4), 0, 1, 9.6), -90, 1.9, 0.6);
    // crates in the doorway
    d.layer();
    const crate = (x: number, y: number, s: number): void => {
      d.ink(rect(x, y, s, s));
      d.cut(rect(x + 0.85, y + 0.85, s - 1.7, s - 1.7));
      d.inkFine(band(seg([x + 0.9, y + s - 0.9], [x + s - 0.9, y + 0.9], 3), 0.85));
    };
    crate(6.2, 16.2, 4.8);
    crate(11.6, 16.2, 4.8);
    crate(8.9, 11.9, 4.1);
    // sack leaning at right
    d.ink([
      [16.8, 15.8],
      [17.6, 14],
      [16.9, 12.6],
      [17.4, 12],
      [18, 12.6],
      [17.8, 15.8],
    ]);
  },

  stable(d) {
    // horse head and neck, facing left
    const head: Poly = [
      [13.4, 21.8],
      [12.6, 16.6],
      [10.4, 16.4],
      [8.2, 17.6],
      [5.4, 17.6],
      [3.9, 16.4],
      [3.7, 14.2],
      [5, 12.2],
      [8.2, 8.2],
      [9.8, 5.8],
      [10.4, 2.4],
      [12, 4.8],
      [13.4, 4.4],
      [15.4, 5.6],
      [17.4, 8.8],
      [19.4, 13.4],
      [20.6, 21.8],
    ];
    d.ink(head);
    // eye, nostril, mouth
    d.cut(gouge([8.6, 10], [10.6, 9.8], 0.95));
    d.cut(ell(5.1, 14.3, 0.75, 0.55, -30));
    d.cut(gouge([3.9, 16.5], [6.4, 16.4], 0.55));
    // jaw line
    d.cut(band(cubic([12, 15.6], [9.6, 14.6], [9.2, 12.8], [11, 11.4], 8), taper(0.7, 0.2)));
    // halter
    d.cut(gouge([6.6, 12.2], [8.4, 16.8], 0.55));
    // mane: tufts along the crest, parted from the neck by one gouge
    const crest: Pt[] = [
      [14.2, 5],
      [15.4, 5.6],
      [17.4, 8.8],
      [19.4, 13.4],
      [20.4, 19],
    ];
    for (let i = 0; i < crest.length - 1; i++) {
      const a = crest[i]!;
      const b = crest[i + 1]!;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy);
      const ux = dx / l;
      const uy = dy / l;
      for (let t = 0.25; t < l; t += 2.1) {
        const p: Pt = [a[0] + ux * t, a[1] + uy * t];
        d.ink([
          [p[0] - ux * 0.9, p[1] - uy * 0.9],
          [p[0] + uy * 1.7 + ux * 1.1, p[1] - ux * 1.7 + uy * 1.1],
          [p[0] + ux * 1, p[1] + uy * 1],
          [p[0] - uy * 0.3, p[1] + ux * 0.3],
        ]);
      }
    }
    d.cut(band(cubic([13.6, 6.4], [16.4, 8], [18, 12.4], [18.8, 19.6], 10), taper(0.75, 0.2)));
    // shadow under the jaw
    d.hatchCut([[12.9, 18.4], [14.6, 15], [16.6, 17], [17.6, 21.2], [13.6, 21.2]], -45);
  },

  castle(d) {
    // tower
    d.ink([
      [6.6, 21.8],
      [7.4, 8.6],
      [16.6, 8.6],
      [17.4, 21.8],
    ]);
    // parapet and merlons
    d.ink(rect(5.6, 6.4, 12.8, 2.6));
    for (const x of [5.6, 10.7, 15.8]) d.ink(rect(x, 3.6, 2.6, 3.2));
    d.cut(gouge([6.4, 9.4], [17.6, 9.4], 0.6));
    for (const x of [8.4, 10.4, 12.4, 14.4]) d.cut(rect(x, 9.6, 0.9, 1.1));
    // banner
    d.inkFine(band(seg([12, 3.8], [12, 0.6], 2), 0.8));
    d.ink([
      [12.3, 0.6],
      [16.6, 1.3],
      [14.6, 1.8],
      [16.2, 2.6],
      [12.3, 2.9],
    ]);
    // door and arrow slit
    d.cut([...arcPts(12, 18, 1.8, 1.8, 180, 360, 8), [13.8, 21.4], [10.2, 21.4]]);
    d.cut(rect(11.55, 12.2, 0.95, 3.4));
    // masonry courses on the lit side
    for (const [y, x0, x1] of [
      [12.6, 8.2, 10.8],
      [15, 8, 10.4],
      [17.4, 7.8, 9.8],
      [19.8, 7.6, 9.6],
    ] as const) {
      d.cut(gouge([x0, y], [x1, y], 0.7));
    }
    d.cut(gouge([9.4, 13.8], [9.4, 14.4], 0.5));
    // ground
    d.hatchInk([[3, 22.4], [21, 22.4], [21, 23.4], [3, 23.4]], 0, 1.2, 0.6);
  },

  // ---- D-29 chain buildings ------------------------------------------------
  fisher(d) {
    // hut on stilts: gable roof, board walls, door
    d.ink([
      [2.6, 9.8],
      [9.6, 2.6],
      [16.6, 9.8],
      [15.2, 9.8],
      [15.2, 15.2],
      [4, 15.2],
      [4, 9.8],
    ]);
    d.cut(band([[3.8, 9.2], [9.6, 3.6], [15.4, 9.2]], 0.5));
    d.hatchCut(clipHalf(shrink([[4, 8.8], [9.6, 4], [15.2, 8.8]], 0.5), 0, 1, 8.6), -90, 1.6, 0.55);
    d.cut(rect(10.6, 11, 2.4, 4.2));
    for (const x of [5.8, 7.6]) d.cut(gouge([x, 10.6], [x, 14.4], 0.5));
    // stilts and a ladder
    for (const x of [4.8, 9.4, 14.2]) d.inkFine(band(seg([x, 15], [x, 20.6], 3), 1.1));
    // water
    d.layer();
    for (const [y, x0, x1] of [
      [19.4, 1, 23],
      [21.8, 2.4, 21.4],
    ] as const) {
      const pts: Pt[] = [];
      for (let x = x0; x <= x1 + 0.01; x += 0.5) pts.push([x, y + Math.sin((x - x0) * 1.3) * 0.4]);
      d.inkFine(band(pts, 1));
    }
    // net hung on a pole at the right
    d.layer();
    d.inkFine(band(seg([19.6, 3.4], [19.6, 18.4], 4), 1.1));
    d.inkFine(band(seg([19.6, 4.2], [23, 6.2], 3), 0.8));
    const net: Poly = [[19.8, 5], [22.8, 6.6], [22.2, 15.4], [19.8, 16.4]];
    d.hatchInk(net, 45, 1.5, 0.5);
    d.hatchInk(net, -45, 1.5, 0.5);
  },

  quarry(d) {
    // stepped quarry face of coursed blocks
    d.ink([
      [1.4, 22],
      [1.4, 16.2],
      [8.2, 16.2],
      [8.2, 12.4],
      [14.8, 12.4],
      [14.8, 8.6],
      [22.6, 8.6],
      [22.6, 22],
    ]);
    // bedding joints and vertical joints, staggered
    d.cut(gouge([9, 16.2], [22, 16.2], 0.6), gouge([15.6, 12.4], [22, 12.4], 0.6), gouge([2, 19.2], [22, 19.2], 0.6));
    for (const [x, y0, y1] of [
      [5, 16.8, 18.6],
      [11.4, 16.8, 18.6],
      [18.4, 16.8, 18.6],
      [8.2, 19.8, 21.4],
      [15, 19.8, 21.4],
      [11.4, 13, 15.6],
      [18.6, 13, 15.6],
      [18.6, 9.2, 11.8],
    ] as const) {
      d.cut(gouge([x, y0], [x, y1], 0.55));
    }
    // lit tops of the steps
    d.hatchCut(rect(1.8, 16.6, 6, 2.2), -45, 1.6, 0.55);
    // shear-legs standing on the steps, a block hanging from the apex
    d.layer();
    d.inkFine(band(seg([2.2, 16], [6.6, 1.8], 5), lerpW(1.3, 0.9)), band(seg([12, 12.2], [7.2, 1.8], 5), lerpW(1.3, 0.9)));
    d.ink(circ(6.9, 1.9, 1));
    d.inkFine(band(seg([6.9, 2.6], [6.9, 6.6], 2), 0.55));
    d.inkFine(band(seg([6.9, 6.4], [4.9, 7.8], 2), 0.5), band(seg([6.9, 6.4], [8.9, 7.8], 2), 0.5));
    d.ink([[4.2, 7.8], [9.6, 7.6], [9.8, 11], [4.4, 11.2]]);
    d.cut(gouge([5, 9.4], [9, 9.3], 0.45));
  },

  charcoalBurner(d) {
    // the kiln mound: a low earth cone with a rounded crown
    d.ink([
      [1.2, 20.8],
      ...cubic([1.2, 20.8], [5, 14], [8.4, 8.6], [11, 8], 10).slice(1),
      [13, 8],
      ...cubic([13, 8], [15.6, 8.6], [19, 14], [22.8, 20.8], 10).slice(1),
    ]);
    // turf courses on the lit side and two rings of vent holes
    for (const [y, x0, x1] of [
      [12, 8.4, 10.8],
      [14.6, 5.6, 9.2],
      [17.2, 3.8, 8.2],
    ] as const) {
      d.cut(gouge([x0, y], [x1, y - 0.6], 0.6));
    }
    for (const x of [6.4, 10, 13.6, 17.2]) d.cut(rect(x, 18.6, 0.9, 0.9));
    for (const x of [9.6, 12.8, 15.4]) d.cut(rect(x, 14.4, 0.8, 0.8));
    // smoke from the crown
    d.layer();
    d.inkFine(band(cubic([12, 7.4], [10.4, 5.4], [14.4, 4], [12.8, 0.6], 10), taper(1.7, 0.5)));
    // ladder leaning on the right flank (cut a gap first so it reads)
    d.layer();
    d.inkFine(band(seg([16.2, 21.6], [19.4, 11.6], 4), 0.95), band(seg([18.4, 21.6], [21.2, 12.6], 4), 0.95));
    for (const t of [0.25, 0.5, 0.75]) {
      const a: Pt = [16.2 + 3.2 * t, 21.6 - 10 * t];
      const b: Pt = [18.4 + 2.8 * t, 21.6 - 9 * t];
      d.inkFine(band(seg(a, b, 2), 0.7));
    }
    // ground
    d.hatchInk([[0.8, 21.4], [23.2, 21.4], [23.2, 22.6], [0.8, 22.6]], 0, 1.2, 0.6);
  },

  malthouse(d) {
    // long low malting floor, thatched
    d.ink([
      [1.2, 21.6],
      [1.2, 13.6],
      [0.4, 13.8],
      [4.2, 8.8],
      [14, 8.8],
      [14, 21.6],
    ]);
    d.hatchCut(clipHalf(shrink([[1.4, 13], [4.6, 9.6], [13.6, 9.6], [13.6, 13]], 0.5), 0, 1, 12.8), -90, 1.6, 0.55);
    d.cut(gouge([1.6, 13.6], [13.6, 13.6], 0.5));
    d.cut(rect(7.4, 16, 2.6, 5.6));
    for (const x of [2.8, 11]) d.cut(rect(x, 15.4, 1.4, 1.2));
    // stone kiln with a pyramid roof and a louvred cowl
    d.layer();
    d.ink(rect(14.8, 10.8, 7.6, 10.8));
    d.ink([[14, 11.2], [18.6, 4.6], [23.2, 11.2]]);
    d.ink(rect(17.2, 1.6, 2.8, 3.6));
    d.ink([[16.6, 2.2], [18.6, 0.4], [20.6, 2.2]]);
    d.cut(gouge([17.6, 2.8], [19.6, 2.8], 0.45), gouge([17.6, 4], [19.6, 4], 0.45));
    for (const y of [13.4, 16, 18.6]) d.cut(gouge([15.4, y], [21.8, y], 0.55));
    for (const [x, y] of [
      [18.2, 11.4],
      [16.6, 14],
      [20.2, 14],
      [18.4, 16.6],
    ] as const) {
      d.cut(gouge([x, y + 0.2], [x, y + 2], 0.45));
    }
    // stoke hole
    d.cut([...arcPts(18.6, 20, 1.4, 1.4, 180, 360, 6), [20, 21.6], [17.2, 21.6]]);
    d.hatchCut(clipHalf(shrink([[14.8, 10.6], [18.6, 5.2], [22.4, 10.6]], 0.6), 1, 0, 18.4), -45, 1.4, 0.5);
  },

  brewery(d) {
    // copper on a furnace: a wide bowl with a rolled rim, the hearth below
    d.ink([
      [2.6, 9.6],
      [21.4, 9.6],
      [21.4, 11.2],
      [20, 11.4],
      ...arcPts(12, 11.4, 8, 6.6, 0, 180, 18).slice(1, -1),
      [4, 11.4],
      [2.6, 11.2],
    ]);
    d.cut(gouge([3.4, 10.5], [20.6, 10.5], 0.45));
    // hammered texture on the lit side
    d.hatchCut(clipHalf(shrink([...arcPts(12, 11.6, 7.2, 5.6, 0, 180, 14)], 0.6), 1, 0.4, 13), -45, 1.6, 0.6);
    // furnace
    d.ink([[4.8, 17.4], [19.2, 17.4], [19.8, 21.8], [4.2, 21.8]]);
    d.cut(gouge([5, 17.6], [19, 17.6], 0.7));
    d.cut([...arcPts(12, 20.2, 2.4, 1.8, 180, 360, 8), [14.4, 21.8], [9.6, 21.8]]);
    d.ink([[10.4, 21.7], [11.2, 19.6], [12, 20.6], [12.8, 19.2], [13.6, 21.7]]);
    // mash paddle
    d.layer();
    d.inkFine(band(seg([15.2, 9.2], [20.6, 1.4], 4), lerpW(1.4, 1)));
    // steam
    d.inkFine(band(cubic([7, 8.8], [5.6, 7], [8.6, 5.4], [7, 2.4], 8), taper(1.2, 0.4)));
    d.inkFine(band(cubic([11.4, 8.6], [10.2, 6.6], [13, 5], [11.6, 1.8], 8), taper(1.2, 0.4)));
  },

  tradePost(d) {
    // a steelyard on a post (D-170): the gallows post with its arm, the beam on a short chain, a sack on the hook,
    // a round weight on the other end, a low counter below — the only building icon with an arm and a hanging beam
    d.ink([[2.2, 22.6], [2.8, 2.2], [5, 2.2], [5.4, 22.6]]);
    d.ink([[3.6, 2], [16.4, 2], [16.4, 4], [3.6, 4.2]]);
    d.inkFine(band(seg([5.2, 8.4], [9.4, 3.8], 3), 0.9));
    d.cut(gouge([3.9, 5.4], [3.9, 20.8], 0.5));
    // chain: three links
    d.layer();
    for (const y of [5, 6.9, 8.8]) { d.ink(ell(15.4, y, 0.7, 1.1)); d.cut(ell(15.4, y, 0.28, 0.6)); }
    // the beam, a little tilted (the sack is heavier)
    d.ink(band(seg([7.6, 11.6], [22, 9.6], 4), lerpW(1.5, 1.1)));
    d.cut(ell(15.4, 10.6, 0.45, 0.45));
    // hook and sack (a full bag, tied at the neck)
    d.inkFine(band(quad([8.4, 11.6], [8.4, 12.8], [9.4, 13], 5), 0.6));
    d.ink([[8.6, 13.2], [10.4, 13.2], [9.9, 14.2], [11.6, 15.2], [12.4, 17.4], [11.6, 18.8], [7.2, 18.8], [6.4, 17.4], [7.2, 15.2], [9, 14.2]]);
    d.cut(gouge([8.8, 14.5], [10.1, 14.5], 0.5));
    d.hatchCut([[10.6, 15.4], [11.6, 17.4], [11, 18.2], [9.8, 18.2]], -45, 1.3, 0.5);
    // the weight on a cord: a stone ball, lighter than the sack's side
    d.inkFine(band(seg([20.6, 9.9], [20.6, 12.4], 2), 0.5));
    d.ink(circ(20.6, 14.2, 1.8));
    d.cut(ell(20, 13.6, 0.5, 0.35, -30));
    // counter: a plank on two legs
    d.layer();
    d.ink(rect(6.6, 19.4, 16, 1.6));
    d.ink(rect(8, 21, 1.3, 1.8), rect(19.8, 21, 1.3, 1.8));
    d.hatchInk([[9.6, 21.3], [19.6, 21.3], [19.6, 22.8], [9.6, 22.8]], -45, 1.5, 0.5);
  },

  bottleneck(d) {
    // a mill hopper on a trestle (D-171): full at the top, a narrow throat, two or three grains below; asymmetric
    // and with legs, unlike the hourglass of 'waiting'
    // grain heaped over the rim
    d.ink([[4.2, 6.4], [6.4, 3.6], [9.6, 2.2], [13.4, 1.8], [16.8, 2.8], [19.8, 5], [20.4, 6.4]]);
    d.hatchCut([[7, 5.6], [9.8, 3.2], [13.4, 2.8], [16.6, 3.8], [18.8, 5.6]], -45, 1.5, 0.5);
    // the boarded hopper: wide trapezoid down to the throat
    d.ink([[2.6, 6.6], [21.4, 6.6], [14, 14.6], [14, 16.4], [10.4, 16.4], [10.4, 14.6]]);
    d.cut(gouge([5.6, 8.8], [18.4, 8.8], 0.55), gouge([8.2, 11.4], [15.8, 11.4], 0.55));
    // grains falling out of the throat, one by one
    d.layer();
    d.ink(ell(12.2, 18.1, 0.55, 0.8), ell(11.4, 20.1, 0.5, 0.75, 20), ell(12.8, 21.9, 0.5, 0.7, -20));
    // trestle legs, splayed
    d.inkFine(band(seg([5.2, 7.2], [2.4, 22.6], 4), lerpW(1.2, 1.4)), band(seg([18.8, 7.2], [21.6, 22.6], 4), lerpW(1.2, 1.4)));
    d.inkFine(band(seg([3.4, 17.6], [8.8, 17.6], 2), 0.9), band(seg([15.6, 17.6], [20.6, 17.6], 2), 0.9));
  },

  // ---- stall reasons -----------------------------------------------------
  no_road(d) {
    dirtTrack(d);
  },

  no_wagon(d) {
    cart(d);
  },

  bridge_jam(d) {
    // stone bridge with arch
    d.ink([
      [0.8, 13.6],
      [23.2, 13.6],
      [23.2, 15.4],
      [21.4, 15.6],
      [21.4, 21.8],
      [17.4, 21.8],
      ...arcPts(12, 21.8, 5.4, 5.6, 360, 180, 14),
      [6.6, 21.8],
      [2.6, 21.8],
      [2.6, 15.6],
      [0.8, 15.4],
    ]);
    d.cut(gouge([1.6, 14.6], [22.4, 14.6], 0.45));
    d.cut(gouge([3.4, 18.2], [6.2, 18.2], 0.6), gouge([18, 18.2], [20.6, 18.2], 0.6));
    d.cut(gouge([3.4, 20.4], [5.8, 20.4], 0.6), gouge([18.4, 20.4], [20.6, 20.4], 0.6));
    // water under the arch
    d.inkFine(band([[8, 21.2], [9.5, 20.8], [11, 21.2], [12.5, 20.8], [14, 21.2], [15.5, 20.8], [16.2, 21]], 0.75));
    // two wagons meeting nose to nose
    d.layer();
    const wag = (flip: boolean): void => {
      const X = (x: number) => (flip ? 24 - x : x);
      d.ink([
        [X(1.4), 6.2],
        [X(9.6), 6.2],
        [X(9.1), 10.6],
        [X(1.9), 10.6],
      ]);
      d.cut(gouge([X(4.2), 7.2], [X(4.2), 9.8], 0.9), gouge([X(6.9), 7.2], [X(6.9), 9.8], 0.9));
      d.inkFine(band(seg([X(9), 9.6], [X(11.3), 10.6], 3), 0.9));
    };
    wag(false);
    wag(true);
    wheel(d, 5.4, 11.2, 2.45, 4);
    wheel(d, 18.6, 11.2, 2.45, 4);
    // clash marks
    d.layer();
    d.inkFine(band(seg([10.8, 7.6], [9.6, 4.6], 2), taper(0.9, 0.3)));
    d.inkFine(band(seg([13.2, 7.6], [14.4, 4.6], 2), taper(0.9, 0.3)));
    d.inkFine(band(seg([12, 7.4], [12, 3.4], 2), taper(0.9, 0.3)));
  },

  output_full(d) {
    // crate
    d.ink(rect(2.8, 12, 15.6, 9.8));
    d.cut(gouge([3.6, 15.3], [17.6, 15.3], 0.75), gouge([3.6, 18.6], [17.6, 18.6], 0.75));
    d.cut(gouge([3.6, 12.9], [17.6, 12.9], 0.45));
    d.hatchCut(rect(4.2, 13.2, 3.4, 1.6), -45, 1.6, 0.55);
    // heaped goods over the brim
    d.layer();
    const balls: [number, number, number][] = [
      [5.6, 9.4, 2.25],
      [10.6, 9.1, 2.35],
      [15.6, 9.4, 2.25],
      [8.1, 5.2, 2.15],
      [13.1, 5, 2.15],
    ];
    for (const [x, y, r] of balls) {
      d.ink(circ(x, y, r));
      d.cut(ell(x - r * 0.38, y - r * 0.4, r * 0.32, r * 0.2, -40));
    }
    // one rolled off
    d.ink(circ(21, 20, 1.75));
    d.cut(ell(20.4, 19.4, 0.5, 0.32, -40));
    d.inkFine(band(seg([19.6, 13.8], [20.8, 16.2], 2), taper(0.6, 0.2)));
    d.inkFine(band(seg([21.6, 13.4], [22.2, 16], 2), taper(0.6, 0.2)));
  },

  waiting(d) {
    // plates
    d.ink([[4, 1.8], [20, 1.8], [19.2, 4], [4.8, 4]], [[4.8, 20], [19.2, 20], [20, 22.2], [4, 22.2]]);
    // posts
    d.inkFine(band(seg([5.8, 4], [5.8, 20], 4), 1.1), band(seg([18.2, 4], [18.2, 20], 4), 1.1));
    d.cut(gouge([5.8, 6], [5.8, 18], 0.35));
    // glass
    d.layer();
    const glass = (inset: number): Poly => {
      const L: Pt[] = [
        [7.7 + inset, 4],
        [8.1 + inset, 7.4],
        [10.2 + inset * 0.8, 10.4],
        [11.3 + inset * 0.45, 12],
        [10.2 + inset * 0.8, 13.6],
        [8.1 + inset, 16.6],
        [7.7 + inset, 20],
      ];
      return [...L, ...[...L].reverse().map((p): Pt => [24 - p[0], p[1]])];
    };
    d.ink(glass(0));
    d.cut(glass(0.95).map((p): Pt => [p[0], Math.min(19.2, Math.max(4.8, p[1]))]));
    // sand
    d.ink([[9.2, 8.6], [14.8, 8.6], [12, 11.9]]);
    d.inkFine(band(seg([12, 11.6], [12, 16], 2), 0.45));
    d.ink([[8.9, 19.3], [15.1, 19.3], [13.4, 16.6], [12, 15.6], [10.6, 16.6]]);
  },

  no_input(d) {
    const cx = 12;
    const cy = 9.6;
    // handle
    d.inkFine(band(arcPts(cx, cy + 0.4, 6.6, 7.2, 186, 354, 16), 1.3));
    d.layer();
    // rim
    d.ink(ell(cx, cy, 9.2, 2.7));
    d.cut(ell(cx, cy - 0.15, 7.7, 1.6));
    // body below the front lip
    d.ink([
      [2.8, cy],
      [5.4, 20.4],
      [7, 21.6],
      [17, 21.6],
      [18.6, 20.4],
      [21.2, cy],
      [19.7, cy],
      ...arcPts(cx, cy - 0.15, 7.7, 1.6, 0, 180, 14).slice(1, -1),
      [4.3, cy],
    ]);
    // wicker weave
    for (const [y, x0, x1] of [
      [14, 4.6, 19.4],
      [17.2, 5.4, 18.6],
    ] as const) {
      d.cut(band(arcPts(12, y - 3, (x1 - x0) / 2, 3.4, 160, 20, 14), taper(0.75, 0.3)));
    }
    for (const [x, y] of [
      [6.4, 12.4],
      [9.6, 12.8],
      [12.8, 12.9],
      [16, 12.7],
      [8, 15.8],
      [11.2, 16.2],
      [14.4, 16.1],
      [17.2, 15.6],
      [9.6, 19.1],
      [12.8, 19.2],
      [15.6, 19],
      [7.4, 18.8],
    ] as const) {
      d.cut(gouge([x, y - 0.75], [x + 0.15, y + 0.8], 0.75));
    }
  },

  strike(d) {
    strikeBar(d);
  },

  no_route(d) {
    // origin ring
    d.ink(circ(4, 19.6, 2.5));
    d.cut(circ(4, 19.6, 1.1));
    // destination pennant
    d.inkFine(band(seg([19.6, 10.4], [19.6, 1.4], 4), 0.95));
    d.ink([
      [20, 1.5],
      [23.4, 2.6],
      [21.6, 3.3],
      [23.2, 4.2],
      [20, 4.9],
    ]);
    // the way, snapped in the middle with ragged ends
    const path = cubic([5.4, 17.6], [9.6, 12.4], [14.4, 12.8], [18.8, 7.2], 40);
    const w = (t: number) => 2.6 - t * 0.6;
    const half = (from: number, to: number): Poly => band(path.slice(from, to + 1), (t) => w((from + t * (to - from)) / 40));
    d.ink(half(0, 15), half(25, 40));
    // ragged ends
    const tear = (k: number, dir: 1 | -1): void => {
      const p = path[k]!;
      const q = path[k + dir]!;
      const ux = q[0] - p[0];
      const uy = q[1] - p[1];
      const l = Math.hypot(ux, uy);
      const tx = ux / l;
      const ty = uy / l;
      const hw = w(k / 40) / 2;
      d.ink([
        [p[0] - ty * hw, p[1] + tx * hw],
        [p[0] - ty * hw * 0.3 - tx * 1.2, p[1] + tx * hw * 0.3 - ty * 1.2],
        [p[0] + ty * hw * 0.2 - tx * 0.4, p[1] - tx * hw * 0.2 - ty * 0.4],
        [p[0] + ty * hw - tx * 1, p[1] - tx * hw - ty * 1],
        [p[0] + ty * hw, p[1] - tx * hw],
      ]);
    };
    tear(15, -1);
    tear(25, 1);
    // gouges along the road
    d.cut(band(path.slice(2, 14), taper(0.55, 0.15)), band(path.slice(27, 38), taper(0.5, 0.15)));
    // crack marks in the gap
    d.inkFine(band([[11.2, 11], [12.4, 12.4], [11.4, 13.6], [12.6, 15]], taper(0.8, 0.3)));
  },

  storage_full(d) {
    const house: Poly = [
      [2.4, 21.8],
      [2.4, 10.4],
      [12, 2.2],
      [21.6, 10.4],
      [21.6, 21.8],
    ];
    d.ink(house);
    const inner = shrink(house, 1.6);
    d.cut(inner);
    // packed to the rafters: sacks in courses
    const room = shrink(house, 2.35);
    const rowH = 2.5;
    let row = 0;
    for (let y = 20.95; y > 3; y -= rowH + 0.55, row++) {
      const off = row % 2 ? 2.1 : 0;
      for (let x = 2 - off; x < 22; x += 4.2) {
        let p: Poly = rect(x + 0.3, y - rowH, 3.6, rowH);
        // round the sack ends a little
        p = [
          [p[0]![0] + 0.5, p[0]![1]],
          [p[1]![0] - 0.5, p[1]![1]],
          [p[1]![0], p[1]![1] + 0.6],
          [p[2]![0], p[2]![1] - 0.5],
          [p[2]![0] - 0.5, p[2]![1]],
          [p[3]![0] + 0.5, p[3]![1]],
          [p[3]![0], p[3]![1] - 0.5],
          [p[0]![0], p[0]![1] + 0.6],
        ];
        // clip to the room
        for (let i = 0; i < room.length; i++) {
          const a = room[i]!;
          const b = room[(i + 1) % room.length]!;
          // keep inside: for a positive-area polygon the interior is on the side of (-dy, dx)
          const nx = b[1] - a[1];
          const ny = -(b[0] - a[0]);
          const s = area(room) > 0 ? -1 : 1;
          p = clipHalf(p, nx * s * -1, ny * s * -1, (nx * a[0] + ny * a[1]) * s * -1);
        }
        if (p.length >= 3 && Math.abs(area(p)) > 1.2) d.ink(p);
      }
    }
  },

  // ---- tools / UI --------------------------------------------------------
  road_dirt(d) {
    dirtTrack(d);
  },

  road_cobble(d) {
    const yTop = 3;
    const yBot = 22.4;
    const L = (y: number) => 1 + (7.6 - 1) * ((yBot - y) / (yBot - yTop));
    const R = (y: number) => 23 - (23 - 16.4) * ((yBot - y) / (yBot - yTop));
    const rows = [22.4, 17.4, 13.4, 10.2, 7.6, 5.4, 3.6];
    const counts = [4, 4, 4, 3, 3, 3];
    for (let r = 0; r + 1 < rows.length; r++) {
      const y0 = rows[r]!;
      const y1 = rows[r + 1]!;
      const n = counts[r]!;
      const off = r % 2 ? 0.5 : 0;
      for (let k = -1; k <= n; k++) {
        const u0 = Math.max(0, (k + off) / n);
        const u1 = Math.min(1, (k + 1 + off) / n);
        if (u1 - u0 < 0.2) continue;
        const X = (u: number, y: number) => L(y) + u * (R(y) - L(y));
        const q: Poly = [
          [X(u0, y1), y1],
          [X(u1, y1), y1],
          [X(u1, y0), y0],
          [X(u0, y0), y0],
        ];
        // chamfer corners, then open the joints
        const ch: Pt[] = [];
        for (let i = 0; i < 4; i++) {
          const a = q[i]!;
          const b = q[(i + 1) % 4]!;
          ch.push([a[0] + (b[0] - a[0]) * 0.2, a[1] + (b[1] - a[1]) * 0.2]);
          ch.push([a[0] + (b[0] - a[0]) * 0.8, a[1] + (b[1] - a[1]) * 0.8]);
        }
        const gap = 0.32 + (y0 - yTop) * 0.018;
        d.ink(shrink(ch, gap));
      }
    }
  },

  demolish(d) {
    // mattock head: pick on the left, adze on the right
    const head = cubic([1.8, 10.6], [7, 4.2], [15, 3.6], [22.2, 7.8], 16);
    d.ink(band(head, (t) => (t < 0.5 ? 0.3 + 4.2 * t : 2.4 + (t - 0.5) * 2.8)));
    // collar
    d.ink(ell(11.6, 5.6, 2.1, 2.5, 18));
    // haft
    d.layer();
    d.ink(band(seg([11.2, 6.6], [6.6, 22.2], 8), lerpW(2, 1.6)));
    d.cut(gouge([10.4, 9.8], [7.6, 19.6], 0.5));
    d.layer();
    d.cut(gouge([16.6, 6.5], [21.2, 8.6], 0.55));
  },

  buy_wagon(d) {
    d.with(scaleAt(0.8, 0, 22.4), () => cart(d));
    d.layer();
    d.ink(band(seg([19, 1], [19, 9.4], 6), taper(2.3, 1.3)));
    d.ink(band(seg([14.8, 5.2], [23.2, 5.2], 6), taper(2.3, 1.3)));
  },

  inspect(d) {
    // manicule: cuff
    d.ink([
      [1.2, 7.6],
      [5.6, 8.4],
      [5.6, 19.6],
      [1.2, 20.4],
    ]);
    d.cut(gouge([2.6, 9.2], [2.6, 19], 0.65), gouge([4.2, 9.4], [4.2, 18.8], 0.65));
    // hand with index finger pointing right
    d.layer();
    d.ink([
      [5.6, 9.2],
      [8.8, 8.2],
      [12.2, 8.9],
      [20.8, 8.9],
      ...arcPts(20.8, 10.25, 1.35, 1.35, 270, 450, 8),
      [13.4, 11.6],
      [14.2, 13],
      [14, 15.4],
      [13.4, 17.6],
      [11.6, 19.2],
      [8.6, 19.6],
      [5.6, 18.8],
    ]);
    // curled fingers
    d.cut(band(quad([8.4, 12.2], [11.6, 11.4], [13.6, 12.4], 6), taper(0.7, 0.2)));
    d.cut(band(quad([8.4, 14.6], [11.8, 14], [13.8, 14.8], 6), taper(0.7, 0.2)));
    d.cut(band(quad([8.2, 17], [11.2, 16.4], [13, 17.2], 6), taper(0.7, 0.2)));
    // thumb along the index
    d.cut(band(quad([7, 10.4], [9.8, 10.7], [12.8, 10.2], 6), taper(0.6, 0.15)));
    // nail
    d.cut(gouge([19.6, 9.7], [21.2, 9.7], 0.5));
  },

  eye(d) {
    // the watchful eye: almond lids, the upper one heavier, lashes cut upward, a hatched iris
    const outer: Poly = [
      ...quad([0.8, 12.4], [12, -2.4], [23.2, 12.4], 14),
      ...quad([23.2, 12.4], [12, 24.4], [0.8, 12.4], 14).slice(1, -1),
    ];
    const white: Poly = [
      ...quad([3.4, 12.2], [12, 1.6], [20.6, 12.2], 14),
      ...quad([20.6, 12.2], [12, 21.6], [3.4, 12.2], 14).slice(1, -1),
    ];
    d.ink(outer);
    d.cut(white);
    // shade on the white: ink hatching in the far corner and under the upper lid (light from the upper left)
    d.hatchInk(clipHalf(shrink(white, 0.5), -1, 0, -16.2), -60, 1.4, 0.5, 0.5);
    d.hatchInk(clipHalf(clipHalf(shrink(white, 0.4), 0, 1, 8.4), -1, 0, -7.4), 0, 1.2, 0.45, 0.7);
    // lashes above the upper lid, splayed outward
    for (const [x, lean] of [[5.6, -1.2], [8.6, -0.6], [12, 0], [15.4, 0.6], [18.4, 1.2]] as const) {
      const t = (x - 0.8) / 22.4;
      const y = (1 - t) * (1 - t) * 12.4 + 2 * t * (1 - t) * -2.4 + t * t * 12.4;
      d.inkFine(band(seg([x, y + 0.4], [x + lean, y - 2.4], 3), lerpW(1.1, 0.35)));
    }
    // iris: ink disc, white-line hatching on the lit upper left
    d.layer();
    const iris = circ(12, 11.9, 4.7);
    d.ink(iris);
    d.hatchCut(clipHalf(shrink(iris, 0.8), 1, 1, 23.2), -45, 1.35, 0.55);
    // pupil with a cut glint
    d.layer();
    d.ink(circ(12, 11.9, 2.1));
    d.cut(circ(11.1, 11, 0.8));
  },

  overlay_load(d) {
    const mid = cubic([1.4, 19.6], [8.4, 21.4], [12.6, 6], [22.6, 5], 40);
    const edge = (o: number): Pt[] =>
      mid.map((p, i) => {
        const a = mid[Math.max(0, i - 1)]!;
        const b = mid[Math.min(mid.length - 1, i + 1)]!;
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return [p[0] - ((b[1] - a[1]) / l) * o, p[1] + ((b[0] - a[0]) / l) * o];
      });
    d.inkFine(band(edge(3.2), 0.85), band(edge(-3.2), 0.85));
    // traffic marks: sparse at the start, dense at the end
    const marks = [3, 9, 15, 20, 24, 27.5, 30.5, 33, 35.5, 38];
    marks.forEach((m, i) => {
      const k = Math.floor(m);
      const a = mid[Math.max(0, k - 1)]!;
      const b = mid[Math.min(mid.length - 1, k + 1)]!;
      const p = mid[k]!;
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const ux = (b[0] - a[0]) / l;
      const uy = (b[1] - a[1]) / l;
      const h = 0.7 + i * 0.07;
      d.ink(gouge([p[0] - ux * h, p[1] - uy * h], [p[0] + ux * h, p[1] + uy * h], 1.5 + i * 0.12));
    });
  },

  pause(d) {
    for (const x of [5.4, 13.6]) {
      d.ink([
        [x, 3.6],
        [x + 5, 3.2],
        [x + 4.8, 20.8],
        [x + 0.2, 20.4],
      ]);
      d.hatchCut(clipHalf(rect(x + 0.9, 4.6, 1.8, 15), 1, 1, x + 22), -45, HATCH_PITCH, CUT_W);
    }
  },

  speed1(d) {
    pennants(d, [8.2]);
  },
  speed2(d) {
    pennants(d, [4.6, 11]);
  },
  speed4(d) {
    pennants(d, [1.4, 7.6, 13.8]);
  },

  close(d) {
    const w: WidthFn = (t) => 2.8 - Math.sin(Math.PI * t) * 0.9;
    d.ink(band(seg([4.2, 4.2], [19.8, 19.8], 10), w));
    d.ink(band(seg([19.8, 4.2], [4.2, 19.8], 10), w));
  },

  menu(d) {
    for (const y of [6, 12, 18]) {
      const pts: Pt[] = [];
      for (let i = 0; i <= 10; i++) pts.push([3.6 + i * 1.68, y + Math.sin(i * 0.9 + y) * 0.18]);
      d.ink(band(pts, (t) => 2.5 - Math.abs(t - 0.4) * 0.9));
    }
    d.cut(gouge([4.6, 5.6], [8.6, 5.6], 0.5), gouge([4.6, 11.6], [7.6, 11.6], 0.5), gouge([4.6, 17.6], [6.6, 17.6], 0.5));
  },

  coin(d) {
    const c = 12;
    d.ink(circ(c, c, 9.7));
    // beaded border ring
    d.cut(circ(c, c, 8.3));
    d.ink(circ(c, c, 7.5));
    for (let i = 0; i < 20; i++) {
      const a = i * 18 * DEG;
      d.cut(circ(c + Math.cos(a) * 8.9, c + Math.sin(a) * 8.9, 0.32));
    }
    // cross pattée and pellets
    const cross: Pt[] = [
      [0.9, -0.9],
      [5.9, -2.6],
      [5.9, 2.6],
      [0.9, 0.9],
      [2.6, 5.9],
      [-2.6, 5.9],
      [-0.9, 0.9],
      [-5.9, 2.6],
      [-5.9, -2.6],
      [-0.9, -0.9],
      [-2.6, -5.9],
      [2.6, -5.9],
    ];
    d.cut(cross.map((p): Pt => [c + p[0], c + p[1]]));
    for (const [sx, sy] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      d.cut(circ(c + sx * 4.3, c + sy * 4.3, 0.95));
    }
  },

  seal(d) {
    // ribbon tails behind the wax
    d.ink([[8.6, 15], [11, 16.4], [8, 22.6], [6.8, 21], [4.6, 22]]);
    d.ink([[15.4, 15], [13, 16.4], [16, 22.6], [17.2, 21], [19.4, 22]]);
    d.layer();
    // squashed wax disc
    const blob: Pt[] = [];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * 360 * DEG;
      const r = 8.3 + Math.sin(i * 1.7) * 0.35 + (i % 5 === 0 ? 0.55 : 0);
      blob.push([12 + Math.cos(a) * r, 10.4 + Math.sin(a) * r * 0.95]);
    }
    d.ink(blob);
    d.cut(circ(12, 10.4, 6.3));
    d.ink(circ(12, 10.4, 5.5));
    // tower device
    const t: Pt[] = [
      [-2.2, 3.4],
      [-2.2, -1.4],
      [-2.9, -1.4],
      [-2.9, -3.5],
      [-1.75, -3.5],
      [-1.75, -2.5],
      [-0.55, -2.5],
      [-0.55, -3.5],
      [0.55, -3.5],
      [0.55, -2.5],
      [1.75, -2.5],
      [1.75, -3.5],
      [2.9, -3.5],
      [2.9, -1.4],
      [2.2, -1.4],
      [2.2, 3.4],
    ];
    d.cut(t.map((p): Pt => [12 + p[0], 10.4 + p[1]]));
    d.ink([...arcPts(12, 12.4, 0.9, 0.9, 180, 360, 5), [12.9, 13.9], [11.1, 13.9]]);
  },

  wagon(d) {
    // horse, facing left
    d.ink(ell(7.4, 11.2, 3.9, 2.4));
    d.ink([
      [4.8, 10.8],
      [3, 7.4],
      [1.2, 8.6],
      [0.8, 7.8],
      [2.6, 5.2],
      [3.4, 4.2],
      [4.2, 5.2],
      [5.2, 7],
      [6.6, 9.8],
    ]);
    d.inkFine(
      band(seg([4.8, 12.4], [4.2, 18.6], 3), lerpW(1.2, 0.8)),
      band(seg([6.2, 12.8], [6.6, 18.6], 3), lerpW(1.2, 0.8)),
      band(seg([9.2, 12.8], [9, 18.6], 3), lerpW(1.2, 0.8)),
      band(seg([10.4, 12.2], [11.2, 18.4], 3), lerpW(1.2, 0.8)),
      band(quad([11, 10.2], [12.4, 11], [12, 14.4], 4), taper(1, 0.4)),
    );
    d.cut(gouge([5.4, 10.4], [9.6, 10], 0.5));
    // shaft
    d.inkFine(band(seg([6.4, 11.4], [14, 11.8], 4), 0.75));
    // cart box with load
    d.layer();
    d.ink([
      [13.4, 7.4],
      [23, 7.4],
      [22.4, 12.6],
      [14, 12.6],
    ]);
    d.cut(gouge([15.8, 8.4], [15.8, 11.6], 0.8), gouge([18.2, 8.4], [18.2, 11.6], 0.8), gouge([20.6, 8.4], [20.6, 11.6], 0.8));
    d.ink([...arcPts(18.2, 7.6, 4.2, 2.6, 180, 360, 10)]);
    d.cut(band(arcPts(18.2, 7.8, 3.1, 1.6, 200, 300, 6), taper(0.6, 0.15)));
    wheel(d, 18, 15.6, 3.9, 6);
    // ground
    d.layer();
    d.inkFine(band(seg([0.8, 19.8], [23.2, 19.8], 10), 0.6));
  },

  sun(d) {
    const c = 12;
    d.ink(circ(c, c, 5.2));
    d.cut(circ(c, c, 4.2));
    d.ink(circ(c, c, 3.5));
    d.hatchCut(clipHalf(circ(c, c, 2.9), 1, 1, 23), -45, 1.5, 0.6);
    for (let i = 0; i < 16; i++) {
      const a = (i * 22.5 - 90) * DEG;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const t: Pt = [-sa, ca];
      if (i % 2 === 0) {
        const r0 = 6.1;
        const r1 = i % 4 === 0 ? 11.3 : 10.2;
        const hw = 1.05;
        d.ink([
          [c + ca * r0 + t[0] * hw, c + sa * r0 + t[1] * hw],
          [c + ca * r1, c + sa * r1],
          [c + ca * r0 - t[0] * hw, c + sa * r0 - t[1] * hw],
        ]);
      } else {
        const pts: Pt[] = [];
        for (let k = 0; k <= 8; k++) {
          const r = 6.3 + k * 0.4;
          const wob = Math.sin(k * 1.4) * 0.45;
          pts.push([c + ca * r + t[0] * wob, c + sa * r + t[1] * wob]);
        }
        d.inkFine(band(pts, taper(0.9, 0.35)));
      }
    }
  },

  rain(d) {
    // cloud
    d.ink(circ(7.8, 8.6, 3.5), circ(12.6, 6.4, 4.3), circ(17.2, 8.8, 3.3), circ(4.6, 11, 2.4), circ(19.8, 11.2, 2), rect(4.6, 9, 15.4, 4.4));
    d.layer();
    d.cut(band(arcPts(7.8, 8.6, 2.5, 2.5, 200, 270, 6), taper(0.7, 0.15)));
    d.cut(band(arcPts(12.6, 6.4, 3.2, 3.2, 200, 280, 8), taper(0.75, 0.15)));
    d.cut(band(arcPts(17.2, 8.8, 2.3, 2.3, 220, 290, 6), taper(0.65, 0.15)));
    d.layer();
    d.hatchCut(clipHalf(rect(4.2, 11.2, 16, 1.9), 0, 1, 13), 0, 1.4, 0.55);
    // rain: slanted hatching
    d.layer();
    for (const [x, y, l] of [
      [6.4, 15, 4.4],
      [10.4, 15.2, 5.4],
      [14.4, 15, 4.6],
      [18.4, 15.2, 5],
      [8.2, 20.4, 2.6],
      [12.4, 21, 2.2],
      [16.4, 20.6, 2.4],
    ] as const) {
      d.inkFine(band(seg([x, y], [x - l * 0.42, y + l], 3), taper(1.25, 0.45)));
    }
  },

  snow(d) {
    // six-armed flake, each arm a tapered band with two pairs of side barbs
    const c = 12;
    for (let i = 0; i < 6; i++) {
      const a = (i * 60 - 90) * DEG;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const tip: Pt = [c + ux * 10.6, c + uy * 10.6];
      d.ink(band(seg([c, c], tip, 8), lerpW(2.3, 1.1)));
      for (const [r, l] of [[5.2, 3.0], [8.0, 2.2]] as const) {
        for (const sgn of [-1, 1]) {
          const b = a + sgn * 50 * DEG;
          const p0: Pt = [c + ux * r, c + uy * r];
          const p1: Pt = [p0[0] + Math.cos(b) * l, p0[1] + Math.sin(b) * l];
          d.inkFine(band(seg(p0, p1, 3), lerpW(1.2, 0.6)));
        }
      }
    }
    d.ink(circ(c, c, 2.6));
    d.cut(circ(c, c, 1.1));
  },

  follow(d) {
    // an open eye: almond lids, iris with hatching, one gouged highlight
    const top = cubic([1.8, 12], [6.5, 4.6], [17.5, 4.6], [22.2, 12], 14);
    const bot = cubic([22.2, 12], [17.5, 19], [6.5, 19], [1.8, 12], 14);
    const almond: Poly = [...top, ...bot.slice(1, -1)];
    d.ink(almond);
    d.cut(shrink(almond, 1.6));
    d.layer();
    d.ink(circ(12, 11.9, 4.6));
    // a ring of short radial gouges for the iris, a solid pupil, one highlight
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 + 10) * DEG;
      d.cut(gouge([12 + Math.cos(a) * 2.4, 11.9 + Math.sin(a) * 2.4], [12 + Math.cos(a) * 3.9, 11.9 + Math.sin(a) * 3.9], 0.55));
    }
    d.cut(gouge([9.3, 10.4], [10.6, 8.8], 1.0));
    // lashes on the upper lid
    for (const x of [6.2, 9.4, 12.6, 15.8]) d.inkFine(band(seg([x + 0.3, 6.6], [x - 0.4, 3.6], 3), lerpW(1.1, 0.5)));
  },

  build(d) {
    // timber frame of a gable house going up: sill, two posts, tie beam, king post, rafters
    d.ink(band(seg([1.6, 21.2], [22.4, 21.2], 8), lerpW(2.6, 2.2)));
    d.layer();
    d.ink(band(seg([5.2, 12.4], [5.2, 20.6], 6), 2.1), band(seg([18.8, 12.4], [18.8, 20.6], 6), 2.1));
    d.inkFine(band(seg([5.6, 19.6], [10.4, 13.4], 5), 1.1));
    d.layer();
    d.ink(band(seg([3, 12.6], [21, 12.6], 8), 2));
    d.ink(band(seg([12, 3.6], [12, 12.4], 6), 1.7));
    d.layer();
    d.ink(band(seg([12, 2.2], [1.4, 13.4], 10), lerpW(2.6, 2.1)), band(seg([12, 2.2], [22.6, 13.4], 10), lerpW(2.6, 2.1)));
    d.cut(gouge([10.6, 4.6], [4.2, 11.2], 0.5), gouge([1.8, 21.2], [21.6, 21.2], 0.45));
  },

  rotate(d) {
    // a cut arrow running round three quarters of a ring, head at the top
    const arc = arcPts(12, 12.6, 8, 8, -70, 215, 30);
    d.ink(band(arc, lerpW(2.0, 2.8)));
    d.cut(band(arcPts(12, 12.6, 8, 8, 20, 190, 20), 0.5));
    d.ink([
      [12.6, 0.8],
      [19.6, 4.2],
      [13.2, 9.4],
      [14.4, 5.2],
    ]);
  },

  undo(d) {
    // hooked arrow: the way back to where the building was not
    d.ink(band([[8.6, 7.2], [14.2, 7.2], ...arcPts(14.2, 12.8, 5.6, 5.6, -90, 90, 16).slice(1), [5.2, 18.4]], lerpW(2.4, 2.0)));
    d.ink([
      [1.4, 7.2],
      [9.4, 2.2],
      [8.2, 7.2],
      [9.4, 12.2],
    ]);
    d.cut(band(arcPts(14.2, 12.8, 5.6, 5.6, -40, 60, 8), 0.45));
  },

  bridge_ice(d) {
    // wooden trestle bridge: rail, deck, piles
    d.inkFine(band(seg([1.2, 5.4], [22.8, 5.4], 10), 1.1));
    for (const x of [2.4, 8.2, 14, 19.8]) d.inkFine(band(seg([x, 5.4], [x, 8.8], 2), 1));
    d.ink(band(seg([0.8, 9.6], [23.2, 9.6], 12), 2.8));
    for (const x of [3.6, 8.2, 12.8, 17.4]) d.cut(gouge([x, 8.8], [x + 0.1, 10.4], 0.5));
    for (const x of [4.6, 12, 19.4]) d.ink(band(seg([x, 10.6], [x - 0.2, 15.6], 3), 1.7));
    // ice floes jammed against the piles, tilted slabs with hatched shadow
    d.layer();
    const floes: Poly[] = [
      [[0.8, 16.4], [6.8, 15], [8, 17.4], [1.6, 19.4]],
      [[8.6, 16.2], [14.4, 14.6], [16.2, 17.2], [9.4, 18.6]],
      [[16.8, 15.6], [23.2, 15], [23.2, 18.4], [17.6, 18.8]],
      [[3.6, 20], [10.8, 19.2], [11.6, 21.8], [4, 22.6]],
      [[12.8, 19.6], [20.4, 19.4], [20.8, 22.2], [13.2, 22.4]],
    ];
    for (const f of floes) {
      d.ink(f);
      d.cut(shrink(f, 0.75));
    }
    d.hatchInk([[9.6, 17.6], [15.4, 16.6], [15.8, 17.4], [9.6, 18.4]], -30, 1.2, 0.5);
    d.hatchInk([[4.4, 21.4], [10.8, 20.6], [11.2, 21.6], [4.6, 22.2]], -30, 1.2, 0.5);
  },

  contested(d) {
    // a cart track forking in two: the right fork is worn deep (the rival takes the goods),
    // the left fork fades out with gaps before it reaches its post
    const stem = seg([12, 23], [12, 14.6], 8);
    d.ink(band(stem, taper(3.2, 2.6)));
    const right = cubic([12, 15.2], [12.4, 10.6], [16.6, 8.4], [19.6, 4.8], 24);
    d.ink(band(right, taper(2.6, 1.9)));
    // arrowhead on the taken fork
    d.ink([[17.2, 3.6], [22.4, 1.4], [21.2, 6.8]]);
    // the faint fork: three dashes thinning out
    const left = cubic([11.6, 15.2], [11.2, 10.8], [7.4, 8.6], [4.4, 5.6], 24);
    for (const [a, b] of [[1, 7], [10, 15], [18, 22]] as const) d.inkFine(band(left.slice(a, b + 1), taper(1.5, 0.8)));
    // empty post at the end of the faint fork
    d.inkFine(band(seg([3.4, 6], [3.4, 1.2], 3), 0.9), circ(3.4, 1.6, 1.1));
    // wheel ruts gouged into the worn stem and fork
    d.cut(band(stem.slice(1, 7), taper(0.55, 0.2)), band(right.slice(3, 19), taper(0.5, 0.15)));
  },

  first(d) {
    // a castle's pennant on its pole (two castles, D-289): "this castle first". The swallow-tailed banner flies
    // right from a finial; a gouged stripe and hatching on its lit upper half, a mound of earth at the foot
    d.ink(band(seg([6.2, 22.6], [6.2, 3], 8), taper(2, 1.5)));
    d.ink(circ(6.2, 2.4, 1.6));
    d.ink([[2.2, 23.4], [3.8, 21.2], [6.2, 20.6], [8.8, 21.2], [10.6, 23.4]]);
    d.layer();
    const flag: Pt[] = [[7, 4], [11.4, 3.2], [16.2, 4.2], [22.4, 4], [18.2, 8.4], [22, 12.8], [16.4, 12.6], [11.6, 11.6], [7, 12.4]];
    d.ink(flag);
    d.cut(band(cubic([8.4, 8.2], [11.6, 7.2], [14.6, 8.6], [18.4, 8.2], 12), taper(0.7, 0.35)));
    d.hatchCut([[8.2, 5], [11.4, 4.4], [16, 5.4], [19.6, 5.2], [17, 7.2], [8.2, 7.2]], -50, 1.6, 0.55);
    d.cut(gouge([6.6, 6], [6.6, 18.6], 0.45));
  },

  back(d) {
    // arrowhead pointing left
    d.ink([
      [1.4, 12],
      [8.8, 6.6],
      [7.4, 10.8],
      [8, 12],
      [7.4, 13.2],
      [8.8, 17.4],
    ]);
    d.cut(gouge([3.6, 11.4], [7, 9.2], 0.5));
    // shaft
    d.ink(band(seg([7, 12], [20.4, 12], 8), 1.6));
    // fletching
    d.ink([
      [15.2, 11.4],
      [17.8, 7.2],
      [22.8, 7.2],
      [20.6, 11.4],
    ]);
    d.ink([
      [15.2, 12.6],
      [17.8, 16.8],
      [22.8, 16.8],
      [20.6, 12.6],
    ]);
  },
};

function pennants(d: Draw, xs: number[]): void {
  for (const x of xs) {
    d.ink([
      [x, 5],
      [x + 8.4, 12],
      [x, 19],
      [x + 3, 12],
    ]);
    d.cut(gouge([x + 1.3, 7.2], [x + 6.2, 11.3], 0.55));
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const fmt = (n: number): string => {
  const v = Math.round(n * 100) / 100;
  return Object.is(v, -0) ? '0' : String(v);
};

function pathData(layer: Piece[]): string {
  return layer
    .map(({ poly }) => 'M' + poly.map((p) => fmt(p[0]) + ' ' + fmt(p[1])).join('L') + 'Z')
    .join('');
}

function render(layers: Piece[][]): string {
  return layers
    .filter((l) => l.some((p) => p.ink))
    .map((l) => `<path fill="currentColor" d="${pathData(l)}"/>`)
    .join('');
}

/** Remove a straight band (around the line a-b) from every polygon: room for a strike bar. */
function cutBand(layers: Piece[][], a: Pt, b: Pt, halfWidth: number): Piece[][] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy);
  const nx = -dy / l;
  const ny = dx / l;
  const c = nx * a[0] + ny * a[1];
  return layers.map((layer) =>
    layer.flatMap((pc) => {
      const out: Piece[] = [];
      const s1 = clipHalf(pc.poly, nx, ny, c - halfWidth);
      const s2 = clipHalf(pc.poly, -nx, -ny, -(c + halfWidth));
      if (s1.length >= 3) out.push({ poly: s1, ink: pc.ink });
      if (s2.length >= 3) out.push({ poly: s2, ink: pc.ink });
      return out;
    }),
  );
}

function draw(id: string, fn: (d: Draw) => void): Piece[][] {
  const d = new Draw(rng(id));
  fn(d);
  return d.layers;
}

const STRIKE_GAP = 2.4;
const STRUCK: ReadonlySet<IconId> = new Set<IconId>(['no_road', 'no_wagon']);

function build(): { icons: Record<IconId, string>; geom: Record<IconId, Piece[][]> } {
  const icons = {} as Record<IconId, string>;
  const geom = {} as Record<IconId, Piece[][]>;
  const strike = draw('strike', strikeBar);
  for (const id of Object.keys(DEFS) as IconId[]) {
    let layers = draw(id, DEFS[id]);
    geom[id] = layers;
    if (id === 'strike') {
      icons[id] = strikeMarkup(strike);
      continue;
    }
    if (STRUCK.has(id)) layers = [...cutBand(layers, STRIKE_A, STRIKE_B, STRIKE_GAP), ...strike];
    icons[id] = render(layers);
  }
  return { icons, geom };
}

/**
 * The strike overlay carries an optional halo (set `--icon-halo` to the background colour
 * on the container) so it stays legible when stacked over another icon.
 */
function strikeMarkup(strike: Piece[][]): string {
  const halo = band(cubic(STRIKE_A, [8.5, 8.6], [14, 14.6], STRIKE_B, 12), taper(2.5 + STRIKE_GAP * 1.4, 2.2));
  const haloD = 'M' + halo.map((p) => fmt(p[0]) + ' ' + fmt(p[1])).join('L') + 'Z';
  return `<path style="fill:var(--icon-halo,transparent)" d="${haloD}"/>` + render(strike);
}

const BUILT = build();

/** Inner SVG markup (paths) for each icon, 24 x 24 viewBox, `fill="currentColor"`. */
export const ICONS: Record<IconId, string> = BUILT.icons;

export const ICON_IDS = Object.keys(ICONS) as IconId[];

/** Goods icons, in production-chain order. */
export const GOOD_ICONS = ['wood', 'planks', 'grain', 'flour', 'bread', 'fish', 'stone', 'charcoal', 'malt', 'beer'] as const satisfies readonly IconId[];

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Icons whose drawing points along the reading direction and so turn round under `dir=rtl` (D-334): the pennant
 * flying from its pole ('first', and the destination pennant at the end of the broken way in 'no_route'). The SVG
 * gets `class="ico-rtl"`; the stylesheet mirrors it with `scale` (composes with `:active` translate transforms).
 * Never mirrored: goods and buildings (shapes are their identity), wagon / no_wagon / buy_wagon (a picture of a
 * cart, the 3D wagons keep their real heading), rotate (a physical clockwise turn), speed1/2/4 (playback speed,
 * like media controls), contested (a fork drawn as on the ground), weather, coin, seal, eye. 'back' and 'undo' are
 * turned by their call sites (`.rtl-flip`, or `.fwd` for the back arrow used as "go to"), since `.fwd` relies on
 * the unflipped glyph.
 */
export const RTL_MIRROR: ReadonlySet<IconId> = new Set<IconId>(['first', 'no_route']);

function wrap(inner: string, size: number, title?: string, id?: IconId): string {
  const a11y = title ? `aria-label="${escapeAttr(title)}"` : 'aria-hidden="true" focusable="false"';
  const cls = id && RTL_MIRROR.has(id) ? ' class="ico-rtl"' : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" role="img"${cls} ${a11y}>` +
    inner +
    '</svg>'
  );
}

/** A complete `<svg>` element for an icon. */
export function iconSvg(id: IconId, size = 24, title?: string): string {
  return wrap(ICONS[id], size, title, id);
}

/**
 * An icon with the strike bar cut cleanly through it (e.g. "missing flour" = flour + strike).
 * Better than stacking `strike` over an icon because the bar gets a real paper gap.
 */
export function struckIconSvg(id: IconId, size = 24, title?: string): string {
  const strike = BUILT.geom.strike;
  const inner = render([...cutBand(BUILT.geom[id], STRIKE_A, STRIKE_B, STRIKE_GAP), ...strike]);
  return wrap(inner, size, title, id);
}
