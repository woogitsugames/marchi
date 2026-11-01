// PBR texture manifest + loader. Files live in public/assets/textures/<name>/ (see docs/ASSETS.md).
//
// Per set: albedo (sRGB), normal (OpenGL / +Y, as three.js expects), orm (R = AO, G = roughness,
// B = 0). Three quality tiers (D-20, sizes per D-22):
//   low   — model sets: 1024 ETC1S ORM + 1024 UASTC normal (KTX2). Terrain: 512 JPG arrays.
//   high  — 2048 ETC1S albedo / ORM + the same 1024 UASTC normals. Anisotropy min(8, GPU max).
//   ultra — 4096 albedo / ORM (bark stays 2048) + the same 1024 normals. Anisotropy min(16, GPU).
//           The 4096 files are NOT in the APK / public/ (D-17): they form a downloadable pack
//           (repo: assets-ultra/, manifest.json) whose location is handed in at runtime with
//           setUltraBase(). Without it, or if a 4K file fails, 'ultra' uses the 2048 files.
// Model materials take their colour from vertex colours, so the model sets ship no albedo at all
// (load them with { albedo: false }); the terrain sets ship albedo for the splat arrays.
// All KTX2 files carry their own mip chain. Model-set KTX2 are encoded Y-flipped to match the
// default flipY = true orientation of the JPGs; the terrain-set KTX2 are NOT flipped, because
// they are only used as array layers (src/render/terrainTextures.ts, uploaded unflipped like the
// canvas-decoded JPG arrays) — do not use loadPbrSet for terrain sets. KTX2 is transcoded to a GPU
// block format (ETC2 / ASTC / BC*): nothing above 1k is ever uploaded as uncompressed RGBA unless
// the GPU has no compressed format at all.
// JPG fallback (no KTX2 loader, or a KTX2 file fails): model sets 1024 normal + ORM JPG, terrain
// sets 512 JPG — one fallback path for every tier.
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
  /** JPG fallbacks (1024 or 512 px). Model sets have no albedo JPG (see PbrLoadOptions). */
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
  /** Terrain splat layers: array-only (unflipped KTX2), 512 px JPGs for low / fallback. */
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
/** KTX2 UASTC normals: 1024 for every tier that uses KTX2 (D-22: 2048 normals were 45 MB of the APK). */
export const NORMAL_TIER_SIZE = 1024;

const sfx = (size: number) => (size === 1024 ? '' : `_${size}`);

/** JPG fallbacks: 512 for terrain sets, 1024 (no suffix) for model sets. */
function jpgs(name: TextureName, terrain: boolean): Pick<PbrPaths, 'albedo' | 'normal' | 'orm'> {
  const dir = `${BASE}${name}/`;
  const s = terrain ? sfx(512) : '';
  return { albedo: `${dir}albedo${s}.jpg`, normal: `${dir}normal${s}.jpg`, orm: `${dir}orm${s}.jpg` };
}

function low(name: TextureName, terrain: boolean): PbrPaths {
  const dir = `${BASE}${name}/`;
  // terrain sets: the 512 JPGs are the low tier itself (arrays); model sets: 1k ETC1S ORM
  if (terrain) return { ...jpgs(name, true), size: 512 };
  return { ...jpgs(name, false), ormKtx2: `${dir}orm.ktx2`, normalKtx2: `${dir}normal${sfx(NORMAL_TIER_SIZE)}.ktx2`, size: 1024 };
}

