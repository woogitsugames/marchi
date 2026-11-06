// Buildings: one procedural model per type at its footprint, turned to face the gate,
// set on a stone plinth where the ground slopes. All static buildings are merged into one mesh
// per material (a handful of draw calls); mill wheels are separate meshes that rotate.
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  Group,
  Matrix4,
  Mesh,
  type Material,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { castleLevel, postOpen, type Building, type World } from '../sim/index';
import { CELL, type Heightfield } from './heightfield';
import { POST_TRADER, buildingModel, castleUpgradeParts, tradePostClosedParts, tradePostOpenParts, type BuildingKind, type WorkerSpot } from './models/buildings';
import { type ModelPart, PartBuilder } from './models/kit';
import { type MatKey, modelMaterial } from './models/materials';
import { HOE_STEP, WORKER_HIP_Y, WORKER_SHOULDER_Y, hoeWalk, type WorkerKind, type WorkerPose, workerPose, workerRig } from './models/people';
import { Parts } from './instancedParts';

export interface BuildingInfo {
  id: number;
  box: Box3;
  /** Marker point above the roof. */
  anchor: Vector3;
  centre: Vector3;
  smoke: Vector3 | null;
  type: Building['type'];
}

interface Wheel {
  mesh: Mesh[];
  base: Matrix4;
  axis: 'x' | 'z';
  buildingId: number;
  angle: number;
}

/** A yard worker: feet on the ground at `base` (position + facing), posed every frame from the building's status. */
interface Worker {
  buildingId: number;
  kind: WorkerKind;
  base: Matrix4;
  /** Phase offset (s) so neighbouring yards do not swing in step. */
  phase: number;
  /** Out on a field (re-placed when roads change), not in the building's own yard. */
  field?: boolean;
  /** Works whatever the building's status (the trader at the open post's counter). */
  always?: boolean;
  /** Legs not drawn: they would stand inside a wall (the trader behind the counter). */
  noLegs?: boolean;
  /**
   * The farmer's furrow (night 6b): he steps back along it after each stroke, between `lo` and `hi` metres from
   * the field cell's centre (x0, z0) along the axis (ax, az), and turns at the ends. `t`: seconds hoed so far.
   */
  walk?: { x0: number; z0: number; ax: number; az: number; lo: number; hi: number; t: number };
}

/** A building whose worker goes out to the fields (the farm), kept to re-place him when the roads change. */
interface FieldWorker { building: Building; spot: WorkerSpot; m: Matrix4; angle: number; baseY: number }

/** Instanced batches of one kind: the arms (with the tool) are its own, legs and torso are its variant's (D-200). */
interface WorkerParts { legs: Parts; torso: Parts; arms: Parts; tool: Parts | null }

/** Rig variant (clothing) per worker kind: neighbours in one yard dress differently. */
const RIG_VARIANT: Record<WorkerKind, number> = {
  chop: 2, sack: 3, peel: 0, sawTop: 1, sawPit: 0, hoe: 1, net: 2, mallet: 3, rake: 2, shovel: 0, paddle: 1, trader: 3,
};
/** How far from a farm (cells, Chebyshev, from its footprint edge) the farmer walks out to a field. */
const FIELD_REACH = 6;

/** Where a building's output pile stands (render-only, D-71): ground point and turn in world space. */
/** A yard spot: `slot` −1 = the producer's output (D-71), 0.. = the n-th store / contract pile (D-79). */
export interface YardPile { buildingId: number; base: Matrix4; x: number; y: number; z: number; slot: number }

/** Most workers of one kind drawn at once (a large valley has a dozen of each at most). */
const WORKER_CAP = 48;

const boundsCache = new Map<ModelPart[], Box3>();
/** Ground-level footprint of a model (parts below 2.5 m), model space. */
function modelBounds(parts: ModelPart[]): Box3 {
  let b = boundsCache.get(parts);
  if (b) return b;
  b = new Box3();
  const v = new Vector3();
  for (const p of parts) {
    if (p.material !== 'plaster' && p.material !== 'wood' && p.material !== 'stone') continue;
    const pos = p.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (v.y < 1.5 && v.y > 0) b.expandByPoint(v);
    }
  }
  if (b.isEmpty()) b.set(new Vector3(-2, 0, -2), new Vector3(2, 1, 2));
  boundsCache.set(parts, b);
  return b;
}

const KEEP = new Set(['position', 'normal', 'uv', 'color']);
const _m = new Matrix4();

