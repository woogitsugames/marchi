// Small ground cover, all instanced and untextured (one draw call per kind):
//  - reeds / sedge clumps along the river banks (static, rebuilt with the road network)
//  - grass tufts and low shrubs scattered only around the camera target at close zoom,
//    generated per 8 m tile (cached) and faded in by scale toward the edge of the radius.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  type Material,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import type { World } from '../sim/index';
import { net } from '../sim/index';
import { CELL, type Heightfield } from './heightfield';
import { hash3, rng, vnoise } from './models/kit';
import { modelMaterial } from './models/materials';
import { treeParts } from './models/trees';
import type { RoadField } from './roads';

/** A clump of tapered blades (one triangle each), leaning outward. */
function bladeClump(n: number, h0: number, h1: number, spread: number, lean: number, base: string, tip: string, seed: number, mixTip?: string): BufferGeometry {
  const r = rng(seed);
  const pos: number[] = [], nor: number[] = [], col: number[] = [];
  const cb = new Color(base), ct = new Color(tip), cm = new Color(mixTip ?? tip), c = new Color();
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * spread;
    const bx = Math.cos(a) * d, bz = Math.sin(a) * d;
    const h = h0 + (h1 - h0) * r();
    const l = lean * (0.4 + r() * 0.8);
    const tx = bx + Math.cos(a) * l * h, tz = bz + Math.sin(a) * l * h;
    const w = 0.02 + r() * 0.03;
    // blade width perpendicular to the lean direction
    const px = -Math.sin(a + (r() - 0.5)) * w, pz = Math.cos(a + (r() - 0.5)) * w;
    pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, tx, h, tz);
    for (let k = 0; k < 3; k++) {
      // soft up-and-out normals so clumps shade like a volume
      const nx = Math.cos(a) * 0.35, nz = Math.sin(a) * 0.35;
      nor.push(nx, 0.94, nz);
    }
    const tipC = r() < 0.3 ? cm : ct;
    c.copy(cb).multiplyScalar(0.8 + r() * 0.2);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    c.copy(tipC).multiplyScalar(0.85 + r() * 0.3);
    col.push(c.r, c.g, c.b);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.computeBoundingSphere();
  return g;
}

interface Item { x: number; y: number; z: number; rot: number; s: number; kind: 0 | 1; tint: number }

const TILE = 8;
const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);
const _c = new Color();
const TINTS = [new Color('#ffffff'), new Color('#e2d6aa'), new Color('#b9c2a6'), new Color('#cfc9a8'), new Color('#f0dca6')];

export class GroundCover {
  readonly group = new Group();
  private reeds: InstancedMesh | null = null;
  private tufts: InstancedMesh;
  private shrubs: InstancedMesh[];
  private tiles = new Map<number, Item[]>();
  private world: World | null = null;
  private roads: RoadField | null = null;
  private lastX = Infinity;
  private lastZ = Infinity;
  private lastR = 0;
  /** Scatter radius (m) at close zoom; 0 disables tufts (low quality). */
  radius = 38;

  constructor(private readonly hf: Heightfield) {
    const tg = bladeClump(13, 0.2, 0.5, 0.18, 0.5, '#363c27', '#6e6a46', 5, '#4f5838');
    this.tufts = new InstancedMesh(tg, modelMaterial('grass') as Material, 4000);
    this.tufts.count = 0;
    this.tufts.name = 'grass-tufts';
    this.tufts.receiveShadow = true;
    this.tufts.frustumCulled = false;
    this.tufts.setColorAt(0, _c.set(1, 1, 1));
    this.group.add(this.tufts);
    this.shrubs = treeParts('bush').map((p) => {
      const m = new InstancedMesh(p.geometry, modelMaterial(p.material) as Material, 220);
      m.count = 0;
      m.name = `low-shrub-${p.material}`;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      this.group.add(m);
      return m;
    });
  }

  /** Rebuild the static reeds and drop cached tiles (roads / buildings changed). */
  rebuild(world: World, roads: RoadField): void {
    this.world = world;
    this.roads = roads;
    this.tiles.clear();
    this.lastX = Infinity;
    this.buildReeds(roads);
  }

  private buildReeds(roads: RoadField): void {
    const hf = this.hf, WL = hf.waterLevel;
    if (this.reeds) { this.group.remove(this.reeds); this.reeds.dispose(); this.reeds.geometry.dispose(); }
    const items: number[] = [];
    const S = 1.0;
    for (let z = 0; z < hf.sizeZ; z += S) for (let x = 0; x < hf.sizeX; x += S) {
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      if (hf.waterDist[cz * hf.w + cx]! > 2.5) continue;
      const jx = x + hash3(Math.round(x * 4), Math.round(z * 4), 1, 5) * S;
      const jz = z + hash3(Math.round(x * 4), Math.round(z * 4), 2, 5) * S;
      const h = hf.height(jx, jz) - WL;
      if (h < -0.22 || h > 0.32) continue;
      // reed beds in patches, with gaps of open bank
      const patch = vnoise(jx / 11, jz / 9, 0.5, 61) + (vnoise(jx / 3, jz / 3, 1.5, 62) - 0.5) * 0.3;
      if (patch < 0.5) continue;
      if (roads.distAt(jx, jz) < 3.6) continue; // (field saturates at ROAD_MAXD = 4 m)
      const s = 0.75 + 0.6 * Math.min(1, (patch - 0.5) * 3) * (0.7 + hash3(Math.round(jx * 3), Math.round(jz * 3), 3, 5) * 0.5);
      items.push(jx, hf.height(jx, jz) - 0.05, jz, hash3(Math.round(jx * 5), 0, Math.round(jz * 5), 7) * 6.28, s);
    }
    const n = items.length / 5;
    const g = bladeClump(30, 0.7, 1.6, 0.45, 0.28, '#3a3a29', '#8c7b50', 9, '#5b5e3c');
    const m = new InstancedMesh(g, modelMaterial('grass') as Material, Math.max(1, n));
    for (let i = 0; i < n; i++) {
      const k = i * 5;
      _q.setFromAxisAngle(_up, items[k + 3]!);
      const sc = items[k + 4]!;
      _m.compose(_p.set(items[k]!, items[k + 1]!, items[k + 2]!), _q, _s.set(sc, sc * (0.8 + (i % 7) * 0.06), sc));
      m.setMatrixAt(i, _m);
    }
    m.count = n;
    m.castShadow = false;
    m.receiveShadow = true;
    m.name = 'reeds';
    m.computeBoundingSphere();
    this.reeds = m;
    this.group.add(m);
  }

