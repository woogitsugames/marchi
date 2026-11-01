/**
 * Reusable construction pieces (beams, rods, roofs, walls, framing) built on `PartBuilder`.
 * All dimensions are metres.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Matrix4,
  Shape,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import { type AddOpts, between, PartBuilder, trs, v3 } from './kit';
import type { MatKey } from './materials';

export type Opts = Omit<AddOpts, 'm'>;

/**
 * Box between two points (long axis a→b), cross-section `w` × `h`. The `h` side is oriented
 * toward `up` (default world up, or +Z for vertical beams).
 */
export function beam(b: PartBuilder, mat: MatKey, a: Vector3, c: Vector3, w: number, h: number, o: Opts, up?: Vector3): void {
  const d = new Vector3().subVectors(c, a);
  const len = d.length();
  d.divideScalar(len || 1);
  const z = (up ? up.clone() : Math.abs(d.y) > 0.95 ? v3(0, 0, 1) : v3(0, 1, 0));
  z.addScaledVector(d, -d.dot(z)).normalize();
  const x = new Vector3().crossVectors(d, z);
  const m = new Matrix4().makeBasis(x, d, z).multiply(new Matrix4().makeScale(1, len, 1));
  m.setPosition(new Vector3().addVectors(a, c).multiplyScalar(0.5));
  b.add(mat, new BoxGeometry(w, 1, h), { ...o, m });
}

/** Cylinder (optionally tapered) between two points. */
export function rod(b: PartBuilder, mat: MatKey, a: Vector3, c: Vector3, r1: number, r2: number, seg: number, o: Opts, open = false): void {
  // CylinderGeometry radiusTop is at +Y (= c)
  b.add(mat, new CylinderGeometry(r2, r1, 1, seg, 1, open), { ...o, m: between(a, c) });
}

/** Axis-aligned (then transformed) box with optional segments for colour/jitter resolution. */
export function box(b: PartBuilder, mat: MatKey, w: number, h: number, d: number, m: Matrix4, o: Opts, seg = 0): void {
  const s = (len: number) => (seg > 0 ? Math.max(1, Math.round(len / seg)) : 1);
  b.add(mat, new BoxGeometry(w, h, d, s(w), s(h), s(d)), { ...o, m });
}

export function sphere(b: PartBuilder, mat: MatKey, m: Matrix4, o: Opts, ws = 10, hs = 7): void {
  b.add(mat, new SphereGeometry(1, ws, hs), { ...o, m });
}

export function lathe(b: PartBuilder, mat: MatKey, profile: [number, number][], seg: number, m: Matrix4, o: Opts): void {
  b.add(mat, new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), seg), { ...o, m });
}

export interface RoofSpec {
  /** Ridge runs along X from x0 to x1 (wall extents). */
  x0: number;
  x1: number;
  /** Z extents of the walls the roof sits on. */
  z0: number;
  z1: number;
  /** Wall-top height. */
  eaveY: number;
  pitchDeg: number;
  thickness: number;
  /** Eave overhang beyond the walls along the slope plan (m). */
  overhang: number;
  /** Overhang beyond the gable walls. */
  gableOverhang: number;
  /** Max random eave length variation (m), 0 for a clean cut. */
  ragged: number;
  /** Segment length for slope/ridge subdivision (m). */
  segLen?: number;
  jitter?: number;
  color: string;
  ridgeColor?: string;
  /** Ridge treatment: thatch roll or a board ridge. */
  ridge: 'roll' | 'board' | 'none';
}

/** Ridge height of a roof spec. */
export function ridgeY(s: RoofSpec): number {
  return s.eaveY + ((s.z1 - s.z0) / 2) * Math.tan((s.pitchDeg * Math.PI) / 180);
}

