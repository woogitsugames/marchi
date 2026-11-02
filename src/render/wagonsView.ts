// Wagons: horse + wagon + driver + cargo, fully instanced (one InstancedMesh per part, shared
// by up to MAX_WAGONS rigs). Positions interpolate between the previous and current sim tick;
// the drawn position follows the smoothed road centreline of the road mask (RoadField
// pointOnEdge: render-only, the sim position stays authoritative), heading aims at a point a
// little further along that curve and is damped, wagons keep to the right of two-way roads when
// meeting traffic (centred on one-lane wooden bridges), wheels turn with the odometer, waiting
// wagons queue back along the drawn road from the node they wait at.
// Wheels and the horse's gait advance with the distance the drawn rig actually moves (not with
// time), so hooves stay planted and wheels roll without slipping at any game speed (gait.ts).
import {
  BufferGeometry,
  Frustum,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  type Material,
  Matrix4,
  type PerspectiveCamera,
  Sphere,
  Vector3,
} from 'three';
import type { Wagon, World } from '../sim/index';
import { edgeLength, MAX_WAGONS, TICK_HZ } from '../sim/index';
import { gaitBlend, gaitAt, horsePose, POSE_SIZE, strideOf } from './gait';
import { CELL, type Heightfield } from './heightfield';
import { CARGO_GOODS, type CargoGood, cargoFor, cargoSlots, cargoUnitParts } from './models/cargo';
import type { ModelPart } from './models/kit';
import { modelMaterial } from './models/materials';
import { addHorsePoseAttributes, createHorseMaterial, type HorseMaterials, WAGON, wagonLod1, wagonModel, writeHorsePose } from './models/wagon';
import type { RoadField, RoadPoint } from './roads';
import { type ParkSlot, stableParking, wagonDrawLag } from './wagonSpacing';

/** Lateral offset from the road centreline (keep right). */
const LANE = 1.05;
/** Heading aims this far ahead along the drawn road (≈ rear axle to the horse's shoulders). */
const LOOKAHEAD = 2.4;
/** How fast a follower catches up again once the wagon ahead turns off (m per sim tick). */
const GAP_RELAX = 0.35;
/** Spacing of wagons queuing at one node. */
const QUEUE_GAP = 8;
/** Rate (1/s) at which a wagon eases into / out of its waiting place beside the stable (D-43). */
const PARK_RATE = 1.6;

interface Snap {
  id: number;
  init: boolean;
  /** Metres the drawn position stays behind the sim position (spacing, D-35). */
  lag: number;
  /** Edge the wagon was on before the current one (to draw it there while lagging), -1 if none. */
  prevAt: number; prevNext: number; curAt: number; curNext: number;
  px: number; pz: number; py: number; podo: number;
  cx: number; cz: number; cy: number; codo: number;
  /** Edge direction of the current snapshot (unit, xz). */
  dx: number; dz: number;
  /** Heading target of the current snapshot: toward a point LOOKAHEAD m further along the road. */
  hx: number; hz: number;
  moving: boolean;
  bridge: boolean;
  /** 0 on a one-lane wooden bridge, 1 elsewhere. */
  lane: number;
  pitch: number;
  heading: number;
  laneS: number;
  /** Opposing traffic close by on the same road. */
  opp: boolean;
  /** Last frame's rendered rig origin (world) and visibility. */
  fx: number; fy: number; fz: number;
  visible: boolean;
  seen: number;
  /** Drawn ground speed in game time (m per sim second), smoothed per tick. */
  vg: number;
  /** Gait phase (cycles) and rolled distance (m), both advanced by the drawn displacement. */
  gph: number;
  roll: number;
  /** Walk (0) → trot (1) blend and standing (0) → moving (1) blend. */
  gb: number;
  mv: number;
  /** A rendered position exists from the previous frame. */
  drawn: boolean;
  /** Waiting place beside the stable (D-43), null when not parked. */
  park: ParkSlot | null;
  /** Drawn offset (m) from the sim position toward the waiting place; eases in and out. */
  ox: number; oz: number;
}

