/**
 * Reusable construction pieces (beams, rods, roofs, walls, framing) built on `PartBuilder`.
 * All dimensions are metres.
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  Shape,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import { type AddOpts, between, fnoise, PartBuilder, trs, v3 } from './kit';
import type { MatKey } from './materials';

export type Opts = Omit<AddOpts, 'm'>;

const MOSS = new Color('#5f5a40');

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

/**
 * One roof slab in local space: x across (width), y through the thickness, z down the slope
 * (ridge at −slope/2, eave at +slope/2). Dense top grid (for lumps and colour streaks), single
 * underside, crisp eave/gable/ridge edges. The eave edge is ragged per column.
 */
function roofSlab(width: number, t: number, slope: number, nx: number, ny: number, ragged: number, seed: number): BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const col: { dz: number; dy: number }[] = [];
  for (let i = 0; i <= nx; i++) {
    const k = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
    const rr = k - Math.floor(k);
    col.push({ dz: ragged > 0 ? (rr - 0.35) * ragged : 0, dy: ragged > 0 ? -rr * ragged * 0.3 : 0 });
  }
  const X = (i: number) => -width / 2 + (i / nx) * width;
  const topY = (j: number) => t / 2 - t * 0.3 * (1 - j / ny); // thinner toward the ridge
  const eaveZ = (i: number) => slope / 2 + col[i].dz;
  const vert = (x: number, y: number, z: number) => (pos.push(x, y, z), pos.length / 3 - 1);
  // top grid
  const top: number[][] = [];
  for (let j = 0; j <= ny; j++) {
    const row: number[] = [];
    for (let i = 0; i <= nx; i++) {
      const z = j === ny ? eaveZ(i) : -slope / 2 + (j / ny) * slope;
      row.push(vert(X(i), topY(j) + (j === ny ? col[i].dy : 0), z));
    }
    top.push(row);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = top[j][i], b = top[j][i + 1], c = top[j + 1][i], d = top[j + 1][i + 1];
    idx.push(a, c, b, b, c, d);
  }
  // underside (two rows)
  const bot0: number[] = [], bot1: number[] = [];
  for (let i = 0; i <= nx; i++) {
    bot0.push(vert(X(i), -t / 2, -slope / 2));
    bot1.push(vert(X(i), -t / 2 + col[i].dy, eaveZ(i) - 0.02));
  }
  for (let i = 0; i < nx; i++) idx.push(bot0[i], bot0[i + 1], bot1[i], bot0[i + 1], bot1[i + 1], bot1[i]);
  // eave edge (+z) and ridge edge (−z)
  const e0: number[] = [], e1: number[] = [], r0: number[] = [], r1: number[] = [];
  for (let i = 0; i <= nx; i++) {
    e0.push(vert(X(i), topY(ny) + col[i].dy, eaveZ(i)));
    e1.push(vert(X(i), -t / 2 + col[i].dy, eaveZ(i) - 0.02));
    r0.push(vert(X(i), topY(0), -slope / 2));
    r1.push(vert(X(i), -t / 2, -slope / 2));
  }
  for (let i = 0; i < nx; i++) {
    idx.push(e0[i], e1[i], e0[i + 1], e0[i + 1], e1[i], e1[i + 1]);
    idx.push(r0[i], r0[i + 1], r1[i], r0[i + 1], r1[i + 1], r1[i]);
  }
  // gable edges
  for (const [i, sgn] of [[0, -1], [nx, 1]] as const) {
    const tp: number[] = [], bt: number[] = [];
    for (let j = 0; j <= ny; j++) {
      const z = j === ny ? eaveZ(i) : -slope / 2 + (j / ny) * slope;
      tp.push(vert(X(i), topY(j) + (j === ny ? col[i].dy : 0), z));
      bt.push(vert(X(i), -t / 2 + (j === ny ? col[i].dy : 0), z - (j === ny ? 0.02 : 0)));
    }
    for (let j = 0; j < ny; j++) {
      if (sgn > 0) idx.push(tp[j], tp[j + 1], bt[j], tp[j + 1], bt[j + 1], bt[j]);
      else idx.push(tp[j], bt[j], tp[j + 1], tp[j + 1], bt[j], bt[j + 1]);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
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
  const thatch = mat === 'thatch';
  const segLen = s.segLen ?? 0.55;
  const nx = Math.max(2, Math.round(width / (thatch ? segLen * 0.5 : segLen)));
  const ny = Math.max(2, Math.round(slope / segLen));
  for (const side of [1, -1]) {
    const g = roofSlab(width, s.thickness, slope, nx, ny, s.ragged, side + s.x0 * 3.1);
    const nrm = v3(0, Math.cos(p), side * Math.sin(p));
    const mid = v3(cx, ry - (run * Math.tan(p)) / 2, cz + (side * run) / 2).add(nrm.multiplyScalar(s.thickness / 2));
    let m = trs(mid.x, mid.y, mid.z, p, side > 0 ? 0 : Math.PI, 0);
    if (extra) m = extra.clone().multiply(m);
    b.add(mat, g, {
      color: s.color,
      m,
      jitter: s.jitter ?? 0.04,
      jitterFreq: 1.6,
      renormal: true,
      noise: thatch ? 0.08 : 0.1,
      noiseFreq: 0.9,
      ao: 0.15,
      dirt: 0,
      shade: (q, n, c) => {
        // weathered: darker toward the eaves, combed streaks running down the slope
        const t = (ry - q.y) / (run * Math.tan(p) + 0.01);
        c.multiplyScalar(1 - 0.22 * Math.max(0, Math.min(1, t)));
        if (thatch) {
          const along = Math.abs(n.z) > Math.abs(n.x) ? q.x : q.z;
          c.multiplyScalar(1 + 0.16 * fnoise(along * 3.3, q.y * 0.35, 0.5, 21));
          const patch = fnoise(q.x * 0.35, q.y * 0.5, q.z * 0.35, 22);
          if (patch > 0.25) c.lerp(MOSS, Math.min(0.45, (patch - 0.25) * 1.5));
        }
        if (n.y < -0.3) c.multiplyScalar(0.55);
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

export interface LoftSection {
  /** Centre of the cross-section. */
  c: Vector3;
  /** Half-width along the side axis and half-height across it. */
  rx: number;
  ry: number;
}

/**
 * Smooth tube through elliptical cross-sections along a spine (organic shapes: horse body,
 * legs, tails). Rings are perpendicular to the spine tangent; `side` fixes the rx axis.
 * Ends are closed with a fan.
 */
export function loftGeometry(secs: LoftSection[], seg: number, side = v3(1, 0, 0)): BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = secs.length;
  for (let i = 0; i < n; i++) {
    const a = secs[Math.max(0, i - 1)].c, c = secs[Math.min(n - 1, i + 1)].c;
    const t = new Vector3().subVectors(c, a).normalize();
    const s = side.clone().addScaledVector(t, -side.dot(t)).normalize();
    const u = new Vector3().crossVectors(t, s);
    for (let j = 0; j < seg; j++) {
      const th = (j / seg) * Math.PI * 2;
      const p = secs[i].c.clone().addScaledVector(s, Math.cos(th) * secs[i].rx).addScaledVector(u, Math.sin(th) * secs[i].ry);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = (i + 1) * seg + j, c = i * seg + ((j + 1) % seg), d = (i + 1) * seg + ((j + 1) % seg);
      idx.push(a, c, b, c, d, b);
    }
  }
  const s0 = pos.length / 3;
  pos.push(secs[0].c.x, secs[0].c.y, secs[0].c.z);
  const e0 = s0 + 1;
  pos.push(secs[n - 1].c.x, secs[n - 1].c.y, secs[n - 1].c.z);
  for (let j = 0; j < seg; j++) {
    const jn = (j + 1) % seg;
    idx.push(s0, jn, j);
    idx.push(e0, (n - 1) * seg + j, (n - 1) * seg + jn);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Shorthand: loft section from (x, y, z, rx, ry). */
export const sec = (x: number, y: number, z: number, rx: number, ry = rx): LoftSection => ({ c: v3(x, y, z), rx, ry });

export interface ThatchSpec {
  /** Wall extents (ridge along X). */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  eaveY: number;
  pitchDeg: number;
  /** Overhang beyond the walls (all sides). */
  overhang: number;
  /** Gable end treatment: plain gable, half-hip (naczółek) or full hip. */
  hip: 'gable' | 'half' | 'full';
  thickness: number;
  ragged: number;
  color: string;
  ridgeColor: string;
  /** Grid spacing (m). */
  cell?: number;
}

function thatchFrame(s: ThatchSpec) {
  const tanP = Math.tan((s.pitchDeg * Math.PI) / 180);
  const tanH = Math.tan(((s.pitchDeg + 6) * Math.PI) / 180);
  const X0 = s.x0 - s.overhang, X1 = s.x1 + s.overhang, Z0 = s.z0 - s.overhang, Z1 = s.z1 + s.overhang;
  const rise = tanP * ((Z1 - Z0) / 2);
  const hipBase = s.hip === 'gable' ? 1e9 : s.hip === 'full' ? 0 : rise * 0.58;
  const yE = s.eaveY - s.overhang * tanP;
  /** Rafter (underside) height at a plan point. */
  const under = (x: number, z: number) => {
    const dz = Math.min(z - Z0, Z1 - z), dx = Math.min(x - X0, X1 - x);
    return yE + Math.min(tanP * dz, hipBase + tanH * dx);
  };
  return { tanP, tanH, X0, X1, Z0, Z1, rise, hipBase, yE, under };
}

/** Underside height of a thatch roof at (x, z) — for clipping gable boards under it. */
export function thatchUnderY(s: ThatchSpec, x: number, z: number): number {
  return thatchFrame(s).under(x, z);
}

/**
 * Thick thatch roof built as a heightfield "hood" over the plan: soft rounded ridge and hips,
 * a ragged eave skirt all round, lumpy surface and combed streaks in the vertex colour.
 */
export function thatchRoof(b: PartBuilder, s: ThatchSpec): void {
  const f = thatchFrame(s);
  const cell = s.cell ?? 0.42;
  const nx = Math.max(4, Math.round((f.X1 - f.X0) / cell));
  const nz = Math.max(4, Math.round((f.Z1 - f.Z0) / cell));
  const t = s.thickness;
  const pos: number[] = [];
  const idx: number[] = [];
  const id = (i: number, j: number) => j * (nx + 1) + i;
  const rag = (i: number, j: number) => {
    const k = Math.sin(i * 12.9898 + j * 78.233 + s.x0 * 3.7) * 43758.5453;
    return k - Math.floor(k);
  };
  const border = (i: number, j: number) => i === 0 || j === 0 || i === nx || j === nz;
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      let x = f.X0 + (i / nx) * (f.X1 - f.X0);
      let z = f.Z0 + (j / nz) * (f.Z1 - f.Z0);
      let y = f.under(x, z) + t;
      if (border(i, j)) {
        // ragged eave: push the edge out/in and let it sag a little
        const r = rag(i, j);
        const out = (r - 0.4) * s.ragged;
        if (i === 0) x -= out; else if (i === nx) x += out;
        if (j === 0) z -= out; else if (j === nz) z += out;
        y -= r * s.ragged * 0.35;
      }
      pos.push(x, y, z);
    }
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = id(i, j), bb = id(i + 1, j), c = id(i, j + 1), d = id(i + 1, j + 1);
    // split along the shorter diagonal-ish: alternate for symmetry
    if ((i < nx / 2) === (j < nz / 2)) idx.push(a, c, d, a, d, bb);
    else idx.push(a, c, bb, bb, c, d);
  }
  // skirt (eave edge) around the perimeter: duplicate the border ring and drop it by the thickness
  const ring: number[] = [];
  for (let i = 0; i <= nx; i++) ring.push(id(i, 0));
  for (let j = 1; j <= nz; j++) ring.push(id(nx, j));
  for (let i = nx - 1; i >= 0; i--) ring.push(id(i, nz));
  for (let j = nz - 1; j >= 1; j--) ring.push(id(0, j));
  const topRing: number[] = [], botRing: number[] = [];
  for (const v of ring) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    topRing.push(pos.length / 3);
    pos.push(x, y, z);
    botRing.push(pos.length / 3);
    pos.push(x, y - t * 1.05, z);
  }
  const n = ring.length;
  for (let k = 0; k < n; k++) {
    const a = topRing[k], bb = topRing[(k + 1) % n], c = botRing[k], d = botRing[(k + 1) % n];
    idx.push(a, bb, c, bb, d, c);
  }
  // coarse underside so the roof is not see-through at grazing angles
  const ux = 4, uz = 4, ub = pos.length / 3;
  for (let j = 0; j <= uz; j++) for (let i = 0; i <= ux; i++) {
    const x = f.X0 + (i / ux) * (f.X1 - f.X0), z = f.Z0 + (j / uz) * (f.Z1 - f.Z0);
    pos.push(x, f.under(x, z) - 0.02, z);
  }
  for (let j = 0; j < uz; j++) for (let i = 0; i < ux; i++) {
    const a = ub + j * (ux + 1) + i, bb = a + 1, c = a + ux + 1, d = c + 1;
    idx.push(a, bb, c, bb, d, c);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const ridgeTop = f.yE + f.rise + t;
  b.add('thatch', g, {
    color: s.color,
    jitter: 0.05,
    jitterFreq: 1.4,
    renormal: true,
    noise: 0.07,
    noiseFreq: 0.8,
    ao: 0.1,
    dirt: 0,
    shade: (q, nn, c) => {
      // darker toward the eaves, combed streaks down the slope, mossy weathered patches
      const tt = (ridgeTop - q.y) / (f.rise + 0.01);
      c.multiplyScalar(1 - 0.24 * Math.max(0, Math.min(1, tt)));
      const along = Math.abs(nn.z) >= Math.abs(nn.x) ? q.x : q.z;
      c.multiplyScalar(1 + 0.18 * fnoise(along * 3.1, q.y * 0.3, 0.5, 21));
      const patch = fnoise(q.x * 0.35, q.y * 0.5, q.z * 0.35, 22);
      if (patch > 0.2) c.lerp(MOSS, Math.min(0.5, (patch - 0.2) * 1.4));
      if (nn.y < -0.3) c.multiplyScalar(0.5);
    },
  });
  // ridge roll between the hips
  const half = (f.rise - Math.min(f.rise, f.hipBase)) / f.tanH;
  const rx0 = f.X0 + half, rx1 = f.X1 - half;
  if (rx1 - rx0 > 0.3) {
    const len = rx1 - rx0;
    b.add('thatch', new CylinderGeometry(t * 0.75, t * 0.75, len, 8, Math.max(2, Math.round(len / 0.5)), false), {
      color: s.ridgeColor,
      m: trs((rx0 + rx1) / 2, ridgeTop - t * 0.15, (s.z0 + s.z1) / 2, 0, 0, Math.PI / 2, 1, 1, 0.85),
      jitter: 0.04,
      jitterFreq: 2,
      ao: 0,
      dirt: 0,
      noise: 0.12,
    });
  }
}
