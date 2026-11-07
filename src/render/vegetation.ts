// Trees from terrain.forest density: instanced full models near the camera (two geometry
// variants per kind), camera-facing cards (atlas baked from the same models) further away and on
// the apron hills, with a dithered crossfade band between the two.
// Placement (deterministic per cell, skipping water, fields, buildings and roads) lives in placement.ts.
import {
  CustomBlending,
  DstColorFactor,
  InstancedMesh,
  type Material,
  PlaneGeometry,
  ShaderMaterial,
  type Vector3,
  type WebGLRenderer,
  ZeroFactor,
} from 'three';
import type { World } from '../sim/index';
import { groundMemo } from './groundCache';
import type { Heightfield } from './heightfield';
import { markInstances } from './instancedParts';
import { modelMaterial, shareInstancedDepth, treeUniforms } from './models/materials';
import { bakeTreeBillboards, billboardDepthMaterial, treeBillboard, treeLodFactor, treeParts, TREE_KINDS, TREE_VARIANTS } from './models/trees';
import { placeApron, placeTrees, type Tree } from './placement';
import type { RoadField } from './roads';

// Soft contact shadow under far-tree cards: a flat quad multiplied onto the ground (darkening
// toward its centre), so a distant clump reads as standing on the meadow. Unlit, no depth write;
// fades out with distance where the fog takes over.
const BLOB_VERT = /* glsl */ `
varying vec2 vP;
varying float vFar;
void main() {
  vP = position.xy;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position.x, 0.0, -position.y, 1.0);
  vFar = distance(cameraPosition, wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const BLOB_FRAG = /* glsl */ `