interface AnimRig {
  wheelF: Parts;
  wheelR: Parts;
  horse: Parts;
  driver: Parts;
  /** Per-instance pose attributes of each horse geometry. */
  poseAttrs: InstancedBufferAttribute[][];
}

/** Gait state of a render-only (decor) rig. */
interface DecorGait { odo: number; gph: number; roll: number; mv: number; init: boolean }

class Parts {
  readonly meshes: InstancedMesh[];
  count = 0;
  constructor(parts: ModelPart[], cap: number, group: Group, name: string, mat?: (p: ModelPart) => Material, geo?: (g: BufferGeometry) => BufferGeometry) {
    this.meshes = parts.map((p) => {
      const m = new InstancedMesh(geo ? geo(p.geometry) : p.geometry, mat ? mat(p) : (modelMaterial(p.material) as Material), cap);
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = true;
      m.receiveShadow = true;
      m.name = name;
      group.add(m);
      return m;
    });
  }
  begin(): void { this.count = 0; }
  push(mat: Matrix4): number {
    const i = this.count++;
    for (const m of this.meshes) m.setMatrixAt(i, mat);
    return i;
  }
  end(): void {
    for (const m of this.meshes) {
      m.count = this.count;
      m.visible = this.count > 0;
      if (this.count) m.instanceMatrix.needsUpdate = true;
    }
  }
  setShadow(on: boolean): void { for (const m of this.meshes) m.castShadow = on; }
}

/** A render-only wagon (main-menu cinematic); not part of the simulation. */
export interface DecorWagon {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  /** Distance travelled along its path (m), drives wheels and gait. */
  odo: number;
  cargo: CargoGood | null;
  qty: number;
}

const _M = new Matrix4();
const _R = new Matrix4();
const _W = new Matrix4();
const _v = new Vector3();
const _frustum = new Frustum();
const _pm = new Matrix4();
const _sphere = new Sphere(new Vector3(), 5);
const _p: RoadPoint = { x: 0, z: 0, tx: 0, tz: 1 };
const _q: RoadPoint = { x: 0, z: 0, tx: 0, tz: 1 };
const _pose = new Float32Array(POSE_SIZE);
/** Largest drawn step (m per frame) still treated as motion; larger ones are teleports. */
const MAX_STEP = 6;

/** Stride (m per gait cycle) at walk/trot blend `gb`. */
function strideAt(gb: number): number {
  return strideOf(gaitAt(gb));
}

/** Cheap idle life for a standing horse: head and tail, in bouts, per-rig offsets. */
function idleMotion(time: number, seed: number, pose: Float32Array, k: number): void {
  if (k <= 0) return;
  const t = time + seed * 7.3;
  pose[13]! += k * (0.05 * Math.sin(t * 0.55) + 0.025 * Math.sin(t * 1.31 + 1));
  pose[14]! += k * 0.32 * Math.sin(t * 2.2) * Math.max(0, Math.sin(t * 0.21 + seed));
}

export class WagonsView {
  readonly group = new Group();
  private snaps = new Map<number, Snap>();
  private body: Parts;
  /** Animated rig parts at close zoom and at middle distance (the body is shared). */
  private near: AnimRig;
  private mid: AnimRig;
  private lod1: Parts;
  private cargo = new Map<CargoGood, Parts>();
  private slots = new Map<CargoGood, Matrix4[]>();
  private horseMat: HorseMaterials;
  private decorGait: DecorGait[] = [];
  private stack = new Map<number, number>();
  private order: Wagon[] = [];
  /** Distance beyond which the low-detail rig is used. */
  lodDist = 110;
  /** Fraction of `lodDist` within which the full-detail rig is used (mid detail beyond). */
  nearFrac = 0.4;
  /** Render-only rigs drawn after the sim wagons (menu cinematic). */
  decor: DecorWagon[] = [];
  private head = new Int32Array(0);
  private link = new Int32Array(MAX_WAGONS * 2 + 8);
  private item = new Int32Array(MAX_WAGONS * 2 + 8);
  private touched: number[] = [];
  private home = new Set<number>();
  private homeVer = -1;
  /** Stable waiting places per stable id, valid for parkVer (netVersion). */
  private parkSlots = new Map<number, ParkSlot[]>();
  private parkVer = -1;
  private cells = [0, 0, 0, 0];
  private byIdx: (Snap | null)[] = [];
  /** A tick ran since opposing traffic was last marked. */
  private oppDirty = false;

