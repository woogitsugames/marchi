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
  | 'needles' // conifer crowns (solid)
  | 'leaves' // alpha-tested leaf cards
  | 'billboard'; // far-tree impostor cards (map baked by `bakeTreeBillboards`)

interface MatSpec {
  roughness: number;
  metalness?: number;
  side?: 'double';
  alphaLeaf?: boolean;
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
  needles: { roughness: 0.92 },
  leaves: { roughness: 0.85, side: 'double', alphaLeaf: true },
  billboard: { roughness: 0.95, side: 'double' },
};

export interface TextureSet {
  map?: Texture | null;
  normalMap?: Texture | null;
  roughnessMap?: Texture | null;
  aoMap?: Texture | null;
}

const cache = new Map<MatKey, MeshStandardMaterial>();

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
  if (s.alphaLeaf) {
    m.map = leafTexture();
    m.alphaTest = 0.5;
    // keep shading on both sides of the card lit like the crown, not dark on the back face
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
  if (set.map !== undefined && !SPECS[key].alphaLeaf) {
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
  for (let i = 0; i < 46; i++) {
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
