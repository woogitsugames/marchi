// The pave ghost on a bridge deck (D-133): the stone-span cure ("pave the bridge in stone") proposes cells over the
// water, where the terrain-draped road preview (D-132) lies on the river bed under the water and the wooden deck.
// One quad per proposed bridge cell, a few centimetres above the planks, drawn with the same grey-buff setts with
// dark joints and an ochre rim as the mud stretch's ghost on the ground.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
} from 'three';
import { BRIDGE } from './models/bridges';
import type { BridgeCell } from './roads';

const VERT = /* glsl */ `
attribute vec2 aEdge;  // across the deck (-1..1), along the run (-1..1)
varying vec2 vEdge;
varying vec2 vW;
#include <fog_pars_vertex>
void main() {
  vEdge = aEdge;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
uniform float uLight;
uniform vec3 uOchre;
varying vec2 vEdge;
varying vec2 vW;
#include <common>
#include <fog_pars_fragment>
// 1 inside a sett, 0 on the joints: staggered rows of size metres (as the terrain's pave ghost, D-132)
float settFace(vec2 wxz, float size) {
  vec2 sp = wxz / size;
  sp.x += 0.5 * step(0.5, fract(sp.y * 0.5));
  vec2 sf = abs(fract(sp) - 0.5);
  return 1.0 - smoothstep(0.34, 0.44, max(sf.x, sf.y));
}
void main() {
  float fw = length(vec2(fwidth(vW.x), fwidth(vW.y))) * 0.7071;
  float lv = log2(max(1.0, fw * 6.0 / 0.95));
  float l0 = floor(lv);
  float sz = 0.95 * exp2(l0);
  float face = mix(settFace(vW, sz), settFace(vW, sz * 2.0), lv - l0);
  vec3 stone = mix(vec3(0.3, 0.27, 0.23), vec3(0.78, 0.73, 0.62), face);
  // an ochre rim along the deck's edges (the parapets), like the ground ghost's verge
  float rim = smoothstep(0.78, 0.95, abs(vEdge.x));
  vec3 col = mix(stone, uOchre, rim) * (0.55 + 0.45 * uLight);
  gl_FragColor = vec4(col, 0.9);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export class DeckGhost {
  readonly group = new Group();
  private mesh: Mesh | null = null;
  private key = '';
  readonly material = new ShaderMaterial({
    uniforms: UniformsUtils.merge([UniformsLib.fog, { uLight: { value: 1 }, uOchre: { value: new Color('#b8893a') } }]),
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    fog: true,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  constructor() {
    this.group.name = 'deck-pave-ghost';
  }

  /** cells: the proposed stretch (null = none); only its wooden bridge cells get a deck ghost. */
  set(cells: readonly number[] | null, bridges: readonly BridgeCell[]): void {
    const want = cells ? new Set(cells) : null;
    const on = want ? bridges.filter((b) => want.has(b.cell) && b.surface === 1) : [];
    const key = on.map((b) => `${b.cell}:${b.y}:${b.angle}`).join(',');
    if (key === this.key) return;
    this.key = key;
    if (this.mesh) { this.group.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh = null; }
    if (!on.length) return;
    const pos = new Float32Array(on.length * 12), edge = new Float32Array(on.length * 8), idx: number[] = [];
    const hw = BRIDGE.woodWidth * 0.5 - 0.1;
    on.forEach((b, i) => {
      // along the run: the model's +Z rotated by angle; across: +X rotated
      const s = Math.sin(b.angle), c = Math.cos(b.angle);
      const hl = BRIDGE.cell * b.stretch * 0.5;
      const ax = s * hl, az = c * hl, cx = c * hw, cz = -s * hw;
      const y = b.y + 0.04;
      const corners: [number, number, number, number][] = [[-1, -1, -1, -1], [1, -1, 1, -1], [1, 1, 1, 1], [-1, 1, -1, 1]];
      corners.forEach(([u, v, eu, ev], k) => {
        pos.set([b.x + cx * u + ax * v, y, b.z + cz * u + az * v], (i * 4 + k) * 3);
        edge.set([eu, ev], (i * 4 + k) * 2);
      });
      const o = i * 4;
      idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aEdge', new BufferAttribute(edge, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    this.mesh = new Mesh(g, this.material);
    this.mesh.renderOrder = 18;
    this.mesh.name = 'deck-pave-ghost';
    this.group.add(this.mesh);
  }

  update(light: number): void {
    this.material.uniforms.uLight!.value = light;
  }

  dispose(): void {
    this.mesh?.geometry.dispose();
    this.material.dispose();
  }
}
