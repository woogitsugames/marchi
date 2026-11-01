// Terrain splat textures packed into three DataArrayTextures (albedo / normal / ORM), one layer
// per ground material. Arrays keep the terrain shader at 3 samplers regardless of layer count
// (mobile GPUs often expose only 16 texture units). Layers are loaded asynchronously from the
// CC0 sets in public/assets/textures; until they arrive, flat palette colours are used.
//
// Tiers (D-20, D-21): 'low' decodes the 512 px JPGs into RGBA8 DataArrayTextures;
// 'high' / 'ultra' stitch the per-layer KTX2 files (2048 / 4096 albedo + ORM, 1024 UASTC normals)
// into CompressedArrayTextures so the GPU keeps them block-compressed (ETC2 / ASTC / BC*). A 4k
// RGBA8 array set would be ~1.3 GB of VRAM; compressed it is ~120 MB (ETC2 + ASTC).
// Without a KTX2 loader, or if a KTX2 map cannot be loaded, that map falls back to the 512 JPGs
// (the only JPGs the terrain sets ship).
import {
  CompressedArrayTexture,
  type CompressedTexture,
  type CompressedTextureMipmap,
  DataArrayTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  UnsignedByteType,
  RGBAFormat,
} from 'three';
import type { Quality } from './api';
import { NORMAL_TIER_SIZE, TIER_ANISOTROPY, anisotropyFor, getKtx2Loader, ultraUrl } from './textures';

/** Size of the terrain JPGs (low tier + the no-KTX2 fallback of every tier). */
export const TERRAIN_JPG_SIZE = 512;

export const TERRAIN_LAYERS = ['meadow', 'mud_track', 'forest_floor', 'riverbank', 'cobblestone'] as const;
export type TerrainLayer = (typeof TERRAIN_LAYERS)[number];
export const LAYER = { meadow: 0, mud: 1, forest: 2, bank: 3, cobble: 4 } as const;

/** Placeholder albedo per layer (sRGB) — palette colours from ART_DIRECTION. */
const FLAT: Record<TerrainLayer, [number, number, number]> = {
  meadow: [0x56, 0x60, 0x3f],
  mud_track: [0x5a, 0x4a, 0x39],
  forest_floor: [0x4a, 0x40, 0x30],
  riverbank: [0x6b, 0x66, 0x5a],
  cobblestone: [0x8a, 0x84, 0x78],
};

export type TerrainArray = DataArrayTexture | CompressedArrayTexture;

export interface TerrainTextureSet {
  albedo: TerrainArray;
  normal: TerrainArray;
  orm: TerrainArray;
  /** Albedo layer edge length in px (2 for the placeholder). */
  size?: number;
  /** Tier that was requested (undefined for the legacy numeric call / placeholder). */
  quality?: Quality;
  /** Estimated VRAM of the three arrays incl. mips, bytes. */
  gpuBytes?: number;
}

function makeArray(size: number, data: Uint8Array, srgb: boolean, mips: boolean, aniso = 4): DataArrayTexture {
  const t = new DataArrayTexture(data, size, size, TERRAIN_LAYERS.length);
  t.format = RGBAFormat;
  t.type = UnsignedByteType;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = mips ? LinearMipmapLinearFilter : LinearFilter;
  t.generateMipmaps = mips;
  t.anisotropy = aniso;
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  t.needsUpdate = true;
  return t;
}

function arrayBytes(t: TerrainArray): number {
  if ((t as CompressedArrayTexture).isCompressedArrayTexture) {
    return (t as CompressedArrayTexture).mipmaps.reduce((n, m) => n + (m as CompressedTextureMipmap).data.byteLength, 0);
  }
  const img = (t as DataArrayTexture).image;
  return Math.round((img.width * img.height * img.depth * 4 * (t.generateMipmaps ? 4 : 3)) / 3);
}

/** Free the GPU memory of a set (the arrays must not be bound any more). */
export function disposeTerrainTextures(t: TerrainTextureSet): void {
  t.albedo.dispose();
  t.normal.dispose();
  t.orm.dispose();
}

