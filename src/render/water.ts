// River surface at terrain.waterLevel: grey-green body tinted by depth (baked per vertex from
// the heightfield), noise-texture ripples drifting with the current, a cheap Fresnel
// reflection of the sky gradient and a sun glint. Morning mist: a few layers of soft,
// horizontal quads over the water, faded by time of day. One draw call each.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three';
import { CELL, type Heightfield } from './heightfield';
import { rng } from './models/kit';
import { noiseTexture } from './noiseTex';
import { APRON, apronHeight } from './terrain';

const WATER_VERT = /* glsl */ `
attribute float depth;
varying vec3 vW;
varying float vDepth;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vDepth = depth;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform float uRain;
uniform float uLight;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSkyH;
uniform vec3 uSkyZ;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform sampler2D tNoise;
varying vec3 vW;
varying float vDepth;
#include <common>
#include <fog_pars_fragment>
float hgt(vec2 p) {
  float a = texture2D(tNoise, p / 90.0 + vec2(uTime * 0.0016, uTime * 0.0005)).a;
  float b = texture2D(tNoise, p / 34.0 + vec2(-uTime * 0.004, uTime * 0.0025)).r;
  float c = texture2D(tNoise, p / 18.0 + vec2(uTime * 0.012, -uTime * 0.008)).g * uRain;
  return a * 0.7 + b * 0.35 + c * 0.3;
}
void main() {
  vec2 p = vW.xz;
  float e = 0.3;
  float h0 = hgt(p);
  float hx = hgt(p + vec2(e, 0.0)) - h0;
  float hz = hgt(p + vec2(0.0, e)) - h0;
  float amp = 0.5 + 0.35 * uRain;
  vec3 N = normalize(vec3(-hx * amp / e, 1.0, -hz * amp / e));
  vec3 V = normalize(cameraPosition - vW);
  float ndv = max(dot(N, V), 0.0);
  float fres = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uSkyH, uSkyZ, smoothstep(0.0, 0.7, R.y));
  float d = clamp(vDepth / 1.4, 0.0, 1.0);
  vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 1.0, d)) * uLight;
  vec3 col = mix(body, sky * 0.62, clamp(fres * 0.8 + 0.05, 0.0, 1.0));
  float spec = pow(max(dot(R, uSunDir), 0.0), 180.0) * (1.0 - uRain * 0.8);
  col += uSunCol * spec * 1.4;
  float alpha = smoothstep(0.0, 0.22, vDepth) * mix(0.72, 0.97, d);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const MIST_VERT = /* glsl */ `
