/**
 * Shared materials for procedural models. Albedo lives in vertex colours (baked AO, dirt and
 * colour variation included), so each material is white-based `MeshStandardMaterial` with
 * `vertexColors`. One material per *kind* keeps draw calls low and lets a PBR texture set be
 * attached per kind later via `applyTextures` (the maps are optional and multiplied by the
 * vertex colour, so albedo maps should be roughly mid-grey/neutral "detail" textures, or the
 * caller can set `vertexColorsAsTint`).
 */
import {
  Color,
  DataTexture,
  DoubleSide,
  LinearFilter,
  type InstancedMesh,
  LinearMipmapLinearFilter,
  type Material,
  MeshDepthMaterial,
  MeshStandardMaterial,
  RGBADepthPacking,
  SRGBColorSpace,
  type Texture,
} from 'three';

export type MatKey =
  | 'wood' // sawn and hewn timber, wagon, boards, shingles, wicker
  | 'bark' // logs, posts, piles
  | 'trunk' // tree trunks and limbs (bark maps + the tree shader: LOD dither, sway)
  | 'thatch'
  | 'stone'
  | 'plaster' // wattle-and-daub, limewash
  | 'cloth' // sacks, clothes, banner
  | 'hide' // horse coat, leather
  | 'skin'
  | 'metal' // iron fittings that need a sheen
  | 'needles' // conifer branch sprays (alpha cards; right half of the texture is solid)
  | 'leaves' // alpha-tested leaf cards
  | 'billboard' // far-tree impostor cards (map baked by `bakeTreeBillboards`)
  | 'grass'; // grass tufts, reeds, sedge (untextured double-sided blades)

interface MatSpec {
  roughness: number;
  metalness?: number;
  side?: 'double';
  alphaLeaf?: boolean;
  alphaNeedle?: boolean;
}

const SPECS: Record<MatKey, MatSpec> = {
  wood: { roughness: 0.86 },
  bark: { roughness: 0.95 },
  trunk: { roughness: 0.95 },
  thatch: { roughness: 0.97 },
  stone: { roughness: 0.9 },
  plaster: { roughness: 0.93 },
  cloth: { roughness: 0.96 },
  hide: { roughness: 0.62 },
  skin: { roughness: 0.7 },
  metal: { roughness: 0.55, metalness: 0.6 },
  needles: { roughness: 0.92, side: 'double', alphaNeedle: true },
  leaves: { roughness: 0.85, side: 'double', alphaLeaf: true },
  billboard: { roughness: 0.95, side: 'double' },
  grass: { roughness: 0.92, side: 'double' },
};

export interface TextureSet {
  map?: Texture | null;
  normalMap?: Texture | null;
  roughnessMap?: Texture | null;
  aoMap?: Texture | null;
}

const cache = new Map<MatKey, MeshStandardMaterial>();

/**
 * Shared fill for foliage (needles, leaves, far-tree cards): light scattered through the crown
 * so self-shadowed crowns stay readable green-grey (palette 'Bór') instead of going black.
 * Set every frame by the view from the sky light (black at night).
 */
export const foliageLift = { value: new Color(0, 0, 0) };

/**
 * Shared tree-shader state (leaves, needles, far-tree cards), set by the vegetation view:
 *  - `uTreeTime` seconds for the wind, `uWindAmp` 0 (off, low quality) … 1;
 *  - `uLodNear` / `uLodBand` the LOD radius and the width (m) of the dithered crossfade between
 *    full trees and far cards; band 0 disables the dither (model preview, both always drawn).
 * Each tree geometry carries `aTree` = (LOD radius factor, tint family: 0 conifer, 1 broadleaf,
 * far-card lift in metres).
 */
export const treeUniforms = {
  uTreeTime: { value: 0 },
  uWindAmp: { value: 1 },
  uLodNear: { value: 1e6 },
  uLodBand: { value: 0 },
  uBbNormal: { value: null as Texture | null },
  /** 0 … 1 deciduous crowns bare (D-260): a leaf card whose `aTree.z` is below it shows the twig spray. */
  uBare: { value: 0 },
  /** 0 … 1 young spring green on the deciduous leaf cards (D-303, `springAt`); 0 keeps the late-autumn palette. */
  uSpring: { value: 0 },
};

/**
 * Bare deciduous crowns (D-260): the `leaves` texture holds the leaf clump in its left half and a bare twig spray in
 * its right half. Each leaf card carries its own hash in `aTree.z` (trees.ts); a card whose hash is below the bare
 * factor samples the right half and takes the twig colour, so the crown thins card by card as the factor rises.
 * Shared by the leaf material, its shadow depth material and the far-card bake (one formula, one look).
 * TWIG_COL is the linear albedo of the twigs (cold grey-brown; the texture adds the rimed upper edges).
 */
export const TWIG_GLSL = /* glsl */ `
#define TWIG_COL vec3(0.19, 0.165, 0.14)
float twigSel(float h, float bare) { return h < bare ? 1.0 : 0.0; }
// about a third of the bare cards show nothing at all (a transparent texel): a bare crown is more open than the
// three crossed cards of a leaf clump
vec2 twigUv(vec2 uv, float sel, float h) {
  return sel * step(fract(h * 13.0), 0.3) > 0.5 ? vec2(0.502, 0.004) : vec2(uv.x * 0.5 + sel * 0.5, uv.y);
}
// young spring leaves (D-303): the leaf colour turns toward a restrained young green of the same luminance (new oak and
// birch leaves under an overcast sky: desaturated, a little yellow), so the baked clump occlusion and the per-clump
// value spread stay; each card has its own shade (olive-green … yellow-green) and its own strength from its hash, so
// a crown does not go one flat colour. Linear albedo; s = 0 returns the colour unchanged (contract missions, autumn).
#define SPRING_COL vec3(0.165, 0.25, 0.07)
#define SPRING_COL2 vec3(0.215, 0.255, 0.065)
vec3 springLeaf(vec3 c, float s, float h) {
  vec3 g = mix(SPRING_COL, SPRING_COL2, fract(h * 7.0));
  const vec3 lw = vec3(0.2126, 0.7152, 0.0722);
  g *= dot(c, lw) / dot(g, lw) * 1.05;
  return mix(c, g, s * (0.78 + 0.22 * fract(h * 29.0)));
}
`;

