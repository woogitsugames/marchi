// Render data that depends only on the ground (D-282): the terrain chunks, the water strip and the apron trees are
// pure functions of the terrain's size, corner heights, water cells and water level (Heightfield reads nothing else).
// A world change rebuilds the view from scratch, and the usual path goes menu → mission → menu → next mission: the
// results of the last two grounds per kind are kept (the menu valley's and the mission's) and handed out again when a
// world has one of those grounds — compared value for value, not by a hash (missions II/IV/VII and III/X/XII–XV share a
// ground under different map ids). Results are treated as read-only by their users.
import type { Terrain } from '../sim/index';

interface Slot {
  t: Terrain;
  value: unknown;
}

/** Grounds kept per kind: the current one and the one before (most recent first). */
const KEEP = 2;
const slots = new Map<string, Slot[]>();

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

/** `build()` for this ground, or the value kept from an earlier build of this kind on the same ground. */
export function groundMemo<T>(kind: string, t: Terrain, build: () => T): T {
  let list = slots.get(kind);
  if (!list) slots.set(kind, (list = []));
  const i = list.findIndex((s) => sameGround(s.t, t));
  if (i >= 0) {
    const s = list.splice(i, 1)[0]!;
    s.t = t; // the next comparison against this world's terrain is by identity
    list.unshift(s);
    return s.value as T;
  }
  const value = build();
  list.unshift({ t, value });
  if (list.length > KEEP) list.length = KEEP;
  return value;
}

/** Forget every kept result (tests, probes). */
export function clearGroundMemo(): void {
  slots.clear();
}
