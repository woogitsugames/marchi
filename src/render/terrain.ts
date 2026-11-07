// Terrain: chunked heightfield mesh (3 vertices per 4 m cell edge, bicubic + noise from
// Heightfield), an outer apron so the valley does not end in a cliff, and a splat shader on
// MeshStandardMaterial that blends meadow / forest floor / tilled field / yard / wet bank,
// draws roads from the distance field (ruts, grass strip, cobbles), and the overlays.
import {
  Box3,
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
  type Frustum,
  type IUniform,
} from 'three';
import type { World } from '../sim/index';
import { net } from '../sim/index';
import { groundMemo } from './groundCache';
import type { Heightfield } from './heightfield';
import { noiseTexture } from './noiseTex';
import type { OverlayData } from './overlay';
import { ROAD_MAXD, type RoadField } from './roads';
import { CHUNKS_X, CHUNKS_Z, pieceBox, TERRAIN_PIECES, terrainGrid, type GridData } from './terrainGrid';
import { disposeTerrainTextures, placeholderTerrainTextures, type TerrainTextureSet } from './terrainTextures';

export { APRON, apronHeight } from './terrainGrid';


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
  /** Indices of the pieces whose geometry is not built yet (D-296), and a box that holds each. */
  private pending: { k: number; box: Box3 }[] = [];
  private meshes: Mesh[] = [];
  private grids: (GridData | undefined)[] = [];
  /** Splat arrays currently bound (owned: disposed when replaced or on dispose()). */
  private tex: TerrainTextureSet | null;

  /**
   * `defer`: build no grid yet (D-296); the view builds the pieces in the camera's frustum before the first frame
   * (`buildInView`) and the rest after it (`buildRest`). The meshes exist from the start, hidden, in the same order.
   */
  constructor(readonly hf: Heightfield, roads: RoadField, overlay: OverlayData, defer = false) {
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
      tSite: { value: overlay.siteTexture },
      uSiteOn: overlay.siteOn,
      tNoise: { value: noiseTexture() },
      uMap: { value: new Vector2(hf.sizeX, hf.sizeZ) },
      uRoadTexel: { value: new Vector2(1 / roads.tw, 1 / roads.th) },
      uWL: { value: hf.waterLevel },
      uWet: { value: 0 },
      uWinter: { value: 0 },
      uTraffic: { value: 0 },
      uTime: { value: 0 },
      // 1 = the bad-draft overlay pulses, 0 = steady (prefers-reduced-motion, D-124)
      uMotion: { value: 1 },
      uSelRect: { value: overlay.selRect },
      uSelRectOn: overlay.selRectOn,
      uSelRing: { value: overlay.selRing },
      uGhostRect: { value: overlay.ghostRect },
      uGhostGate: { value: overlay.ghostGate },
      uGhostBad: { value: overlay.ghostBad },
      uGhostOn: { value: overlay.ghostOn },
      uPrevDash: overlay.previewDash,
      uPrevPave: overlay.previewPave,
      uOchre: { value: new Color('#b8893a') },
      uClay: { value: new Color('#8c4a2f') },
      uDetail: { value: 1 },
      uSky: { value: new Color('#c9c6bb') },
    };
    this.material = makeTerrainMaterial(this.uniforms);
    this.buildMeshes(defer);
  }

  /** Low quality: no normal/ORM reads, one meadow scale, shared mud sample, no rut relief. */
  setLowQuality(low: boolean): void {
    if (!!this.material.userData.low === low) return;
    this.material.userData.low = low;
    this.material.needsUpdate = true;
  }

  /**
   * A detached copy of the terrain material as `setLowQuality(low)` would leave it, or null when
   * nothing would change: lets the renderer compile that program before the switch (prewarm.ts).
   */
  qualityVariant(low: boolean): [MeshStandardMaterial, MeshStandardMaterial] | null {
    const m = this.material;
    if (!!m.userData.low === low) return null;
    const c = m.clone();
    c.onBeforeCompile = m.onBeforeCompile;
    c.customProgramCacheKey = m.customProgramCacheKey;
    c.userData.low = low;
    return [m, c];
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
      const r = b.type === 'castle' || b.type === 'tradePost' ? 2 : 1;
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

  private buildMeshes(defer: boolean): void {
    const hf = this.hf;
    // the grids are a function of the ground alone: a world on the same ground reuses them (D-282), each one built
    // on first use (D-296)
    this.grids = groundMemo('terrain-grids', hf.t, () => new Array<GridData | undefined>(TERRAIN_PIECES));
    for (let k = 0; k < TERRAIN_PIECES; k++) {
      const m = new Mesh(new BufferGeometry(), this.material);
      m.receiveShadow = true;
      if (k < CHUNKS_X * CHUNKS_Z) {
        m.name = `terrain-${k % CHUNKS_X}-${Math.floor(k / CHUNKS_X)}`;
        this.chunks.push(m);
      } else m.name = 'terrain-apron';
      this.meshes.push(m);
      this.group.add(m);
      if (defer && !this.grids[k]) {
        m.visible = false;
        this.pending.push({ k, box: pieceBox(hf, k) });
      } else this.fill(k);
    }
  }

  /** Give mesh `k` its grid (the geometry object it was created with, so draw order and ids stay as before). */
  private fill(k: number): void {
    const d = (this.grids[k] ??= terrainGrid(this.hf, k));
    const g = this.meshes[k]!.geometry;
    g.setAttribute('position', new BufferAttribute(d.pos, 3));
    g.setAttribute('normal', new BufferAttribute(d.nor, 3));
    g.setIndex(new BufferAttribute(d.idx, 1));
    g.boundingBox = d.box.clone();
    g.boundingSphere = d.sphere.clone();
    this.meshes[k]!.visible = true;
  }

  /** Pieces not built yet (D-296). */
  get pendingPieces(): number {
    return this.pending.length;
  }

  /** Build the pending pieces that may show inside `frustum` (a conservative box test); returns how many. */
  buildInView(frustum: Frustum): number {
    let n = 0;
    this.pending = this.pending.filter((p) => {
      if (!frustum.intersectsBox(p.box)) return true;
      this.fill(p.k);
      n++;
      return false;
    });
    return n;
  }

  /** Build every pending piece. */
  buildRest(): void {
    for (const p of this.pending) this.fill(p.k);
    this.pending = [];
  }

  dispose(): void {
    for (const c of this.group.children) (c as Mesh).geometry.dispose();
    this.material.dispose();
    this.groundTex.dispose();
    if (this.tex) disposeTerrainTextures(this.tex);
    this.tex = null;
  }
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
uniform sampler2D tSite;
uniform float uSiteOn;
uniform sampler2D tNoise;
uniform vec2 uMap;
uniform vec2 uRoadTexel;
uniform float uWL;
uniform float uWet;
uniform float uWinter;
uniform float uTraffic;
uniform float uTime;
uniform float uMotion;
uniform vec4 uSelRect;
uniform float uSelRectOn;
uniform vec4 uSelRing;
uniform vec4 uGhostRect;
uniform vec4 uGhostGate;
uniform vec4 uGhostBad;
uniform vec2 uGhostOn;
uniform float uPrevDash;
uniform float uPrevPave;
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
// Tiling-free sampling (two offset lookups blended by a slow noise index): the meadow tile no
// longer repeats every few metres, which read as a plywood/checker pattern from afar.
void sampleLayerNT(float L, vec2 uv, float k, vec2 wxz, out vec3 a, out vec3 n, out vec2 ro) {
  float idx = texture(tNoise, wxz / 41.0 + 0.53).g * 8.0;
  float ia = floor(idx);
  float f = fract(idx);
  vec2 offA = sin(vec2(3.0, 7.0) * ia) * 7.31;
  vec2 offB = sin(vec2(3.0, 7.0) * (ia + 1.0)) * 7.31;
  vec3 aA; vec3 nA; vec2 roA; vec3 aB; vec3 nB; vec2 roB;
  sampleLayer(L, uv + offA, k, aA, nA, roA);
  sampleLayer(L, uv + offB, k, aB, nB, roB);
  vec3 d = aA - aB;
  float w = smoothstep(0.2, 0.8, f - 0.1 * (d.x + d.y + d.z));
  a = mix(aA, aB, w); n = mix(nA, nB, w); ro = mix(roA, roB, w);
}
#define BLEND(w, a2, n2, ro2) { A = mix(A, a2, w); N = mix(N, n2, w); RO = mix(RO, ro2, w); }
// 1 inside a sett, 0 on the joints: staggered rows of size metres (the pave ghost, D-132)
float settFace(vec2 wxz, float size) {
  vec2 sp = wxz / size;
  sp.x += 0.5 * step(0.5, fract(sp.y * 0.5));
  vec2 sf = abs(fract(sp) - 0.5);
  return 1.0 - smoothstep(0.34, 0.44, max(sf.x, sf.y));
}
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
  sampleLayerNT(0.0, uv, 1.0, wxz, A, N, RO);
#ifndef TERRAIN_LOW
  // second scale to break tiling
  // (rotated ~37 deg and at an irrational-ish scale so the two lattices never line up)
  {
    mat2 R = mat2(0.8, 0.6, -0.6, 0.8);
    vec2 uvR = R * uv + 0.37;
    vec2 sx = gDx, sy = gDy;
    gDx = R * gDx; gDy = R * gDy;
    sampleLayer(0.0, uvR, 0.23, a2, n2, ro2);
    gDx = sx; gDy = sy;
    A = mix(A, a2, 0.5);
  }
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
    vec4 nzP0 = texture(tNoise, wxz / 17.0 + 0.19);
    float fc = (gnd.a > 0.5 ? wxz.x : wxz.y) + (nzS.r - 0.5) * 0.6 + (nzM.r - 0.5) * 3.2;
    float ph = fc * 6.2831853 / 0.8;
    float fade = 1.0 - smoothstep(0.08, 0.3, fwidth(fc) / 0.8);
    float ridge = mix(0.6, 0.5 + 0.5 * sin(ph), fade);
    a2 *= mix(0.8, 1.0, ridge) * (0.9 + 0.2 * nzP0.g);
    a2 = mix(a2, vec3(0.32, 0.25, 0.15), smoothstep(0.75, 1.0, ridge) * smoothstep(0.4, 0.8, nzS.a) * 0.3);
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
  // winter (free valley seasons): hoarfrost pales and cools the ground; no snow cover, no new assets
  if (uWinter > 0.001) {
    float lum = dot(A, vec3(0.3, 0.59, 0.11));
    // roads keep their colour (they carry the diagnosis) and the river bed stays dark
    float frost = uWinter * 0.42 * (1.0 - roadCover) * smoothstep(0.3, 1.2, hW);
    A = mix(A, vec3(lum * 0.9 + 0.28, lum * 0.92 + 0.29, lum * 0.95 + 0.31), frost);
    RO.x = mix(RO.x, RO.x * 0.85, frost);
  }

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
  if (uSiteOn > 0.5) {
    // suitable ground for the placement: sparse cross-hatching in ochre, like a surveyor's shading
    float site = smoothstep(0.3, 0.6, texture(tSite, cuv).r);
    float h1 = abs(fract((wxz.x + wxz.y) * 0.45) - 0.5) * 2.0;
    float h2 = abs(fract((wxz.x - wxz.y) * 0.45) - 0.5) * 2.0;
    float cross = max(1.0 - smoothstep(0.12, 0.3, h1), 1.0 - smoothstep(0.12, 0.3, h2));
    float k = site * (0.18 + 0.5 * cross);
    ovCol = mix(ovCol, uOchre * 0.82, k); ovA = max(ovA, k * 0.75);
  }
  if (pv > 0.0 && uPrevPave > 0.5) {
    // a dirt stretch to pave (D-132): grey-buff setts in staggered rows with dark joints, so it reads as "cobbles
    // here" against the wet, dark mud it lies on (the ochre wash looked like one more dirt road in the rain). The
    // setts grow in octaves with distance (blended), so the joints stay a few pixels apart and never alias away.
    float lv = log2(max(1.0, fw * 6.0 / 0.95));
    float l0 = floor(lv);
    float sz = 0.95 * exp2(l0);
    float face = mix(settFace(wxz, sz), settFace(wxz, sz * 2.0), lv - l0);
    vec3 stone = mix(vec3(0.3, 0.27, 0.23), vec3(0.78, 0.73, 0.62), face);
    // an ochre rim where the stretch meets the verge, like the road preview's own colour
    float rim = 1.0 - smoothstep(0.35, 0.8, pv);
    ovCol = mix(ovCol, mix(stone, uOchre, rim), pv);
    ovA = max(ovA, pv * 0.9);
  } else if (pv > 0.0) { ovCol = mix(ovCol, uOchre, pv); ovA = max(ovA, pv * 0.65); }
  if (pb > 0.0) { ovCol = mix(ovCol, uClay, pb); ovA = max(ovA, pb * 0.6); }
  float bad = smoothstep(0.3, 0.6, ov.a);
  if (bad > 0.0) {
    float pulse = 0.65 + 0.35 * uMotion * sin(uTime * 6.0) + 0.2 * (1.0 - uMotion);
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
      float pulse = 0.55 + 0.25 * uMotion * sin(uTime * 6.0) + 0.2 * (1.0 - uMotion);
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
  // Both hooks read `this` (the material being compiled), not the closure's `m`: a clone made to
  // pre-compile the other quality tier (`qualityVariant`) must key and build its own variant.
  m.onBeforeCompile = function (this: MeshStandardMaterial, sh) {
    const low = !!this.userData.low;
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n vWNrm = normalize(mat3(modelMatrix) * objectNormal);',
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + (low ? '#define TERRAIN_LOW\n' : '') + FRAG_DECL)
      .replace('#include <map_fragment>', FRAG_MAIN)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = tRough;')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(Nw, 0.0)).xyz);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += tEmis;');
  };
  m.customProgramCacheKey = function (this: MeshStandardMaterial) { return 'marchia-terrain-4' + (this.userData.low ? '-low' : ''); };
  return m;
}
