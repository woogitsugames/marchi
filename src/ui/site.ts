// Where the build ghost starts when a sheet's "Naprawa" opens the build tool (granary by a full yard, a second
// producer by a shared one). Pure read of the sim (validatePlace); no DOM, so the headless balance tools use it too.
import { BUILDINGS, missionSiteHint, validatePlace, type BuildingType, type World } from '../sim/index';

export interface Site { x: number; y: number; facing: number; /** The mission's authored site (D-107). */ hint: boolean }

/**
 * The mission's authored site for `type` when it is free (D-107, mission data, e.g. X's second woodcutter),
 * else the closest valid site around building `near` (rings of growing Chebyshev distance, up to 10 cells,
 * first facing that fits), or null.
 */
export function buildSite(world: World, type: BuildingType, near: number): Site | null {
  const h = missionSiteHint(world.state.mission.id, type);
  if (h && validatePlace(world, type, h.x, h.y, h.facing).ok) return { x: h.x, y: h.y, facing: h.facing, hint: true };
  const b = world.state.buildings.find((q) => q.id === near);
  if (!b) return null;
  const W = world.terrain.w, H = world.terrain.h, def = BUILDINGS[type];
  const ox = b.x + (b.w >> 1) - (def.w >> 1), oy = b.y + (b.h >> 1) - (def.h >> 1);
  for (let r = 1; r <= 10; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = ox + dx, y = oy + dy;
      if (x < 1 || y < 1 || x + def.w >= W || y + def.h >= H) continue;
      for (let f = 0; f < 4; f++) {
        if (validatePlace(world, type, x, y, f).ok) return { x, y, facing: f, hint: false };
      }
    }
  }
  return null;
}

/** Centre cell of a site's footprint (what the build ghost is moved to). */
export function siteCentre(world: World, type: BuildingType, s: Site): number {
  const def = BUILDINGS[type];
  return (s.y + (def.h >> 1)) * world.terrain.w + s.x + (def.w >> 1);
}
