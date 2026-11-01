// Golden terrain fingerprint. Saves do not store terrain: worldFromState() regenerates it from
// mapId + seed, so any change to the generator silently moves water, slopes and bridges under an
// old save. The save envelope keeps this hash and the loader compares it (see D-23).
import { hashString } from './hash';
import type { Terrain } from './types';

/** Bump the prefix if the hashed fields or the encoding change. */
export const TERRAIN_HASH_VERSION = 't1';

/**
 * Deterministic and cheap (one JSON pass over ~35k numbers for a 96x72 map). JSON.stringify prints
 * doubles as the shortest round-trip decimal, so the text is identical for identical floats.
 */
export function terrainHash(t: Terrain): string {
  const body = JSON.stringify([t.w, t.h, t.cellSize, t.waterLevel, t.corners, t.cellH, t.water, t.forest, t.field]);
  return TERRAIN_HASH_VERSION + '-' + hashString(body);
}
