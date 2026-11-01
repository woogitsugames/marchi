/**
 * Shared materials for procedural models. Albedo lives in vertex colours (baked AO, dirt and
 * colour variation included), so each material is white-based `MeshStandardMaterial` with
 * `vertexColors`. One material per *kind* keeps draw calls low and lets a PBR texture set be
 * attached per kind later via `applyTextures` (the maps are optional and multiplied by the
 * vertex colour, so albedo maps should be roughly mid-grey/neutral "detail" textures, or the
 * caller can set `vertexColorsAsTint`).
 */
import {
  CanvasTexture,
  Color,
  DoubleSide,
  MeshStandardMaterial,
  SRGBColorSpace,
  type Texture,
} from 'three';

export type MatKey =
  | 'wood' // sawn and hewn timber, wagon, boards, shingles, wicker
  | 'bark' // logs, trunks
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

// Far-tree cards turn about their vertical axis to face the camera (cylindrical billboard):
// the first quad of the cross is swung toward the camera, the second collapses to nothing, so
// from a high camera there is no "X" of two crossed cards. Shadows keep the static cross.
const BB_NORMAL = /* glsl */ `
vec3 objectNormal = vec3(normal);
#ifdef USE_INSTANCING
  vec3 bbWorld = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
  vec3 bbTo = cameraPosition - bbWorld;
  bbTo.y = 0.0;
  vec3 bbF = normalize(bbTo + vec3(1e-4, 0.0, 0.0));
  vec3 bbR = vec3(bbF.z, 0.0, -bbF.x);
  mat3 bbIM = transpose(mat3(instanceMatrix));
  vec3 bbLR = normalize(bbIM * bbR);
  vec3 bbLF = normalize(bbIM * bbF);
  objectNormal = normalize(bbLR * normal.x + vec3(0.0, normal.y, 0.0) + bbLF * 0.6);
#endif
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif
`;
const BB_VERTEX = /* glsl */ `
vec3 transformed = vec3(position);
#ifdef USE_INSTANCING
  transformed = bbLR * position.x + vec3(0.0, position.y, 0.0);
#endif
#ifdef USE_ALPHAHASH
  vPosition = vec3(position);
#endif
`;

function addFoliageLift(m: MeshStandardMaterial, key: MatKey): void {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFoliageLift = foliageLift;
    if (key === 'billboard') sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', BB_NORMAL).replace('#include <begin_vertex>', BB_VERTEX);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uFoliageLift;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uFoliageLift;');
  };
  m.customProgramCacheKey = () => 'foliage-' + key;
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
  if (key === 'needles' || key === 'leaves' || key === 'billboard' || key === 'grass') addFoliageLift(m, key);
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
  const m = modelMaterial(key);
  if (set.map !== undefined && !SPECS[key].alphaLeaf && !SPECS[key].alphaNeedle) {
    m.map = set.map;
    if (m.map) m.map.colorSpace = SRGBColorSpace;
  }
  if (set.normalMap !== undefined) m.normalMap = set.normalMap;
  if (set.roughnessMap !== undefined) m.roughnessMap = set.roughnessMap;
  if (set.aoMap !== undefined) m.aoMap = set.aoMap;
  m.needsUpdate = true;
}

let leafTex: CanvasTexture | null = null;

/**
 * Procedural leaf-cluster alpha texture (white RGB, leaf-shaped alpha), drawn on a canvas so
 * nothing is downloaded. Colour comes from the vertex colours of the card.
 */
export function leafTexture(): CanvasTexture {
  if (leafTex) return leafTex;
  const size = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  if (!g) throw new Error('2d canvas unavailable');
  g.clearRect(0, 0, size, size);
  let s = 12345;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // a twig across the card
  g.strokeStyle = 'rgba(120,110,100,1)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(size * 0.1, size * 0.9);
  g.quadraticCurveTo(size * 0.45, size * 0.55, size * 0.9, size * 0.15);
  g.stroke();
  // sparse leaves, each a small ellipse with random tone (alpha carries the shape)
  for (let i = 0; i < 64; i++) {
    const t = r();
    const cx = size * (0.1 + 0.8 * t) + (r() - 0.5) * size * 0.42;
    const cy = size * (0.9 - 0.75 * t) + (r() - 0.5) * size * 0.42;
    const rad = size * (0.025 + r() * 0.03);
    const tone = 170 + Math.floor(r() * 85);
    g.fillStyle = `rgb(${tone},${tone},${tone})`;
    g.beginPath();
    g.ellipse(cx, cy, rad * 1.6, rad, r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  leafTex = new CanvasTexture(cv);
  leafTex.colorSpace = SRGBColorSpace;
  leafTex.anisotropy = 2;
  return leafTex;
}

let needleTex: CanvasTexture | null = null;

/**
 * Conifer spray texture (256×128): left half a branch spray with needles along a stem that runs
 * along U (u 0→0.5, v = 0.5), right half solid (for opaque crown cores that share the material).
 */
export function needleTexture(): CanvasTexture {
  if (needleTex) return needleTex;
  const W = 256, H = 128;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
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
  needleTex = new CanvasTexture(cv);
  needleTex.colorSpace = SRGBColorSpace;
  needleTex.anisotropy = 2;
  return needleTex;
}