  constructor(private readonly hf: Heightfield, private readonly roads: RoadField) {
    const cap = MAX_WAGONS;
    const wm = wagonModel();
    this.body = new Parts(wm.body, cap, this.group, 'wagon-body');
    this.horseMat = createHorseMaterial();
    const rig = (detail: 'near' | 'mid'): AnimRig => {
      const m = wagonModel(detail);
      const poseAttrs: InstancedBufferAttribute[][] = [];
      const horse = new Parts(m.horse, cap, this.group, `wagon-horse-${detail}`, () => this.horseMat.material, (g) => {
        const c = g.clone();
        poseAttrs.push(addHorsePoseAttributes(c, cap));
        return c;
      });
      for (const h of horse.meshes) h.customDepthMaterial = this.horseMat.depth;
      return {
        wheelF: new Parts(m.wheelFront, cap * 2, this.group, `wagon-wheelF-${detail}`),
        wheelR: new Parts(m.wheelRear, cap * 2, this.group, `wagon-wheelR-${detail}`),
        horse,
        driver: new Parts(m.driver, cap, this.group, `wagon-driver-${detail}`),
        poseAttrs,
      };
    };
    this.near = rig('near');
    this.mid = rig('mid');
    this.lod1 = new Parts(wagonLod1(), cap, this.group, 'wagon-lod1');
    for (const g of CARGO_GOODS) {
      this.cargo.set(g, new Parts(cargoUnitParts(g), cap * 6, this.group, `cargo-${g}`));
      this.slots.set(g, cargoSlots(g));
    }
  }

  setShadows(near: boolean, far: boolean): void {
    for (const p of [this.body, ...this.animParts()]) p.setShadow(near);
    this.lod1.setShadow(far);
    for (const p of this.cargo.values()) p.setShadow(near);
  }

  private centre(world: World, c: number, out: Vector3): Vector3 {
    const w = world.terrain.w;
    const x = c % w, y = (c - x) / w;
    return out.set((x + 0.5) * CELL, 0, (y + 0.5) * CELL);
  }

  private surf(world: World, c: number): number {
    const t = world.terrain;
    if (t.water[c]) return t.cellH[c]!;
    const w = t.w, x = c % w, y = (c - x) / w;
    return this.hf.height((x + 0.5) * CELL, (y + 0.5) * CELL);
  }

