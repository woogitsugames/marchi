// Road rendering data. Roads are not meshes: they are a distance field over the valley
// (0.5 m texels) that the terrain shader turns into rutted mud / cobbles, so roads follow the
// terrain exactly. Centrelines are built from the road cell graph; degree-2 cells get a
// quadratic Bézier between the edge midpoints, so diagonal chains read as curves, not stairs.
// Water cells with a road become bridge segments (one model per cell, oriented along the road).
import { DataTexture, LinearFilter, RGBAFormat, UnsignedByteType } from 'three';
import type { World } from '../sim/index';
import { net } from '../sim/index';
import { CELL } from './heightfield';

/** Field resolution: texels per metre. */
export const ROAD_RES = 2;
/** Encoded distance range in metres (8-bit channel covers 0..ROAD_MAXD). */
export const ROAD_MAXD = 6;

export interface BridgeCell {
  cell: number;
  x: number;
  z: number;
  /** Deck height (sim cellH). */
  y: number;
  /** Rotation around Y so the model's +Z runs along the road. */
  angle: number;
  /** 1 for straight spans, √2 when crossing a cell diagonally. */
  stretch: number;
  surface: 1 | 2;
}

const DX8 = [1, 0, -1, 0, 1, -1, -1, 1];
const DY8 = [0, 1, 0, -1, 1, 1, -1, -1];

/** A point on the drawn road centreline with its unit tangent (xz, metres). */
export interface RoadPoint {
  x: number;
  z: number;
  tx: number;
  tz: number;
}

export class RoadField {
  readonly tw: number;
  readonly th: number;
  readonly dirt: Float32Array;
  readonly cobble: Float32Array;
  /** Distance to the nearest junction centre (degree ≥ 3), for trodden mud patches. */
  readonly junc: Float32Array;
  readonly texture: DataTexture;
  private readonly data: Uint8Array;
  /**
   * Per texel row: the first and last column any segment of the current rebuild swept (D-310). Every texel outside
   * these spans still holds ROAD_MAXD in all three fields, which encodes to 255: only the spans are encoded.
   */
  private readonly rowLo: Int32Array;
  private readonly rowHi: Int32Array;
  /** Per cell: bit d set when the drawn centreline runs toward neighbour d (DX8/DY8). */
  readonly links: Uint8Array;
  private water: ArrayLike<number> | null = null;
  bridges: BridgeCell[] = [];
  version = -1;