function prep(g: BufferGeometry, m: Matrix4): BufferGeometry {
  const c = g.clone();
  for (const k of Object.keys(c.attributes)) if (!KEEP.has(k)) c.deleteAttribute(k);
  if (!c.getAttribute('uv')) return c.applyMatrix4(m);
  return c.applyMatrix4(m);
}

export interface FootprintTransform {
  /** Model space -> world. */
  m: Matrix4;
  cx: number;
  cz: number;
  baseY: number;
  /** Lowest ground under the footprint. */
  lo: number;
  angle: number;
  sx: number;
  sz: number;
}

/**
 * Where a building model stands: footprint centre, base height (a little above the mean ground so
 * the low side gets a plinth), turned so the model's +Z faces the gate, scaled to the footprint.
 * Shared by the placed buildings and the placement ghost so the ghost is exactly what gets built.
 */
export function footprintTransform(
  hf: Heightfield, model: { cells: [number, number] }, x: number, y: number, w: number, h: number, facing: number,
): FootprintTransform {
  const cx = (x + w / 2) * CELL, cz = (y + h / 2) * CELL;
  let lo = Infinity, hi = -Infinity, sum = 0, n = 0;
  for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) {
    const gy = hf.height(x * CELL + (i / 4) * w * CELL, y * CELL + (j / 4) * h * CELL);
    lo = Math.min(lo, gy); hi = Math.max(hi, gy); sum += gy; n++;
  }
  const mean = sum / n;
  const baseY = mean + (hi - mean) * 0.35;
  const angle = (facing & 3) * (Math.PI / 2);
  const odd = (facing & 1) === 1;
  const [mcx, mcz] = model.cells;
  const sx = odd ? h / mcx : w / mcx;
  const sz = odd ? w / mcz : h / mcz;
  const m = new Matrix4().makeTranslation(cx, baseY, cz).multiply(_m.makeRotationY(angle)).multiply(new Matrix4().makeScale(sx, 1, sz));
  return { m, cx, cz, baseY, lo, angle, sx, sz };
}

export class BuildingsView {
  readonly group = new Group();
  info = new Map<number, BuildingInfo>();
  private meshes: Mesh[] = [];
  private wheels: Wheel[] = [];
  private workers: Worker[] = [];
  private fieldWorkers: FieldWorker[] = [];
  private fieldNet = -1;
  /** Output piles by the yards, drawn each frame from the stock with the wagons' cargo instances (D-71). */
  readonly yards: YardPile[] = [];
  private workerParts = new Map<WorkerKind, WorkerParts>();
  /** Legs and torso batches per clothing variant, shared by every kind dressed in it. */
  private bodyParts = new Map<number, { legs: Parts; torso: Parts }>();
  private readonly workerGroup = new Group();
  private time = 0;
  private signature = '';

  constructor(private readonly hf: Heightfield) {
    this.workerGroup.name = 'yard-workers';
    this.group.add(this.workerGroup);
  }

  private partsFor(kind: WorkerKind): WorkerParts {
    let p = this.workerParts.get(kind);
    if (!p) {
      const v = RIG_VARIANT[kind];
      const rig = workerRig(kind, v);
      let body = this.bodyParts.get(v);
      if (!body) {
        body = { legs: new Parts(rig.legs, WORKER_CAP, this.workerGroup, `worker-v${v}-legs`), torso: new Parts(rig.torso, WORKER_CAP, this.workerGroup, `worker-v${v}-torso`) };
        this.bodyParts.set(v, body);
      }
      p = {
        legs: body.legs,
        torso: body.torso,
        arms: new Parts(rig.arms, WORKER_CAP, this.workerGroup, `worker-${kind}-arms`),
        tool: rig.tool ? new Parts(rig.tool, WORKER_CAP, this.workerGroup, `worker-${kind}-tool`) : null,
      };
      this.workerParts.set(kind, p);
    }
    return p;
  }