// Far-tree cards turn about their vertical axis to face the camera (cylindrical billboard), so
// from a high camera there is no "X" of two crossed cards. Their shadows use a separate blob
// depth material (trees.ts billboardDepthMaterial). Shading comes from a baked normal atlas
// (same crown normals as the full model), passed in view space as the card's basis.
const BB_NORMAL = /* glsl */ `
vec3 objectNormal = vec3(normal);
#ifdef USE_INSTANCING
  vec3 bbWorld = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
  vec3 bbTo = cameraPosition - bbWorld;
  float bbEl = clamp(bbTo.y / max(length(bbTo), 1e-3), 0.0, 1.0);
  bbTo.y = 0.0;
  vec3 bbF = normalize(bbTo + vec3(1e-4, 0.0, 0.0));
  vec3 bbR = vec3(bbF.z, 0.0, -bbF.x);
  // lean the card back toward a high camera (part of the elevation angle), so from above a
  // crown reads as a round clump instead of a squashed wedge
  float bbA = max(asin(bbEl) - 0.52, 0.0) * 0.6;
  vec3 bbU = vec3(0.0, cos(bbA), 0.0) - bbF * sin(bbA);
  mat3 bbIM = transpose(mat3(instanceMatrix));
  vec3 bbLR = normalize(bbIM * bbR);
  vec3 bbLU = normalize(bbIM * bbU);
  // shade as the upright crown would (the lean is only a projection aid)
  vec3 bbLF = normalize(bbIM * bbF);
  objectNormal = normalize(bbLR * normal.x + vec3(0.0, normal.y, 0.0) + bbLF * 0.6);
  vBbR = normalize(mat3(viewMatrix) * bbR);
  // basis of the bake camera (looking down at 0.52 rad, see trees.ts BB_ELEV)
  vBbU = normalize(mat3(viewMatrix) * (vec3(0.0, 0.8678, 0.0) - bbF * 0.4969));
  vBbF = normalize(mat3(viewMatrix) * (vec3(0.0, 0.4969, 0.0) + bbF * 0.8678));
#if defined(TREE_BB_VIEWS) && defined(USE_MAP)
  // multi-view atlas (trees.ts BB_VIEWS): view i was baked with the camera at azimuth i/N turns
  // in the tree's own frame. The camera direction in that frame picks the two nearest views
  // (the tree's yaw is honoured, so the card turns with the model it stands in for).
  float bbAz = atan(bbLF.x, bbLF.z) * (TREE_BB_VIEWS / 6.2831853);
  bbAz = bbAz < 0.0 ? bbAz + TREE_BB_VIEWS : bbAz;
  float bbV0 = min(floor(bbAz), TREE_BB_VIEWS - 1.0);
  vBbW = clamp(bbAz - bbV0, 0.0, 1.0);
  float bbV1 = bbV0 + 1.0 >= TREE_BB_VIEWS ? 0.0 : bbV0 + 1.0;
  vBbUv1 = vec2(vMapUv.x, vMapUv.y + bbV1 / TREE_BB_VIEWS);
  vMapUv.y += bbV0 / TREE_BB_VIEWS;
#endif
#endif
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif
`;
const BB_VERTEX = /* glsl */ `
vec3 transformed = vec3(position);
#ifdef USE_INSTANCING
  // the card is raised by aTree.z (the part of the elevated bake below the trunk foot) and moved
  // toward the camera by the same amount over tan(elevation): it projects where it belongs but
  // no longer dips into the ground
  float bbTan = bbEl / max(sqrt(1.0 - bbEl * bbEl), 1e-3);
  transformed = bbLR * position.x + bbLU * position.y + bbLF * (aTree.z / max(bbTan, 0.35));
#endif
#ifdef USE_ALPHAHASH
  vPosition = vec3(position);
#endif
`;

const TREE_VERT_HEAD = /* glsl */ `
uniform float uTreeTime;
uniform float uWindAmp;
uniform float uLodNear;
uniform float uLodBand;
uniform float uBare;
uniform float uSpring;
attribute vec3 aTree;
varying vec3 vTint;
varying float vLodT;
#ifdef TREE_LEAVES
varying float vTwig;
#endif
#ifdef TREE_FAR
varying vec3 vBbR;
varying vec3 vBbU;
varying vec3 vBbF;
varying vec2 vBbUv1;
varying float vBbW;
#endif
`;