varying vec2 vP;
varying float vFar;
void main() {
  float r = length(vP);
  float a = 1.0 - smoothstep(0.15, 1.0, r);
  a *= a * (1.0 - smoothstep(320.0, 700.0, vFar));
  gl_FragColor = vec4(vec3(1.0 - 0.3 * a), 1.0);
}`;

function blobMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: BLOB_VERT,
    fragmentShader: BLOB_FRAG,
    transparent: true,
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: DstColorFactor,
    blendDst: ZeroFactor,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    fog: false,
  });
}

export class VegetationView {
  readonly group: import('three').Group;
  private trees: Tree[] = [];
  private apron: Tree[] = [];
  /** near[kind * TREE_VARIANTS + variant] = one mesh per material part. */
  private near: InstancedMesh[][] = [];
  private far: InstancedMesh[] = [];
  /** Contact shadows under far cards (one draw call; off in low quality). */
  private blobs: InstancedMesh | null = null;
  private blobGeo = new PlaneGeometry(2, 2);
  private blobMat = blobMaterial();
  private blobsOn = true;
  private lastX = Infinity;
  private lastZ = Infinity;
  private lastR = 0;
  private castShadows = true;
  nearDist = 85;
  /** Width (m) of the dithered crossfade between full trees and far cards. */
  fadeBand = 12;

  constructor(private readonly hf: Heightfield, group: import('three').Group) {
    this.group = group;
    this.apron = groundMemo('apron-trees', hf.t, () => placeApron(hf)); // same ground, same apron trees (D-282)
  }

  /** Bake (or re-bake at another cell size, bare or spring level, D-260 / D-303) the far-card atlases. */
  bake(renderer: WebGLRenderer, cellPx: number, bare = 0, spring = 0): void {
    bakeTreeBillboards(renderer, cellPx, bare, spring);
  }

  /**
   * Deciduous crowns 0 (in leaf) … 1 (bare) (D-260) and 0 … 1 young spring green (D-303) for the near trees, the
   * ground-cover shrubs and the far cards' per-tree tint: two numbers written into shared uniforms.
   */
  setBare(bare: number, spring = 0): void {
    treeUniforms.uBare.value = bare;
    treeUniforms.uSpring.value = spring;
  }

  setShadows(on: boolean): void {
    this.castShadows = on;
    // the contact-shadow decals belong to the shadowed (high/ultra) look; low stays as cheap
    if (this.blobsOn !== on) { this.blobsOn = on; this.lastX = Infinity; }
    for (const l of this.near) for (const m of l) m.castShadow = on;
    for (const m of this.far) m.castShadow = on;
  }

  rebuild(world: World, roads: RoadField): void {
    this.trees = placeTrees(world, this.hf, roads);
    // (re)allocate instanced meshes sized to the counts
    for (const l of this.near) for (const m of l) { this.group.remove(m); m.dispose(); }
    for (const m of this.far) { this.group.remove(m); m.dispose(); }
    if (this.blobs) { this.group.remove(this.blobs); this.blobs.dispose(); }
    this.near = [];
    this.far = [];
    this.blobs = new InstancedMesh(this.blobGeo, this.blobMat, Math.max(1, this.trees.length + this.apron.length));
    this.blobs.count = 0;
    this.blobs.name = 'tree-blob';
    this.blobs.renderOrder = 1;
    this.blobs.frustumCulled = false;
    this.group.add(this.blobs);
    TREE_KINDS.forEach((kind, k) => {
      const n = this.trees.filter((t) => t.kind === k).length;
      const na = this.apron.filter((t) => t.kind === k).length;
      for (let v = 0; v < TREE_VARIANTS; v++) {
        const nv = this.trees.filter((t) => t.kind === k && t.variant === v).length;
        this.near.push(
          treeParts(kind, v).map((p) => {
            const m = new InstancedMesh(p.geometry, modelMaterial(p.material) as Material, Math.max(1, nv));
            m.count = 0;
            m.castShadow = this.castShadows;
            m.receiveShadow = true;
            m.name = `tree-${kind}${v}-${p.material}`;
            shareInstancedDepth(m);
            this.group.add(m);
            return m;
          }),
        );
      }
      const bb = treeBillboard(kind)[0]!;
      const fm = new InstancedMesh(bb.geometry, modelMaterial(bb.material) as Material, Math.max(1, n + na));
      fm.count = 0;
      fm.castShadow = this.castShadows;
      fm.receiveShadow = true;
      fm.customDepthMaterial = billboardDepthMaterial();
      fm.name = `tree-bb-${kind}`;
      this.group.add(fm);
      this.far.push(fm);
    });
    this.lastX = Infinity;
  }

  /** Re-bucket near/far when the camera moved noticeably. */
  update(camPos: Vector3, force = false): void {
    treeUniforms.uLodNear.value = this.nearDist;
    treeUniforms.uLodBand.value = this.fadeBand;
    const dx = camPos.x - this.lastX, dz = camPos.z - this.lastZ;
    if (!force && dx * dx + dz * dz < 36 && Math.abs(this.nearDist - this.lastR) < 1) return;
    this.lastX = camPos.x;
    this.lastZ = camPos.z;
    this.lastR = this.nearDist;
    // Trees inside the crossfade band (plus a margin for the 6 m re-bucket step) go into both
    // lists; the shaders dither them per pixel from the exact camera distance.
    const MARGIN = 7;
    const nK = TREE_KINDS.length;
    const nearIn = new Float32Array(nK), farOut = new Float32Array(nK), blobOut = new Float32Array(nK);
    TREE_KINDS.forEach((k, i) => {
      const f = treeLodFactor(k);
      const R = this.nearDist * f, B = this.fadeBand * f;
      nearIn[i] = (R + MARGIN) ** 2;
      farOut[i] = Math.max(0, R - B - MARGIN) ** 2;
      blobOut[i] = Math.max(0, R - B * 0.5) ** 2;
    });
    const counts = new Int32Array(nK * TREE_VARIANTS);
    const fcounts = new Int32Array(nK);
    const blobs = this.blobsOn ? this.blobs : null;
    let nb = 0;
    const cy = camPos.y;
    for (const t of this.trees) {
      const ddx = t.x - camPos.x, ddy = t.y - cy, ddz = t.z - camPos.z;
      const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
      if (d2 < nearIn[t.kind]!) {
        const slot = t.kind * TREE_VARIANTS + t.variant;
        const i = counts[slot]!++;
        for (const m of this.near[slot]!) m.setMatrixAt(i, t.m);
      }
      if (d2 > farOut[t.kind]!) {
        this.far[t.kind]!.setMatrixAt(fcounts[t.kind]!++, t.m);
        if (blobs && d2 > blobOut[t.kind]!) blobs.setMatrixAt(nb++, t.blob);
      }
    }
    for (const t of this.apron) {
      this.far[t.kind]!.setMatrixAt(fcounts[t.kind]!++, t.m);
      if (blobs) blobs.setMatrixAt(nb++, t.blob);
    }
    if (this.blobs) {
      this.blobs.count = nb;
      this.blobs.visible = nb > 0;
      markInstances(this.blobs.instanceMatrix, nb);
    }
    this.near.forEach((list, slot) => {
      for (const m of list) {
        m.count = counts[slot]!;
        markInstances(m.instanceMatrix, m.count);
        m.visible = m.count > 0;
        m.computeBoundingSphere();
      }
    });
    this.far.forEach((f, i) => {
      f.count = fcounts[i]!;
      markInstances(f.instanceMatrix, f.count);
      f.visible = f.count > 0;
      f.computeBoundingSphere();
    });
  }

  /** Per-frame: wind clock for the tree shaders. */
  tick(timeSec: number): void {
    treeUniforms.uTreeTime.value = timeSec;
  }

  dispose(): void {
    // the tree group is the view's, shared by every world: leave nothing of this world in it (D-222; before, every
    // world change left the previous world's trees drawn in the next one, e.g. the menu valley's in each mission)
    for (const l of this.near) for (const m of l) { this.group.remove(m); m.dispose(); }
    for (const m of this.far) { this.group.remove(m); m.dispose(); }
    if (this.blobs) this.group.remove(this.blobs);
    this.near = [];
    this.far = [];
    this.blobs?.dispose();
    this.blobs = null;
    this.blobGeo.dispose();
    this.blobMat.dispose();
  }
}
