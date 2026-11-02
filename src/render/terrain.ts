// Terrain: chunked heightfield mesh (3 vertices per 4 m cell edge, bicubic + noise from
// Heightfield), an outer apron so the valley does not end in a cliff, and a splat shader on
// MeshStandardMaterial that blends meadow / forest floor / tilled field / yard / wet bank,
// draws roads from the distance field (ruts, grass strip, cobbles), and the overlays.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  RGBAFormat,
  UnsignedByteType,
  Vector2,
  type IUniform,
} from 'three';
import type { World } from '../sim/index';
import { net } from '../sim/index';
import { CELL, Heightfield } from './heightfield';
import { noiseTexture } from './noiseTex';
import type { OverlayData } from './overlay';
import { ROAD_MAXD, type RoadField } from './roads';
import { disposeTerrainTextures, placeholderTerrainTextures, type TerrainTextureSet } from './terrainTextures';

const SUB = 3;
const CHUNKS_X = 3, CHUNKS_Z = 2;
export const APRON = 280;

export interface TerrainUniforms {
  [k: string]: IUniform;
}

export class TerrainView {
  readonly group = new Group();
  readonly material: MeshStandardMaterial;
  readonly uniforms: TerrainUniforms;
  readonly groundTex: DataTexture;
  private readonly groundData: Uint8Array;
  private chunks: Mesh[] = [];
  /** Splat arrays currently bound (owned: disposed when replaced or on dispose()). */
  private tex: TerrainTextureSet | null;

  constructor(readonly hf: Heightfield, roads: RoadField, overlay: OverlayData) {
    const { w, h } = hf;
    this.groundData = new Uint8Array(w * h * 4);
    this.groundTex = new DataTexture(this.groundData, w, h, RGBAFormat, UnsignedByteType);
    this.groundTex.magFilter = LinearFilter;
    this.groundTex.minFilter = LinearFilter;
    const tx = placeholderTerrainTextures();
    this.tex = tx;
    this.uniforms = {
      tAlb: { value: tx.albedo },
      tNrm: { value: tx.normal },
      tOrm: { value: tx.orm },
      tGround: { value: this.groundTex },
      tRoad: { value: roads.texture },
      tOver: { value: overlay.texture },
      tNoise: { value: noiseTexture() },
      uMap: { value: new Vector2(hf.sizeX, hf.sizeZ) },
      uRoadTexel: { value: new Vector2(1 / roads.tw, 1 / roads.th) },
      uWL: { value: hf.waterLevel },
      uWet: { value: 0 },
      uTraffic: { value: 0 },
      uTime: { value: 0 },
      uSelRect: { value: overlay.selRect },
      uSelRectOn: overlay.selRectOn,
      uSelRing: { value: overlay.selRing },
      uGhostRect: { value: overlay.ghostRect },
      uGhostGate: { value: overlay.ghostGate },
      uGhostBad: { value: overlay.ghostBad },
      uGhostOn: { value: overlay.ghostOn },
      uPrevDash: overlay.previewDash,
      uOchre: { value: new Color('#b8893a') },
      uClay: { value: new Color('#8c4a2f') },
      uDetail: { value: 1 },
      uSky: { value: new Color('#c9c6bb') },
    };
    this.material = makeTerrainMaterial(this.uniforms);
    this.buildMeshes();
  }

  /** Low quality: no normal/ORM reads, one meadow scale, shared mud sample, no rut relief. */
  setLowQuality(low: boolean): void {
    if (!!this.material.userData.low === low) return;
    this.material.userData.low = low;
    this.material.needsUpdate = true;
  }

  /** Bind a texture set; the terrain takes ownership and disposes the previous arrays. */
  setTextures(t: TerrainTextureSet): void {
    const old = this.tex;
    this.tex = t;
    this.uniforms.tAlb!.value = t.albedo;
    this.uniforms.tNrm!.value = t.normal;
    this.uniforms.tOrm!.value = t.orm;
    if (old && old !== t) disposeTerrainTextures(old);
  }

  /** The bound set, handed over (e.g. to the next TerrainView): dispose() will no longer free it. */
  detachTextures(): TerrainTextureSet | null {
    const t = this.tex;
    this.tex = null;
    return t;
  }