/** Tiny flat arrays used until the real textures are decoded. */
export function placeholderTerrainTextures(): TerrainTextureSet {
  const n = TERRAIN_LAYERS.length;
  const s = 2;
  const a = new Uint8Array(s * s * 4 * n), nr = new Uint8Array(s * s * 4 * n), o = new Uint8Array(s * s * 4 * n);
  TERRAIN_LAYERS.forEach((k, l) => {
    for (let i = 0; i < s * s; i++) {
      const p = (l * s * s + i) * 4;
      a.set([...FLAT[k], 255], p);
      nr.set([128, 128, 255, 255], p);
      o.set([255, 235, 0, 255], p);
    }
  });
  return { albedo: makeArray(s, a, true, false), normal: makeArray(s, nr, false, false), orm: makeArray(s, o, false, false) };
}

function texUrl(layer: string, map: string, size: number, ext = 'jpg'): string {
  const base = (import.meta.env?.BASE_URL ?? '/') as string;
  return `${base}assets/textures/${layer}/${map}${size === 1024 ? '' : '_' + size}.${ext}`;
}

async function loadPixels(url: string, size: number, ctx: CanvasRenderingContext2D): Promise<Uint8ClampedArray> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`texture ${url}: ${res.status}`);
  const blob = await res.blob();
  let src: CanvasImageSource;
  try {
    src = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  } catch {
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode();
    src = img;
  }
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(src, 0, 0, size, size);
  if ('close' in src && typeof src.close === 'function') src.close();
  return ctx.getImageData(0, 0, size, size).data;
}

const MAPS = ['albedo', 'normal', 'orm'] as const;
type MapKind = (typeof MAPS)[number];
const FILL: Record<MapKind, (l: TerrainLayer) => number[]> = {
  albedo: (l) => [...FLAT[l], 255],
  normal: () => [128, 128, 255, 255],
  orm: () => [255, 235, 0, 255],
};

/** Decode one map of every layer from JPG into an RGBA8 array (layers that fail stay flat). */
async function loadJpgArray(map: MapKind, size: number, ctx: CanvasRenderingContext2D, aniso: number): Promise<DataArrayTexture> {
  const n = TERRAIN_LAYERS.length;
  const per = size * size * 4;
  const buf = new Uint8Array(per * n);
  for (let l = 0; l < n; l++) {
    const layer = TERRAIN_LAYERS[l]!;
    try {
      buf.set(await loadPixels(texUrl(layer, map, size), size, ctx), l * per);
    } catch {
      const fill = FILL[map](layer);
      for (let i = 0; i < size * size; i++) buf.set(fill, l * per + i * 4);
    }
  }
  return makeArray(size, buf, map === 'albedo', true, aniso);
}

function jpgContext(size: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d canvas unavailable');
  return ctx;
}

/**
 * Load one KTX2 file per layer and stitch them into a CompressedArrayTexture (mip level i of the
 * array = mip level i of every layer, concatenated). All layers must share size, mip count and
 * transcoded format — true for files from tools/textures/ktx.mjs with the same settings.
 */
