// Placement ghost for the build tool: the real building model (geometry merged and cached per
// type) drawn see-through and tinted — ochre when the spot is valid, clay when it is not — at the
// same transform the placed building will get. Two draw calls: a depth-only pre-pass and one
// translucent colour pass (so the model's own back faces never show through its front).
// The ground marks (footprint outline, gate wedge, offending cell) are drawn by the terrain
// shader from OverlayData uniforms, so they drape on the ground and cost no draw call.
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BUILDINGS, gateCell, type World } from '../sim/index';
import type { PlacementGhost } from './api';
import { footprintTransform } from './buildingsView';
import { CELL, type Heightfield } from './heightfield';
import { buildingModel, type BuildingKind } from './models/buildings';
import type { OverlayData } from './overlay';

/** Palette (docs/ART_DIRECTION.md): Ochra for a valid spot, Glina for a refused one. */
const OCHRE = new Color('#b8893a');
const CLAY = new Color('#8c4a2f');

const geoCache = new Map<BuildingKind, BufferGeometry>();

/** All parts of a building model (mill wheel included, at rest) as one geometry (position, normal, baked colour). */
function ghostGeometry(kind: BuildingKind): BufferGeometry {
  const hit = geoCache.get(kind);
  if (hit) return hit;
  const model = buildingModel(kind);
  const list: BufferGeometry[] = [];
  const strip = (g: BufferGeometry, m: Matrix4 | null): void => {
    let c = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(c.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') c.deleteAttribute(k);
    if (!c.getAttribute('color')) {
      const n = c.getAttribute('position').count;
      c.setAttribute('color', new Float32BufferAttribute(new Float32Array(n * 3).fill(0.7), 3));
    }
    if (m) c = c.applyMatrix4(m);
    list.push(c);
  };
  for (const p of model.parts) strip(p.geometry, null);
  if (model.wheel) {
    const m = new Matrix4().makeTranslation(model.wheel.pivot.x, model.wheel.pivot.y, model.wheel.pivot.z);
    for (const p of model.wheel.parts) strip(p.geometry, m);
  }
  const g = mergeGeometries(list, false) ?? new BufferGeometry();
  for (const l of list) l.dispose();
  g.computeBoundingSphere();
  geoCache.set(kind, g);
  return g;
}

export class PlacementGhostView {
  readonly group = new Group();
  private readonly depthMat = new MeshBasicMaterial({ colorWrite: false, transparent: true });
  // the baked vertex colour (AO, thatch vs. plaster values) keeps the model's form readable;
  // the tint multiplies it (lifted above 1 so the wash stays light) and a little emissive keeps it
  // legible in shadow and at dusk
  private readonly colourMat = new MeshStandardMaterial({
    color: OCHRE.clone(),
    vertexColors: true,
    emissive: OCHRE.clone(),
    emissiveIntensity: 0.14,
    roughness: 0.92,
    metalness: 0,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  private readonly pre: Mesh;
  private readonly col: Mesh;
  private key = '';

  constructor() {
    this.depthMat.name = 'ghost-depth';
    this.colourMat.name = 'ghost';
    this.pre = new Mesh(new BufferGeometry(), this.depthMat);
    this.col = new Mesh(this.pre.geometry, this.colourMat);
    for (const m of [this.pre, this.col]) {
      m.matrixAutoUpdate = false;
      m.castShadow = false;
      m.receiveShadow = false;
    }
    // after the opaque scene and the water; depth pre-pass first
    this.pre.renderOrder = 20;
    this.col.renderOrder = 21;
    this.group.add(this.pre, this.col);
    this.group.visible = false;
  }

  /** Show / move / hide. Cheap when nothing changed (called on every ghost change, not per frame). */
  set(g: PlacementGhost | null, world: World | null, hf: Heightfield | null, ov: OverlayData | null): void {
    if (!g || !world || !hf) {
      this.key = '';
      this.group.visible = false;
      if (ov) { ov.ghostOn.set(0, 0); ov.ghostBad.w = 0; }
      return;
    }
    const key = `${g.type}|${g.x}|${g.y}|${g.facing & 3}|${g.valid}|${g.badCell}|${world.state.netVersion}`;
    if (key === this.key) return;
    this.key = key;
    const def = BUILDINGS[g.type];
    const kind = g.type as BuildingKind;
    const geo = ghostGeometry(kind);
    this.pre.geometry = geo;
    this.col.geometry = geo;
    const { m } = footprintTransform(hf, buildingModel(kind), g.x, g.y, def.w, def.h, g.facing);
    this.pre.matrix.copy(m);
    this.col.matrix.copy(m);
    this.pre.matrixWorldNeedsUpdate = true;
    this.col.matrixWorldNeedsUpdate = true;
    const tint = g.valid ? OCHRE : CLAY;
    this.colourMat.color.copy(tint).multiplyScalar(1.7);
    this.colourMat.emissive.copy(tint);
    this.group.visible = true;
    if (!ov) return;
    const W = world.terrain.w;
    ov.ghostRect.set(g.x * CELL, g.y * CELL, (g.x + def.w) * CELL, (g.y + def.h) * CELL);
    const gate = gateCell(world, g.x, g.y, def.w, def.h, g.facing);
    const gx = ((gate % W) + 0.5) * CELL, gz = (Math.floor(gate / W) + 0.5) * CELL;
    const f = g.facing & 3;
    ov.ghostGate.set(gx, gz, f === 1 ? 1 : f === 3 ? -1 : 0, f === 0 ? 1 : f === 2 ? -1 : 0);
    if (!g.valid && g.badCell >= 0 && g.badCell < W * world.terrain.h) {
      ov.ghostBad.set(((g.badCell % W) + 0.5) * CELL, (Math.floor(g.badCell / W) + 0.5) * CELL, CELL / 2 - 0.2, 1);
    } else ov.ghostBad.w = 0;
    ov.ghostOn.set(1, g.valid ? 1 : 0);
  }

  dispose(): void {
    for (const g of geoCache.values()) g.dispose();
    geoCache.clear();
    this.depthMat.dispose();
    this.colourMat.dispose();
  }
}