// Per-instance hue/value variation, LOD crossfade factor and a gentle height-weighted sway.
// Everything is keyed on the instance origin, so a tree keeps its tint across the LOD swap.
const TREE_VERT_BODY = /* glsl */ `
#ifdef USE_INSTANCING
  vec3 tO = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
#else
  vec3 tO = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#endif
  // small-magnitude hash (no sin of large arguments): identical in every tree program
  vec2 hp = fract(tO.xz * vec2(0.1031, 0.1030));
  hp += dot(hp, hp.yx + 33.33);
  float tH1 = fract((hp.x + hp.y) * hp.x);
  float tH2 = fract((hp.x + hp.y) * hp.y);
  float tVal = 0.86 + 0.28 * tH1;
#ifdef TREE_LEAVES
  // bare winter crown (D-260): this card shows the twig spray, untinted, in the twig colour, and barely flutters
  float tBare = twigSel(aTree.z, uBare);
  vTwig = tBare;
#ifdef USE_MAP
  vMapUv = twigUv(vMapUv, tBare, aTree.z);
#endif
#ifdef USE_COLOR
  vColor.rgb = mix(springLeaf(vColor.rgb, uSpring, aTree.z), TWIG_COL * (0.9 + 0.2 * tH2), tBare);
#endif
#else
  float tBare = 0.0;
#endif
  if (aTree.y > 0.5) {
    // broadleaf: from russet-brown through ochre to a dull green-yellow, lighter/darker per tree
    vec3 warm = vec3(1.13, 0.97, 0.80);
    vec3 cool = vec3(0.92, 1.02, 0.94);
    vTint = mix(cool, warm, tH2) * tVal;
    // spring (D-303): most of the russet/ochre hue spread goes (it would brown the young green), the value spread stays;
    // the far cards follow with the exact factor
    vTint = mix(vTint, vec3(tVal), 0.6 * uSpring);
  } else {
    // conifers: value and a slight blue-green / yellow-green shift
    vTint = mix(vec3(0.95, 1.0, 1.0), vec3(1.05, 1.02, 0.92), tH2) * (0.9 + 0.2 * tH1);
  }
  vTint = mix(vTint, vec3(1.0), tBare);
  float lodK = aTree.x > 0.0 ? aTree.x : 1.0;
  vLodT = uLodBand > 0.0 ? clamp((uLodNear * lodK - distance(cameraPosition, tO)) / (uLodBand * lodK), 0.0, 1.0) : -1.0;
  float wh = max(transformed.y, 0.0);
  float wPh = uTreeTime * 1.1 + tH1 * 6.2831;
  float sway = (sin(wPh) * 0.7 + sin(wPh * 2.37 + 1.3) * 0.3) * uWindAmp * 0.0006 * wh * wh;
#if !defined(TREE_FAR) && !defined(TREE_TRUNK)
  // leaf flutter on top of the sway (cards only; the far card keeps its silhouette)
  float fl = sin(uTreeTime * 3.7 + dot(position, vec3(1.9, 1.3, 2.3)) + tH2 * 6.2831) * 0.035 * uWindAmp * min(wh, 2.0) * (1.0 - 0.75 * tBare);
  transformed += vec3(fl, fl * 0.4, -fl * 0.6);
#endif
  transformed.x += sway;
  transformed.z += sway * 0.45;
`;

const TREE_FRAG_HEAD = /* glsl */ `
varying vec3 vTint;
varying float vLodT;
#ifdef TREE_LEAVES
varying float vTwig;
#endif
#ifdef TREE_FAR
varying vec3 vBbR;
varying vec3 vBbU;
varying vec3 vBbF;
varying vec2 vBbUv1;
varying float vBbW;
#ifdef TREE_BB_NORMAL
uniform sampler2D uBbNormal;
#endif
#endif
`;

// Dithered LOD crossfade: the full tree keeps the pixels whose dither value is below the fade
// factor, the far card the rest, so the pair always covers the crown exactly once.
// Alpha-tested cards lose coverage in coarse mips (averaged thin needles fall under the cutoff
// and distant conifers turn into bare poles): scale alpha up with the mip level being sampled.
const TREE_FRAG_MIPALPHA = /* glsl */ `
#if defined(USE_MAP) && !defined(TREE_TRUNK)
{
  vec2 tuv = vMapUv * vec2(textureSize(map, 0));
  vec2 tdx = dFdx(tuv), tdy = dFdy(tuv);
  float tlod = max(0.0, 0.5 * log2(max(dot(tdx, tdx), dot(tdy, tdy))));
#ifdef TREE_LEAVES
  // thin twigs average away faster than leaves in the coarse mips: hold them up harder (D-260)
  diffuseColor.a *= 1.0 + tlod * (0.3 + 0.2 * vTwig);
#ifndef ALPHA_TO_COVERAGE
  // low tier (plain alpha test): screen-door the twig cards by their coverage, so a bare crown keeps the thin haze
  // alpha to coverage gives it on high instead of losing every twig thinner than the cut (a pattern offset from
  // the LOD dither's, so the two do not line up in the crossfade band)
  if (vTwig > 0.5) diffuseColor.a = step(0.1 + 0.8 * fract(52.9829189 * fract(dot(gl_FragCoord.xy + 17.0, vec2(0.00583715, 0.06711056)))), diffuseColor.a);
#endif
#else
  diffuseColor.a *= 1.0 + tlod * 0.3;
#endif
}
#endif
`;

// Far cards replace map_fragment: the atlas is effectively premultiplied (cleared to 0, foliage
// written opaque), so colour = rgb / alpha without any dark fringe; the silhouette also takes a
// finer mip than the colour, so thin spruce sprays stay solid at a distance. With a multi-view
// atlas, high blends the two nearest azimuth views; low picks one of them per pixel (dithered by
// the blend weight), so it costs the same samples as a single view. `bbUv` / `bbLod` are reused
// for the normal atlas (TREE_NORMAL).
const TREE_FRAG_FARMAP = /* glsl */ `
vec2 bbUv = vMapUv;
float bbLod = 0.0;
#ifdef USE_MAP
{
  vec2 tuv = vMapUv * vec2(textureSize(map, 0));
  vec2 tdx = dFdx(tuv), tdy = dFdy(tuv);
  bbLod = max(0.0, 0.5 * log2(max(dot(tdx, tdx), dot(tdy, tdy))));
}
#if defined(TREE_BB_VIEWS) && !defined(TREE_BB_BLEND)
  if (fract(52.9829189 * fract(dot(gl_FragCoord.yx, vec2(0.06711056, 0.00583715)) + 0.37)) < vBbW) bbUv = vBbUv1;
#endif
  vec4 tS = textureLod(map, bbUv, bbLod);
  vec4 tFine = textureLod(map, bbUv, max(0.0, bbLod - 1.5));
#if defined(TREE_BB_VIEWS) && defined(TREE_BB_BLEND)
  tS = mix(tS, textureLod(map, vBbUv1, bbLod), vBbW);
  tFine = mix(tFine, textureLod(map, vBbUv1, max(0.0, bbLod - 1.5)), vBbW);
#endif
  diffuseColor = vec4(diffuse * (tS.rgb + tFine.rgb) / max(tS.a + tFine.a, 1e-3), opacity * max(tS.a, tFine.a));
  diffuseColor.a *= 1.0 + bbLod * 0.3;
#endif
`;

