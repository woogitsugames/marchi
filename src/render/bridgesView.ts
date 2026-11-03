// Bridge segments: one model per water road cell, rotated along the road, deck at the sim's
// cellH; bank-end pieces (ramp, crib / wing walls) where a run meets land. Merged into one mesh
// per material; rebuilt with the road network. Foam collars and short wakes where piles and
// piers stand in the current: one extra transparent draw call over the water.
import {
  BufferAttribute,
  type BufferGeometry,
  BufferGeometry as Geometry,
  Color,
  Group,
  Matrix4,
  Mesh,
  type Material,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BRIDGE, type BridgeKind, bridgeEndParts, bridgeFootings, bridgeParts } from './models/bridges';
import { type MatKey, modelMaterial } from './models/materials';
import { noiseTexture } from './noiseTex';
import type { BridgeCell } from './roads';

const KEEP = new Set(['position', 'normal', 'uv', 'color']);

// Foam around a footing: a collar hugging its (rotated) box, and a wake trailing downstream
// (the river runs along +x, as in the water shader), widening and breaking up with distance.
const FOAM_VERT = /* glsl */ `
attribute vec2 aBox;   // footing-local offset (x across the road, z along it)
attribute vec2 aFlow;  // world offset from the footing centre (x downstream)
attribute vec4 aSize;  // half sizes (hx, hz), downstream / across extent of the box in world
varying vec2 vBox;
varying vec2 vFlow;
varying vec4 vSize;
varying vec2 vW;
#include <fog_pars_vertex>
void main() {
  vBox = aBox;
  vFlow = aFlow;
  vSize = aSize;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FOAM_FRAG = /* glsl */ `