  /** Rebuild if the set of buildings changed. Returns true when rebuilt. */
  sync(world: World): boolean {
    const lvl = castleLevel(world.state);
    const open = postOpen(world);
    const sig = `${lvl}|${open ? 1 : 0}|` + world.state.buildings.map((b) => `${b.id}:${b.type}:${b.x}:${b.y}:${b.facing}`).join('|');
    if (sig === this.signature) return false;
    this.signature = sig;
    this.clear();
    const byMat = new Map<MatKey, BufferGeometry[]>();
    const add = (parts: ModelPart[], m: Matrix4) => {
      for (const p of parts) {
        let l = byMat.get(p.material);
        if (!l) byMat.set(p.material, (l = []));
        l.push(prep(p.geometry, m));
      }
    };
    for (const b of world.state.buildings) {
      const model = buildingModel(b.type as BuildingKind);
      const { m, cx, cz, baseY, lo, angle, sx, sz } = footprintTransform(this.hf, model, b.x, b.y, b.w, b.h, b.facing);
      add(model.parts, m);
      // castle level 1 (free valley rank 5): the extra corner tower with its pennant
      if (b.type === 'castle' && lvl >= 1) add(castleUpgradeParts(), m);
      // the trading post (D-170): shutters closed until rank 4, then the counter, the wares and the pennant
      if (b.type === 'tradePost') add(open ? tradePostOpenParts() : tradePostClosedParts(), m);
      // ... and, open, the trader behind the counter (D-200): legs hidden in the wall, at work all day
      if (b.type === 'tradePost' && open) {
        const at = POST_TRADER.at.clone().applyMatrix4(m);
        const base = new Matrix4().makeRotationY(angle + POST_TRADER.yaw).setPosition(at.x, baseY + POST_TRADER.at.y, at.z);
        this.partsFor(POST_TRADER.kind);
        this.workers.push({ buildingId: b.id, kind: POST_TRADER.kind, base, phase: (b.id * 0.618) % 1 * 7, always: true, noLegs: true });
      }
      if (baseY - lo > 0.3) {
        // field-stone plinth under the main house, reaching into the ground on the low side
        const mb = modelBounds(model.parts);
        const pw = (mb.max.x - mb.min.x) * 0.8 * sx, pd = (mb.max.z - mb.min.z) * 0.8 * sz;
        const pcx = (mb.max.x + mb.min.x) * 0.5, pcz = (mb.max.z + mb.min.z) * 0.5;
        const pb = new PartBuilder({ seed: b.id, ao: 0, dirt: 0.6, dirtHeight: 0.5 });
        const depth = baseY - lo + 0.5;
        pb.add('stone', new BoxGeometry(pw, depth, pd), {
          color: '#625d53',
          m: new Matrix4().makeTranslation(0, -depth / 2 + 0.05, 0),
          noise: 0.12,
        });
        add(pb.build(), new Matrix4().makeTranslation(cx, baseY, cz).multiply(_m.makeRotationY(angle)).multiply(new Matrix4().makeTranslation(pcx * sx, 0, pcz * sz)));
      }
      for (const spot of model.workers ?? []) {
        const at = spot.at.clone().applyMatrix4(m);
        // on the yard, like the props; `at.y` lifts the feet onto a log or a landing stage
        const base = new Matrix4().makeRotationY(angle + spot.yaw).setPosition(at.x, Math.max(baseY, this.hf.height(at.x, at.z)) + spot.at.y, at.z);
        this.partsFor(spot.kind);
        this.workers.push({ buildingId: b.id, kind: spot.kind, base, phase: (b.id * 0.618) % 1 * 7 });
      }
      if (model.fieldWorker) {
        this.partsFor(model.fieldWorker.kind);
        this.fieldWorkers.push({ building: b, spot: model.fieldWorker, m: m.clone(), angle, baseY });
      }
      if (model.yard) {
        const at = model.yard.at.clone().applyMatrix4(m);
        const y = Math.max(baseY, this.hf.height(at.x, at.z));
        this.yards.push({ buildingId: b.id, base: new Matrix4().makeRotationY(angle + model.yard.yaw).setPosition(at.x, y, at.z), x: at.x, y, z: at.z, slot: -1 });
      }
      model.piles?.forEach((p, slot) => {
        const at = p.at.clone().applyMatrix4(m);
        const y = Math.max(baseY, this.hf.height(at.x, at.z));
        this.yards.push({ buildingId: b.id, base: new Matrix4().makeRotationY(angle + p.yaw).setPosition(at.x, y, at.z), x: at.x, y, z: at.z, slot });
      });
      if (model.wheel) {
        const wm = m.clone().multiply(new Matrix4().makeTranslation(model.wheel.pivot.x, model.wheel.pivot.y, model.wheel.pivot.z));
        const meshes = model.wheel.parts.map((p) => {
          const mesh = new Mesh(p.geometry, modelMaterial(p.material) as Material);
          mesh.matrixAutoUpdate = false;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.group.add(mesh);
          return mesh;
        });
        this.wheels.push({ mesh: meshes, base: wm, axis: model.wheel.axis, buildingId: b.id, angle: 0 });
      }
      // bounds and marker anchor
      const box = new Box3();
      for (const p of model.parts) {
        if (!p.geometry.boundingBox) p.geometry.computeBoundingBox();
        box.union(p.geometry.boundingBox!.clone().applyMatrix4(m));
      }
      const top = box.max.y;
      const smoke = model.smoke ? model.smoke.clone().applyMatrix4(m) : null;
      this.info.set(b.id, {
        id: b.id,
        box,
        anchor: new Vector3(cx, top + 1.5, cz),
        centre: new Vector3(cx, baseY, cz),
        smoke,
        type: b.type,
      });
    }
    this.placeFieldWorkers(world);
    for (const [mat, list] of byMat) {
      const g = mergeGeometries(list, false);
      for (const l of list) l.dispose();
      if (!g) continue;
      g.computeBoundingSphere();
      const mesh = new Mesh(g, modelMaterial(mat) as Material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `buildings-${mat}`;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
    return true;
  }

  /**
   * Farmers stand out on the nearest tilled field cell within FIELD_REACH of their farm that is free of roads
   * and buildings (deterministic: scan order, ties by distance then index), facing along the furrows; with no
   * such field they work in the yard spot. Re-placed when the road network changes (a road over the field).
   */
  private placeFieldWorkers(world: World): void {
    this.fieldNet = world.state.netVersion;
    this.workers = this.workers.filter((w) => !w.field);
    if (!this.fieldWorkers.length) return;
    const t = world.terrain, W = t.w, H = t.h, roads = world.state.roads;
    const blocked = new Uint8Array(W * H);
    for (const q of world.state.buildings) for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) blocked[y * W + x] = 1;
    const taken = new Set<number>();
    for (const f of this.fieldWorkers) {
      const b = f.building;
      let best = -1, bestD = Infinity;
      for (let y = Math.max(0, b.y - FIELD_REACH); y < Math.min(H, b.y + b.h + FIELD_REACH); y++) {
        for (let x = Math.max(0, b.x - FIELD_REACH); x < Math.min(W, b.x + b.w + FIELD_REACH); x++) {
          const i = y * W + x;
          if (!t.field[i] || roads[i] || blocked[i] || t.water[i] || taken.has(i)) continue;
          const dx = x + 0.5 - (b.x + b.w / 2), dy = y + 0.5 - (b.y + b.h / 2);
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = i; }
        }
      }
      let base: Matrix4;
      let walk: Worker['walk'];
      if (best >= 0) {
        taken.add(best);
        const cx = best % W, cy = (best - cx) / W;
        // furrows run along the longer run of field cells (as the terrain shader draws them)
        let rx = 0, rz = 0;
        for (let k = cx + 1; k < W && t.field[cy * W + k]; k++) rx++;
        for (let k = cx - 1; k >= 0 && t.field[cy * W + k]; k--) rx++;
        for (let k = cy + 1; k < H && t.field[k * W + cx]; k++) rz++;
        for (let k = cy - 1; k >= 0 && t.field[k * W + cx]; k--) rz++;
        const yaw = (rx >= rz ? Math.PI / 2 : 0) + (b.id % 2 ? Math.PI : 0);
        const px = (cx + 0.5) * CELL + ((b.id * 0.37) % 1 - 0.5) * 1.2, pz = (cy + 0.5) * CELL;
        base = new Matrix4().makeRotationY(yaw).setPosition(px, this.hf.height(px, pz), pz);
        // the row he works: free field cells along the furrow, at most two on each side of his cell
        const ax = rx >= rz ? 1 : 0, az = 1 - ax;
        const free = (k: number): boolean => {
          const x = cx + ax * k, y = cy + az * k;
          if (x < 0 || y < 0 || x >= W || y >= H) return false;
          const i = y * W + x;
          return !!t.field[i] && !roads[i] && !blocked[i] && !t.water[i] && !taken.has(i);
        };
        let fwd = 0, back = 0;
        while (fwd < 2 && free(fwd + 1)) fwd++;
        while (back < 2 && free(-back - 1)) back++;
        const lo = -(back + 0.35) * CELL, hi = (fwd + 0.35) * CELL;
        if (hi - lo > 2 * HOE_STEP) walk = { x0: px, z0: pz, ax, az, lo, hi, t: 0 };
      } else {
        const at = f.spot.at.clone().applyMatrix4(f.m);
        base = new Matrix4().makeRotationY(f.angle + f.spot.yaw).setPosition(at.x, Math.max(f.baseY, this.hf.height(at.x, at.z)), at.z);
      }
      this.workers.push({ buildingId: b.id, kind: f.spot.kind, base, phase: (b.id * 0.618) % 1 * 7, field: true, ...(walk ? { walk } : {}) });
    }
  }