  /** The bound set (placeholder until the real textures arrive). */
  get textures(): TerrainTextureSet | null {
    return this.tex;
  }

  /** Per-cell ground classes; rebuilt when buildings change. */
  updateGround(world: World): void {
    const t = world.terrain;
    const { w, h } = t;
    const occ = net(world).occupied;
    const d = this.groundData;
    // yard: footprint dilated by ~1.5 cells, softened by the linear filter
    const yard = new Float32Array(w * h);
    for (const b of world.state.buildings) {
      const r = b.type === 'castle' ? 2 : 1;
      for (let y = b.y - r; y < b.y + b.h + r; y++) for (let x = b.x - r; x < b.x + b.w + r; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const inside = x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
        yard[y * w + x] = Math.max(yard[y * w + x]!, inside ? 1 : 0.65);
      }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let forest = t.forest[i]!;
      if (occ[i] !== -1) forest = 0;
      d[i * 4] = Math.round(forest * 255);
      d[i * 4 + 1] = t.field[i] ? 255 : 0;
      d[i * 4 + 2] = Math.round(yard[i]! * 255);
      // furrow orientation: along the longer run of contiguous field cells
      let along = 0;
      if (t.field[i]) {
        let rx = 1, rz = 1;
        for (let k = x + 1; k < w && t.field[y * w + k]; k++) rx++;
        for (let k = x - 1; k >= 0 && t.field[y * w + k]; k--) rx++;
        for (let k = y + 1; k < h && t.field[k * w + x]; k++) rz++;
        for (let k = y - 1; k >= 0 && t.field[k * w + x]; k--) rz++;
        along = rz >= rx ? 255 : 0;
      }
      d[i * 4 + 3] = along;
    }
    this.groundTex.needsUpdate = true;
  }

  private buildMeshes(): void {
    const hf = this.hf;
    const cw = Math.ceil(hf.w / CHUNKS_X), ch = Math.ceil(hf.h / CHUNKS_Z);
    for (let jz = 0; jz < CHUNKS_Z; jz++) {
      for (let ix = 0; ix < CHUNKS_X; ix++) {
        const x0 = ix * cw, x1 = Math.min(hf.w, x0 + cw);
        const z0 = jz * ch, z1 = Math.min(hf.h, z0 + ch);
        const g = gridGeometry(hf, x0 * CELL, z0 * CELL, (x1 - x0) * SUB, (z1 - z0) * SUB, CELL / SUB, null);
        const m = new Mesh(g, this.material);
        m.receiveShadow = true;
        m.name = `terrain-${ix}-${jz}`;
        this.chunks.push(m);
        this.group.add(m);
      }
    }
    // apron: coarse ring beyond the map edge (4 pieces so it can be culled)
    const S = 8;
    const A = APRON;
    const pieces: [number, number, number, number][] = [
      [-A, -A, hf.sizeX + 2 * A, A + 8], // north
      [-A, hf.sizeZ - 8, hf.sizeX + 2 * A, A + 8], // south
      [-A, -8, A + 8, hf.sizeZ + 16], // west
      [hf.sizeX - 8, -8, A + 8, hf.sizeZ + 16], // east
    ];
    for (const [x, z, sx, sz] of pieces) {
      const g = gridGeometry(hf, x, z, Math.round(sx / S), Math.round(sz / S), S, apronHeight);
      const m = new Mesh(g, this.material);
      m.receiveShadow = true;
      m.name = 'terrain-apron';
      this.group.add(m);
    }
  }

  dispose(): void {
    for (const c of this.group.children) (c as Mesh).geometry.dispose();
    this.material.dispose();
    this.groundTex.dispose();
    if (this.tex) disposeTerrainTextures(this.tex);
    this.tex = null;
  }
}