const TREE_FRAG_DITHER = /* glsl */ `
if (vLodT >= 0.0) {
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float dv = ign;
#ifdef TREE_FAR
  if (dv < vLodT) discard;
#else
  if (dv >= vLodT) discard;
#endif
}
#ifndef TREE_TRUNK
diffuseColor.rgb *= vTint;
#endif
`;

// Foliage cards are double sided but carry crown normals: never flip them on back faces (the
// default flip turned every card seen from behind toward the crown's dark side).
const TREE_NORMAL = /* glsl */ `
float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
vec3 normal = normalize(vNormal);
#if defined(TREE_FAR) && defined(TREE_BB_NORMAL) && defined(USE_MAP)
  vec4 bt = textureLod(uBbNormal, bbUv, bbLod);
#if defined(TREE_BB_VIEWS) && defined(TREE_BB_BLEND)
  bt = mix(bt, textureLod(uBbNormal, vBbUv1, bbLod), vBbW);
#endif
  vec3 bn = bt.a > 0.02 ? bt.xyz / bt.a * 2.0 - 1.0 : vec3(0.0, 0.5, 0.8);
  normal = normalize(normalize(vBbR) * bn.x + normalize(vBbU) * bn.y + normalize(vBbF) * max(bn.z, 0.05));
#endif
vec3 nonPerturbedNormal = normal;
`;

function addFoliageLift(m: MeshStandardMaterial, key: MatKey): void {
  const tree = key === 'needles' || key === 'leaves' || key === 'billboard' || key === 'trunk';
  const foliage = key !== 'trunk';
  m.onBeforeCompile = (sh) => {
    if (key === 'billboard') sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', BB_NORMAL).replace('#include <begin_vertex>', BB_VERTEX);
    if (tree) {
      Object.assign(sh.uniforms, treeUniforms);
      const def = key === 'billboard' ? '#define TREE_FAR\n' : key === 'trunk' ? '#define TREE_TRUNK\n' : key === 'leaves' ? '#define TREE_LEAVES\n' : '';
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + def + TWIG_GLSL + TREE_VERT_HEAD)
        .replace('#include <morphtarget_vertex>', '#include <morphtarget_vertex>\n' + TREE_VERT_BODY);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + def + TREE_FRAG_HEAD)
        .replace('#include <map_fragment>', key === 'billboard' ? TREE_FRAG_FARMAP : '#include <map_fragment>\n' + TREE_FRAG_MIPALPHA)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + TREE_FRAG_DITHER);
      if (foliage) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', TREE_NORMAL);
    }
    if (foliage) {
      sh.uniforms.uFoliageLift = foliageLift;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uFoliageLift;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uFoliageLift;');
    }
  };
  m.customProgramCacheKey = () => 'foliage4-' + key;
}

/**
 * Winter hoarfrost on the buildings (D-203): up-facing faces (roofs, wall tops, log and fence tops, the kiln mound)
 * pale toward the same frost colour the terrain shader uses, so the roofs no longer stay summer-brown on a white valley.
 * Only plain meshes (buildings, bridges, props): the instanced users (wagons, cargo, yard piles, workers) skip it.
 * One shared uniform, set per frame by the view; the code is always in the program, so a season change links nothing.
 */
export const frostUniform = { value: 0 };
const FROST_KEYS = new Set<MatKey>(['wood', 'bark', 'thatch', 'stone', 'plaster']);
const FROST_VERT = `
#ifdef USE_INSTANCING
  vFrostUp = -1.0;
#else
  vFrostUp = normalize(mat3(modelMatrix) * objectNormal).y;
#endif
`;
const FROST_FRAG = `
{
  float frostK = uFrost * smoothstep(0.4, 0.8, vFrostUp);
  float frostL = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(frostL * 0.9 + 0.28, frostL * 0.92 + 0.29, frostL * 0.95 + 0.31), frostK);
}
`;

// one hook and one cache key for every frosted kind: the program text is the same, so the kinds keep sharing one
// program (and one for the instanced mirrors) as before the frost; a per-kind key would add a program per kind
function frostHook(sh: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }): void {
  sh.uniforms.uFrost = frostUniform;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vFrostUp;')
    .replace('#include <project_vertex>', '#include <project_vertex>\n' + FROST_VERT);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uFrost;\nvarying float vFrostUp;')
    .replace('#include <color_fragment>', '#include <color_fragment>\n' + FROST_FRAG);
}
const frostKey = (): string => 'frost1';

function addFrost(m: MeshStandardMaterial): void {
  m.onBeforeCompile = frostHook;
  m.customProgramCacheKey = frostKey;
}

/**
 * Quality switch for the tree materials: alpha-to-coverage on the full-detail cards (soft edges
 * through MSAA) and wind on high/ultra; plain alpha test and a still forest on low.
 */