attribute vec4 quad; // centre xyz, size
attribute vec2 corner;
attribute float seed;
varying vec2 vUv;
varying float vSeed;
varying vec3 vW;
#include <fog_pars_vertex>
uniform float uTime;
void main() {
  vUv = corner;
  vSeed = seed;
  float drift = sin(uTime * 0.05 + seed * 6.28) * 3.0;
  vec3 wp = quad.xyz + vec3(corner.x * quad.w + drift, 0.0, corner.y * quad.w * 0.55);
  vW = wp;
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const MIST_FRAG = /* glsl */ `
uniform float uOpacity;
uniform float uTime;
uniform vec3 uColor;
uniform sampler2D tNoise;
varying vec2 vUv;
varying float vSeed;
varying vec3 vW;
#include <common>
#include <fog_pars_fragment>
void main() {
  float r = length(vUv);
  float soft = 1.0 - smoothstep(0.2, 1.0, r);
  float n = texture2D(tNoise, vW.xz / 37.0 + vec2(uTime * 0.004, vSeed)).a;
  float a = soft * soft * (0.3 + 0.9 * n) * uOpacity * 0.13;
  gl_FragColor = vec4(uColor, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export class WaterView {
  readonly mesh: Mesh;
  readonly mist: Mesh;
  readonly material: ShaderMaterial;
  readonly mistMaterial: ShaderMaterial;

  constructor(hf: Heightfield) {
    const WL = hf.waterLevel;
    // strip spanning the river's z range, extended through the apron on both sides
    let zmin = Infinity, zmax = -Infinity;
    for (let y = 0; y < hf.h; y++) for (let x = 0; x < hf.w; x++) {
      if (hf.waterDist[y * hf.w + x]! < 0.5) { zmin = Math.min(zmin, y); zmax = Math.max(zmax, y); }
    }
    if (!isFinite(zmin)) { zmin = 0; zmax = 0; }
    const z0 = (zmin - 3) * CELL, z1 = (zmax + 4) * CELL;
    const x0 = -APRON, x1 = hf.sizeX + APRON;
    const S = 2;
    const nx = Math.ceil((x1 - x0) / S), nz = Math.ceil((z1 - z0) / S);
    const verts: number[] = [], depth: number[] = [], idx: number[] = [];
    const vid = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
    const H = (x: number, z: number) => (hf.inside(x, z) ? hf.height(x, z) : apronHeight(hf, x, z));
    // emit only quads where some corner is under water
    const depthAt = new Float32Array((nx + 1) * (nz + 1));
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) depthAt[j * (nx + 1) + i] = WL - H(x0 + i * S, z0 + j * S);
    const vertex = (i: number, j: number) => {
      const k = j * (nx + 1) + i;
      if (vid[k]! >= 0) return vid[k]!;
      vid[k] = verts.length / 3;
      verts.push(x0 + i * S, WL, z0 + j * S);
      depth.push(depthAt[k]!);
      return vid[k]!;
    };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * (nx + 1) + i;
      const m = Math.max(depthAt[k]!, depthAt[k + 1]!, depthAt[k + nx + 1]!, depthAt[k + nx + 2]!);
      if (m < -0.05) continue;
      const a = vertex(i, j), b = vertex(i + 1, j), c = vertex(i, j + 1), d = vertex(i + 1, j + 1);
      idx.push(a, c, b, b, c, d);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
    g.setAttribute('depth', new BufferAttribute(new Float32Array(depth), 1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    this.material = new ShaderMaterial({
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uRain: { value: 0 },
          uLight: { value: 1 },
          uDeep: { value: new Color('#2c3533') },
          uShallow: { value: new Color('#45453a') },
          uSkyH: { value: new Color('#c9c6bb') },
          uSkyZ: { value: new Color('#9aa3a3') },
          uSunDir: { value: new Vector3(0, 1, 0) },
          uSunCol: { value: new Color('#ffd6ad') },
          tNoise: { value: null },
        },
      ]),
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    this.material.uniforms.tNoise!.value = noiseTexture();
    this.mesh = new Mesh(g, this.material);
    this.mesh.name = 'water';
    this.mesh.renderOrder = 1;

    // mist quads along the river centre
    const r = rng(77);
    const quads: number[] = [], corners: number[] = [], seeds: number[] = [], mi: number[] = [];
    let n = 0;
    for (let x = 0; x < hf.w; x += 3) {
      let sy = 0, cnt = 0;
      for (let y = 0; y < hf.h; y++) if (hf.waterDist[y * hf.w + x]! < 0.5) { sy += y; cnt++; }
      if (!cnt) continue;
      const cz = (sy / cnt + 0.5) * CELL;
      for (let layer = 0; layer < 2; layer++) {
        const cx = (x + 0.5 + r() * 2) * CELL;
        const size = 16 + r() * 14;
        const y = WL + 0.7 + layer * 0.9 + r() * 0.4;
        const s = r();
        for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
          quads.push(cx, y, cz + (r() - 0.5) * 4, size);
          corners.push(u, v);
          seeds.push(s);
        }
        mi.push(n, n + 1, n + 2, n, n + 2, n + 3);
        n += 4;
      }
    }
    const mg = new BufferGeometry();
    mg.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
    mg.setAttribute('quad', new BufferAttribute(new Float32Array(quads), 4));
    mg.setAttribute('corner', new BufferAttribute(new Float32Array(corners), 2));
    mg.setAttribute('seed', new BufferAttribute(new Float32Array(seeds), 1));
    mg.setIndex(mi);
    mg.boundingSphere = g.boundingSphere!.clone();
    this.mistMaterial = new ShaderMaterial({
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        { uOpacity: { value: 0 }, uTime: { value: 0 }, uColor: { value: new Color('#d2cfc4') }, tNoise: { value: null } },
      ]),
      vertexShader: MIST_VERT,
      fragmentShader: MIST_FRAG,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      fog: true,
    });
    this.mistMaterial.uniforms.tNoise!.value = noiseTexture();
    this.mist = new Mesh(mg, this.mistMaterial);
    this.mist.name = 'mist';
    this.mist.renderOrder = 3;
    this.mist.frustumCulled = false;
  }

  update(time: number, rain: number, mist: number): void {
    this.material.uniforms.uTime!.value = time;
    this.material.uniforms.uRain!.value = rain;
    this.mistMaterial.uniforms.uTime!.value = time;
    this.mistMaterial.uniforms.uOpacity!.value = mist;
    this.mist.visible = mist > 0.01;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mist.geometry.dispose();
    this.material.dispose();
    this.mistMaterial.dispose();
  }
}