async function loadKtx2Array(map: MapKind, size: number, aniso: number): Promise<CompressedArrayTexture> {
  const loader = getKtx2Loader();
  if (!loader) throw new Error('KTX2 loader not initialised');
  const url = (l: TerrainLayer) => {
    if (size !== 4096) return texUrl(l, map, size, 'ktx2');
    const u = map === 'normal' ? null : ultraUrl(l, map);
    if (!u) throw new Error('ultra pack not set (setUltraBase)');
    return u;
  };
  const urls = TERRAIN_LAYERS.map(url);
  const texs = (await Promise.all(urls.map((u) => loader.loadAsync(u)))) as unknown as CompressedTexture[];
  try {
    const t0 = texs[0]!;
    const levels = t0.mipmaps as CompressedTextureMipmap[];
    for (const t of texs) {
      const mm = t.mipmaps as CompressedTextureMipmap[];
      if (t.format !== t0.format || t.type !== t0.type || mm.length !== levels.length || mm[0]!.width !== levels[0]!.width) {
        throw new Error(`terrain ${map}: KTX2 layers differ in size / format`);
      }
    }
    const mipmaps = levels.map((lv, i) => {
      const parts = texs.map((t) => (t.mipmaps as CompressedTextureMipmap[])[i]!.data);
      const total = parts.reduce((n, p) => n + p.length, 0);
      const Ctor = parts[0]!.constructor as new (n: number) => typeof parts[0];
      const data = new Ctor(total);
      let off = 0;
      for (const p of parts) { (data as Uint8Array).set(p as Uint8Array, off); off += p.length; }
      return { data, width: lv.width, height: lv.height } as CompressedTextureMipmap;
    });
    const arr = new CompressedArrayTexture(mipmaps, levels[0]!.width, levels[0]!.height, TERRAIN_LAYERS.length, t0.format, t0.type);
    arr.colorSpace = map === 'albedo' ? SRGBColorSpace : NoColorSpace;
    arr.wrapS = arr.wrapT = RepeatWrapping;
    arr.magFilter = LinearFilter;
    arr.minFilter = mipmaps.length > 1 ? LinearMipmapLinearFilter : LinearFilter;
    arr.generateMipmaps = false;
    arr.anisotropy = aniso;
    arr.needsUpdate = true;
    return arr;
  } finally {
    for (const t of texs) t.dispose();
  }
}

/**
 * Load all terrain layers.
 *  - `loadTerrainTextures('ultra' | 'high')`: KTX2 compressed arrays (4096 / 2048 albedo + ORM,
 *    1024 normals). Ultra reads the 4096 files from the pack set with setUltraBase(); without it
 *    (or on any 4K error) it uses the 2048 files. Any map whose KTX2 fails (or no KTX2 loader)
 *    falls back to the 512 JPGs.
 *  - `loadTerrainTextures('low')`: 512 JPGs as RGBA8 arrays.
 *  - `loadTerrainTextures(512)` (legacy): JPGs at that size, anisotropy 4 (only 512 JPGs ship).
 * Resolves with a complete set; layers that fail stay flat. The caller owns the result
 * (TerrainView.setTextures takes it over; otherwise free it with disposeTerrainTextures).
 */
export async function loadTerrainTextures(sizeOrQuality: number | Quality = TERRAIN_JPG_SIZE): Promise<TerrainTextureSet> {
  if (typeof sizeOrQuality === 'number') {
    const size = sizeOrQuality;
    const ctx = jpgContext(size);
    const [albedo, normal, orm] = [
      await loadJpgArray('albedo', size, ctx, 4),
      await loadJpgArray('normal', size, ctx, 4),
      await loadJpgArray('orm', size, ctx, 4),
    ];
    return { albedo, normal, orm, size, gpuBytes: arrayBytes(albedo) + arrayBytes(normal) + arrayBytes(orm) };
  }
  const quality: Quality = sizeOrQuality in TIER_ANISOTROPY ? sizeOrQuality : 'high';
  const aniso = anisotropyFor(quality);
  let ctx: CanvasRenderingContext2D | null = null;
  const jpg = (map: MapKind) => loadJpgArray(map, TERRAIN_JPG_SIZE, (ctx ??= jpgContext(TERRAIN_JPG_SIZE)), aniso);
  const one = async (map: MapKind): Promise<TerrainArray> => {
    if (quality === 'low' || !getKtx2Loader()) return jpg(map);
    const sizes = map === 'normal' ? [NORMAL_TIER_SIZE] : quality === 'ultra' && ultraUrl('meadow', 'albedo') ? [4096, 2048] : [2048];
    for (const s of sizes) {
      try {
        return await loadKtx2Array(map, s, aniso);
      } catch (err) {
        console.warn(`[terrainTextures] KTX2 ${map} ${s} failed, trying a smaller fallback`, err);
      }
    }
    return jpg(map);
  };
  // Sequential: keeps the transient transcoded data (~56 MB per 4k ETC2 map) bounded.
  const albedo = await one('albedo');
  const normal = await one('normal');
  const orm = await one('orm');
  const gpuBytes = arrayBytes(albedo) + arrayBytes(normal) + arrayBytes(orm);
  const albedoSize = (albedo as { image: { width: number } }).image.width;
  return { albedo, normal, orm, size: albedoSize, quality, gpuBytes };
}