export function setTreeQuality(high: boolean): void {
  treeUniforms.uWindAmp.value = high ? 1 : 0;
  // far cards: blend the two nearest baked azimuth views on high, dither between them on low
  const bb = modelMaterial('billboard') as unknown as { defines?: Record<string, string>; needsUpdate: boolean };
  const defs = { ...(bb.defines ?? {}) };
  if (('TREE_BB_BLEND' in defs) !== high) {
    if (high) defs.TREE_BB_BLEND = '';
    else delete defs.TREE_BB_BLEND;
    bb.defines = defs;
    bb.needsUpdate = true;
  }
  // (far cards keep the plain alpha test: their thin sprays read as a ghostly haze through MSAA)
  for (const k of ['leaves', 'needles'] as const) {
    const m = modelMaterial(k);
    if (m.alphaToCoverage !== high) {
      m.alphaToCoverage = high;
      m.needsUpdate = true;
    }
  }
  for (const k of ['billboard', 'leaves', 'needles'] as const) syncInstanced(k);
}

/**
 * Detached copies of the tree materials as `setTreeQuality(high)` would leave them (only those that
 * would change), keyed by the real material: the renderer compiles them before the switch.
 */
export function treeQualityVariants(high: boolean): Map<Material, Material> {
  const out = new Map<Material, Material>();
  const variant = (m: MeshStandardMaterial): MeshStandardMaterial => {
    const c = m.clone();
    c.onBeforeCompile = m.onBeforeCompile;
    c.customProgramCacheKey = m.customProgramCacheKey;
    return c;
  };
  const bb = modelMaterial('billboard') as MeshStandardMaterial & { defines?: Record<string, string> };
  if (('TREE_BB_BLEND' in (bb.defines ?? {})) !== high) {
    const c = variant(bb) as MeshStandardMaterial & { defines?: Record<string, string> };
    const defs = { ...(bb.defines ?? {}) };
    if (high) defs.TREE_BB_BLEND = '';
    else delete defs.TREE_BB_BLEND;
    c.defines = defs;
    out.set(bb, c);
  }
  for (const k of ['leaves', 'needles'] as const) {
    const m = modelMaterial(k);
    if (m.alphaToCoverage === high) continue;
    const c = variant(m);
    c.alphaToCoverage = high;
    out.set(m, c);
  }
  // the instanced mirrors switch with their base material: compile the same variant for them
  for (const [m, c] of [...out]) for (const im of mirrorsOf(m.name.slice('model-'.length) as MatKey)) out.set(im, c);
  return out;
}

/** Shared material for a kind (created lazily, one instance per kind). */
export function modelMaterial(key: MatKey): MeshStandardMaterial {
  let m = cache.get(key);
  if (m) return m;
  const s = SPECS[key];
  m = new MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: s.roughness,
    metalness: s.metalness ?? 0,
  });
  if (s.side === 'double') m.side = DoubleSide;
  m.name = `model-${key}`;
  if (key === 'needles' || key === 'leaves' || key === 'billboard' || key === 'grass' || key === 'trunk') addFoliageLift(m, key);
  if (FROST_KEYS.has(key)) addFrost(m);
  if (s.alphaLeaf) {
    m.map = leafTexture();
    m.alphaTest = 0.5;
    // keep shading on both sides of the card lit like the crown, not dark on the back face
    m.shadowSide = DoubleSide;
  }
  if (s.alphaNeedle) {
    m.map = needleTexture();
    m.alphaTest = 0.5;
    m.shadowSide = DoubleSide;
  }
  cache.set(key, m);
  return m;
}

/**
 * Hook for the texture pipeline: attach optional PBR maps to a material kind. Passing a
 * texture as `null` removes it. Safe to call before or after meshes are created.
 */
export function applyTextures(key: MatKey, set: TextureSet): void {
  assignMaps(modelMaterial(key), key, set);
  syncInstanced(key);
}

/** Instanced mirrors by kind: `key` (InstancedMesh users) and `key+color` (InstancedMesh with `instanceColor`). */
const instCache = new Map<string, MeshStandardMaterial>();

/**
 * The kind's material for InstancedMesh users (wagon rigs, cargo, yard workers): a mirror of `modelMaterial(key)` with
 * the same shader hooks and program cache key. three.js keeps one current program per material and keys it by
 * `instancing`; a material drawn by both an InstancedMesh and a plain Mesh (buildings, bridges) in one frame rebuilds
 * its program parameters on every switch (research 2026-11-05 render #5). The mirror never diverges: every change of
 * a base material goes through a function here that calls `syncInstanced`, and `materialsFor` lists both for the
 * shader pre-warm.
 * `colored`: a separate mirror for InstancedMesh with `instanceColor` (`instancingColor` is checked the same way: the
 * grass tufts and the reeds shared `model-grass` and rebuilt twice per render, research 2026-11-05 rebuilds).
 */
export function instancedMaterial(key: MatKey, colored = false): MeshStandardMaterial {
  // guard (D-133): the impostor bake rewrites the billboard material outside this module; no mirror may follow it
  if (key === 'billboard') throw new Error('instancedMaterial: billboard has no instanced mirror');
  const id = colored ? key + '+color' : key;
  let c = instCache.get(id);
  if (c) return c;
  const m = modelMaterial(key);
  c = m.clone();
  c.onBeforeCompile = m.onBeforeCompile;
  c.customProgramCacheKey = m.customProgramCacheKey;
  c.name = m.name + (colored ? '-inst-color' : '-inst');
  instCache.set(id, c);
  return c;
}

function mirrorsOf(key: MatKey): MeshStandardMaterial[] {
  const out: MeshStandardMaterial[] = [];
  for (const id of [key, key + '+color']) { const im = instCache.get(id); if (im) out.push(im); }
  return out;
}

/** The base material of a kind and its instanced mirrors, if any were made. */
export function materialsFor(key: MatKey): MeshStandardMaterial[] {
  return [modelMaterial(key), ...mirrorsOf(key)];
}