uniform float uTime;
uniform float uLight;
uniform float uDetail;
uniform vec3 uSkyH;
uniform sampler2D tNoise;
varying vec2 vBox;
varying vec2 vFlow;
varying vec4 vSize;
varying vec2 vW;
#include <common>
#include <fog_pars_fragment>
void main() {
  // rounded footprint (cutwaters are pointed, piles round): corners eased by 0.3 m
  float rr = min(0.3, min(vSize.x, vSize.y));
  float d = length(max(abs(vBox) - vSize.xy + rr, 0.0)) - rr;
  float collar = 1.0 - smoothstep(0.0, 0.22 + 0.08 * vSize.y, d);
  float u = vFlow.x - vSize.z;
  float wide = vSize.w + 0.35 + max(u, 0.0) * 0.3;
  float wake = step(0.0, u) * (1.0 - smoothstep(0.0, 2.5 + 2.0 * vSize.w, u)) * (1.0 - smoothstep(wide * 0.4, wide, abs(vFlow.y)));
  float n = texture2D(tNoise, vW / 3.5 + vec2(-uTime * 0.05 * (0.4 + 0.6 * uDetail), 0.0)).r;
  float n2 = texture2D(tNoise, vW / 2.2 + vec2(-uTime * 0.11 * uDetail, 0.31)).g;
  float f = max(collar * smoothstep(0.35, 0.7, n2 * 0.6 + n * 0.4 + collar * 0.15), wake * smoothstep(0.38, 0.68, n * 0.7 + n2 * 0.3) * 0.75);
  float a = f * 0.28;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uSkyH * 0.56 * uLight, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const _v = new Vector3();

export class BridgesView {
  readonly group = new Group();
  private meshes: Mesh[] = [];
  private foam: Mesh | null = null;
  readonly foamMaterial = new ShaderMaterial({
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      { uTime: { value: 0 }, uLight: { value: 1 }, uDetail: { value: 1 }, uSkyH: { value: new Color('#c9c6bb') }, tNoise: { value: null } },
    ]),
    vertexShader: FOAM_VERT,
    fragmentShader: FOAM_FRAG,
    transparent: true,
    depthWrite: false,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  constructor() {
    this.foamMaterial.uniforms.tNoise!.value = noiseTexture();
  }

  rebuild(cells: BridgeCell[], waterLevel: number): void {
    for (const m of this.meshes) { this.group.remove(m); m.geometry.dispose(); }
    this.meshes = [];
    if (this.foam) { this.group.remove(this.foam); this.foam.geometry.dispose(); this.foam = null; }
    if (!cells.length) return;
    const byMat = new Map<MatKey, BufferGeometry[]>();
    const S = new Matrix4(), R = new Matrix4(), F = new Matrix4().makeRotationY(Math.PI);
    const add = (parts: ReturnType<typeof bridgeParts>, m: Matrix4) => {
      for (const p of parts) {
        const g = p.geometry.clone();
        for (const k of Object.keys(g.attributes)) if (!KEEP.has(k)) g.deleteAttribute(k);
        g.applyMatrix4(m);
        let l = byMat.get(p.material);
        if (!l) byMat.set(p.material, (l = []));
        l.push(g);
      }
    };
    // run ends: no bridge cell one segment further along the road axis
    const hasCellNear = (x: number, z: number) => cells.some((o) => Math.abs(o.x - x) < 1 && Math.abs(o.z - z) < 1);
    const foam: number[][] = [[], [], [], []];
    const foamIdx: number[] = [];
    for (const c of cells) {
      const kind: BridgeKind = c.surface === 2 ? 'stone' : 'wood';
      const deck = kind === 'stone' ? BRIDGE.stoneDeckY : BRIDGE.woodDeckY;
      const m = new Matrix4().makeTranslation(c.x, c.y - deck, c.z).multiply(R.makeRotationY(c.angle)).multiply(S.makeScale(1, 1, c.stretch * 1.002));
      add(bridgeParts(kind), m);
      const step = BRIDGE.cell * c.stretch;
      const dx = Math.sin(c.angle) * step, dz = Math.cos(c.angle) * step;
      if (!hasCellNear(c.x + dx, c.z + dz)) add(bridgeEndParts(kind), m);
      if (!hasCellNear(c.x - dx, c.z - dz)) add(bridgeEndParts(kind), m.clone().multiply(F));
      // foam quads at the water surface (only where the bed lies below it: the bank hides the rest)
      const ca = Math.cos(c.angle), sa = Math.sin(c.angle);
      for (const f of bridgeFootings(kind)) {
        const lz = f.z * c.stretch;
        _v.set(f.x, 0, lz).applyMatrix4(R.makeRotationY(c.angle));
        const px = c.x + _v.x, pz = c.z + _v.z;
        // the box's extent along / across the flow (world x / z)
        const ex = Math.abs(ca) * f.hx + Math.abs(sa) * f.hz * c.stretch;
        const ez = Math.abs(sa) * f.hx + Math.abs(ca) * f.hz * c.stretch;
        const x0 = -ex - 0.9, x1 = ex + 3.5 + 2.5 * ez, zr = ez + 1.4;
        const base = foam[0]!.length / 3;
        for (const [ox, oz] of [[x0, -zr], [x1, -zr], [x1, zr], [x0, zr]] as const) {
          foam[0]!.push(px + ox, waterLevel + 0.03, pz + oz);
          // world offset -> footing-local (inverse rotation about Y)
          foam[1]!.push(ox * ca - oz * sa, (ox * sa + oz * ca) / c.stretch);
          foam[2]!.push(ox, oz);
          foam[3]!.push(f.hx, f.hz, ex, ez);
        }
        foamIdx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      }
    }
    for (const [mat, list] of byMat) {
      const g = mergeGeometries(list, false);
      for (const l of list) l.dispose();
      if (!g) continue;
      g.computeBoundingSphere();
      const mesh = new Mesh(g, modelMaterial(mat) as Material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `bridge-${mat}`;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
    if (foamIdx.length) {
      const g = new Geometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(foam[0]!), 3));
      g.setAttribute('aBox', new BufferAttribute(new Float32Array(foam[1]!), 2));
      g.setAttribute('aFlow', new BufferAttribute(new Float32Array(foam[2]!), 2));
      g.setAttribute('aSize', new BufferAttribute(new Float32Array(foam[3]!), 4));
      g.setIndex(foamIdx);
      g.computeBoundingSphere();
      this.foam = new Mesh(g, this.foamMaterial);
      this.foam.name = 'bridge-foam';
      // over the water (renderOrder 1), under the mist (3)
      this.foam.renderOrder = 2;
      this.group.add(this.foam);
    }
  }

  /** Per frame: foam drift and light (same sky tint as the shoreline foam). */
  update(time: number, light: number, skyH: Color): void {
    const u = this.foamMaterial.uniforms;
    u.uTime!.value = time;
    u.uLight!.value = light;
    (u.uSkyH!.value as Color).copy(skyH);
  }

  /** High/ultra: the foam drifts and churns; low: a slower single layer. */
  setDetail(high: boolean): void {
    this.foamMaterial.uniforms.uDetail!.value = high ? 1 : 0;
  }

  dispose(): void {
    for (const m of this.meshes) m.geometry.dispose();
    this.foam?.geometry.dispose();
    this.foamMaterial.dispose();
  }
}
