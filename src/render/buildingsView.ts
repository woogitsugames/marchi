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
import type { Building, World } from '../sim/index';
import { CELL, type Heightfield } from './heightfield';
import { buildingModel, type BuildingKind } from './models/buildings';
import { type ModelPart, PartBuilder } from './models/kit';
import { type MatKey, modelMaterial } from './models/materials';

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

export class BuildingsView {
  readonly group = new Group();
  info = new Map<number, BuildingInfo>();
  private meshes: Mesh[] = [];
  private wheels: Wheel[] = [];
  private signature = '';

  constructor(private readonly hf: Heightfield) {}

  /** Rebuild if the set of buildings changed. Returns true when rebuilt. */
  sync(world: World): boolean {
    const sig = world.state.buildings.map((b) => `${b.id}:${b.type}:${b.x}:${b.y}:${b.facing}`).join('|');
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
      const cx = (b.x + b.w / 2) * CELL, cz = (b.y + b.h / 2) * CELL;
      // ground under the footprint
      let lo = Infinity, hi = -Infinity, sum = 0, n = 0;
      for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) {
        const y = this.hf.height(b.x * CELL + (i / 4) * b.w * CELL, b.y * CELL + (j / 4) * b.h * CELL);
        lo = Math.min(lo, y); hi = Math.max(hi, y); sum += y; n++;
      }
      const mean = sum / n;
      const baseY = mean + (hi - mean) * 0.35;
      const angle = (b.facing & 3) * (Math.PI / 2);
      const odd = (b.facing & 1) === 1;
      const [mcx, mcz] = model.cells;
      const sx = odd ? b.h / mcx : b.w / mcx;
      const sz = odd ? b.w / mcz : b.h / mcz;
      const m = new Matrix4().makeTranslation(cx, baseY, cz).multiply(_m.makeRotationY(angle)).multiply(new Matrix4().makeScale(sx, 1, sz));
      add(model.parts, m);
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

  private clear(): void {
    for (const m of this.meshes) { this.group.remove(m); m.geometry.dispose(); }
    for (const w of this.wheels) for (const m of w.mesh) this.group.remove(m);
    this.meshes = [];
    this.wheels = [];
    this.info.clear();
  }

  dispose(): void {
    this.clear();
  }
}

const ROT = new Matrix4();