/** Height outside the map: clamp to the border and rise into wooded hills. */
export function apronHeight(hf: Heightfield, x: number, z: number): number {
  const cx = Math.min(hf.sizeX, Math.max(0, x)), cz = Math.min(hf.sizeZ, Math.max(0, z));
  const out = Math.hypot(x - cx, z - cz);
  const b = hf.base(cx, cz);
  if (out <= 0) return b - 0.35; // under the real terrain (hides seams)
  // keep the river channel low where it leaves the map
  const riverK = Math.min(1, Math.max(0, (b - hf.waterLevel - 0.2) / 2.5));
  const n = Math.sin(x * 0.013 + Math.cos(z * 0.011) * 2) * 0.5 + Math.sin(z * 0.017 - x * 0.006) * 0.5;
  const rise = out * (0.07 + 0.05 * n) + Math.max(0, out - 60) * 0.12;
  return b - 0.35 + rise * (0.25 + 0.75 * riverK);
}

function gridGeometry(
  hf: Heightfield,
  x0: number,
  z0: number,
  nx: number,
  nz: number,
  step: number,
  heightFn: ((hf: Heightfield, x: number, z: number) => number) | null,
): BufferGeometry {
  const vx = nx + 1, vz = nz + 1;
  const pos = new Float32Array(vx * vz * 3);
  const nor = new Float32Array(vx * vz * 3);
  const hs = new Float32Array(vx * vz);
  const H = heightFn ? (x: number, z: number) => heightFn(hf, x, z) : (x: number, z: number) => hf.height(x, z);
  for (let j = 0; j < vz; j++) for (let i = 0; i < vx; i++) {
    const x = x0 + i * step, z = z0 + j * step;
    const k = j * vx + i;
    const y = H(x, z);
    hs[k] = y;
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
  }
  // normals from central differences (sampling outside the grid for seamless chunk edges)
  const e = step;
  for (let j = 0; j < vz; j++) for (let i = 0; i < vx; i++) {
    const k = j * vx + i;
    const x = x0 + i * step, z = z0 + j * step;
    const hl = i > 0 ? hs[k - 1]! : H(x - e, z);
    const hr = i < nx ? hs[k + 1]! : H(x + e, z);
    const hu = j > 0 ? hs[k - vx]! : H(x, z - e);
    const hd = j < nz ? hs[k + vx]! : H(x, z + e);
    const ax = -(hr - hl), ay = 2 * e, az = -(hd - hu);
    const l = Math.hypot(ax, ay, az);
    nor[k * 3] = ax / l; nor[k * 3 + 1] = ay / l; nor[k * 3 + 2] = az / l;
  }
  const idx = vx * vz > 65535 ? new Uint32Array(nx * nz * 6) : new Uint16Array(nx * nz * 6);
  let p = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * vx + i, b = a + 1, c = a + vx, d = c + 1;
    // alternate the diagonal for a less regular triangulation
    if ((i + j) & 1) { idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d; }
    else { idx[p++] = a; idx[p++] = c; idx[p++] = d; idx[p++] = a; idx[p++] = d; idx[p++] = b; }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nor, 3));
  g.setIndex(new BufferAttribute(idx, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

// ------------------------------------------------------------------------------------------
// Shader
// ------------------------------------------------------------------------------------------

const VERT_DECL = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNrm;
`;

const FRAG_DECL = /* glsl */ `
uniform sampler2DArray tAlb;
uniform sampler2DArray tNrm;
uniform sampler2DArray tOrm;
uniform sampler2D tGround;
uniform sampler2D tRoad;
uniform sampler2D tOver;
uniform sampler2D tNoise;
uniform vec2 uMap;
uniform vec2 uRoadTexel;
uniform float uWL;
uniform float uWet;
uniform float uTraffic;
uniform float uTime;
uniform vec4 uSelRect;
uniform float uSelRectOn;
uniform vec4 uSelRing;
uniform vec4 uGhostRect;
uniform vec4 uGhostGate;
uniform vec4 uGhostBad;
uniform vec2 uGhostOn;
uniform float uPrevDash;
uniform vec3 uOchre;
uniform vec3 uClay;
uniform float uDetail;
varying vec3 vWPos;
varying vec3 vWNrm;

uniform vec3 uSky;

vec2 gDx, gDy;
// Fallback roughness / AO per layer when the ORM map is not read (low quality).
vec2 layerRO(float L) {
  return L < 0.5 ? vec2(0.93, 0.95) : L < 1.5 ? vec2(0.86, 0.9) : L < 2.5 ? vec2(0.95, 0.85) : L < 3.5 ? vec2(0.8, 0.9) : vec2(0.82, 0.85);
}
void sampleLayer(float L, vec2 uv, float k, out vec3 a, out vec3 n, out vec2 ro) {
  vec3 p = vec3(uv * k, L);
  a = textureGrad(tAlb, p, gDx * k, gDy * k).rgb;
#ifdef TERRAIN_LOW
  n = vec3(0.0, 0.0, 1.0);
  ro = layerRO(L);
#else
  n = textureGrad(tNrm, p, gDx * k, gDy * k).xyz * 2.0 - 1.0;
  n.y = -n.y;
  vec3 o = textureGrad(tOrm, p, gDx * k, gDy * k).rgb;
  ro = vec2(o.g, o.r);
#endif
}
#define BLEND(w, a2, n2, ro2) { A = mix(A, a2, w); N = mix(N, n2, w); RO = mix(RO, ro2, w); }
float rutProfile(float d) {
  // wheel ruts at ±0.86 m (wagon track 1.72 m)
  float r1 = exp(-pow((d - 0.86) / 0.2, 2.0));
  return -r1;
}
`;

const FRAG_MAIN = /* glsl */ `
  vec3 Ng = normalize(vWNrm);
  vec2 wxz = vWPos.xz;
  vec2 uv = wxz / 3.2;
  gDx = dFdx(uv); gDy = dFdy(uv);
  // metres per pixel: drives level of detail of ruts, furrows and edge noise
  float fw = length(vec2(fwidth(wxz.x), fwidth(wxz.y))) * 0.7071;
  vec2 cuv = wxz / uMap;
  vec4 gnd = texture(tGround, cuv);
  vec4 nzM = texture(tNoise, wxz / 61.0);
  vec4 nzS = texture(tNoise, wxz / 9.7 + 0.31);
  vec4 nzL = texture(tNoise, wxz / 197.0 + 0.13);
  vec4 rd = texture(tRoad, cuv);
  vec4 ov = texture(tOver, cuv);
  float hW = vWPos.y - uWL;
  bool outside = cuv.x < 0.0 || cuv.y < 0.0 || cuv.x > 1.0 || cuv.y > 1.0;
  if (outside) { rd = vec4(1.0); ov = vec4(0.0); }

  vec3 A; vec3 N; vec2 RO;
  vec3 a2; vec3 n2; vec2 ro2;
  // base: wet meadow
  sampleLayer(0.0, uv, 1.0, A, N, RO);
#ifndef TERRAIN_LOW
  // second scale to break tiling
  sampleLayer(0.0, uv, 0.29, a2, n2, ro2);
  A = mix(A, a2, 0.35);
#endif
  A *= vec3(0.94, 1.04, 1.0);
  // macro tone variation (kept in the desaturated middle)
  A *= 0.86 + 0.26 * nzM.r;
  // slight colour noise: some tufts warmer, some cooler
  A *= vec3(1.0 + (nzS.r - 0.5) * 0.12, 1.0, 1.0 + (nzS.g - 0.5) * 0.1);
  vec4 nzP = texture(tNoise, wxz / 23.0 + 0.71);
  float nearW = 1.0 - smoothstep(0.4, 2.2, hW);
  // large patches of dark, wet grass (more of them in the river meadows)
  float wetP = smoothstep(0.52, 0.78, nzL.r + nearW * 0.22 + (nzP.b - 0.5) * 0.25);
  A = mix(A, A * vec3(0.62, 0.74, 0.68), wetP * 0.75);
  // dry, yellowed tussock grass in large drifts, mottled at tussock scale
  float dryP = smoothstep(0.48, 0.72, nzL.g + (nzP.r - 0.5) * 0.3) * (1.0 - nearW * 0.7);
  float tus = smoothstep(0.35, 0.75, nzS.b);
  A = mix(A, A * vec3(1.42, 1.18, 0.7), dryP * (0.4 + 0.5 * tus));
  // small-scale tussock mottling everywhere
  A *= 0.9 + 0.2 * smoothstep(0.3, 0.8, nzS.b);
  // stubble / trampled verge around ploughed fields
  float halo = smoothstep(0.03, 0.45, gnd.g) * (1.0 - smoothstep(0.45, 0.7, gnd.g));
  A = mix(A, A * vec3(1.12, 0.98, 0.72) * (0.85 + 0.25 * nzS.a), halo * 0.6);
  // grass grades darker and ranker toward the river (sedge fringe)
  A = mix(A, A * vec3(0.78, 0.86, 0.78), nearW * 0.6);

  float slope = 1.0 - Ng.y;
  float wForest = smoothstep(0.1, 0.5, gnd.r + (nzS.r - 0.5) * 0.35);
  float wSteep = smoothstep(0.18, 0.42, slope + (nzS.g - 0.5) * 0.1);
  wForest = max(wForest, wSteep * 0.75);
  if (outside) wForest = max(wForest, cuv.y < 0.12 ? 0.85 : smoothstep(0.5, 0.75, nzM.b) * 0.7);
  if (wForest > 0.003) {
#ifdef TERRAIN_LOW
    a2 = vec3(0.07, 0.055, 0.035) * (0.8 + 0.4 * nzS.b); n2 = vec3(0.0, 0.0, 1.0); ro2 = vec2(0.95, 0.85);
#else
    sampleLayer(2.0, uv, 0.8, a2, n2, ro2);
    a2 *= 0.85 + 0.3 * nzS.b;
#endif
    BLEND(wForest, a2, n2, ro2);
  }
  // mud albedo shared by fields, yards and tracks in low quality
#ifdef TERRAIN_LOW
  vec3 mudA; vec3 mudN; vec2 mudRO;
  sampleLayer(1.0, uv, 1.0, mudA, mudN, mudRO);
#define MUD(k) { a2 = mudA; n2 = mudN; ro2 = mudRO; }
#else
#define MUD(k) sampleLayer(1.0, uv, k, a2, n2, ro2);
#endif
  float wField = smoothstep(0.35, 0.7, gnd.g);
  if (wField > 0.003) {
    // ploughed soil with furrows (0.8 m pitch), a little straw stubble left on the ridges
    MUD(1.3)
    float fc = (gnd.a > 0.5 ? wxz.x : wxz.y) + (nzS.r - 0.5) * 0.6;
    float ph = fc * 6.2831853 / 0.8;
    float fade = 1.0 - smoothstep(0.25, 0.6, fwidth(fc) / 0.8);
    float ridge = mix(0.6, 0.5 + 0.5 * sin(ph), fade);
    a2 *= mix(0.62, 1.0, ridge);
    a2 = mix(a2, vec3(0.32, 0.25, 0.15), smoothstep(0.75, 1.0, ridge) * smoothstep(0.4, 0.8, nzS.a) * 0.6);
    float dh = cos(ph) * 0.55 * fade;
    vec3 fn = gnd.a > 0.5 ? vec3(-dh, 0.0, 1.0) : vec3(0.0, dh, 1.0);
    n2 = normalize(n2 + fn - vec3(0.0, 0.0, 1.0));
    BLEND(wField, a2, n2, ro2);
  }
  float wYard = smoothstep(0.3, 0.75, gnd.b + (nzS.g - 0.5) * 0.45);
  if (wYard > 0.003) {
    MUD(0.9)
    a2 *= 0.95;
    BLEND(wYard * 0.85, a2, n2, ro2);
  }
  // river bank: irregular mud / gravel band, darker and glossy where wet
  float bn = (nzS.b - 0.5) * 0.45 + (nzM.g - 0.5) * 0.5;
  float wBank = 1.0 - smoothstep(0.1, 0.7, hW + bn);
  if (wBank > 0.003) {
    sampleLayer(3.0, uv, 1.1, a2, n2, ro2);
    // gravel bars and pebble spits in patches
    float grav = smoothstep(0.56, 0.7, nzM.a + (nzS.r - 0.5) * 0.35) * (1.0 - smoothstep(0.25, 0.6, hW));
#ifndef TERRAIN_LOW
    if (grav > 0.01) {
      vec3 a3; vec3 n3; vec2 ro3;
      sampleLayer(4.0, uv, 3.4, a3, n3, ro3);
      a2 = mix(a2, a3 * vec3(0.8, 0.78, 0.74), grav * 0.85);
      n2 = mix(n2, n3, grav * 0.85);
    }
#else
    a2 = mix(a2, a2 * 1.25, grav * 0.6);
#endif
    float wetB = 1.0 - smoothstep(-0.05, 0.26 + (nzS.g - 0.5) * 0.25, hW);
    a2 *= mix(0.62, 0.38, wetB) * vec3(0.95, 0.97, 1.0);
    ro2.x = mix(ro2.x, 0.2, wetB);
    BLEND(wBank, a2, n2, ro2);
  }

  // --- roads -------------------------------------------------------------------------
  float dD = rd.r * ${ROAD_MAXD.toFixed(1)};
  float dC = rd.g * ${ROAD_MAXD.toFixed(1)};
  // trodden mud patch where roads meet
  float jn = 1.0 - smoothstep(1.2, 3.6, rd.b * ${ROAD_MAXD.toFixed(1)});
  // ruts only when they resolve on screen; further out one worn track
  float rutK = (1.0 - smoothstep(0.045, 0.12, fw)) * (1.0 - jn);
#ifdef TERRAIN_LOW
  float eN = (nzS.a - 0.5) * 0.8;
#else
  float eN = (nzS.a - 0.5) * 0.7 + (texture(tNoise, wxz / 2.7 + 0.47).b - 0.5) * 0.45 * (1.0 - smoothstep(0.05, 0.2, fw));
#endif
  // 0 close up .. 1 at mid/far zoom (metres per pixel): the road turns into one worn, darker
  // mud track with a lighter trampled verge, so it stays the most legible line in the frame
  float farK = smoothstep(0.07, 0.4, fw);
  eN *= 1.0 - 0.6 * farK;
  // width varies along the road; a bit wider where it is worn at junctions
  float halfW = 1.85 + (nzM.a - 0.5) * 0.9 * (1.0 - 0.5 * farK) + jn * 1.1;
  // at far zoom keep roads a few pixels wide (they are the drawing); the field holds 6 m
  float grow = min(farK * (0.35 + fw * 0.9), 1.9);
  float wDirt = 1.0 - smoothstep(halfW - 0.35 + eN + grow, halfW + 0.45 + eN + grow + fw * 0.6, dD);
  float wCob = 1.0 - smoothstep(1.95 + eN * 0.3 + grow, 2.25 + eN * 0.3 + grow + fw * 0.6, dC);
  float roadCover = max(wDirt, wCob);
  // trampled verge just outside the track: browned close up, a pale dry-grass rim from afar
  float vergeW = mix(1.4, max(1.4, fw * 2.2), farK);
  float verge = (1.0 - smoothstep(halfW + 0.2 + grow, halfW + 0.2 + grow + vergeW, max(dD, 0.0))) * (1.0 - wDirt);
  verge = max(verge, (1.0 - smoothstep(2.1 + grow, 2.1 + grow + vergeW, dC)) * (1.0 - wCob) * farK);
  vec3 vergeTint = mix(vec3(0.92, 0.86, 0.76), vec3(1.3, 1.22, 0.98), farK);
  A = mix(A, A * vergeTint, verge * mix(0.6, 0.75, farK));
  vec3 bumpW = vec3(0.0);
  if (wDirt > 0.003 && hW > -0.2) {
    MUD(1.0)
    float rut = -rutProfile(dD) * rutK;
    // worn centre/hoof line and wheel lanes merge into one track when far
    float wear = 1.0 - smoothstep(0.4, 1.6, dD);
    a2 *= mix(0.92, 0.84, wear * (1.0 - rutK));
    // from afar: one dark, wet-looking worn track (Błoto), darkest along the wheel lanes
    a2 *= mix(vec3(1.0), vec3(0.62, 0.57, 0.51) - 0.08 * wear, farK);
    a2 *= (0.88 + 0.24 * nzP.g) - 0.24 * rut;
    ro2.x = mix(ro2.x, 0.55, rut * 0.5);
    // grass strip between the ruts, only close up and patchy
    float strip = (1.0 - smoothstep(0.2, 0.45, dD)) * smoothstep(0.35, 0.75, nzS.r + 0.15) * rutK;
    a2 = mix(a2, A * 0.85, strip * 0.5);
    // standing water: a few patches always (wet November), many in rain, mostly in the ruts
    float pz = nzP.g * 0.6 + nzS.g * 0.4;
    float puddle = smoothstep(0.66, 0.74, pz + uWet * 0.22 + rut * 0.18 * uWet) * (1.0 - smoothstep(1.1, 1.7, dD));
    puddle = max(puddle, uWet * smoothstep(0.35, 0.8, rut + (nzS.g - 0.5) * 0.9));
    a2 *= 1.0 - 0.28 * uWet;
    ro2.x = mix(ro2.x, 0.42, uWet * 0.7);
    a2 = mix(a2, a2 * 0.4 + uSky * 0.06, puddle);
    ro2.x = mix(ro2.x, 0.06, puddle);
    n2 = mix(n2, vec3(0.0, 0.0, 1.0), puddle);
    BLEND(wDirt, a2, n2, ro2);
#ifndef TERRAIN_LOW
    if (rutK > 0.01) {
      // rut relief: gradient of the profile along the distance-field gradient
      float dx = texture(tRoad, cuv + vec2(uRoadTexel.x, 0.0)).r * ${ROAD_MAXD.toFixed(1)} - dD;
      float dz = texture(tRoad, cuv + vec2(0.0, uRoadTexel.y)).r * ${ROAD_MAXD.toFixed(1)} - dD;
      vec2 gd = vec2(dx, dz) * 2.0; // texel = 0.5 m
      float dp = (rutProfile(dD + 0.08) - rutProfile(dD - 0.08)) / 0.16;
      bumpW = vec3(gd.x, 0.0, gd.y) * dp * 0.12 * wDirt * (1.0 - puddle) * rutK;
    }
#endif
  }
  if (wCob > 0.003 && hW > -0.2) {
    sampleLayer(4.0, uv, 1.6, a2, n2, ro2);
    // cobbles read lighter than the meadow, more so from afar
    a2 *= mix(1.05, 1.3, farK) * (1.0 - 0.2 * uWet);
    ro2.x = mix(ro2.x, 0.35, uWet * 0.8);
    BLEND(wCob, a2, n2, ro2);
  }
  // everything gets a little darker and glossier in rain
  A *= 1.0 - 0.12 * uWet;
  RO.x = mix(RO.x, RO.x * 0.75, uWet);

  // --- overlays ----------------------------------------------------------------------
  vec3 ovCol = vec3(0.0);
  float ovA = 0.0;
  if (uTraffic > 0.5) {
    float tr = ov.r;
    float k = roadCover * smoothstep(0.04, 0.2, tr);
    ovCol = mix(uOchre, uClay, smoothstep(0.35, 0.95, tr));
    ovA = k * 0.62;
  }
  float pv = smoothstep(0.32, 0.55, ov.g);
  float pb = smoothstep(0.32, 0.55, ov.b);
  if (uPrevDash > 0.5) {
    // proposed road: diagonal hatching, like a road pencilled onto a survey map
    float hatch = smoothstep(0.35, 0.5, abs(fract((wxz.x + wxz.y) * 0.32) - 0.5) * 2.0);
    pv *= 0.25 + 0.75 * hatch;
    pb *= 0.25 + 0.75 * hatch;
  }
  if (pv > 0.0) { ovCol = mix(ovCol, uOchre, pv); ovA = max(ovA, pv * 0.65); }
  if (pb > 0.0) { ovCol = mix(ovCol, uClay, pb); ovA = max(ovA, pb * 0.6); }
  float bad = smoothstep(0.3, 0.6, ov.a);
  if (bad > 0.0) {
    float pulse = 0.65 + 0.35 * sin(uTime * 6.0);
    ovCol = mix(ovCol, uClay * 0.8, bad); ovA = max(ovA, bad * pulse);
  }
  if (uSelRectOn > 0.5) {
    vec2 c = (uSelRect.xy + uSelRect.zw) * 0.5, hs = (uSelRect.zw - uSelRect.xy) * 0.5;
    vec2 q = abs(wxz - c) - hs;
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    float line = 1.0 - smoothstep(0.1, 0.28, abs(sd - 0.6));
    ovCol = mix(ovCol, uClay, line); ovA = max(ovA, line * 0.8);
  }
  if (uSelRing.w > 0.5) {
    float sd = length(wxz - uSelRing.xy) - uSelRing.z;
    float line = 1.0 - smoothstep(0.06, 0.2, abs(sd));
    float fill = (1.0 - smoothstep(-0.2, 0.0, sd)) * 0.12;
    ovCol = mix(ovCol, uClay, max(line, fill)); ovA = max(ovA, max(line * 0.75, fill));
  }
  if (uGhostOn.x > 0.5) {
    vec3 gc = uGhostOn.y > 0.5 ? uOchre : uClay;
    // footprint: a firm line just inside the edge and a faint wash
    vec2 c = (uGhostRect.xy + uGhostRect.zw) * 0.5, hs = (uGhostRect.zw - uGhostRect.xy) * 0.5;
    vec2 q = abs(wxz - c) - hs;
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    float line = 1.0 - smoothstep(0.1, 0.26, abs(sd + 0.32));
    float wash = (1.0 - smoothstep(-0.05, 0.05, sd)) * 0.2;
    ovCol = mix(ovCol, gc, max(line, wash)); ovA = max(ovA, max(line * 0.9, wash));
    // gate: a wedge pointing out of the building, inside the gate cell
    vec2 gp = wxz - uGhostGate.xy;
    float al = dot(gp, uGhostGate.zw), ac = abs(dot(gp, vec2(-uGhostGate.w, uGhostGate.z)));
    float tri = max(max(-al - 1.3, al - 1.1), ac - (1.1 - al) * 0.62);
    float wedge = 1.0 - smoothstep(-0.06, 0.06, tri);
    vec2 gq = abs(gp) - vec2(1.75);
    float gbox = 1.0 - smoothstep(0.06, 0.2, abs(max(gq.x, gq.y)));
    ovCol = mix(ovCol, gc, max(wedge, gbox)); ovA = max(ovA, max(wedge * 0.92, gbox * 0.7));
    // offending cell: pulsing clay fill crossed out
    if (uGhostBad.w > 0.5) {
      vec2 bp = wxz - uGhostBad.xy;
      vec2 bq = abs(bp) - vec2(uGhostBad.z);
      float inside = 1.0 - smoothstep(-0.05, 0.05, max(bq.x, bq.y));
      float xmark = 1.0 - smoothstep(0.12, 0.26, min(abs(bp.x - bp.y), abs(bp.x + bp.y)) * 0.7071);
      float pulse = 0.55 + 0.25 * sin(uTime * 6.0);
      ovCol = mix(ovCol, uClay * mix(1.0, 0.55, xmark), inside);
      ovA = max(ovA, inside * max(pulse, xmark * 0.95));
    }
  }
  A = mix(A, ovCol, ovA * 0.85);

  diffuseColor.rgb = A * mix(1.0, RO.y, 0.5);
  float tRough = clamp(RO.x, 0.04, 1.0);
  vec3 Ttn = normalize(vec3(1.0, 0.0, 0.0) - Ng * Ng.x);
  vec3 Btn = cross(Ttn, Ng);
  vec3 Nw = normalize(Ttn * N.x * uDetail + Btn * N.y * uDetail + Ng * max(N.z, 0.2) - bumpW);
  vec3 tEmis = ovCol * ovA * 0.07;
`;

function makeTerrainMaterial(uniforms: TerrainUniforms): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  m.name = 'terrain';
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n vWNrm = normalize(mat3(modelMatrix) * objectNormal);',
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + (m.userData.low ? '#define TERRAIN_LOW\n' : '') + FRAG_DECL)
      .replace('#include <map_fragment>', FRAG_MAIN)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = tRough;')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(Nw, 0.0)).xyz);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += tEmis;');
  };
  m.customProgramCacheKey = () => 'marchia-terrain-3' + (m.userData.low ? '-low' : '');
  return m;
}