function drifted(im: MeshStandardMaterial, m: MeshStandardMaterial): boolean {
  const d = im as MeshStandardMaterial & { defines?: Record<string, string> };
  const b = m as MeshStandardMaterial & { defines?: Record<string, string> };
  return im.map !== m.map || im.normalMap !== m.normalMap || im.roughnessMap !== m.roughnessMap || im.aoMap !== m.aoMap ||
    im.alphaToCoverage !== m.alphaToCoverage || im.alphaTest !== m.alphaTest || im.side !== m.side || im.shadowSide !== m.shadowSide ||
    JSON.stringify(d.defines ?? {}) !== JSON.stringify(b.defines ?? {});
}

/** Kinds whose mirror's program-relevant state differs from its base (empty when in sync; tests and debug). */
export function mirrorDrift(): MatKey[] {
  const out: MatKey[] = [];
  for (const [id, im] of instCache) {
    const key = id.split('+')[0] as MatKey;
    const m = modelMaterial(key);
    if (drifted(im, m) || im.onBeforeCompile !== m.onBeforeCompile || im.customProgramCacheKey !== m.customProgramCacheKey) {
      if (!out.includes(key)) out.push(key);
    }
  }
  return out;
}

/** Copy the program-relevant state of the base material to its mirrors (no-op without one). */
function syncInstanced(key: MatKey): void {
  const m = modelMaterial(key) as MeshStandardMaterial & { defines?: Record<string, string> };
  for (const im of mirrorsOf(key)) {
    if (!drifted(im, m)) continue;
    im.map = m.map;
    im.normalMap = m.normalMap;
    im.roughnessMap = m.roughnessMap;
    im.aoMap = m.aoMap;
    im.alphaToCoverage = m.alphaToCoverage;
    im.alphaTest = m.alphaTest;
    im.side = m.side;
    im.shadowSide = m.shadowSide;
    (im as MeshStandardMaterial & { defines?: Record<string, string> }).defines = { ...(m.defines ?? {}) };
    im.needsUpdate = true;
  }
}

let instDepth: MeshDepthMaterial | null = null;

/**
 * Shadow-pass material for instanced casters (set as `customDepthMaterial` by `shareInstancedDepth`). WebGLShadowMap
 * draws every caster without a custom depth material (and without an alpha-tested map) with ONE shared
 * MeshDepthMaterial, so its program flipped between the instanced and the plain variant at every switch between
 * wagons/trees/shrubs and buildings/bridges in the traversal: 2-4 parameter rebuilds per shadow render (research
 * 2026-11-05 rebuilds). Same packing and per-draw state (the shadow pass copies side, maps, alpha test and clipping
 * from the source material into it, exactly as into the shared one), so the depth written is the same.
 */
export function instancedDepthMaterial(): MeshDepthMaterial {
  if (!instDepth) {
    instDepth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
    instDepth.name = 'instanced-depth';
  }
  return instDepth;
}

let leafDepth: MeshDepthMaterial | null = null;

/**
 * Shadow depth material for leaf cards (D-260): the shadow map would otherwise draw them with its own clone of the
 * plain depth material and the plain UVs, i.e. full summer crowns casting shadows under bare winter trees. Same
 * card selection as the leaf material (`TWIG_GLSL`); map and alpha test come from the leaf material per draw
 * (WebGLShadowMap copies them onto a custom depth material too).
 */
export function leafDepthMaterial(): MeshDepthMaterial {
  if (leafDepth) return leafDepth;
  const m = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  m.name = 'leaf-depth';
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBare = treeUniforms.uBare;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uBare;\nattribute vec3 aTree;' + TWIG_GLSL)
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv = twigUv(vMapUv, twigSel(aTree.z, uBare), aTree.z);\n#endif');
  };
  m.customProgramCacheKey = () => 'leaf-depth-1';
  leafDepth = m;
  return m;
}

/**
 * Give an instanced shadow caster the shared instanced depth material, unless it has its own (horse skin, far cards)
 * or its material makes WebGLShadowMap pick a per-material depth clone (alpha-tested map, alpha to coverage,
 * displacement): those are never shared with plain meshes and must keep the shadow map's own alpha handling.
 */
export function shareInstancedDepth(mesh: InstancedMesh): void {
  if (mesh.customDepthMaterial) return;
  // leaf cards: their own depth material that drops the leaves in winter like the colour pass (D-260)
  if (mesh.material === cache.get('leaves')) { mesh.customDepthMaterial = leafDepthMaterial(); return; }
  const ms = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of ms) {
    const s = m as Material & { map?: unknown; alphaMap?: unknown; displacementMap?: unknown; displacementScale?: number };
    if ((s.displacementMap && s.displacementScale !== 0) || ((s.map || s.alphaMap) && m.alphaTest > 0) || m.alphaToCoverage) return;
  }
  mesh.customDepthMaterial = instancedDepthMaterial();
}

/**
 * A detached copy of a kind's material with `set` applied (same shader hooks and program cache
 * key): lets the renderer compile the textured variant before `applyTextures` binds it.
 */
export function texturedVariant(key: MatKey, set: TextureSet): MeshStandardMaterial {
  const m = modelMaterial(key);
  const c = m.clone();
  c.onBeforeCompile = m.onBeforeCompile;
  c.customProgramCacheKey = m.customProgramCacheKey;
  assignMaps(c, key, set);
  return c;
}

/** Every material kind (shader pre-warm draws one stand-in mesh per kind). */
export function materialKinds(): MatKey[] {
  return Object.keys(SPECS) as MatKey[];
}

function assignMaps(m: MeshStandardMaterial, key: MatKey, set: TextureSet): void {
  if (set.map !== undefined && !SPECS[key].alphaLeaf && !SPECS[key].alphaNeedle) {
    m.map = set.map;
    if (m.map) m.map.colorSpace = SRGBColorSpace;
  }
  if (set.normalMap !== undefined) m.normalMap = set.normalMap;
  if (set.roughnessMap !== undefined) m.roughnessMap = set.roughnessMap;
  if (set.aoMap !== undefined) m.aoMap = set.aoMap;
  m.needsUpdate = true;
}