function tier(name: TextureName, terrain: boolean, size: number): PbrPaths {
  const dir = `${BASE}${name}/`;
  return {
    ...jpgs(name, terrain),
    // model sets ship no albedo (vertex colours); only terrain sets have albedo_2048
    albedoKtx2: terrain ? `${dir}albedo${sfx(size)}.ktx2` : undefined,
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
    high: tier(name, terrain, Math.min(2048, maxSize)),
    low: low(name, terrain),
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
 * paths). null = pack not installed: 'ultra' then loads the 2048 files. The cache key includes
 * the base, so later loads pick it up; a live view reloads on its next setQuality('ultra')
 * (the view compares the base it loaded with getUltraBase()).
 */
export function setUltraBase(url: string | null): void {
  ultraBase = url ? (url.endsWith('/') ? url : `${url}/`) : null;
}

export function getUltraBase(): string | null {
  return ultraBase;
}

/**
 * URL of a 4K file in the ultra pack, or null when the pack is not set / the set has no 4K.
 * The pack holds orm_4096 for every set except bark, albedo_4096 only for the terrain sets.
 */
export function ultraUrl(name: TextureName, map: 'albedo' | 'orm'): string | null {
  const e = TEXTURES[name];
  if (!ultraBase || e.maxSize < 4096 || (map === 'albedo' && !e.terrain)) return null;
  return `${ultraBase}textures/${name}/${map}_4096.ktx2`;
}

/** Paths for a set at a quality tier ('high' for unknown values, e.g. an old saved pref). */
export function texturePaths(name: TextureName, quality: Quality): PbrPaths {
  const e = TEXTURES[name];
  if (quality === 'low') return e.low;
  if (quality !== 'ultra') return e.high;
  const a = ultraUrl(name, 'albedo') ?? undefined, o = ultraUrl(name, 'orm');
  if (!o) return e.high;
  return {
    ...e.high,
    albedoKtx2: a,
    ormKtx2: o,
    albedoKtx2Fallback: a ? e.high.albedoKtx2 : undefined,
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
interface CacheEntry {
  quality: Quality;
  /** Ultra base the set was loaded with ('' for low / high). */
  base: string;
  p: Promise<PbrSet>;
}
const cache = new Map<string, CacheEntry>();
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
 * directly — use disposeTextures() / disposeTexturesExcept(). Model sets have no albedo files:
 * load them with { albedo: false }. Quality 'ultra' / 'high' / 'low' picks the tier; any other
 * value is treated as 'high'.
 */
export function loadPbrSet(name: TextureName, q: Quality, opts: PbrLoadOptions = {}): Promise<PbrSet> {
  const quality: Quality = q in TIER_ANISOTROPY ? q : 'high';
  const withAlbedo = opts.albedo !== false;
  const base = quality === 'ultra' ? ultraBase ?? '' : '';
  const key = `${name}|${quality}|${withAlbedo ? 'a' : '-'}|${base}`;
  let p = cache.get(key)?.p;
  if (!p) {
    const src = texturePaths(name, quality);
    const aniso = anisotropyFor(quality);
    p = Promise.all([
      withAlbedo ? loadOne(src.albedo, src.albedoKtx2, true, aniso, src.albedoKtx2Fallback) : Promise.resolve<Texture>(whiteTexture()),
      loadOne(src.normal, src.normalKtx2, false, aniso),
      loadOne(src.orm, src.ormKtx2, false, aniso, src.ormKtx2Fallback),
    ]).then(([map, normalMap, orm]) => ({ map, normalMap, roughnessMap: orm, aoMap: orm }));
    const entry: CacheEntry = { quality, base, p };
    p.catch(() => { if (cache.get(key) === entry) cache.delete(key); });
    cache.set(key, entry);
  }
  return p;
}

function disposeSet(s: PbrSet): void {
  if (s.map !== white) s.map.dispose();
  s.normalMap.dispose();
  s.roughnessMap.dispose();
}

/** Dispose every cached texture (teardown). */
export async function disposeTextures(): Promise<void> {
  const sets = await Promise.allSettled([...cache.values()].map((e) => e.p));
  cache.clear();
  for (const s of sets) if (s.status === 'fulfilled') disposeSet(s.value);
}

/**
 * Dispose every cached set except those of `keep` (quality switch: call after the new tier's
 * sets are bound to the materials). For 'ultra', sets loaded with a different ultra base
 * (pack installed / removed since) are disposed too. In-flight loads are awaited first.
 */
export async function disposeTexturesExcept(keep: Quality): Promise<void> {
  const base = keep === 'ultra' ? ultraBase ?? '' : '';
  const drop = [...cache.entries()].filter(([, e]) => e.quality !== keep || e.base !== base);
  for (const [k] of drop) cache.delete(k);
  const sets = await Promise.allSettled(drop.map(([, e]) => e.p));
  for (const s of sets) if (s.status === 'fulfilled') disposeSet(s.value);
}

/**
 * Estimated GPU bytes of one square texture with a full mip chain (×4/3), for perf docs and
 * the HUD. bytesPerTexel: ETC2 RGB 0.5, ASTC 4×4 / BC7 / ETC2 RGBA 1, RGBA8 4.
 */
export function gpuBytes(size: number, bytesPerTexel: number, layers = 1): number {
  return Math.round(((size * size * bytesPerTexel * 4) / 3) * layers);
}
