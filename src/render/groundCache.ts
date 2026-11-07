// Render data that depends only on the ground (D-282): the terrain chunks, the water strip and the apron trees are
// pure functions of the terrain's size, corner heights, water cells and water level (Heightfield reads nothing else).
// The menu valley and missions I / the free valley share one ground, and a world change rebuilds the view from
// scratch, so the last result per kind is kept and handed out again when the next world has the same ground —
// compared value for value, not by a hash. Results are treated as read-only by their users.
import type { Terrain } from '../sim/index';

interface Slot {
  t: Terrain;
  value: unknown;
}

const slots = new Map<string, Slot>();

/** Do two terrains give the same Heightfield (size, water level, corner heights, water cells)? */
export function sameGround(a: Terrain, b: Terrain): boolean {
  if (a === b) return true;
  if (a.w !== b.w || a.h !== b.h || !Object.is(a.waterLevel, b.waterLevel)) return false;
  const ca = a.corners, cb = b.corners, wa = a.water, wb = b.water;
  if (ca.length !== cb.length || wa.length !== wb.length) return false;
  for (let i = 0; i < ca.length; i++) if (!Object.is(ca[i], cb[i])) return false;
  for (let i = 0; i < wa.length; i++) if (wa[i] !== wb[i]) return false;
  return true;
}

/** `build()` for this ground, or the value kept from the last build of this kind on the same ground. */
export function groundMemo<T>(kind: string, t: Terrain, build: () => T): T {
  const s = slots.get(kind);
  if (s && sameGround(s.t, t)) {
    s.t = t; // the next comparison against this world's terrain is by identity
    return s.value as T;
  }
  const value = build();
  slots.set(kind, { t, value });
  return value;
}

/** Forget every kept result (tests, probes). */
export function clearGroundMemo(): void {
  slots.clear();
}