/** Thick gable roof (thatch or shingles) with optional ragged eaves. */
export function gableRoof(b: PartBuilder, mat: MatKey, s: RoofSpec, extra?: Matrix4): void {
  const p = (s.pitchDeg * Math.PI) / 180;
  const half = (s.z1 - s.z0) / 2;
  const cz = (s.z0 + s.z1) / 2;
  const cx = (s.x0 + s.x1) / 2;
  const ry = ridgeY(s);
  const run = half + s.overhang;
  const slope = run / Math.cos(p);
  const width = s.x1 - s.x0 + 2 * s.gableOverhang;
  const segLen = s.segLen ?? 0.55;
  const nx = Math.max(2, Math.round(width / segLen));
  const ny = Math.max(2, Math.round(slope / segLen));
  for (const side of [1, -1]) {
    const g = new BoxGeometry(width, s.thickness, slope, nx, 1, ny);
    const pos = g.getAttribute('position');
    // ragged eave: lengthen/shorten columns at the eave end, slightly droop them
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i) * side; // +slope/2 = eave end
      const x = pos.getX(i);
      if (s.ragged > 0 && z > slope / 2 - 1e-4) {
        const col = Math.round((x / width) * nx * 2);
        const k = Math.sin(col * 12.9898 + side * 78.233) * 43758.5453;
        const rr = k - Math.floor(k);
        pos.setZ(i, pos.getZ(i) + side * (rr - 0.35) * s.ragged);
        pos.setY(i, pos.getY(i) - rr * s.ragged * 0.25);
      }
      // thatch thins slightly toward the ridge
      if (z < -slope / 2 + 1e-4 && pos.getY(i) > 0) pos.setY(i, pos.getY(i) - s.thickness * 0.25);
    }
    g.computeVertexNormals();
    const theta = side * p;
    const nrm = v3(0, Math.cos(p), side * Math.sin(p));
    const mid = v3(cx, ry - (run * Math.tan(p)) / 2, cz + (side * run) / 2).add(nrm.multiplyScalar(s.thickness / 2));
    let m = trs(mid.x, mid.y, mid.z, theta, 0, 0);
    if (extra) m = extra.clone().multiply(m);
    b.add(mat, g, {
      color: s.color,
      m,
      jitter: s.jitter ?? 0.04,
      jitterFreq: 1.6,
      noise: 0.1,
      noiseFreq: 0.9,
      ao: 0.15,
      dirt: 0,
      shade: (q, n, c) => {
        // weathered, darker toward eaves and on undersides
        const t = (ry - q.y) / (run * Math.tan(p) + 0.01);
        c.multiplyScalar(1 - 0.18 * Math.max(0, Math.min(1, t)));
        if (n.y < -0.3) c.multiplyScalar(0.6);
      },
    });
  }
  if (s.ridge !== 'none') {
    const rc = s.ridgeColor ?? s.color;
    const ex = extra ?? new Matrix4();
    if (s.ridge === 'roll') {
      const rr = s.thickness * 0.9;
      const g = new CylinderGeometry(rr, rr, width + 0.1, 10, Math.max(2, nx), false);
      b.add(mat, g, {
        color: rc,
        m: ex.clone().multiply(trs(cx, ry + s.thickness * 0.75, cz, 0, 0, Math.PI / 2, 1, 1, 0.8)),
        jitter: 0.04,
        jitterFreq: 2,
        ao: 0,
        dirt: 0,
        noise: 0.12,
      });
    } else {
      for (const side of [1, -1]) {
        const g = new BoxGeometry(width + 0.06, 0.035, 0.26);
        const nrm = v3(0, Math.cos(p), side * Math.sin(p));
        const at = v3(cx, ry, cz).add(nrm.clone().multiplyScalar(s.thickness + 0.02)).add(v3(0, -Math.sin(p) * 0.11, side * Math.cos(p) * 0.11));
        b.add(mat, g, { color: rc, m: ex.clone().multiply(trs(at.x, at.y, at.z, side * p, 0, 0)), ao: 0, dirt: 0 });
      }
    }
  }
}

/**
 * Wall with a gable on top, as an extruded pentagon in the plane perpendicular to X.
 * `z0..z1` wall span, `x` position of the wall's outer face, extruded `thick` toward +X when
 * `dir` = 1, −X when `dir` = −1.
 */
export function gableEnd(b: PartBuilder, mat: MatKey, x: number, dir: 1 | -1, z0: number, z1: number, y0: number, eaveY: number, pitchDeg: number, thick: number, o: Opts): void {
  const half = (z1 - z0) / 2;
  const top = eaveY + half * Math.tan((pitchDeg * Math.PI) / 180);
  const sh = new Shape();
  sh.moveTo(-half, y0);
  sh.lineTo(half, y0);
  sh.lineTo(half, eaveY);
  sh.lineTo(0, top);
  sh.lineTo(-half, eaveY);
  sh.closePath();
  const g = new ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false, steps: 1 });
  // shape x → model z (centred), extrude z → model x
  const cz = (z0 + z1) / 2;
  const m = new Matrix4().makeBasis(v3(0, 0, -1), v3(0, 1, 0), v3(dir, 0, 0)).setPosition(x, 0, cz);
  b.add(mat, g, { ...o, m });
}

