// PBR texture manifest + loader. Files live in public/assets/textures/<name>/ (see docs/ASSETS.md).
//
// Per set: albedo (sRGB), normal (OpenGL / +Y, as three.js expects), orm (R = AO, G = roughness,
// B = 0). Albedo and ORM also ship as KTX2 (ETC1S, Y-flipped at encode time so they match the
// default flipY=true orientation of the JPGs). Normals are JPG only for now (UASTC normals were
// ~1.1 MB each, see docs/ASSETS.md). Terrain sets have *_512 variants for low quality.
import {
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
  albedo: string;
  normal: string;
  orm: string;
  /** ETC1S KTX2 versions, preferred when a KTX2 loader is configured. */
  albedoKtx2?: string;
  ormKtx2?: string;
}

export interface TextureEntry {
  /** Terrain splat layers: tileable, have 512 px low-quality variants. */
  terrain: boolean;
  /** Real-world edge length of one tile in metres (from the source scan). */
  tileMetres: number;
  high: PbrPaths;
  low: PbrPaths;
}

const BASE = `${import.meta.env.BASE_URL}assets/textures/`;
const TRANSCODER_PATH = `${import.meta.env.BASE_URL}vendor/basis/`;
const MAX_ANISOTROPY = 4;

function paths(name: TextureName, suffix: string): PbrPaths {
  const dir = `${BASE}${name}/`;
  return {
    albedo: `${dir}albedo${suffix}.jpg`,
    normal: `${dir}normal${suffix}.jpg`,
    orm: `${dir}orm${suffix}.jpg`,
    albedoKtx2: `${dir}albedo${suffix}.ktx2`,
    ormKtx2: `${dir}orm${suffix}.ktx2`,
  };
}

function entry(name: TextureName, terrain: boolean, tileMetres: number): TextureEntry {
  const high = paths(name, '');
  return { terrain, tileMetres, high, low: terrain ? paths(name, '_512') : high };
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
  bark: entry('bark', false, 1.0),
  plaster_daub: entry('plaster_daub', false, 1.8),
};

export interface PbrSet {
  map: Texture;
  normalMap: Texture;
  roughnessMap: Texture;
  /** Same texture object as roughnessMap (ORM packing: AO in R, roughness in G). */
  aoMap?: Texture;
}

const jpgLoader = new TextureLoader();
let ktx2Loader: KTX2Loader | null = null;
let anisotropy = MAX_ANISOTROPY;
const cache = new Map<string, Promise<PbrSet>>();

/**
 * Call once after the renderer exists. Enables KTX2 (Basis) textures and caps anisotropy to
 * min(4, GPU max). Without this call, loadPbrSet uses the JPG files only.
 */
export function initTextureLoaders(renderer: WebGLRenderer): void {
  anisotropy = Math.min(MAX_ANISOTROPY, renderer.capabilities.getMaxAnisotropy());
  if (!ktx2Loader) {
    ktx2Loader = new KTX2Loader().setTranscoderPath(TRANSCODER_PATH).detectSupport(renderer);
  }
}

function setup(tex: Texture, srgb: boolean): Texture {
  tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.anisotropy = anisotropy;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  // JPGs get GPU-generated mips; KTX2 files carry their own mip chain.
  if (!(tex as { isCompressedTexture?: boolean }).isCompressedTexture) tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

async function loadOne(jpg: string, ktx2: string | undefined, srgb: boolean): Promise<Texture> {
  if (ktx2 && ktx2Loader) {
    try {
      return setup(await ktx2Loader.loadAsync(ktx2), srgb);
    } catch (err) {
      console.warn(`[textures] KTX2 failed, falling back to JPG: ${ktx2}`, err);
    }
  }
  return setup(await jpgLoader.loadAsync(jpg), srgb);
}

/**
 * Load (and cache) one PBR set. Textures are shared between callers: set `repeat` on a
 * clone (`tex.clone()`) if a material needs a different tiling, and do not dispose them
 * directly — use disposeTextures().
 */
export function loadPbrSet(name: TextureName, quality: Quality): Promise<PbrSet> {
  const key = `${name}:${quality}`;
  let p = cache.get(key);
  if (!p) {
    const src = quality === 'low' ? TEXTURES[name].low : TEXTURES[name].high;
    p = Promise.all([
      loadOne(src.albedo, src.albedoKtx2, true),
      loadOne(src.normal, undefined, false),
      loadOne(src.orm, src.ormKtx2, false),
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
    s.value.map.dispose();
    s.value.normalMap.dispose();
    s.value.roughnessMap.dispose();
  }
}
