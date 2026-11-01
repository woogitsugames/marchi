// Sun / moon, hemisphere sky light, fog and the sky dome, driven by the sim's time of day and
// rain. Palette-matched keyframes (no saturated blue): low warm sun in the morning, flat grey
// in rain, cool readable night.
import {
  BackSide,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Mesh,
  type Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

interface Key {
  f: number;
  sun: string;
  sunI: number;
  hemiSky: string;
  hemiGround: string;
  hemiI: number;
  skyH: string;
  skyZ: string;
  fog: string;
  exposure: number;
  mist: number;
}

const KEYS: Key[] = [
  { f: 0.0, sun: '#8a98ad', sunI: 1.0, hemiSky: '#5d6874', hemiGround: '#24201b', hemiI: 1.6, skyH: '#3b4249', skyZ: '#20262d', fog: '#363c42', exposure: 1.55, mist: 0.35 },
  { f: 0.205, sun: '#8a98ad', sunI: 0.9, hemiSky: '#5d6874', hemiGround: '#24201b', hemiI: 1.6, skyH: '#3b4249', skyZ: '#20262d', fog: '#363c42', exposure: 1.55, mist: 0.5 },
  { f: 0.245, sun: '#d08a62', sunI: 0.5, hemiSky: '#8f8e8c', hemiGround: '#2e2822', hemiI: 1.2, skyH: '#b49c88', skyZ: '#5e666e', fog: '#8d8479', exposure: 1.2, mist: 0.9 },
  { f: 0.27, sun: '#ffb47e', sunI: 2.3, hemiSky: '#b4b2ab', hemiGround: '#40372d', hemiI: 1.35, skyH: '#d9c6ad', skyZ: '#8f989c', fog: '#c2b8a8', exposure: 1.08, mist: 1.0 },
  { f: 0.34, sun: '#ffd2a6', sunI: 3.1, hemiSky: '#c4c6c4', hemiGround: '#4a3f33', hemiI: 1.5, skyH: '#cdc9bd', skyZ: '#9aa3a6', fog: '#c9c6bb', exposure: 1.02, mist: 0.3 },
  { f: 0.45, sun: '#ffdcb8', sunI: 3.3, hemiSky: '#c6c8c6', hemiGround: '#4a3f33', hemiI: 1.55, skyH: '#cbc8bd', skyZ: '#9ea6a8', fog: '#c9c6bb', exposure: 1.0, mist: 0.04 },
  { f: 0.66, sun: '#ffd2a6', sunI: 3.0, hemiSky: '#c2c3c0', hemiGround: '#4a3f33', hemiI: 1.5, skyH: '#ccc5b6', skyZ: '#979fa2', fog: '#c6c1b4', exposure: 1.02, mist: 0.02 },
  { f: 0.73, sun: '#ff9f6a', sunI: 2.1, hemiSky: '#a8a2a0', hemiGround: '#3c3229', hemiI: 1.0, skyH: '#cfa98a', skyZ: '#6e767e', fog: '#a99d8f', exposure: 1.1, mist: 0.15 },
  { f: 0.765, sun: '#9a7a78', sunI: 0.45, hemiSky: '#6a6c72', hemiGround: '#262119', hemiI: 1.2, skyH: '#6d6466', skyZ: '#2c333b', fog: '#4f4f52', exposure: 1.25, mist: 0.25 },
  { f: 0.8, sun: '#8a98ad', sunI: 1.0, hemiSky: '#5d6874', hemiGround: '#24201b', hemiI: 1.6, skyH: '#3b4249', skyZ: '#20262d', fog: '#363c42', exposure: 1.55, mist: 0.3 },
  { f: 1.0, sun: '#8a98ad', sunI: 1.0, hemiSky: '#5d6874', hemiGround: '#24201b', hemiI: 1.6, skyH: '#3b4249', skyZ: '#20262d', fog: '#363c42', exposure: 1.55, mist: 0.35 },
];

const RAIN_SKY_H = new Color('#a9aaa6');
const RAIN_SKY_Z = new Color('#878b8b');
const RAIN_FOG = new Color('#9fa09b');

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAG = /* glsl */ `
uniform vec3 uH;
uniform vec3 uZ;
uniform vec3 uFog;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform float uSunGlow;
varying vec3 vDir;
#include <common>
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 c = mix(uH, uZ, smoothstep(0.0, 0.55, y));
  c = mix(c, uFog, 1.0 - smoothstep(-0.02, 0.12, y));
  float s = max(dot(d, uSunDir), 0.0);
  c += uSunCol * (pow(s, 8.0) * 0.18 + pow(s, 64.0) * 0.35) * uSunGlow;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const tmpA = new Color(), tmpB = new Color();
const _right = new Vector3(), _up = new Vector3(), _snap = new Vector3();
function lerpKey(f: number, pick: (k: Key) => string, out: Color): Color {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1]!.f <= f) i++;
  const a = KEYS[i]!, b = KEYS[i + 1]!;
  const t = Math.min(1, Math.max(0, (f - a.f) / (b.f - a.f)));
  tmpA.set(pick(a));
  tmpB.set(pick(b));
  return out.copy(tmpA).lerp(tmpB, t);
}
function lerpNum(f: number, pick: (k: Key) => number): number {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1]!.f <= f) i++;
  const a = KEYS[i]!, b = KEYS[i + 1]!;
  const t = Math.min(1, Math.max(0, (f - a.f) / (b.f - a.f)));
  return pick(a) + (pick(b) - pick(a)) * t;
}

export interface EnvState {
  sunDir: Vector3;
  sunColor: Color;
  skyH: Color;
  skyZ: Color;
  fogColor: Color;
  /** Overall light level 0..1 (for unlit shaders: water, mist). */
  light: number;
  mist: number;
  exposure: number;
  rain: number;
  isNight: boolean;
}

export class Lighting {
  readonly hemi: HemisphereLight;
  readonly sun: DirectionalLight;
  readonly fog: FogExp2;
  readonly sky: Mesh;
  private readonly skyMat: ShaderMaterial;
  readonly env: EnvState = {
    sunDir: new Vector3(0, 1, 0),
    sunColor: new Color(),
    skyH: new Color(),
    skyZ: new Color(),
    fogColor: new Color(),
    light: 1,
    mist: 0,
    exposure: 1,
    rain: 0,
    isNight: false,
  };
  private shadowSize = 2048;

  constructor(scene: Scene) {
    this.hemi = new HemisphereLight('#c4c6c4', '#4a3f33', 1.2);
    scene.add(this.hemi);
    this.sun = new DirectionalLight('#ffd6ad', 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.shadowSize, this.shadowSize);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 3;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.fog = new FogExp2('#c9c6bb', 0.004);
    scene.fog = this.fog;
    this.skyMat = new ShaderMaterial({
      uniforms: {
        uH: { value: new Color() },
        uZ: { value: new Color() },
        uFog: { value: new Color() },
        uSunDir: { value: new Vector3() },
        uSunCol: { value: new Color() },
        uSunGlow: { value: 1 },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new Mesh(new SphereGeometry(1800, 32, 16), this.skyMat);
    this.sky.name = 'sky';
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);
  }

  setShadowMapSize(size: number, enabled: boolean): void {
    this.sun.castShadow = enabled;
    if (size === this.shadowSize) return;
    this.shadowSize = size;
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
  }

  /** f = time of day 0..1, rain 0..1 (smoothed by the caller). */
  update(f: number, rain: number): void {
    const e = this.env;
    e.rain = rain;
    const p = (f - 0.25) / 0.5;
    const day = p > -0.02 && p < 1.02;
    e.isNight = !day;
    if (day) {
      const q = Math.min(1, Math.max(0, p));
      const az = Math.PI * q;
      const elev = ((7 + 15 * Math.sin(Math.PI * q)) * Math.PI) / 180;
      e.sunDir.set(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev) * 0.85 + 0.15).normalize();
    } else {
      e.sunDir.set(-0.35, 0.62, 0.45).normalize(); // moon
    }
    lerpKey(f, (k) => k.sun, e.sunColor);
    let sunI = lerpNum(f, (k) => k.sunI);
    const hemiI = lerpNum(f, (k) => k.hemiI);
    lerpKey(f, (k) => k.skyH, e.skyH);
    lerpKey(f, (k) => k.skyZ, e.skyZ);
    lerpKey(f, (k) => k.fog, e.fogColor);
    e.exposure = lerpNum(f, (k) => k.exposure);
    e.mist = lerpNum(f, (k) => k.mist) * (1 - rain * 0.4);
    // rain: flat grey sky, weak diffuse sun
    const dayK = day ? 1 : 0.35;
    e.skyH.lerp(tmpA.copy(RAIN_SKY_H).multiplyScalar(day ? 1 : 0.35), rain * 0.85);
    e.skyZ.lerp(tmpA.copy(RAIN_SKY_Z).multiplyScalar(day ? 1 : 0.35), rain * 0.85);
    e.fogColor.lerp(tmpA.copy(RAIN_FOG).multiplyScalar(dayK), rain * 0.7);
    sunI *= 1 - 0.7 * rain;
    this.sun.color.copy(e.sunColor);
    this.sun.intensity = sunI;
    lerpKey(f, (k) => k.hemiSky, this.hemi.color);
    lerpKey(f, (k) => k.hemiGround, this.hemi.groundColor);
    this.hemi.color.lerp(tmpA.set('#b8bab6').multiplyScalar(dayK), rain * 0.5);
    this.hemi.intensity = hemiI * (1 + 0.1 * rain);
    e.light = Math.min(1, (hemiI * 0.6 + sunI * 0.15) / 1.2);
    this.fog.color.copy(e.fogColor);
    const u = this.skyMat.uniforms;
    (u.uH!.value as Color).copy(e.skyH);
    (u.uZ!.value as Color).copy(e.skyZ);
    (u.uFog!.value as Color).copy(e.fogColor);
    (u.uSunDir!.value as Vector3).copy(e.sunDir);
    (u.uSunCol!.value as Color).copy(e.sunColor);
    u.uSunGlow!.value = (day ? 1 : 0.2) * (1 - rain * 0.9);
  }

  /**
   * Fit the shadow camera to a square of half-size `radius` around `target`, snapped to
   * shadow texels to avoid shimmering while panning.
   */
  fitShadow(target: Vector3, radius: number): void {
    const s = this.sun;
    const cam = s.shadow.camera;
    const r = Math.max(12, radius);
    const texel = (2 * r) / this.shadowSize;
    // snap target in light space
    const dir = this.env.sunDir;
    const right = _right.set(0, 1, 0).cross(dir).normalize();
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    const up = _up.crossVectors(dir, right).normalize();
    const tx = Math.round(target.dot(right) / texel) * texel;
    const ty = Math.round(target.dot(up) / texel) * texel;
    const tz = target.dot(dir);
    const snapped = _snap.set(0, 0, 0).addScaledVector(right, tx).addScaledVector(up, ty).addScaledVector(dir, tz);
    s.target.position.copy(snapped);
    s.position.copy(snapped).addScaledVector(dir, 300);
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
    cam.near = 150; cam.far = 300 + r * 1.2 + 80;
    cam.updateProjectionMatrix();
    s.target.updateMatrixWorld();
  }

  followCamera(pos: Vector3): void {
    this.sky.position.copy(pos);
  }

  dispose(): void {
    this.sky.geometry.dispose();
    this.skyMat.dispose();
    this.sun.shadow.map?.dispose();
  }
}