export interface Opening {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/**
 * Half-timbering on one wall face. The wall runs from `origin` along unit `along` for
 * `length`; `out` is the outward normal. Beams protrude slightly from the infill.
 */
export function timberFrame(
  b: PartBuilder,
  origin: Vector3,
  along: Vector3,
  out: Vector3,
  length: number,
  height: number,
  color: string,
  openings: Opening[] = [],
  bay = 1.6,
): void {
  const w = 0.17;
  const at = (u: number, v: number, d = 0.03) =>
    origin.clone().addScaledVector(along, u).add(v3(0, v, 0)).addScaledVector(out, d);
  const o: Opts = { color, noise: 0.12, vary: 0.1, jitter: 0.008, jitterFreq: 4 };
  beam(b, 'wood', at(-0.08, w / 2), at(length + 0.08, w / 2), w, w, o); // sill
  beam(b, 'wood', at(-0.08, height - w / 2), at(length + 0.08, height - w / 2), w, w, o); // top plate
  const n = Math.max(1, Math.round(length / bay));
  const posts: number[] = [];
  for (let i = 0; i <= n; i++) posts.push((i / n) * length);
  const blocked = (u: number) => openings.some((q) => u > q.u0 - 0.12 && u < q.u1 + 0.12);
  for (const u of posts) {
    if (blocked(u)) continue;
    const uu = Math.min(Math.max(u, w / 2), length - w / 2);
    beam(b, 'wood', at(uu, w), at(uu, height - w), w * 0.95, w, o);
  }
  // door/window posts and lintels
  for (const q of openings) {
    beam(b, 'wood', at(q.u0 - w / 2, w), at(q.u0 - w / 2, height - w), w, w, o);
    beam(b, 'wood', at(q.u1 + w / 2, w), at(q.u1 + w / 2, height - w), w, w, o);
    beam(b, 'wood', at(q.u0 - w, q.v1 + w / 2), at(q.u1 + w, q.v1 + w / 2), w, w, o);
    if (q.v0 > 0.3) beam(b, 'wood', at(q.u0 - w, q.v0 - w / 2), at(q.u1 + w, q.v0 - w / 2), w, w, o);
  }
  // mid rail and corner braces in each free bay
  const mid = height * 0.5;
  for (let i = 0; i < n; i++) {
    const a = posts[i], c = posts[i + 1];
    const free = !openings.some((q) => q.u1 > a && q.u0 < c);
    if (!free) continue;
    beam(b, 'wood', at(a, mid), at(c, mid), w * 0.85, w * 0.85, o);
    if (i === 0) beam(b, 'wood', at(a + 0.1, w), at(c - 0.05, mid), w * 0.8, w * 0.8, o, out);
    else if (i === n - 1) beam(b, 'wood', at(c - 0.1, w), at(a + 0.05, mid), w * 0.8, w * 0.8, o, out);
  }
}

/** Plank door (or window shutter) set into a wall face. */
export function door(b: PartBuilder, center: Vector3, out: Vector3, w: number, h: number, color = '#4a3b2c'): void {
  const ry = Math.atan2(out.x, out.z);
  const boards = Math.max(2, Math.round(w / 0.22));
  for (let i = 0; i < boards; i++) {
    const u = -w / 2 + (i + 0.5) * (w / boards);
    const m = trs(center.x, center.y, center.z, 0, ry).multiply(trs(u, 0, 0.02));
    box(b, 'wood', w / boards - 0.012, h, 0.05, m, { color, vary: 0.12, noise: 0.1, ao: 0.3 });
  }
  // dark gap behind (reads as depth at the edges)
  box(b, 'wood', w + 0.04, h + 0.04, 0.02, trs(center.x, center.y, center.z, 0, ry), { color: '#231d17', vary: 0, ao: 0 });
  for (const v of [-h * 0.3, h * 0.3]) {
    box(b, 'wood', w * 0.92, 0.1, 0.04, trs(center.x, center.y, center.z, 0, ry).multiply(trs(0, v, 0.06)), { color, vary: 0.05 });
  }
}

/** Small shuttered window opening (dark void + two open shutters). */
export function windowHole(b: PartBuilder, center: Vector3, out: Vector3, w = 0.55, h = 0.45, color = '#4f4031'): void {
  const ry = Math.atan2(out.x, out.z);
  const base = trs(center.x, center.y, center.z, 0, ry);
  box(b, 'wood', w, h, 0.04, base.clone().multiply(trs(0, 0, 0.0)), { color: '#1f1a15', vary: 0, ao: 0, noise: 0 });
  for (const s of [-1, 1]) {
    box(b, 'wood', w / 2, h, 0.035, base.clone().multiply(trs(s * (w / 2 + w / 4 + 0.02), 0, 0.05, 0, s * 0.25)), { color, vary: 0.1 });
  }
}

/** Stack of horizontal logs (log pile), logs along X. */
export function logPile(b: PartBuilder, center: Vector3, ry: number, len: number, rows: number, r = 0.13): void {
  const base = trs(center.x, center.y, center.z, 0, ry);
  for (let row = 0; row < rows; row++) {
    const cnt = rows - row + 2;
    for (let i = 0; i < cnt; i++) {
      const rr = r * (0.85 + b.r(0, 0.3));
      const z = (i - (cnt - 1) / 2) * r * 2.02 + (row % 2) * 0.01;
      const y = r + row * r * 1.75;
      const dl = b.r(-0.15, 0.15);
      logGeom(b, base.clone().multiply(trs(dl, y, z, b.r(-0.03, 0.03), 0, Math.PI / 2)), rr, len);
    }
  }
}

/** One log with bark and lighter end grain; axis along local Y before `m`. */
export function logGeom(b: PartBuilder, m: Matrix4, r: number, len: number, seg = 8): void {
  const g = new CylinderGeometry(r, r * 1.04, len, seg, 1, false);
  b.add('bark', g, {
    color: '#544636',
    m,
    jitter: r * 0.12,
    jitterFreq: 5,
    noise: 0.12,
    shade: (_p, n, c) => {
      // caps: the end grain. Normal ~ parallel to the log axis
      const ax = new Vector3(0, 1, 0).transformDirection(m);
      if (Math.abs(n.dot(ax)) > 0.7) c.set('#a8916c');
    },
  });
}

/** Simple post-and-rail fence from a to c (ground level). */
export function fenceRun(b: PartBuilder, a: Vector3, c: Vector3, h = 1.1, color = '#5f5243'): void {
  const len = a.distanceTo(c);
  const n = Math.max(1, Math.round(len / 2));
  const dir = new Vector3().subVectors(c, a).normalize();
  for (let i = 0; i <= n; i++) {
    const p = a.clone().addScaledVector(dir, (i / n) * len);
    rod(b, 'wood', p.clone().setY(-0.1), p.clone().setY(h + b.r(-0.05, 0.08)), 0.065, 0.055, 6, { color, vary: 0.12, jitter: 0.01 });
  }
  for (const hy of [h * 0.45, h * 0.88]) {
    rod(b, 'wood', a.clone().setY(hy + b.r(-0.03, 0.03)).addScaledVector(dir, -0.1), c.clone().setY(hy + b.r(-0.03, 0.03)).addScaledVector(dir, 0.1), 0.045, 0.04, 5, {
      color,
      vary: 0.15,
      jitter: 0.015,
      jitterFreq: 1.5,
    });
  }
}

/** Woven wattle fence panel from a to c (lower, denser). */
export function wattleRun(b: PartBuilder, a: Vector3, c: Vector3, h = 0.9, color = '#6a5a45'): void {
  const len = a.distanceTo(c);
  const n = Math.max(2, Math.round(len / 0.6));
  const dir = new Vector3().subVectors(c, a).normalize();
  for (let i = 0; i <= n; i++) {
    const p = a.clone().addScaledVector(dir, (i / n) * len);
    rod(b, 'wood', p.clone().setY(-0.05), p.clone().setY(h + 0.08), 0.03, 0.025, 4, { color, vary: 0.1 });
  }
  const side = v3(-dir.z, 0, dir.x);
  for (let k = 0; k < 5; k++) {
    const y = 0.15 + (k / 4) * (h - 0.2);
    const off = side.clone().multiplyScalar(k % 2 ? 0.02 : -0.02);
    beam(b, 'wood', a.clone().setY(y).add(off), c.clone().setY(y).add(off), 0.035, 0.12, { color, vary: 0.12, noise: 0.15, jitter: 0.02, jitterFreq: 1.3 });
  }
}

export const isGeom = (g: unknown): g is BufferGeometry => g instanceof BufferGeometry;
