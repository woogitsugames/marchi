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
import { APRON, ApronRow } from './terrain';

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
uniform float uDetail;
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
  float amp = 0.9 + 0.5 * uRain;
  vec3 N = normalize(vec3(-hx * amp / e, 1.0, -hz * amp / e));
  vec3 V = normalize(cameraPosition - vW);
  float ndv = max(dot(N, V), 0.0);
  float fres = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uSkyH, uSkyZ, smoothstep(0.0, 0.7, R.y));
  // large slow patches: deeper pools and shallower riffles, so the channel is not one tone
  vec4 big = texture2D(tNoise, p / 140.0 + vec2(0.17, 0.53));
  float d = clamp(vDepth / 1.3 + (big.r - 0.5) * 0.5, 0.0, 1.0);
  vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 1.0, d));
  body *= 0.9 + 0.2 * big.g;
  body *= uLight;
  // close to the camera the surface is clearer: darker body, more of the bed shows through
  float near = 1.0 - smoothstep(30.0, 140.0, distance(cameraPosition, vW));
  body *= 1.0 - 0.3 * near;
  // current: streaks stretched along the flow (river runs roughly along +x)
  float st = texture2D(tNoise, vec2(p.x / 55.0 - uTime * 0.012, p.y / 5.0 + big.b * 0.6)).a;
  float streak = smoothstep(0.5, 0.9, st) * (1.0 - uRain * 0.6) * smoothstep(0.15, 0.5, vDepth);
  vec3 col = mix(body, sky * 0.5, clamp(fres * 0.6 + 0.04 + streak * 0.06, 0.0, 1.0));
  float spec = pow(max(dot(R, uSunDir), 0.0), 180.0) * (1.0 - uRain * 0.8);
  col += uSunCol * spec * 1.4;
  // high: the waterline laps a few centimetres up the bank and back (slow, out of phase along
  // the river), so the edge and its foam move; low keeps a still edge
  float lap = uDetail * 0.05 * (0.5 + 0.5 * sin(uTime * 0.7 + p.x * 0.09 + big.b * 6.0));
  float dl = vDepth + lap;
  // broken scum / foam line along the waterline, lit like the sky; on high a second, thinner
  // line drifts in toward the bank and fades (wavelets breaking on the mud)
  float edge = smoothstep(0.02, 0.1, dl) * (1.0 - smoothstep(0.12, 0.32, dl));
  float brk = texture2D(tNoise, p / 6.0 + vec2(uTime * 0.003, 0.0)).r;
  float foam = edge * smoothstep(0.45, 0.75, brk) * 0.45;
  float ph = fract(dl * 3.2 + uTime * 0.11);
  foam += uDetail * smoothstep(0.75, 0.95, ph) * (1.0 - smoothstep(0.05, 0.4, dl)) * step(0.0, dl) * smoothstep(0.4, 0.7, brk) * 0.3;
  col = mix(col, uSkyH * 0.62 * uLight, min(foam, 0.6));
  float alpha = smoothstep(0.0, 0.3, dl) * mix(0.62, 0.96, d) * (1.0 - 0.3 * near * (1.0 - fres));
  // wet edge: the strip of bank just above the waterline is darker and catches a little sky
  // (the water mesh already covers it: quads reach 0.35 m above the water level)
  float wet = smoothstep(-0.3, -0.02, dl) * (1.0 - smoothstep(0.0, 0.12, dl)) * (0.75 + 0.25 * brk);
  vec3 wetCol = vec3(0.09, 0.08, 0.06) * uLight + sky * 0.25 * fres + uSunCol * spec * 0.4;
  float wA = wet * 0.34 * (1.0 - alpha);
  float outA = alpha + wA;
  gl_FragColor = vec4((col * alpha + wetCol * wA) / max(outA, 1e-3), outA);
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
  // thin out near the camera: mist is seen across the valley, not as a veil over the water at your feet
  float camFade = smoothstep(35.0, 150.0, distance(cameraPosition, vW));
  float a = soft * soft * (0.3 + 0.9 * n) * uOpacity * 0.09 * camFade;
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
    const S = 1;
    const nx = Math.ceil((x1 - x0) / S), nz = Math.ceil((z1 - z0) / S);
    const vid = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
    // emit only quads where some corner is under water
    const depthAt = new Float32Array((nx + 1) * (nz + 1));
    // the strip runs 280 m into the apron on both sides, where a whole row clamps to one border point: ApronRow asks
    // hf.base once per border point instead of once per metre (D-281; same values)
    const ap = new ApronRow(hf);
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + i * S, z = z0 + j * S;
      depthAt[j * (nx + 1) + i] = WL - (hf.inside(x, z) ? hf.height(x, z) : ap.at(x, z));
    }
    // two passes straight into typed arrays (D-281; were number[] pushes copied afterwards): number the vertices in
    // the order the quads first use them, then fill; the index width follows three's setIndex(array) rule
    const wet = new Uint8Array(nx * nz);
    let nv = 0, nq = 0;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * (nx + 1) + i;
      const m = Math.max(depthAt[k]!, depthAt[k + 1]!, depthAt[k + nx + 1]!, depthAt[k + nx + 2]!);
      if (m < -0.35) continue;
      wet[j * nx + i] = 1;
      nq++;
      if (vid[k]! < 0) vid[k] = nv++;
      if (vid[k + 1]! < 0) vid[k + 1] = nv++;
      if (vid[k + nx + 1]! < 0) vid[k + nx + 1] = nv++;
      if (vid[k + nx + 2]! < 0) vid[k + nx + 2] = nv++;
    }
    const verts = new Float32Array(nv * 3), depth = new Float32Array(nv);
    const idx = nv - 1 >= 65535 ? new Uint32Array(nq * 6) : new Uint16Array(nq * 6);
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const k = j * (nx + 1) + i, v = vid[k]!;
      if (v < 0) continue;
      verts[v * 3] = x0 + i * S; verts[v * 3 + 1] = WL; verts[v * 3 + 2] = z0 + j * S;
      depth[v] = depthAt[k]!;
    }
    let p = 0;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      if (!wet[j * nx + i]) continue;
      const k = j * (nx + 1) + i;
      const a = vid[k]!, b = vid[k + 1]!, c = vid[k + nx + 1]!, d = vid[k + nx + 2]!;
      idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(verts, 3));
    g.setAttribute('depth', new BufferAttribute(depth, 1));
    g.setIndex(new BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    this.material = new ShaderMaterial({
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uRain: { value: 0 },
          uLight: { value: 1 },
          uDetail: { value: 1 },
          uDeep: { value: new Color('#2c3533') },
          uShallow: { value: new Color('#4d4b3c') },
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

  /** High/ultra: lapping waterline and drifting foam lines; low: a still edge. */
  setDetail(high: boolean): void {
    this.material.uniforms.uDetail!.value = high ? 1 : 0;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mist.geometry.dispose();
    this.material.dispose();
    this.mistMaterial.dispose();
  }
}