/**
 * Canvas → straight-alpha texture. A 2D canvas keeps black under fully transparent pixels, which
 * filtering and mipmaps smear into dark rims around every leaf and every distant crown (an inked
 * outline). Transparent texels get a neutral grey instead; rows are flipped to GL order.
 */
function straightAlpha(cv: HTMLCanvasElement, fill: number): DataTexture {
  const w = cv.width, h = cv.height;
  const g = cv.getContext('2d');
  if (!g) throw new Error('2d canvas unavailable');
  const src = g.getImageData(0, 0, w, h).data;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, o = ((h - 1 - y) * w + x) * 4;
      const a = src[i + 3]!;
      out[o] = a ? src[i]! : fill;
      out[o + 1] = a ? src[i + 1]! : fill;
      out[o + 2] = a ? src[i + 2]! : fill;
      out[o + 3] = a;
    }
  }
  const t = new DataTexture(out, w, h);
  t.colorSpace = SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.anisotropy = 2;
  t.needsUpdate = true;
  return t;
}

let leafTex: DataTexture | null = null;

/**
 * Procedural leaf-cluster texture (grey-scale, leaf-shaped alpha), drawn on a canvas so nothing
 * is downloaded. Left half (u 0→0.5): one card is a whole clump of foliage, a lobed, irregular mass
 * of small leaves, darker toward its lower inner part and lighter on the upper rim (baked clump
 * occlusion), with a few twigs and gaps. Right half (u 0.5→1): the same clump in winter, a bare
 * twig spray (D-260, `TWIG_GLSL` picks the half per card). Colour comes from the vertex colours.
 */
export function leafTexture(): DataTexture {
  if (leafTex) return leafTex;
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = size * 2;
  cv.height = size;
  const g = cv.getContext('2d');
  if (!g) throw new Error('2d canvas unavailable');
  g.clearRect(0, 0, size * 2, size);
  let s = 12345;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const c = size / 2;
  // lobed outline: radius per angle from three low harmonics
  const p1 = r() * 6.28, p2 = r() * 6.28, p3 = r() * 6.28;
  const rim = (a: number) => size * 0.4 * (1 + 0.13 * Math.sin(3 * a + p1) + 0.09 * Math.sin(5 * a + p2) + 0.05 * Math.sin(8 * a + p3));
  g.save();
  g.beginPath();
  g.rect(0, 0, size, size);
  g.clip();
  // twigs from the lower centre outward
  g.strokeStyle = 'rgb(96,88,80)';
  g.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.6;
    const l = rim(a) * (0.6 + r() * 0.3);
    g.lineWidth = 2.2 - i * 0.2;
    g.beginPath();
    g.moveTo(c, c + size * 0.18);
    g.quadraticCurveTo(c + Math.cos(a) * l * 0.4, c + Math.sin(a) * l * 0.5, c + Math.cos(a) * l, c + Math.sin(a) * l);
    g.stroke();
  }
  // leaves: denser inside, a ragged fringe at the rim; drawn back (dark) to front (light)
  const leaves: [number, number, number, number, number][] = [];
  for (let i = 0; i < 420; i++) {
    const a = r() * Math.PI * 2;
    const k = Math.pow(r(), 0.6);
    const R = rim(a) * k;
    const x = c + Math.cos(a) * R, y = c + Math.sin(a) * R;
    // a few holes so the clump is not a solid disc
    const hole = Math.sin(x * 0.07 + p1) * Math.sin(y * 0.06 + p2);
    if (hole > 0.82 && k < 0.85) continue;
    const up = (c - y) / (size * 0.4); // +1 top, -1 bottom
    const tone = Math.max(70, Math.min(255, (150 + 80 * k + 40 * up) * (0.8 + r() * 0.35)));
    leaves.push([x, y, a + (r() - 0.5) * 1.6, tone, size * (0.022 + r() * 0.016)]);
  }
  leaves.sort((p, q) => p[3] - q[3]);
  for (const [x, y, rot, tone, len] of leaves) {
    const t = Math.round(tone);
    g.fillStyle = `rgb(${t},${t},${t})`;
    g.beginPath();
    g.ellipse(x, y, len * 1.7, len * 0.8, rot, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  drawTwigSpray(g, size, size, rim, r);
  leafTex = straightAlpha(cv, 175);
  return leafTex;
}

/**
 * Bare twig spray for the winter half of the leaf texture (D-260), in the cell at x0: a few limbs from the lower
 * centre fan up and out and fork four to five times, tapering to hair-thin tips that fill the same lobed outline as
 * the leaf clump (the bare crown keeps the summer silhouette, as a real one does). Woodcut reading: a dark stroke per
 * twig with a pale cut along its upper edge (light and rime from above), no soft shading.
 */
function drawTwigSpray(g: CanvasRenderingContext2D, x0: number, size: number, rim: (a: number) => number, r: () => number): void {
  const c = size / 2, by = c + size * 0.18;
  g.save();
  g.beginPath();
  g.rect(x0, 0, size, size);
  g.clip();
  g.lineCap = 'round';
  const segs: [number, number, number, number, number][] = [];
  const grow = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
    // a slight crook per segment: two straight pieces with a kink, as twigs grow node to node
    const kink = (r() - 0.5) * 0.5;
    const mx = x + Math.cos(a + kink) * len * 0.5, my = y + Math.sin(a + kink) * len * 0.5;
    let ex = mx + Math.cos(a - kink * 0.6) * len * 0.5, ey = my + Math.sin(a - kink * 0.6) * len * 0.5;
    // keep the spray inside the clump outline
    const dx = ex - c, dy = ey - c, d = Math.hypot(dx, dy), lim = rim(Math.atan2(dy, dx)) * 1.08;
    if (d > lim) { ex = c + (dx / d) * lim; ey = c + (dy / d) * lim; }
    segs.push([x, y, mx, my, w], [mx, my, ex, ey, w * 0.88]);
    // short spurs along the older twigs: the dense, fine outer twigging that makes a bare crown a haze, not sticks
    if (depth <= 3) {
      for (let k = 0; k < 1 + (depth <= 1 ? 1 : 0); k++) {
        const t = 0.3 + r() * 0.6, sa = a + (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.5);
        const sx = x + (ex - x) * t, sy = y + (ey - y) * t, sl = len * (0.22 + r() * 0.2);
        segs.push([sx, sy, sx + Math.cos(sa) * sl, sy + Math.sin(sa) * sl, Math.max(0.9, w * 0.5)]);
      }
    }
    if (depth <= 0) return;
    const n = depth > 4 ? 2 : 2 + (r() < 0.6 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const spread = (0.3 + r() * 0.32) * (k === 0 ? -1 : k === 1 ? 1 : (r() - 0.5) * 0.7);
      // tips curl a little upward (canvas y grows down: up is -PI/2)
      const up = (-Math.PI / 2 - a) * 0.12;
      grow(ex, ey, a + spread + up, len * (0.64 + r() * 0.14), Math.max(1.0, w * 0.7), depth - 1);
    }
  };
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.55 + (r() - 0.5) * 0.3;
    grow(c, by, a, rim(a) * (0.3 + r() * 0.08), 4.6 - Math.abs(i - 2.5) * 0.4, 5);
  }
  // a couple of shorter limbs hanging lower and out
  for (let i = 0; i < 2; i++) {
    const a = (i ? 0.2 : Math.PI - 0.2) + (r() - 0.5) * 0.3;
    grow(c, by, a, rim(a) * 0.28, 3.0, 4);
  }
  // body: dark strokes, thick first
  segs.sort((p, q) => q[4] - p[4]);
  g.strokeStyle = 'rgb(150,146,140)';
  for (const [ax, ay, bx, bly, w] of segs) {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x0 + ax, ay);
    g.lineTo(x0 + bx, bly);
    g.stroke();
  }
  // pale upper edge on the thicker twigs (light and rime from above)
  g.strokeStyle = 'rgb(240,240,238)';
  for (const [ax, ay, bx, bly, w] of segs) {
    if (w < 1.6) continue;
    g.lineWidth = Math.max(0.6, w * 0.35);
    const o = w * 0.32;
    g.beginPath();
    g.moveTo(x0 + ax, ay - o);
    g.lineTo(x0 + bx, bly - o);
    g.stroke();
  }
  g.restore();
}