  constructor(readonly w: number, readonly h: number) {
    this.tw = w * CELL * ROAD_RES;
    this.th = h * CELL * ROAD_RES;
    this.dirt = new Float32Array(this.tw * this.th);
    this.cobble = new Float32Array(this.tw * this.th);
    this.junc = new Float32Array(this.tw * this.th);
    this.links = new Uint8Array(w * h);
    this.data = new Uint8Array(this.tw * this.th * 4);
    this.rowLo = new Int32Array(this.th);
    this.rowHi = new Int32Array(this.th);
    this.texture = new DataTexture(this.data, this.tw, this.th, RGBAFormat, UnsignedByteType);
    this.texture.magFilter = LinearFilter;
    this.texture.minFilter = LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  /** Metres from (x, z) to the nearest road centreline of any surface (CPU side). */
  distAt(x: number, z: number): number {
    const i = Math.floor(x * ROAD_RES), j = Math.floor(z * ROAD_RES);
    if (i < 0 || j < 0 || i >= this.tw || j >= this.th) return ROAD_MAXD;
    const k = j * this.tw + i;
    return Math.min(this.dirt[k]!, this.cobble[k]!);
  }

  rebuild(world: World): void {
    const st = world.state, t = world.terrain;
    const { w, h } = t;
    const occ = net(world).occupied;
    this.dirt.fill(ROAD_MAXD);
    this.cobble.fill(ROAD_MAXD);
    this.junc.fill(ROAD_MAXD);
    this.links.fill(0);
    this.rowLo.fill(this.tw);
    this.rowHi.fill(-1);
    this.water = t.water;
    const roads = st.roads;
    const isRoad = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && roads[y * w + x]! > 0 && occ[y * w + x] === -1;
    const nb: number[] = [];
    this.bridges = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = y * w + x;
        if (!isRoad(x, y)) continue;
        const target = roads[c] === 2 ? this.cobble : this.dirt;
        nb.length = 0;
        for (let d = 0; d < 8; d++) {
          const nx = x + DX8[d]!, ny = y + DY8[d]!;
          if (!isRoad(nx, ny)) continue;
          if (d >= 4) {
            // diagonal: not across a building corner
            if (occ[y * w + nx] !== -1 || occ[ny * w + x] !== -1) continue;
          }
          nb.push(d);
          this.links[c]! |= 1 << d;
        }
        const cx = (x + 0.5) * CELL, cz = (y + 0.5) * CELL;
        if (nb.length === 2) {
          const a = nb[0]!, b = nb[1]!;
          const ax = cx + DX8[a]! * CELL * 0.5, az = cz + DY8[a]! * CELL * 0.5;
          const bx = cx + DX8[b]! * CELL * 0.5, bz = cz + DY8[b]! * CELL * 0.5;
          // quadratic Bézier a -> (c) -> b, sampled
          let px = ax, pz = az;
          const N = 6;
          for (let s = 1; s <= N; s++) {
            const u = s / N, iu = 1 - u;
            const qx = iu * iu * ax + 2 * iu * u * cx + u * u * bx;
            const qz = iu * iu * az + 2 * iu * u * cz + u * u * bz;
            this.segment(target, px, pz, qx, qz);
            px = qx; pz = qz;
          }
        } else if (nb.length === 0) {
          this.segment(target, cx, cz, cx, cz);
        } else {
          for (const d of nb) this.segment(target, cx, cz, cx + DX8[d]! * CELL * 0.5, cz + DY8[d]! * CELL * 0.5);
          if (nb.length === 1) {
            // dead end (usually a gate): run on to the cell edge so the road meets the door
            const d = nb[0]!;
            this.segment(target, cx, cz, cx - DX8[d]! * CELL * 0.45, cz - DY8[d]! * CELL * 0.45);
          }
        }
        if (nb.length >= 3 && !t.water[c]) {
          // a junction: offset the patch centre a little so it is not a perfect disc
          const ox = (((c * 2654435761) >>> 0) % 1000) / 1000 - 0.5, oz = (((c * 40503) >>> 0) % 1000) / 1000 - 0.5;
          this.segment(this.junc, cx + ox * 0.8, cz + oz * 0.8, cx - ox * 0.6, cz - oz * 0.6);
        }
        if (t.water[c]) this.bridges.push(bridgeCell(world, x, y, nb, roads[c] === 2 ? 2 : 1));
      }
    }
    // encode: a texel no segment swept holds ROAD_MAXD in all three fields, Math.round((6 / 6) * 255) = 255, so the
    // whole texture starts as 255 and only the swept span of each row is encoded (D-310; was every texel)
    const dd = this.data, tw = this.tw, lo = this.rowLo, hi = this.rowHi;
    const dirt = this.dirt, cobble = this.cobble, junc = this.junc;
    dd.fill(255);
    for (let j = 0; j < this.th; j++) {
      for (let i = j * tw + lo[j]!, e = j * tw + hi[j]!; i <= e; i++) {
        dd[i * 4] = Math.round((dirt[i]! / ROAD_MAXD) * 255);
        dd[i * 4 + 1] = Math.round((cobble[i]! / ROAD_MAXD) * 255);
        dd[i * 4 + 2] = Math.round((junc[i]! / ROAD_MAXD) * 255);
      }
    }
    this.texture.needsUpdate = true;
    this.version = st.netVersion;
  }

  /**
   * The point a wagon at fraction `f` of the edge a -> b (adjacent cells) is drawn at, on the same
   * curve the road mask uses: through a degree-2 cell the centreline is the quadratic Bézier
   * between its edge midpoints (control point = cell centre); junctions, dead ends, bridges and
   * links the mask does not draw stay straight. Tangent points from a toward b. Render-only.
   */
  pointOnEdge(a: number, b: number, f: number, out: RoadPoint): RoadPoint {
    if (f < 0.5) {
      this.cellPoint(a, b, f, out);
    } else {
      this.cellPoint(b, a, 1 - f, out);
      out.tx = -out.tx; out.tz = -out.tz;
    }
    return out;
  }

  /** Where a wagon standing at node `c` is drawn (on the curve through a degree-2 cell). */
  nodePoint(c: number, out: RoadPoint): RoadPoint {
    const w = this.w, m = this.links[c]!;
    const x = c % w, y = (c - x) / w;
    let N = c;
    for (let d = 0; d < 8; d++) if (m & (1 << d)) { N = (y + DY8[d]!) * w + x + DX8[d]!; break; }
    this.cellPoint(c, N, 0, out);
    return out;
  }

  /** Point at `t` (0..0.5 of the centre-to-centre edge) from cell X's centre toward neighbour N; tangent toward N. */
  private cellPoint(X: number, N: number, t: number, out: RoadPoint): void {
    const w = this.w;
    const x = X % w, y = (X - x) / w, nx = N % w, ny = (N - nx) / w;
    const ddx = nx - x, ddy = ny - y;
    const cx = (x + 0.5) * CELL, cz = (y + 0.5) * CELL;
    const bx = cx + ddx * CELL * 0.5, bz = cz + ddy * CELL * 0.5;
    let dN = -1;
    for (let d = 0; d < 8; d++) if (DX8[d] === ddx && DY8[d] === ddy) { dN = d; break; }
    const m = this.links[X]!;
    let other = -1;
    if (dN >= 0 && m & (1 << dN) && !(this.water && this.water[X])) {
      let n = 0;
      for (let d = 0; d < 8; d++) if (m & (1 << d)) { n++; if (d !== dN) other = d; }
      if (n !== 2) other = -1;
    }
    if (other < 0) {
      const k = t * 2;
      out.x = cx + (bx - cx) * k;
      out.z = cz + (bz - cz) * k;
      const l = Math.hypot(bx - cx, bz - cz) || 1;
      out.tx = (bx - cx) / l; out.tz = (bz - cz) / l;
      return;
    }
    const ax = cx + DX8[other]! * CELL * 0.5, az = cz + DY8[other]! * CELL * 0.5;
    const u = 0.5 + t, iu = 1 - u;
    out.x = iu * iu * ax + 2 * iu * u * cx + u * u * bx;
    out.z = iu * iu * az + 2 * iu * u * cz + u * u * bz;
    const gx = iu * (cx - ax) + u * (bx - cx), gz = iu * (cz - az) + u * (bz - cz);
    const l = Math.hypot(gx, gz) || 1;
    out.tx = gx / l; out.tz = gz / l;
  }

  /**
   * Walk `dist` metres back along the drawn road from cell `at`, leaving it against the
   * direction (hx, hz) (the way a waiting wagon faces). Returns the point and the tangent
   * pointing toward `at` (the queue's facing). Stops at a dead end.
   */
  walkBack(at: number, hx: number, hz: number, dist: number, out: RoadPoint): RoadPoint {
    const w = this.w;
    let X = at, prev = -1;
    // desired direction of travel (away from the head of the queue)
    let vx = -hx, vz = -hz;
    let left = dist;
    this.cellPoint(X, X, 0, out); // centre (straight case)
    for (let guard = 0; guard < 64; guard++) {
      const m = this.links[X]!;
      const x = X % w, y = (X - x) / w;
      let best = -1, bestDot = -2;
      for (let d = 0; d < 8; d++) {
        if (!(m & (1 << d))) continue;
        const N = (y + DY8[d]!) * w + x + DX8[d]!;
        if (N === prev) continue;
        const l = Math.hypot(DX8[d]!, DY8[d]!);
        const dot = (DX8[d]! * vx + DY8[d]! * vz) / l;
        if (dot > bestDot) { bestDot = dot; best = d; }
      }
      // (at the head node any link will do: a queue lines up along the road, never into a yard)
      if (best < 0) break;
      const N = (y + DY8[best]!) * w + x + DX8[best]!;
      const len = CELL * (best >= 4 ? Math.SQRT2 : 1);
      if (left <= len) {
        this.pointOnEdge(X, N, left / len, out);
        out.tx = -out.tx; out.tz = -out.tz;
        return out;
      }
      left -= len;
      this.pointOnEdge(X, N, 1, out);
      vx = out.tx; vz = out.tz;
      prev = X; X = N;
    }
    // dead end: continue straight past the last point
    const tx = -vx, tz = -vz;
    out.x -= tx * left; out.z -= tz * left;
    out.tx = tx; out.tz = tz;
    return out;
  }

  private segment(f: Float32Array, ax: number, az: number, bx: number, bz: number): void {
    const R = ROAD_RES, M = ROAD_MAXD;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - M) * R));
    const i1 = Math.min(this.tw - 1, Math.ceil((Math.max(ax, bx) + M) * R));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - M) * R));
    const j1 = Math.min(this.th - 1, Math.ceil((Math.max(az, bz) + M) * R));
    const vx = bx - ax, vz = bz - az;
    const ll = vx * vx + vz * vz;
    const lo = this.rowLo, hi = this.rowHi;
    for (let j = j0; j <= j1; j++) {
      if (i0 < lo[j]!) lo[j] = i0;
      if (i1 > hi[j]!) hi[j] = i1;
    }
    for (let j = j0; j <= j1; j++) {
      const pz = (j + 0.5) / R;
      const row = j * this.tw;
      for (let i = i0; i <= i1; i++) {
        const px = (i + 0.5) / R;
        let u = ll > 0 ? ((px - ax) * vx + (pz - az) * vz) / ll : 0;
        if (u < 0) u = 0; else if (u > 1) u = 1;
        const dx = px - (ax + vx * u), dz = pz - (az + vz * u);
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < f[row + i]!) f[row + i] = d;
      }
    }
  }
}

function bridgeCell(world: World, x: number, y: number, nb: number[], surface: 1 | 2): BridgeCell {
  const t = world.terrain;
  // axis = doubled-angle mean of neighbour directions (direction sign does not matter)
  let sx = 0, sz = 0;
  for (const d of nb) {
    const a = Math.atan2(DX8[d]!, DY8[d]!);
    sx += Math.cos(2 * a);
    sz += Math.sin(2 * a);
  }
  let angle = nb.length ? Math.atan2(sz, sx) / 2 : 0;
  // snap to 45° steps: cells are joined orthogonally or diagonally
  angle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  const diag = Math.abs(Math.round(angle / (Math.PI / 4))) % 2 === 1;
  return {
    cell: y * t.w + x,
    x: (x + 0.5) * CELL,
    z: (y + 0.5) * CELL,
    y: t.cellH[y * t.w + x]!,
    angle,
    stretch: diag ? Math.SQRT2 : 1,
    surface,
  };
}
