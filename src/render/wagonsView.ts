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
  Box3,
  Frustum,
  Group,
  InstancedBufferAttribute,
  Matrix4,
  type PerspectiveCamera,
  Sphere,
  Vector3,
} from 'three';
import type { Wagon, World } from '../sim/index';
import { edgeLength, GOODS, MAX_WAGONS, TICK_HZ, outputGoods, type Building, type Good } from '../sim/index';
import type { YardPile } from './buildingsView';
import { gaitBlend, gaitAt, horsePose, POSE_SIZE, strideOf } from './gait';
import { CELL, type Heightfield } from './heightfield';
import { CARGO_GOODS, type CargoGood, cargoFor, cargoSlots, cargoUnitParts, yardPileLocal } from './models/cargo';
import { markInstances, Parts } from './instancedParts';
import { addHorsePoseAttributes, createHorseMaterial, type HorseMaterials, WAGON, type WagonModel, wagonLod1, wagonModel, writeHorsePose } from './models/wagon';
import type { RoadField, RoadPoint } from './roads';
import { drawLagScratch, type ParkSlot, stableParking, wagonDrawLag } from './wagonSpacing';

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
  /** Last exact ground sample: rig origin and heading it was taken at, and its y / pitch (reused while unchanged). */
  gx: number; gz: number; gfx: number; gfz: number; gy: number; gp: number;
  /** Queue slot cache (research frame-cost day 9 #2): walkBack inputs (cell, slot, heading, road version) and result. */
  qAt: number; qK: number; qHx: number; qHz: number; qV: number; qx: number; qz: number; qtx: number; qtz: number;
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
const _box = new Box3();
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
  /** Cargo of wagons beyond lodDist (LOD1): same meshes as `cargo`, never casts a shadow (D-126). */
  private cargoFar = new Map<CargoGood, Parts>();
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
  /** Output piles by the buildings' yards (BuildingsView.yards): drawn from the stock with the cargo instances (D-71). */
  yards: readonly YardPile[] = [];
  private head = new Int32Array(0);
  private link = new Int32Array(MAX_WAGONS * 2 + 8);
  private item = new Int32Array(MAX_WAGONS * 2 + 8);
  private touched: number[] = [];
  private home = new Set<number>();
  private homeVer = -1;
  /** Stable waiting places per stable id, valid for parkVer (netVersion). */
  private parkSlots = new Map<number, ParkSlot[]>();
  private parkVer = -1;
  /** Reused by afterTick every tick (research 2026-11-04 "Poprawki" #3). */
  private readonly lagScratch = drawLagScratch();
  private readonly parking = new Map<number, ParkSlot>();
  /** Ground height per cell centre, filled lazily by surf(). */
  private surfH = new Float64Array(0);
  private cells = [0, 0, 0, 0];
  private byIdx: (Snap | null)[] = [];
  /** A tick ran since opposing traffic was last marked. */
  private oppDirty = false;
  /** Every instanced part list drawn per frame (built once: no arrays per frame, GC audit). */
  private readonly framed: Parts[];

  constructor(private readonly hf: Heightfield, private readonly roads: RoadField) {
    const cap = MAX_WAGONS;
    const wm = wagonModel();
    this.body = new Parts(wm.body, cap, this.group, 'wagon-body');
    this.horseMat = createHorseMaterial();
    // the near rig draws the menu's wagon at once; the mid and far rigs and the cargo of each good are built on
    // first use, or after the first frame (`buildPending`, before the shader pre-warm walks the scene) (D-256)
    const rig = (detail: 'near' | 'mid'): AnimRig => {
      const m = (): WagonModel => wagonModel(detail);
      const lazy = detail === 'mid';
      const poseAttrs: InstancedBufferAttribute[][] = [];
      const horse = new Parts(lazy ? () => m().horse : m().horse, cap, this.group, `wagon-horse-${detail}`, () => this.horseMat.material, (g) => {
        const c = g.clone();
        poseAttrs.push(addHorsePoseAttributes(c, cap));
        return c;
      }, (h) => { h.customDepthMaterial = this.horseMat.depth; });
      return {
        wheelF: new Parts(lazy ? () => m().wheelFront : m().wheelFront, cap * 2, this.group, `wagon-wheelF-${detail}`),
        wheelR: new Parts(lazy ? () => m().wheelRear : m().wheelRear, cap * 2, this.group, `wagon-wheelR-${detail}`),
        horse,
        driver: new Parts(lazy ? () => m().driver : m().driver, cap, this.group, `wagon-driver-${detail}`),
        poseAttrs,
      };
    };
    this.near = rig('near');
    this.mid = rig('mid');
    this.lod1 = new Parts(wagonLod1, cap, this.group, 'wagon-lod1');
    this.framed = [this.body, this.lod1, ...this.animParts()];
    for (const g of CARGO_GOODS) {
      // one cached unit model per good, shared by the near and far instances (D-256: it was built twice per view)
      this.cargo.set(g, new Parts(() => cargoUnitParts(g), cap * 6, this.group, `cargo-${g}`));
      this.cargoFar.set(g, new Parts(() => cargoUnitParts(g), cap * 6, this.group, `cargo-far-${g}`));
      this.slots.set(g, cargoSlots(g));
    }
  }

  /** Build the parts not drawn yet (after the first frame), so the shader pre-warm sees every mesh. */
  buildPending(): void {
    for (const p of this.framed) p.build();
    for (const p of this.cargo.values()) p.build();
    for (const p of this.cargoFar.values()) p.build();
  }

  /**
   * near: near rig, wagon bodies and near cargo cast; far: LOD1 rig casts; midRig: the mid rig's horse, wheels and
   * driver cast too (D-126: ultra only; low/high drop them, -14…-27 % shadow triangles). Far cargo never casts.
   */
  setShadows(near: boolean, far: boolean, midRig: boolean): void {
    const n = this.near, m = this.mid;
    for (const p of [this.body, n.wheelF, n.wheelR, n.horse, n.driver]) p.setShadow(near);
    for (const p of [m.wheelF, m.wheelR, m.horse, m.driver]) p.setShadow(near && midRig);
    this.lod1.setShadow(far);
    for (const p of this.cargo.values()) p.setShadow(near);
    for (const p of this.cargoFar.values()) p.setShadow(false);
  }

  private centre(world: World, c: number, out: Vector3): Vector3 {
    const w = world.terrain.w;
    const x = c % w, y = (c - x) / w;
    return out.set((x + 0.5) * CELL, 0, (y + 0.5) * CELL);
  }

  /**
   * Ground height at a cell's centre. Terrain and heightfield never change for a map, so each cell is sampled once
   * (lazily, NaN = not yet; Float64 keeps the exact value) instead of twice per moving wagon per tick (research
   * 2026-11-04 "Poprawki" #3).
   */
  private surf(world: World, c: number): number {
    const t = world.terrain;
    if (t.water[c]) return t.cellH[c]!;
    let cache = this.surfH;
    if (cache.length !== t.w * t.h) cache = this.surfH = new Float64Array(t.w * t.h).fill(NaN);
    const v = cache[c]!;
    if (v === v) return v;
    const w = t.w, x = c % w, y = (c - x) / w;
    return (cache[c] = this.hf.height((x + 0.5) * CELL, (y + 0.5) * CELL));
  }

  /** Snapshot current sim positions; previous ones become the interpolation start. */
  afterTick(world: World, nowMs: number): void {
    void nowMs;
    const t = world.terrain;
    const A = _v;
    const wantLag = wagonDrawLag(world, this.lagScratch);
    if (this.parkVer !== world.state.netVersion) { this.parkVer = world.state.netVersion; this.parkSlots.clear(); }
    const parking = stableParking(world, this.parkSlots, this.parking);
    for (const w of world.state.wagons) {
      let s = this.snaps.get(w.id);
      if (!s) {
        s = {
          id: w.id, init: false, lag: 0, prevAt: -1, prevNext: -1, curAt: -1, curNext: -1, px: 0, pz: 0, py: 0, podo: 0, cx: 0, cz: 0, cy: 0, codo: 0, dx: 0, dz: 1, hx: 0, hz: 1,
          moving: false, bridge: false, lane: 1, pitch: 0, heading: 0, laneS: 1, opp: false, fx: 0, fy: 0, fz: 0, visible: false, seen: 0,
          vg: 0, gph: (w.id * 0.618) % 1, roll: 0, gb: 0, mv: 0, drawn: false, park: null, ox: 0, oz: 0,
          gx: NaN, gz: NaN, gfx: NaN, gfz: NaN, gy: 0, gp: 0,
          qAt: -1, qK: 0, qHx: NaN, qHz: NaN, qV: -1, qx: 0, qz: 0, qtx: 0, qtz: 0,
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

  /**
   * Could the rig at (x, z) heading (fx, fz) pass the frustum test below for any ground height? The box holds the
   * test sphere (5 m around a point 1.8 m ahead, 1.2 m up) for every y in [yMin, yMax]; Frustum.intersectsBox only
   * answers false when the box is wholly outside one plane, so false here means the exact test fails too.
   */
  private mayShow(x: number, z: number, fx: number, fz: number, yMin: number, yMax: number): boolean {
    const cx = x + fx * 1.8, cz = z + fz * 1.8, r = _sphere.radius;
    _box.min.set(cx - r, yMin + 1.2 - r, cz - r);
    _box.max.set(cx + r, yMax + 1.2 + r, cz + r);
    return _frustum.intersectsBox(_box);
  }

  /** Wagon whose ground height is always sampled exactly (the followed one: the camera reads its y). */
  exactId = -1;

  frame(world: World, alpha: number, dt: number, camera: PerspectiveCamera, time: number): void {
    if (this.oppDirty) {
      this.oppDirty = false;
      this.markOpposing(world);
    }
    const hf = this.hf;
    const { min: yMin, max: yMax } = hf.bounds();
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

    for (let i = 0; i < this.framed.length; i++) this.framed[i]!.begin();
    for (const p of this.cargo.values()) p.begin();
    for (const p of this.cargoFar.values()) p.begin();
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
          // a queued wagon asks the same question every frame: walk the road back once per change of slot,
          // heading or road network, not per frame (O(k) per wagon, O(k²) per queue)
          if (s.qAt !== w.at || s.qK !== k || s.qHx !== fx || s.qHz !== fz || s.qV !== this.roads.version) {
            const p = this.roads.walkBack(w.at, fx, fz, k * QUEUE_GAP, _p);
            s.qAt = w.at; s.qK = k; s.qHx = fx; s.qHz = fz; s.qV = this.roads.version;
            s.qx = p.x; s.qz = p.z; s.qtx = p.tx; s.qtz = p.tz;
          }
          x = s.qx; z = s.qz;
          if (s.qtx !== 0 || s.qtz !== 0) {
            fx = s.qtx; fz = s.qtz;
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
      let culled = false;
      if (s.bridge) {
        y = s.py + (s.cy - s.py) * a;
        pitch = s.pitch;
      } else if (x === s.gx && z === s.gz && fx === s.gfx && fz === s.gfz) {
        // standing or queued: same spot and heading as the last sample, same ground
        y = s.gy;
        pitch = s.gp;
      } else if (w.id !== this.exactId && (hidden || !this.mayShow(x, z, fx, fz, yMin, yMax))) {
        // off screen whatever the ground height (or tucked into the stable): no sample. The drawn y stays within
        // the map's height bounds, so its pin / tap point projects off screen as the exact one would.
        culled = true;
        const est = s.drawn ? s.fy : s.py + (s.cy - s.py) * a;
        y = est < yMin ? yMin : est > yMax ? yMax : est;
        pitch = 0;
      } else {
        const hF = hf.height(x + fx * 1.6, z + fz * 1.6);
        const hB = hf.height(x - fx * 1.6, z - fz * 1.6);
        y = Math.max(hf.height(x, z), (hF + hB) * 0.5);
        pitch = Math.atan2(hF - hB, 3.2);
        s.gx = x; s.gz = z; s.gfx = fx; s.gfz = fz; s.gy = y; s.gp = pitch;
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
      if (hidden || culled) continue;
      _sphere.center.set(x + fx * 1.8, y + 1.2, z + fz * 1.8);
      if (!_frustum.intersectsSphere(_sphere)) continue;
      _M.makeRotationY(s.heading).multiply(_R.makeRotationX(-pitch)).setPosition(x, y, z);
      const ddx = x - camPos.x, ddy = y - camPos.y, ddz = z - camPos.z;
      const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
      const close = d2 < lod2;
      if (close) {
        this.pushRig(d2 < near2 ? this.near : this.mid, s.roll, s.gph, s.gb, s.mv, time, w.id);
      } else {
        this.lod1.push(_M);
      }
      if (w.cargoGood && w.cargoQty > 0) {
        const g = cargoFor(w.cargoGood);
        const parts = (close ? this.cargo : this.cargoFar).get(g)!;
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
    this.pushYards(world, camPos, lod2);
    for (let i = 0; i < this.framed.length; i++) this.framed[i]!.end();
    for (const p of this.cargo.values()) p.end();
    for (const p of this.cargoFar.values()) p.end();
    for (let k = 0; k < 2; k++) {
      const r = k === 0 ? this.near : this.mid;
      for (const attrs of r.poseAttrs) for (const a of attrs) markInstances(a, r.horse.count);
    }
  }

  /**
   * Yard piles (owner decision 15, D-71): each producer's output stock drawn as up to one wagon load of the same
   * cargo units by its yard — a full yard (OUTPUT_FULL) is visible without a tap. Same instanced meshes as the
   * wagons' cargo (no new meshes or materials), within the wagon LOD distance and the frustum, and never past the
   * instance buffers (wagon cargo is pushed first).
   */
  private pushYards(world: World, camPos: Vector3, lod2: number): void {
    const bs = world.state.buildings;
    for (const y of this.yards) {
      let b = null;
      for (let i = 0; i < bs.length; i++) if (bs[i]!.id === y.buildingId) { b = bs[i]!; break; }
      if (!b) continue;
      const pick = yardPileGood(world, b, y.slot);
      if (!pick) continue;
      const good = pick.good;
      const qty = pick.qty;
      if (!(qty >= 1)) continue;
      const dx = y.x - camPos.x, dy = y.y - camPos.y, dz = y.z - camPos.z;
      if (dx * dx + dy * dy + dz * dz > lod2) continue;
      _sphere.center.set(y.x, y.y + 0.6, y.z);
      if (!_frustum.intersectsSphere(_sphere)) continue;
      const g = cargoFor(good);
      const parts = this.cargo.get(g)!;
      const slots = this.slots.get(g)!;
      const n = Math.min(slots.length, Math.floor(pick.frac >= 0 ? Math.max(1, Math.round(pick.frac * slots.length)) : qty), parts.cap - parts.count);
      if (n <= 0) continue;
      _M.multiplyMatrices(y.base, yardPileLocal(g));
      for (let i = 0; i < n; i++) parts.push(_W.multiplyMatrices(_M, slots[i]!));
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
    // the instance buffers and the per-view geometries (horse copies with pose attributes) go with the view (D-222);
    // the shared models (cached in models/) stay for the next view; the horse copies with their pose attributes go
    for (const p of this.framed) p.dispose();
    for (const p of this.cargo.values()) p.dispose();
    for (const p of this.cargoFar.values()) p.dispose();
    this.horseMat.material.dispose();
    this.horseMat.depth.dispose();
  }
}

const _pick: { good: Good; qty: number; frac: number } = { good: 'wood', qty: 0, frac: -1 };
/**
 * What a yard spot shows (D-71, D-79): a producer its first output (`frac` −1: the units are the stock); the
 * contract castle the `slot`-th ordered good, as the share of it delivered (`frac`: a full pile = the good is
 * complete); any other store (warehouse) its `slot`-th largest stock (ties in goods order). Null: nothing here.
 */
export function yardPileGood(world: World, b: Building, slot: number): typeof _pick | null {
  if (slot < 0) {
    const out = outputGoods(b.type);
    if (!out.length) return null;
    _pick.good = out[0]!; _pick.qty = b.stock[out[0]!]; _pick.frac = -1;
    return _pick;
  }
  const c = world.state.mission.contract;
  if (b.type === 'castle') {
    if (!c || c.castle !== b.id) return null;
    let k = 0;
    for (const g of GOODS) {
      if (c.need[g] <= 0) continue;
      if (k++ !== slot) continue;
      _pick.good = g; _pick.qty = b.stock[g]; _pick.frac = Math.min(1, b.stock[g] / c.need[g]);
      return _pick;
    }
    return null;
  }
  // the slot-th largest stock without sorting: count the goods that rank above each candidate
  for (const g of GOODS) {
    const v = b.stock[g];
    if (!(v >= 1)) continue;
    let above = 0;
    for (const h of GOODS) {
      const u = b.stock[h];
      if (u > v || (u === v && GOODS.indexOf(h) < GOODS.indexOf(g))) above++;
    }
    if (above === slot) { _pick.good = g; _pick.qty = v; _pick.frac = -1; return _pick; }
  }
  return null;
}