let needleTex: DataTexture | null = null;

/**
 * Conifer texture (256×256). Upper half (v 0.5→1): left a branch spray with needles along a stem
 * that runs along U (u 0→0.5, v = 0.75), right solid (opaque crown cores share the material).
 * Lower half (v 0→0.5): a pine tuft clump for `clumps(..., 'needles')` cards.
 */
export function needleTexture(): DataTexture {
  if (needleTex) return needleTex;
  const W = 256, H = 128;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H * 2;
  const g = cv.getContext('2d');
  if (!g) throw new Error('2d canvas unavailable');
  g.clearRect(0, 0, W, H);
  let s = 777;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const stem = (x0: number, y0: number, x1: number, y1: number, width: number, needle: number) => {
    const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / 1.6);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const len = needle * (1 - t * 0.55) * (0.7 + r() * 0.5);
      const tone = 150 + Math.floor(r() * 105);
      g.strokeStyle = `rgb(${tone},${tone},${tone})`;
      g.lineWidth = 1.3;
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
      const nx = -dy / L, ny = dx / L;
      for (const sd of [-1, 1]) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (nx * sd * 0.9 + (dx / L) * 0.5) * len, y + (ny * sd * 0.9 + (dy / L) * 0.5) * len);
        g.stroke();
      }
    }
    g.strokeStyle = 'rgb(110,100,90)';
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  };
  // main stem + side shoots (a flat spruce/pine spray)
  stem(2, H / 2, W / 2 - 6, H / 2 + 4, 2.4, 13);
  for (let i = 0; i < 7; i++) {
    const x = 14 + i * 15;
    const sd = i % 2 ? 1 : -1;
    stem(x, H / 2 + 1, x + 22 - i * 1.5, H / 2 + sd * (40 - i * 4), 1.4, 9 - i * 0.6);
  }
  g.fillStyle = 'rgb(220,220,220)';
  g.fillRect(W / 2 + 4, 4, W / 2 - 8, H - 8);
  // lower half: a Scots-pine tuft clump (bursts of needles in a lobed mass), seen from any side
  const cx = W / 2, cy = H + H / 2;
  const p1 = r() * 6.28, p2 = r() * 6.28;
  const rim = (a: number) => H * 0.46 * (1 + 0.14 * Math.sin(3 * a + p1) + 0.08 * Math.sin(5 * a + p2));
  const tufts: [number, number, number][] = [];
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, k = Math.pow(r(), 0.55);
    const x = cx + Math.cos(a) * rim(a) * k * 1.9, y = cy + Math.sin(a) * rim(a) * k;
    tufts.push([x, y, Math.max(70, Math.min(255, (140 + 90 * k + 50 * (cy - y) / H) * (0.8 + r() * 0.3)))]);
  }
  tufts.sort((p, q) => p[2] - q[2]);
  g.lineWidth = 1.4;
  for (const [x, y, tone] of tufts) {
    const t = Math.round(tone);
    g.strokeStyle = `rgb(${t},${t},${t})`;
    const n = 14 + Math.floor(r() * 8);
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 + r() * 0.3;
      const l = 7 + r() * 7;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.8 - 2);
      g.stroke();
    }
  }
  needleTex = straightAlpha(cv, 175);
  return needleTex;
}
