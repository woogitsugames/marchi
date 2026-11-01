// Terrain splat textures packed into three DataArrayTextures (albedo / normal / ORM), one layer
// per ground material. Arrays keep the terrain shader at 3 samplers regardless of layer count
// (mobile GPUs often expose only 16 texture units). Layers are loaded asynchronously from the
// CC0 sets in public/assets/textures; until they arrive, flat palette colours are used.
import {
  DataArrayTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  UnsignedByteType,
  RGBAFormat,
} from 'three';

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

export interface TerrainTextureSet {
  albedo: DataArrayTexture;
  normal: DataArrayTexture;
  orm: DataArrayTexture;
}

function makeArray(size: number, data: Uint8Array, srgb: boolean, mips: boolean): DataArrayTexture {
  const t = new DataArrayTexture(data, size, size, TERRAIN_LAYERS.length);
  t.format = RGBAFormat;
  t.type = UnsignedByteType;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = mips ? LinearMipmapLinearFilter : LinearFilter;
  t.generateMipmaps = mips;
  t.anisotropy = 4;
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  t.needsUpdate = true;
  return t;
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

function texUrl(layer: string, map: string, size: number): string {
  const base = (import.meta.env?.BASE_URL ?? '/') as string;
  return `${base}assets/textures/${layer}/${map}${size === 1024 ? '' : '_' + size}.jpg`;
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

/** Load all layers (512² each). Resolves with a complete set; layers that fail stay flat. */
export async function loadTerrainTextures(size = 512): Promise<TerrainTextureSet> {
  const n = TERRAIN_LAYERS.length;
  const per = size * size * 4;
  const maps = ['albedo', 'normal', 'orm'] as const;
  const bufs = maps.map(() => new Uint8Array(per * n));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d canvas unavailable');
  for (let l = 0; l < n; l++) {
    const layer = TERRAIN_LAYERS[l]!;
    for (let m = 0; m < maps.length; m++) {
      const buf = bufs[m]!;
      try {
        const px = await loadPixels(texUrl(layer, maps[m]!, size), size, ctx);
        buf.set(px, l * per);
      } catch {
        // flat fallback for this layer/map
        const fill = m === 0 ? [...FLAT[layer], 255] : m === 1 ? [128, 128, 255, 255] : [255, 235, 0, 255];
        for (let i = 0; i < size * size; i++) buf.set(fill, l * per + i * 4);
      }
    }
  }
  return {
    albedo: makeArray(size, bufs[0]!, true, true),
    normal: makeArray(size, bufs[1]!, false, true),
    orm: makeArray(size, bufs[2]!, false, true),
  };
}
