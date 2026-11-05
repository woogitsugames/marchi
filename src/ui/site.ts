// Where the build ghost starts when a sheet's "Naprawa" opens the build tool (granary by a full yard, a second
// producer by a shared one). Pure read of the sim (validatePlace); no DOM, so the headless balance tools use it too.
import { BUILDINGS, cutsDiagonalRoad, missionSiteHint, validatePlace, type BuildingType, type World } from '../sim/index';

export interface Site { x: number; y: number; facing: number; /** The mission's authored site (D-107). */ hint: boolean }

/**
 * The mission's authored site for `type` when it is free (D-107, mission data, e.g. X's second woodcutter),
 * else the closest valid site around building `near` (rings of growing Chebyshev distance, up to 10 cells,
 * first facing that fits), or null.
 */
export function buildSite(world: World, type: BuildingType, near: number, anyCoins = false): Site | null {
  // anyCoins: a site that only lacks silver counts (the card names it; the sheet says how much is missing)
  const fits = (x: number, y: number, f: number): boolean => {
    const r = validatePlace(world, type, x, y, f);
    return r.ok || (anyCoins && r.err.k === 'NO_COINS');
  };
  const h = missionSiteHint(world.state.mission.id, type);
  if (h && fits(h.x, h.y, h.facing)) return { x: h.x, y: h.y, facing: h.facing, hint: true };
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
        if (fits(x, y, f)) return { x, y, facing: f, hint: false };
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

const siteMemo = new WeakMap<World, Map<string, { key: string; ok: boolean }>>();
/**
 * D-175 (research valley-ranks-2-3, F4): does the build ghost find any site for `type` by building `near`, silver
 * aside? The rank card skips a building it could only offer as a red ghost (seed 1304: no rock within 10 cells of
 * the castle). Kept per (type, near) until the network, the building count or the rank changes (the HUD asks every frame).
 */
export function siteExists(world: World, type: BuildingType, near: number): boolean {
  let m = siteMemo.get(world);
  if (!m) siteMemo.set(world, (m = new Map()));
  const q = `${type}|${near}`, key = `${world.state.netVersion}|${world.state.buildings.length}|${world.state.town.rank}`;
  const c = m.get(q);
  if (c && c.key === key) return c.ok;
  const ok = buildSite(world, type, near, true) !== null;
  m.set(q, { key, ok });
  return ok;
}

/**
 * Which plain-words reason a BLOCKED placement at `cell` gets (the `place.*` key suffix). D-176: the corner of a
 * diagonal road step the footprint would cut (D-172) is told apart by the same pure check the sim runs, so the
 * ghost says "would cut the road" instead of the generic building/obstacle text. `rect`: x, y, w, h of the footprint.
 */
export function blockedWhy(world: World, cell: number, gate: number, foot: ReadonlySet<number>,
  rect: readonly [number, number, number, number]): 'gate' | 'cutsRoad' | 'water' | 'road' | 'building' {
  if (cell === gate && !foot.has(cell)) return 'gate';
  if (!world.state.roads[cell] && cutsDiagonalRoad(world, rect[0], rect[1], rect[2], rect[3]) === cell) return 'cutsRoad';
  if (world.terrain.water[cell]) return 'water';
  if (world.state.roads[cell]) return 'road';
  return 'building';
}
