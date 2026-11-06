// Where the build ghost starts when a sheet's "Naprawa" opens the build tool (granary by a full yard, a second
// producer by a shared one). Pure read of the sim (validatePlace); no DOM, so the headless balance tools use it too.
import { BUILDINGS, cutsDiagonalRoad, gateCell, missionSiteHint, rankGated, suggestLinkForSite, validatePlace, type BuildingType, type World } from '../sim/index';

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
  // D-266: in the free valley (built up around the castle late in the game) the ghost prefers a site a road can
  // reach; the first valid site is the fallback (missions keep it as before)
  let first: Site | null = null;
  const linked = rankGated(world);
  for (let r = 1; r <= 10; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = ox + dx, y = oy + dy;
      if (x < 1 || y < 1 || x + def.w >= W || y + def.h >= H) continue;
      for (let f = 0; f < 4; f++) {
        if (!fits(x, y, f)) continue;
        const s = { x, y, facing: f, hint: false };
        if (!linked || siteLinked(world, type, s)) return s;
        first ??= s;
      }
    }
  }
  return first;
}

/**
 * D-266: a road can reach this site's gate — a road cell next to it (the gate is laid as road on placement), or a link
 * the gap finder would build (suggestLinkForSite). Pure read.
 */
const linkMemo = new WeakMap<World, { key: string; m: Map<string, boolean> }>();
export function siteLinked(world: World, type: BuildingType, s: { x: number; y: number; facing: number }): boolean {
  // kept until the network or the building count changes (the cards ask every frame, the ghost on every pick)
  const key = `${world.state.netVersion}|${world.state.buildings.length}`;
  let memo = linkMemo.get(world);
  if (!memo || memo.key !== key) linkMemo.set(world, (memo = { key, m: new Map() }));
  const q = `${type}|${s.x}|${s.y}|${s.facing}`;
  const hit = memo.m.get(q);
  if (hit !== undefined) return hit;
  const ok = linkedNow(world, type, s);
  memo.m.set(q, ok);
  return ok;
}

function linkedNow(world: World, type: BuildingType, s: { x: number; y: number; facing: number }): boolean {
  const def = BUILDINGS[type], W = world.terrain.w, H = world.terrain.h, roads = world.state.roads;
  const gate = gateCell(world, s.x, s.y, def.w, def.h, s.facing);
  const foot: number[] = [];
  for (let y = s.y; y < s.y + def.h; y++) for (let x = s.x; x < s.x + def.w; x++) foot.push(y * W + x);
  const gx = gate % W, gy = (gate - gx) / W;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = gx + dx, y = gy + dy;
    if ((!dx && !dy) || x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = y * W + x;
    if (!roads[i] || foot.includes(i)) continue;
    // a diagonal step needs both corner cells free of the new footprint (the network's own rule for buildings)
    if (dx && dy && (foot.includes(gy * W + x) || foot.includes(y * W + gx))) continue;
    return true;
  }
  return suggestLinkForSite(world, type, gate, foot) !== null;
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
  // D-266: in the free valley only a site a road can reach counts (the card would name a building born cut off)
  const s = buildSite(world, type, near, true);
  const ok = s !== null && (!rankGated(world) || s.hint || siteLinked(world, type, s));
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