  /** Snapshot current sim positions; previous ones become the interpolation start. */
  afterTick(world: World, nowMs: number): void {
    void nowMs;
    const t = world.terrain;
    const A = _v;
    const wantLag = wagonDrawLag(world);
    if (this.parkVer !== world.state.netVersion) { this.parkVer = world.state.netVersion; this.parkSlots.clear(); }
    const parking = stableParking(world, this.parkSlots);
    for (const w of world.state.wagons) {
      let s = this.snaps.get(w.id);
      if (!s) {
        s = {
          id: w.id, init: false, lag: 0, prevAt: -1, prevNext: -1, curAt: -1, curNext: -1, px: 0, pz: 0, py: 0, podo: 0, cx: 0, cz: 0, cy: 0, codo: 0, dx: 0, dz: 1, hx: 0, hz: 1,
          moving: false, bridge: false, lane: 1, pitch: 0, heading: 0, laneS: 1, opp: false, fx: 0, fy: 0, fz: 0, visible: false, seen: 0,
          vg: 0, gph: (w.id * 0.618) % 1, roll: 0, gb: 0, mv: 0, drawn: false, park: null, ox: 0, oz: 0,
        };
        this.snaps.set(w.id, s);
      }
      s.px = s.cx; s.pz = s.cz; s.py = s.cy; s.podo = s.codo;
      if (w.next >= 0 && (w.at !== s.curAt || w.next !== s.curNext)) {
        s.prevAt = s.curAt; s.prevNext = s.curNext; s.curAt = w.at; s.curNext = w.next;
      }
      // spacing: the lag grows at once (no overlap) and shrinks gently (no jump when the road clears)
      const want = w.next >= 0 ? wantLag.get(w.id) ?? 0 : 0;
      s.lag = want >= s.lag ? want : Math.max(want, s.lag - GAP_RELAX);
      if (w.next >= 0) {
        // the edge and distance actually drawn: lagging may put the wagon back on its previous edge
        let ea = w.at, eb = w.next, d = w.edgeT - s.lag;
        if (d < 0 && s.prevNext === w.at && s.prevAt >= 0) {
          const pl = edgeLength(t, s.prevAt, s.prevNext);
          ea = s.prevAt; eb = s.prevNext; d = Math.max(0, pl + d);
        }
        d = Math.max(0, d);
        this.centre(world, ea, A);
        const ax = A.x, az = A.z;
        this.centre(world, eb, A);
        const bx = A.x, bz = A.z;
        const len = edgeLength(t, ea, eb);
        const f = Math.min(1, d / len);
        const l = Math.hypot(bx - ax, bz - az) || 1;
        s.dx = (bx - ax) / l; s.dz = (bz - az) / l;
        // drawn on the road mask's curve; heading toward a point a little further along it
        const p = this.roads.pointOnEdge(ea, eb, f, _p);
        s.cx = p.x; s.cz = p.z;
        const ahead = (1 - f) * l;
        let q: RoadPoint;
        if (LOOKAHEAD <= ahead) q = this.roads.pointOnEdge(ea, eb, f + LOOKAHEAD / l, _q);
        else if (eb !== w.next || w.path.length) {
          const n2 = eb !== w.next ? w.next : w.path[0]!;
          this.centre(world, n2, A);
          const l2 = Math.hypot(A.x - bx, A.z - bz) || 1;
          q = this.roads.pointOnEdge(eb, n2, Math.min(1, (LOOKAHEAD - ahead) / l2), _q);
        } else q = this.roads.pointOnEdge(ea, eb, 1, _q);
        const hx = q.x - p.x, hz = q.z - p.z, hl = Math.hypot(hx, hz);
        if (hl > 0.4) { s.hx = hx / hl; s.hz = hz / hl; } else { s.hx = p.tx; s.hz = p.tz; }
        const wa = t.water[ea] === 1, wb = t.water[eb] === 1;
        s.bridge = wa || wb;
        const ha = this.surf(world, ea), hb = this.surf(world, eb);
        s.cy = ha + (hb - ha) * f;
        s.pitch = s.bridge ? Math.atan2(hb - ha, l) : 0;
        const woodA = wa && world.state.roads[ea] === 1, woodB = wb && world.state.roads[eb] === 1;
        s.lane = woodA && woodB ? 0 : woodA ? Math.min(1, f * 2 - 0.4) : woodB ? Math.min(1, (1 - f) * 2 - 0.4) : 1;
        if (s.lane < 0) s.lane = 0;
        s.moving = true;
      } else {
        const p = this.roads.nodePoint(w.at, _p);
        s.cx = p.x; s.cz = p.z;
        s.cy = this.surf(world, w.at);
        s.bridge = t.water[w.at] === 1;
        s.lane = s.bridge && world.state.roads[w.at] === 1 ? 0 : 1;
        s.moving = false;
      }
      s.park = parking.get(w.id) ?? null;
      s.codo = w.odometer - s.lag;
      s.opp = false;
      if (!s.init) {
        s.init = true;
        s.px = s.cx; s.pz = s.cz; s.py = s.cy; s.podo = s.codo;
        s.heading = Math.atan2(s.hx, s.hz);
        s.laneS = s.lane;
      }
      // game-time ground speed of the drawn rig (picks walk or trot; independent of ×1/×2/×4)
      const step = Math.hypot(s.cx - s.px, s.cz - s.pz);
      const v = s.moving && step < MAX_STEP ? step * TICK_HZ : 0;
      s.vg += (v - s.vg) * 0.3;
    }
    // opposing traffic is only read when drawing: mark it once before the next frame instead of
    // after every tick (×4 or a slow frame runs several ticks per frame; only the last one counts)
    this.oppDirty = true;
  }