  private tile(tx: number, tz: number): Item[] {
    const key = tz * 4096 + tx;
    let t = this.tiles.get(key);
    if (t) return t;
    t = [];
    const hf = this.hf, w = this.world, roads = this.roads;
    if (w && roads) {
      const occ = net(w).occupied;
      const terr = w.terrain;
      const S = 1.05;
      for (let j = 0; j < TILE / S; j++) for (let i = 0; i < TILE / S; i++) {
        const gx = tx * TILE + i * S, gz = tz * TILE + j * S;
        const hsh = hash3(Math.round(gx * 3), Math.round(gz * 3), 11, 3);
        const x = gx + hsh * S, z = gz + hash3(Math.round(gx * 3), Math.round(gz * 3), 12, 3) * S;
        if (!hf.inside(x, z)) continue;
        const ci = Math.floor(z / CELL) * terr.w + Math.floor(x / CELL);
        if (terr.water[ci] || terr.field[ci] || occ[ci] !== -1) continue;
        const rdist = roads.distAt(x, z);
        if (rdist < 2.1) continue;
        // clumpy density: thick in some patches, bare in others
        const dens = (vnoise(x / 6, z / 6, 3.5, 63) + vnoise(x / 2.2, z / 2.2, 4.5, 64) * 0.5 - 0.62) * 1.5 + (terr.forest[ci]! > 0.3 ? -0.35 : 0) + (rdist < 3.2 ? 0.25 : 0);
        const r2 = hash3(Math.round(x * 7), Math.round(z * 7), 13, 3);
        if (r2 > dens) continue;
        const y = hf.height(x, z);
        if (y - hf.waterLevel < 0.3) continue;
        const shrub = r2 < 0.03 && dens > 0.3 && rdist > 3.5;
        t.push({ x, y: y - 0.03, z, rot: hsh * 6.28, s: shrub ? 0.28 + r2 * 4 : 0.55 + hsh * hsh * 1.1, kind: shrub ? 1 : 0, tint: Math.floor(hash3(Math.round(x * 2), Math.round(z * 2), 14, 3) * TINTS.length) });
      }
    }
    if (this.tiles.size > 900) this.tiles.clear();
    this.tiles.set(key, t);
    return t;
  }

  /** Re-scatter tufts around the camera target when it moved; `dist` = camera distance. */
  update(target: Vector3, dist: number, force = false): void {
    const R = this.radius * (1 - smooth(55, 95, dist));
    const dx = target.x - this.lastX, dz = target.z - this.lastZ;
    if (!force && dx * dx + dz * dz < 9 && Math.abs(R - this.lastR) < 1.5) return;
    this.lastX = target.x;
    this.lastZ = target.z;
    this.lastR = R;
    let nT = 0, nS = 0;
    if (R > 4) {
      const t0x = Math.floor((target.x - R) / TILE), t1x = Math.floor((target.x + R) / TILE);
      const t0z = Math.floor((target.z - R) / TILE), t1z = Math.floor((target.z + R) / TILE);
      for (let tz = t0z; tz <= t1z; tz++) for (let tx = t0x; tx <= t1x; tx++) {
        for (const it of this.tile(tx, tz)) {
          const d = Math.hypot(it.x - target.x, it.z - target.z);
          const f = 1 - smooth(R * 0.6, R, d);
          if (f < 0.05) continue;
          _q.setFromAxisAngle(_up, it.rot);
          const sc = it.s * f;
          _m.compose(_p.set(it.x, it.y, it.z), _q, _s.set(sc, sc, sc));
          if (it.kind === 0) {
            if (nT >= this.tufts.instanceMatrix.count) continue;
            this.tufts.setMatrixAt(nT, _m);
            this.tufts.setColorAt(nT, _c.copy(TINTS[it.tint]!));
            nT++;
          } else if (nS < this.shrubs[0]!.instanceMatrix.count) {
            for (const m of this.shrubs) m.setMatrixAt(nS, _m);
            nS++;
          }
        }
      }
    }
    this.tufts.count = nT;
    this.tufts.visible = nT > 0;
    this.tufts.instanceMatrix.needsUpdate = true;
    if (this.tufts.instanceColor) this.tufts.instanceColor.needsUpdate = true;
    for (const m of this.shrubs) {
      m.count = nS;
      m.visible = nS > 0;
      m.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const c of this.group.children) {
      const m = c as InstancedMesh;
      m.dispose();
    }
    this.reeds?.geometry.dispose();
    this.tufts.geometry.dispose();
  }
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