  update(world: World, dt: number): void {
    this.time += dt;
    if (world.state.netVersion !== this.fieldNet && this.fieldWorkers.length) this.placeFieldWorkers(world);
    this.updateWorkers(world, dt);
    if (!this.wheels.length) return;
    for (const w of this.wheels) {
      const b = world.state.buildings.find((x) => x.id === w.buildingId);
      const speed = b && b.status.k === 'WORKING' ? 1 : 0.55;
      w.angle += dt * 0.6 * speed;
      const a = w.angle;
      _m.copy(w.base).multiply(w.axis === 'x' ? ROT.makeRotationX(a) : ROT.makeRotationZ(a));
      for (const mesh of w.mesh) {
        mesh.matrix.copy(_m);
        mesh.matrixWorldNeedsUpdate = true;
      }
    }
  }

  /** Yard workers: chop / carry / bake while the building is WORKING, stand at rest otherwise. */
  private updateWorkers(world: World, dt: number): void {
    for (const b of this.bodyParts.values()) { b.legs.begin(); b.torso.begin(); }
    for (const p of this.workerParts.values()) { p.arms.begin(); p.tool?.begin(); }
    const bs = world.state.buildings;
    for (const w of this.workers) {
      let working = !!w.always;
      if (!working) for (let i = 0; i < bs.length; i++) if (bs[i]!.id === w.buildingId) { working = bs[i]!.status.k === 'WORKING'; break; }
      let base = w.base;
      const wk = w.walk;
      if (wk) {
        // the stroke and the step share one clock that only runs while he hoes: he stops where he stands
        if (working) wk.t += dt;
        workerPose(w.kind, working ? wk.t + w.phase : this.time + w.phase, working, _pose);
        const span = wk.hi - wk.lo, u = hoeWalk(wk.t + w.phase) % (2 * span);
        const back = u >= span;
        const s = wk.lo + (back ? 2 * span - u : u);
        const x = wk.x0 + wk.ax * s, z = wk.z0 + wk.az * s;
        // facing the tilled earth he draws toward his feet, so he steps backwards; turned round at the row's end
        _wb.makeRotationY(Math.atan2(wk.ax, wk.az) + (back ? 0 : Math.PI)).setPosition(x, this.hf.height(x, z), z);
        base = _wb;
      } else workerPose(w.kind, this.time + w.phase, working, _pose);
      const p = this.workerParts.get(w.kind)!;
      if (p.torso.count >= WORKER_CAP || p.arms.count >= WORKER_CAP) continue;
      if (!w.noLegs) p.legs.push(base);
      _wt.copy(base).multiply(_t.makeTranslation(0, WORKER_HIP_Y, 0)).multiply(ROT.makeRotationX(_pose.bend));
      p.torso.push(_wt);
      _wa.copy(_wt).multiply(_t.makeTranslation(0, WORKER_SHOULDER_Y, 0)).multiply(ROT.makeRotationX(_pose.arm));
      p.arms.push(_wa);
      if (p.tool) p.tool.push(_wa.copy(base).multiply(_t.makeTranslation(0, _pose.lift, 0)));
    }
    for (const b of this.bodyParts.values()) { b.legs.end(); b.torso.end(); }
    for (const p of this.workerParts.values()) { p.arms.end(); p.tool?.end(); }
  }

  private clear(): void {
    for (const m of this.meshes) { this.group.remove(m); m.geometry.dispose(); }
    for (const w of this.wheels) for (const m of w.mesh) this.group.remove(m);
    this.meshes = [];
    this.wheels = [];
    this.workers = [];
    this.fieldWorkers = [];
    this.yards.length = 0;
    this.info.clear();
  }

  dispose(): void {
    this.clear();
  }
}

const ROT = new Matrix4();
const _t = new Matrix4();
const _wt = new Matrix4();
const _wa = new Matrix4();
const _wb = new Matrix4();
const _pose: WorkerPose = { bend: 0, arm: 0, lift: 0 };
