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
import { castleLevel, type Building, type World } from '../sim/index';
import { CELL, type Heightfield } from './heightfield';
import { buildingModel, castleUpgradeParts, type BuildingKind } from './models/buildings';
import { type ModelPart, PartBuilder } from './models/kit';
import { type MatKey, modelMaterial } from './models/materials';
import { WORKER_HIP_Y, WORKER_SHOULDER_Y, type WorkerKind, workerPose, workerRig } from './models/people';
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
}

interface WorkerParts { legs: Parts; torso: Parts; arms: Parts }

/** Where a building's output pile stands (render-only, D-71): ground point and turn in world space. */
export interface YardPile { buildingId: number; base: Matrix4; x: number; y: number; z: number }

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
  /** Output piles by the yards, drawn each frame from the stock with the wagons' cargo instances (D-71). */
  readonly yards: YardPile[] = [];
  private workerParts = new Map<WorkerKind, WorkerParts>();
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
      const rig = workerRig(kind, kind === 'chop' ? 2 : kind === 'sack' ? 3 : 0);
      p = {
        legs: new Parts(rig.legs, WORKER_CAP, this.workerGroup, `worker-${kind}-legs`),
        torso: new Parts(rig.torso, WORKER_CAP, this.workerGroup, `worker-${kind}-torso`),
        arms: new Parts(rig.arms, WORKER_CAP, this.workerGroup, `worker-${kind}-arms`),
      };
      this.workerParts.set(kind, p);
    }
    return p;
  }

  /** Rebuild if the set of buildings changed. Returns true when rebuilt. */
  sync(world: World): boolean {
    const lvl = castleLevel(world.state);
    const sig = `${lvl}|` + world.state.buildings.map((b) => `${b.id}:${b.type}:${b.x}:${b.y}:${b.facing}`).join('|');
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
      if (model.worker) {
        const at = model.worker.at.clone().applyMatrix4(m);
        const base = new Matrix4().makeRotationY(angle + model.worker.yaw).setPosition(at.x, Math.max(baseY, this.hf.height(at.x, at.z)), at.z); // on the yard, like the props
        this.partsFor(model.worker.kind);
        this.workers.push({ buildingId: b.id, kind: model.worker.kind, base, phase: (b.id * 0.618) % 1 * 7 });
      }
      if (model.yard) {
        const at = model.yard.at.clone().applyMatrix4(m);
        const y = Math.max(baseY, this.hf.height(at.x, at.z));
        this.yards.push({ buildingId: b.id, base: new Matrix4().makeRotationY(angle + model.yard.yaw).setPosition(at.x, y, at.z), x: at.x, y, z: at.z });
      }
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

  update(world: World, dt: number): void {
    this.time += dt;
    this.updateWorkers(world);
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
  private updateWorkers(world: World): void {
    for (const p of this.workerParts.values()) { p.legs.begin(); p.torso.begin(); p.arms.begin(); }
    const bs = world.state.buildings;
    for (const w of this.workers) {
      let working = false;
      for (let i = 0; i < bs.length; i++) if (bs[i]!.id === w.buildingId) { working = bs[i]!.status.k === 'WORKING'; break; }
      workerPose(w.kind, this.time + w.phase, working, _pose);
      const p = this.workerParts.get(w.kind)!;
      if (p.legs.count >= WORKER_CAP) continue;
      p.legs.push(w.base);
      _wt.copy(w.base).multiply(_t.makeTranslation(0, WORKER_HIP_Y, 0)).multiply(ROT.makeRotationX(_pose.bend));
      p.torso.push(_wt);
      _wa.copy(_wt).multiply(_t.makeTranslation(0, WORKER_SHOULDER_Y, 0)).multiply(ROT.makeRotationX(_pose.arm));
      p.arms.push(_wa);
    }
    for (const p of this.workerParts.values()) { p.legs.end(); p.torso.end(); p.arms.end(); }
  }

  private clear(): void {
    for (const m of this.meshes) { this.group.remove(m); m.geometry.dispose(); }
    for (const w of this.wheels) for (const m of w.mesh) this.group.remove(m);
    this.meshes = [];
    this.wheels = [];
    this.workers = [];
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
const _pose = { bend: 0, arm: 0 };
