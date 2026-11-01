// Cheap atmospheric effects, one draw call each and animated entirely in the vertex shader:
//  - chimney smoke (soft billboards rising and drifting with the wind) for working buildings
//  - rain streaks (line segments wrapping in a box around the camera target)
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineSegments,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three';
import { rng } from './models/kit';

const MAX_EMITTERS = 8;
const PUFFS = 16;

const SMOKE_VERT = /* glsl */ `
attribute vec3 emitter;
attribute vec2 corner;
attribute float seed;
attribute float on;
uniform float uTime;
uniform vec3 uWind;
varying vec2 vUv;
varying float vA;
#include <fog_pars_vertex>
void main() {
  float age = fract(uTime * 0.09 + seed);
  vec3 p = emitter + uWind * (age * age * 9.0) + vec3(sin(seed * 31.0 + age * 4.0) * 0.5, age * 9.0, cos(seed * 17.0 + age * 3.0) * 0.5);
  float size = 0.5 + age * 3.2;
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  mvPosition.xy += corner * size;
  vUv = corner;
  vA = on * (1.0 - age) * smoothstep(0.0, 0.08, age);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const SMOKE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
varying float vA;
#include <common>
#include <fog_pars_fragment>
void main() {
  float r = length(vUv);
  float a = (1.0 - smoothstep(0.3, 1.0, r)) * vA * uOpacity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const RAIN_VERT = /* glsl */ `
attribute vec3 seed;
attribute float tip;
uniform float uTime;
uniform vec3 uCenter;
uniform float uBox;
uniform vec3 uVel;
varying float vTip;
void main() {
  float H = uBox * 0.7;
  float y = mod(seed.y * H - uTime * length(uVel), H);
  vec3 p = uCenter + vec3((seed.x - 0.5) * uBox, y - H * 0.25, (seed.z - 0.5) * uBox);
  p -= uVel * tip * 0.085;
  vTip = tip;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const RAIN_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vTip;
void main() {
  gl_FragColor = vec4(uColor, uOpacity * (0.15 + 0.85 * vTip));
}`;

export class Effects {
  readonly smoke: Mesh;
  readonly rain: LineSegments;
  private readonly smokeMat: ShaderMaterial;
  private readonly rainMat: ShaderMaterial;
  private readonly emitterAttr: BufferAttribute;
  private readonly onAttr: BufferAttribute;

  constructor() {
    const n = MAX_EMITTERS * PUFFS;
    const em = new Float32Array(n * 4 * 3), corner = new Float32Array(n * 4 * 2), seed = new Float32Array(n * 4), on = new Float32Array(n * 4);
    const idx: number[] = [];
    const r = rng(55);
    for (let i = 0; i < n; i++) {
      const s = (i % PUFFS) / PUFFS + r() * 0.03;
      const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let k = 0; k < 4; k++) {
        corner[(i * 4 + k) * 2] = cs[k]![0]!;
        corner[(i * 4 + k) * 2 + 1] = cs[k]![1]!;
        seed[i * 4 + k] = s;
      }
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(n * 4 * 3), 3));
    this.emitterAttr = new BufferAttribute(em, 3);
    this.onAttr = new BufferAttribute(on, 1);
    g.setAttribute('emitter', this.emitterAttr);
    g.setAttribute('corner', new BufferAttribute(corner, 2));
    g.setAttribute('seed', new BufferAttribute(seed, 1));
    g.setAttribute('on', this.onAttr);
    g.setIndex(idx);
    this.smokeMat = new ShaderMaterial({
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        { uTime: { value: 0 }, uWind: { value: new Vector3(0.6, 0, 0.25) }, uColor: { value: new Color('#8f8a82') }, uOpacity: { value: 0.32 } },
      ]),
      vertexShader: SMOKE_VERT,
      fragmentShader: SMOKE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      fog: true,
    });
    this.smoke = new Mesh(g, this.smokeMat);
    this.smoke.frustumCulled = false;
    this.smoke.renderOrder = 4;
    this.smoke.name = 'smoke';

    const N = 2400;
    const rs = new Float32Array(N * 2 * 3), tip = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const a = r(), b = r(), c = r();
      for (let k = 0; k < 2; k++) {
        rs[(i * 2 + k) * 3] = a; rs[(i * 2 + k) * 3 + 1] = b; rs[(i * 2 + k) * 3 + 2] = c;
        tip[i * 2 + k] = k;
      }
    }
    const rg = new BufferGeometry();
    rg.setAttribute('position', new BufferAttribute(new Float32Array(N * 2 * 3), 3));
    rg.setAttribute('seed', new BufferAttribute(rs, 3));
    rg.setAttribute('tip', new BufferAttribute(tip, 1));
    this.rainMat = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new Vector3() },
        uBox: { value: 80 },
        uVel: { value: new Vector3(2.2, -14, 1.2) },
        uColor: { value: new Color('#8f9391') },
        uOpacity: { value: 0 },
      },
      vertexShader: RAIN_VERT,
      fragmentShader: RAIN_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.rain = new LineSegments(rg, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 5;
    this.rain.name = 'rain';
    this.rain.visible = false;
  }

  /** Set chimney emitters: world positions + whether each is smoking. */
  setEmitters(list: { pos: Vector3; on: boolean }[]): void {
    const em = this.emitterAttr.array as Float32Array, on = this.onAttr.array as Float32Array;
    for (let e = 0; e < MAX_EMITTERS; e++) {
      const it = list[e];
      for (let p = 0; p < PUFFS * 4; p++) {
        const k = e * PUFFS * 4 + p;
        if (it) { em[k * 3] = it.pos.x; em[k * 3 + 1] = it.pos.y; em[k * 3 + 2] = it.pos.z; }
        on[k] = it && it.on ? 1 : 0;
      }
    }
    this.emitterAttr.needsUpdate = true;
    this.onAttr.needsUpdate = true;
  }

  update(time: number, rain: number, center: Vector3, box: number, light: number): void {
    this.smokeMat.uniforms.uTime!.value = time;
    (this.smokeMat.uniforms.uColor!.value as Color).setRGB(0.16 * light + 0.02, 0.15 * light + 0.02, 0.14 * light + 0.02);
    this.rainMat.uniforms.uTime!.value = time;
    (this.rainMat.uniforms.uCenter!.value as Vector3).copy(center);
    this.rainMat.uniforms.uBox!.value = box;
    this.rainMat.uniforms.uOpacity!.value = rain * 0.32 * (0.4 + 0.6 * light);
    this.rain.visible = rain > 0.02;
  }

  dispose(): void {
    this.smoke.geometry.dispose();
    this.rain.geometry.dispose();
    this.smokeMat.dispose();
    this.rainMat.dispose();
  }
}