  /**
   * Wagons keep to the centre of the track unless meeting opposing traffic nearby. Reads only the
   * snapshots of the last tick (direction, raw lane), so running it once per frame after any number
   * of ticks gives the same result as after each of them. Allocation-free.
   */
  private markOpposing(world: World): void {
    const ws = world.state.wagons;
    const n = world.terrain.w * world.terrain.h;
    if (this.head.length !== n) this.head = new Int32Array(n).fill(-1);
    const head = this.head, link = this.link, item = this.item, touched = this.touched, cells = this.cells;
    const cap = link.length;
    // snapshots by wagon index (one Map lookup per wagon instead of one per neighbour visited)
    const byIdx = this.byIdx;
    byIdx.length = ws.length;
    let k = 0;
    touched.length = 0;
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i]!;
      byIdx[i] = this.snaps.get(w.id) ?? null;
      if (w.next < 0) continue;
      for (let c = w.at, pass = 0; pass < 2; pass++, c = w.next) {
        if (c < 0 || k >= cap) continue;
        if (head[c] === -1) touched.push(c);
        item[k] = i; link[k] = head[c]!; head[c] = k++;
      }
    }
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i]!;
      const s = byIdx[i];
      if (!s || w.next < 0) continue;
      let opp = false;
      cells[0] = w.at; cells[1] = w.next; cells[2] = w.path[0] ?? -1; cells[3] = w.path[1] ?? -1;
      for (let ci = 0; ci < 4 && !opp; ci++) {
        const c = cells[ci]!;
        if (c < 0) continue;
        for (let e = head[c]!; e !== -1; e = link[e]!) {
          const j = item[e]!;
          if (j === i) continue;
          const o = byIdx[j];
          if (o && o.dx * s.dx + o.dz * s.dz < -0.3) { opp = true; break; }
        }
      }
      s.opp = opp;
      if (!opp) s.lane = 0;
    }
    for (let i = 0; i < touched.length; i++) head[touched[i]!] = -1;
    byIdx.fill(null);
  }

  /** Forget wagons that no longer exist (call on setWorld). */
  reset(): void {
    this.snaps.clear();
    this.oppDirty = false;
  }

  get(id: number): Snap | undefined {
    return this.snaps.get(id);
  }

  frame(world: World, alpha: number, dt: number, camera: PerspectiveCamera, time: number): void {
    if (this.oppDirty) {
      this.oppDirty = false;
      this.markOpposing(world);
    }
    const hf = this.hf;
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_pm);
    const camPos = camera.position;
    const lod2 = this.lodDist * this.lodDist;
    const near2 = lod2 * this.nearFrac * this.nearFrac;
    const kTurn = 1 - Math.exp(-dt * 7);
    const kLane = 1 - Math.exp(-dt * 3);
    const kMove = 1 - Math.exp(-dt * 5);
    const kGait = 1 - Math.exp(-dt * 1.5);
    const kPark = 1 - Math.exp(-dt * PARK_RATE);

    for (const p of [this.body, this.lod1, ...this.animParts()]) p.begin();
    for (const p of this.cargo.values()) p.begin();
    this.stack.clear();
    // stable order: moving first doesn't matter; queue index by id order
    this.order.length = 0;
    for (const w of world.state.wagons) this.order.push(w);

    if (this.homeVer !== world.state.netVersion) {
      this.homeVer = world.state.netVersion;
      this.home.clear();
      for (const b of world.state.buildings) if (b.type === 'stable') this.home.add(b.gate);
    }
    const home = this.home;

    for (const w of this.order) {
      const s = this.snaps.get(w.id);
      if (!s) continue;
      const a = alpha;
      let x = s.px + (s.cx - s.px) * a;
      let z = s.pz + (s.cz - s.pz) * a;
      // heading
      if (s.moving) {
        const target = Math.atan2(s.hx, s.hz);
        let d = target - s.heading;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        s.heading += d * kTurn;
      }
      s.laneS += (s.lane - s.laneS) * kLane;
      // waiting place beside the stable (render-only): ease the drawn offset in, and back out on leaving
      const wox = s.park ? s.park.x - x : 0, woz = s.park ? s.park.z - z : 0;
      s.ox += (wox - s.ox) * kPark;
      s.oz += (woz - s.oz) * kPark;
      const easing = Math.abs(wox - s.ox) + Math.abs(woz - s.oz) > 0.3;
      if (s.park) {
        // pulling in: face the way it drives, then turn the horses toward the road
        const tgt = easing && Math.hypot(wox - s.ox, woz - s.oz) > 2 ? Math.atan2(wox - s.ox, woz - s.oz) : s.park.heading;
        let d = tgt - s.heading;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        s.heading += d * kTurn * 0.6;
      }
      x += s.ox;
      z += s.oz;
      let fx = Math.sin(s.heading), fz = Math.cos(s.heading);
      let hidden = false;
      if (!s.moving && !s.park) {
        const k = this.stack.get(w.at) ?? 0;
        this.stack.set(w.at, k + 1);
        if (k > 0) {
          // queue back along the drawn road, facing the node waited at
          const p = this.roads.walkBack(w.at, fx, fz, k * QUEUE_GAP, _p);
          x = p.x; z = p.z;
          if (p.tx !== 0 || p.tz !== 0) {
            fx = p.tx; fz = p.tz;
            s.heading = Math.atan2(fx, fz);
          }
        }
        if (w.status.k === 'IDLE' && home.has(w.at) && k >= 3) hidden = true;
      }
      // keep right (not while standing in the waiting row)
      const off = s.park ? 0 : LANE * s.laneS;
      x += -fz * off;
      z += fx * off;
      let y: number;
      let pitch: number;
      if (s.bridge) {
        y = s.py + (s.cy - s.py) * a;
        pitch = s.pitch;
      } else {
        const hF = hf.height(x + fx * 1.6, z + fz * 1.6);
        const hB = hf.height(x - fx * 1.6, z - fz * 1.6);
        y = Math.max(hf.height(x, z), (hF + hB) * 0.5);
        pitch = Math.atan2(hF - hB, 3.2);
      }
      // distance actually drawn this frame, along the heading (lane drift does not count)
      let ds = s.drawn ? (x - s.fx) * fx + (z - s.fz) * fz : 0;
      if (ds < 0 || ds > MAX_STEP) ds = 0;
      s.gb += (gaitBlend(s.vg) - s.gb) * kGait;
      s.mv += (((s.moving && s.vg > 0.2) || (s.park && easing) ? 1 : 0) - s.mv) * kMove;
      s.roll += ds;
      s.gph = (s.gph + ds / strideAt(s.gb)) % 1;
      s.drawn = true;
      s.fx = x; s.fy = y; s.fz = z;
      s.visible = !hidden;
      if (hidden) continue;
      _sphere.center.set(x + fx * 1.8, y + 1.2, z + fz * 1.8);
      if (!_frustum.intersectsSphere(_sphere)) continue;
      _M.makeRotationY(s.heading).multiply(_R.makeRotationX(-pitch)).setPosition(x, y, z);
      const ddx = x - camPos.x, ddy = y - camPos.y, ddz = z - camPos.z;
      const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
      if (d2 < lod2) {
        this.pushRig(d2 < near2 ? this.near : this.mid, s.roll, s.gph, s.gb, s.mv, time, w.id);
      } else {
        this.lod1.push(_M);
      }
      if (w.cargoGood && w.cargoQty > 0) {
        const g = cargoFor(w.cargoGood);
        const parts = this.cargo.get(g)!;
        const slots = this.slots.get(g)!;
        const n = Math.min(slots.length, Math.round(w.cargoQty));
        for (let i = 0; i < n; i++) {
          _W.multiplyMatrices(_M, slots[i]!);
          parts.push(_W);
        }
      }
    }
    this.decorGait.length = Math.min(this.decorGait.length, this.decor.length);
    this.decor.forEach((d, i) => {
      const g = this.decorGait[i] ?? (this.decorGait[i] = { odo: d.odo, gph: 0, roll: 0, mv: 1, init: false });
      let ds = g.init ? d.odo - g.odo : 0;
      if (ds < 0 || ds > MAX_STEP) ds = 0;
      g.init = true;
      g.odo = d.odo;
      const gb = 0; // the menu wagon walks (1.6 m/s)
      g.roll += ds;
      g.gph = (g.gph + ds / strideAt(gb)) % 1;
      _M.makeRotationY(d.heading).multiply(_R.makeRotationX(-d.pitch)).setPosition(d.x, d.y, d.z);
      this.pushRig(this.near, g.roll, g.gph, gb, g.mv, time, 1000 + i);
      if (d.cargo && d.qty > 0) {
        const parts = this.cargo.get(d.cargo)!;
        const slots = this.slots.get(d.cargo)!;
        for (let i = 0; i < Math.min(slots.length, d.qty); i++) parts.push(_W.multiplyMatrices(_M, slots[i]!));
      }
    });
    for (const p of [this.body, this.lod1, ...this.animParts()]) p.end();
    for (const p of this.cargo.values()) p.end();
    for (const r of [this.near, this.mid]) {
      if (r.horse.count) for (const attrs of r.poseAttrs) for (const a of attrs) a.needsUpdate = true;
    }
  }

  private animParts(): Parts[] {
    const n = this.near, m = this.mid;
    return [n.wheelF, n.wheelR, n.horse, n.driver, m.wheelF, m.wheelR, m.horse, m.driver];
  }

  /** Near-LOD rig at `_M`: body, posed horse, bobbing driver, wheels rolled by `roll` metres. */
  private pushRig(r: AnimRig, roll: number, gph: number, gb: number, mv: number, time: number, seed: number): void {
    this.body.push(_M);
    const hi = r.horse.push(_M);
    horsePose(gph, gb, mv, _pose);
    idleMotion(time, seed, _pose, 1 - mv);
    _pose[14]! += 0.06 * mv * Math.sin(2 * Math.PI * gph);
    for (const attrs of r.poseAttrs) writeHorsePose(attrs, hi, _pose);
    _W.copy(_M).multiply(_R.makeTranslation(0, _pose[15]!, 0));
    r.driver.push(_W);
    for (const wh of WAGON.wheels) {
      _W.copy(_M).multiply(_R.makeTranslation(wh.position.x, wh.position.y, wh.position.z)).multiply(_R.makeRotationX(roll / wh.radius));
      (wh.kind === 'front' ? r.wheelF : r.wheelR).push(_W);
    }
  }

  dispose(): void {
    for (const c of this.group.children) (c as InstancedMesh).dispose();
    this.horseMat.material.dispose();
    this.horseMat.depth.dispose();
  }
}
