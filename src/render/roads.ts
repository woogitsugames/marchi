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
export const ROAD_MAXD = 4;

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

export class RoadField {
  readonly tw: number;
  readonly th: number;
  readonly dirt: Float32Array;
  readonly cobble: Float32Array;
  /** Distance to the nearest junction centre (degree ≥ 3), for trodden mud patches. */
  readonly junc: Float32Array;
  readonly texture: DataTexture;
  private readonly data: Uint8Array;
  bridges: BridgeCell[] = [];
  version = -1;

  constructor(readonly w: number, readonly h: number) {
    this.tw = w * CELL * ROAD_RES;
    this.th = h * CELL * ROAD_RES;
    this.dirt = new Float32Array(this.tw * this.th);
    this.cobble = new Float32Array(this.tw * this.th);
    this.junc = new Float32Array(this.tw * this.th);
    this.data = new Uint8Array(this.tw * this.th * 4);
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
    // encode
    const dd = this.data, n = this.tw * this.th;
    for (let i = 0; i < n; i++) {
      dd[i * 4] = Math.round((this.dirt[i]! / ROAD_MAXD) * 255);
      dd[i * 4 + 1] = Math.round((this.cobble[i]! / ROAD_MAXD) * 255);
      dd[i * 4 + 2] = Math.round((this.junc[i]! / ROAD_MAXD) * 255);
      dd[i * 4 + 3] = 255;
    }
    this.texture.needsUpdate = true;
    this.version = st.netVersion;
  }

  private segment(f: Float32Array, ax: number, az: number, bx: number, bz: number): void {
    const R = ROAD_RES, M = ROAD_MAXD;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - M) * R));
    const i1 = Math.min(this.tw - 1, Math.ceil((Math.max(ax, bx) + M) * R));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - M) * R));
    const j1 = Math.min(this.th - 1, Math.ceil((Math.max(az, bz) + M) * R));
    const vx = bx - ax, vz = bz - az;
    const ll = vx * vx + vz * vz;
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
