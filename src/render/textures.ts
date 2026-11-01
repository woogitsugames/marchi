// PBR texture manifest + loader. Files live in public/assets/textures/<name>/ (see docs/ASSETS.md).
//
// Per set: albedo (sRGB), normal (OpenGL / +Y, as three.js expects), orm (R = AO, G = roughness,
// B = 0). Three quality tiers (D-14):
//   low   — terrain sets 512 px, other sets 1024 px: KTX2 (ETC1S) albedo/orm + JPG normals.
//   high  — 2048 px: KTX2 ETC1S albedo/orm + KTX2 UASTC normals. Anisotropy min(8, GPU max).
//   ultra — 4096 px albedo/orm (bark stays 2048) + the same 2048 UASTC normals.
//           Anisotropy min(16, GPU max). The 4096 files are NOT in the APK / public/ (D-17):
//           they form a downloadable pack (repo: assets-ultra/, manifest.json) whose location is
//           handed in at runtime with setUltraBase(). Without it, or if a 4K file fails, 'ultra'
//           uses the 2048 files from the APK.
// All KTX2 files carry their own mip chain and are encoded Y-flipped so they match the default
// flipY = true orientation of the JPGs. They are transcoded to a GPU block format (ETC2 / ASTC /
// BC*) — 2k / 4k textures are never uploaded as uncompressed RGBA unless the GPU has no
// compressed format at all. JPGs exist only at 1024 / 512 px: without a KTX2 loader (or when a
// KTX2 file fails) every tier falls back to them.
import {
  DataTexture,
  LinearMipmapLinearFilter,
  LinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import type { Quality } from './api';

export type TextureName =
  | 'meadow'
  | 'mud_track'
  | 'cobblestone'
  | 'riverbank'
  | 'forest_floor'
  | 'wood_planks'
  | 'thatch'
  | 'fieldstone_wall'
  | 'bark'
  | 'plaster_daub';

export interface PbrPaths {
  /** JPG fallbacks (1024 or 512 px). */
  albedo: string;
  normal: string;
  orm: string;
  /** KTX2 versions, preferred when a KTX2 loader is configured. */
  albedoKtx2?: string;
  ormKtx2?: string;
  normalKtx2?: string;
  /** Tried before the JPG when the first KTX2 fails (ultra: the 2048 file shipped in the APK). */
  albedoKtx2Fallback?: string;
  ormKtx2Fallback?: string;
  /** Edge length in px of the KTX2 albedo / orm (the JPG fallbacks may be smaller). */
  size?: number;
}

export interface TextureEntry {
  /** Terrain splat layers: tileable, have 512 px low-quality variants. */
  terrain: boolean;
  /** Real-world edge length of one tile in metres (from the source scan). */
  tileMetres: number;
  /** Largest albedo / orm size (4096 = in the downloadable ultra pack, or 2048 for bark). */
  maxSize: number;
  high: PbrPaths;
  low: PbrPaths;
}

const BASE = `${import.meta.env.BASE_URL}assets/textures/`;
const TRANSCODER_PATH = `${import.meta.env.BASE_URL}vendor/basis/`;

/** Anisotropic filtering cap per tier (clamped to the GPU maximum in initTextureLoaders). */
export const TIER_ANISOTROPY: Readonly<Record<Quality, number>> = { low: 2, high: 8, ultra: 16 };
/** Albedo / ORM edge length per tier for the terrain array textures. */
export const TERRAIN_TIER_SIZE: Readonly<Record<Quality, number>> = { low: 512, high: 2048, ultra: 4096 };
/** Normal maps ship at 2048 for high and ultra (see D-14: 4k normals cost 10–16 MB each). */
export const NORMAL_TIER_SIZE = 2048;

const sfx = (size: number) => (size === 1024 ? '' : `_${size}`);

function legacy(name: TextureName, size: 512 | 1024): PbrPaths {
  const dir = `${BASE}${name}/`;
  const s = sfx(size);
  return {
    albedo: `${dir}albedo${s}.jpg`,
    normal: `${dir}normal${s}.jpg`,
    orm: `${dir}orm${s}.jpg`,
    albedoKtx2: `${dir}albedo${s}.ktx2`,
    ormKtx2: `${dir}orm${s}.ktx2`,
    size,
  };
}

function tier(name: TextureName, size: number): PbrPaths {
  const dir = `${BASE}${name}/`;
  return {
    ...legacy(name, 1024),
    albedoKtx2: `${dir}albedo${sfx(size)}.ktx2`,
    ormKtx2: `${dir}orm${sfx(size)}.ktx2`,
    normalKtx2: `${dir}normal${sfx(NORMAL_TIER_SIZE)}.ktx2`,
    size,
  };
}

function entry(name: TextureName, terrain: boolean, tileMetres: number, maxSize = 4096): TextureEntry {
  return {
    terrain,
    tileMetres,
    maxSize,
    high: tier(name, Math.min(2048, maxSize)),
    low: legacy(name, terrain ? 512 : 1024),
  };
}

export const TEXTURES: Readonly<Record<TextureName, TextureEntry>> = {
  meadow: entry('meadow', true, 2.0),
  mud_track: entry('mud_track', true, 1.3),
  cobblestone: entry('cobblestone', true, 2.0),
  riverbank: entry('riverbank', true, 2.9),
  forest_floor: entry('forest_floor', true, 2.3),
  wood_planks: entry('wood_planks', false, 2.0),
  thatch: entry('thatch', false, 2.5),
  fieldstone_wall: entry('fieldstone_wall', false, 2.0),
  bark: entry('bark', false, 1.0, 2048),
  plaster_daub: entry('plaster_daub', false, 1.8),
};

let ultraBase: string | null = null;

/**
 * Where the downloaded 4K pack lives: a URL / WebView-servable path of the folder that holds
 * `textures/<set>/<map>_4096.ktx2` (the root of assets-ultra/, same layout as its manifest
 * paths). null = pack not installed: 'ultra' then loads the 2048 files. Already-loaded ultra
 * sets are dropped from the cache (call disposeTextures() + reload to apply to a live scene).
 */
export function setUltraBase(url: string | null): void {
  const next = url ? (url.endsWith('/') ? url : `${url}/`) : null;
  if (next === ultraBase) return;
  ultraBase = next;
  for (const k of [...cache.keys()]) if (k.includes(':ultra:')) cache.delete(k);
}

export function getUltraBase(): string | null {
  return ultraBase;
}

/** URL of a 4K file in the ultra pack, or null when the pack is not set / the set has no 4K. */
export function ultraUrl(name: TextureName, map: 'albedo' | 'orm'): string | null {
  if (!ultraBase || TEXTURES[name].maxSize < 4096) return null;
  return `${ultraBase}textures/${name}/${map}_4096.ktx2`;
}

/** Paths for a set at a quality tier ('high' for unknown values, e.g. an old saved pref). */
export function texturePaths(name: TextureName, quality: Quality): PbrPaths {
  const e = TEXTURES[name];
  if (quality === 'low') return e.low;
  if (quality !== 'ultra') return e.high;
  const a = ultraUrl(name, 'albedo'), o = ultraUrl(name, 'orm');
  if (!a || !o) return e.high;
  return {
    ...e.high,
    albedoKtx2: a,
    ormKtx2: o,
    albedoKtx2Fallback: e.high.albedoKtx2,
    ormKtx2Fallback: e.high.ormKtx2,
    size: 4096,
  };
}

export interface PbrSet {
  map: Texture;
  normalMap: Texture;
  roughnessMap: Texture;
  /** Same texture object as roughnessMap (ORM packing: AO in R, roughness in G). */
  aoMap?: Texture;
}

export interface PbrLoadOptions {
  /**
   * false = do not download the albedo; `map` is then a shared 1×1 white texture. Model
   * materials take their colour from vertex colours and only use normal + ORM.
   */
  albedo?: boolean;
}

const jpgLoader = new TextureLoader();
let ktx2Loader: KTX2Loader | null = null;
let maxAnisotropy = 4;
const cache = new Map<string, Promise<PbrSet>>();
let white: DataTexture | null = null;

/**
 * Call once after the renderer exists. Enables KTX2 (Basis) textures and reads the GPU's
 * anisotropy limit. Without this call, loadPbrSet uses the 1k/512 JPG files only.
 */
export function initTextureLoaders(renderer: WebGLRenderer): void {
  maxAnisotropy = Math.max(1, renderer.capabilities.getMaxAnisotropy());
  if (!ktx2Loader) {
    ktx2Loader = new KTX2Loader().setTranscoderPath(TRANSCODER_PATH).detectSupport(renderer);
  }
}

/** The shared KTX2 loader (null before initTextureLoaders). Used by terrainTextures. */
export function getKtx2Loader(): KTX2Loader | null {
  return ktx2Loader;
}

/** Anisotropy for a tier: min(tier cap, GPU max). */
export function anisotropyFor(quality: Quality): number {
  return Math.min(TIER_ANISOTROPY[quality] ?? TIER_ANISOTROPY.high, maxAnisotropy);
}

function setup(tex: Texture, srgb: boolean, aniso: number): Texture {
  tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.anisotropy = aniso;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  // JPGs get GPU-generated mips; KTX2 files carry their own mip chain.
  if (!(tex as { isCompressedTexture?: boolean }).isCompressedTexture) tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

async function loadOne(jpg: string, ktx2: string | undefined, srgb: boolean, aniso: number, ktx2Fallback?: string): Promise<Texture> {
  for (const url of [ktx2, ktx2Fallback]) {
    if (!url || !ktx2Loader) continue;
    try {
      return setup(await ktx2Loader.loadAsync(url), srgb, aniso);
    } catch (err) {
      console.warn(`[textures] KTX2 failed, trying the next fallback: ${url}`, err);
    }
  }
  return setup(await jpgLoader.loadAsync(jpg), srgb, aniso);
}

function whiteTexture(): DataTexture {
  if (!white) {
    white = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.colorSpace = SRGBColorSpace;
    white.needsUpdate = true;
  }
  return white;
}

/**
 * Load (and cache) one PBR set. Textures are shared between callers: set `repeat` on a
 * clone (`tex.clone()`) if a material needs a different tiling, and do not dispose them
 * directly — use disposeTextures(). Quality 'ultra' / 'high' / 'low' picks the tier; any other
 * value is treated as 'high'.
 */
export function loadPbrSet(name: TextureName, quality: Quality, opts: PbrLoadOptions = {}): Promise<PbrSet> {
  const withAlbedo = opts.albedo !== false;
  const key = `${name}:${quality}:${withAlbedo ? 'a' : '-'}:${quality === 'ultra' ? ultraBase ?? '' : ''}`;
  let p = cache.get(key);
  if (!p) {
    const src = texturePaths(name, quality);
    const aniso = anisotropyFor(quality);
    p = Promise.all([
      withAlbedo ? loadOne(src.albedo, src.albedoKtx2, true, aniso, src.albedoKtx2Fallback) : Promise.resolve<Texture>(whiteTexture()),
      loadOne(src.normal, src.normalKtx2, false, aniso),
      loadOne(src.orm, src.ormKtx2, false, aniso, src.ormKtx2Fallback),
    ]).then(([map, normalMap, orm]) => ({ map, normalMap, roughnessMap: orm, aoMap: orm }));
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

/** Dispose every cached texture (e.g. on quality switch or teardown). */
export async function disposeTextures(): Promise<void> {
  const sets = await Promise.allSettled([...cache.values()]);
  cache.clear();
  for (const s of sets) {
    if (s.status !== 'fulfilled') continue;
    if (s.value.map !== white) s.value.map.dispose();
    s.value.normalMap.dispose();
    s.value.roughnessMap.dispose();
  }
}

/**
 * Estimated GPU bytes of one square texture with a full mip chain (×4/3), for perf docs and
 * the HUD. bytesPerTexel: ETC2 RGB 0.5, ASTC 4×4 / BC7 / ETC2 RGBA 1, RGBA8 4.
 */
export function gpuBytes(size: number, bytesPerTexel: number, layers = 1): number {
  return Math.round(((size * size * bytesPerTexel * 4) / 3) * layers);
}
