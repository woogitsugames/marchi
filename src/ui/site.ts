// Where the build ghost starts when a sheet's "Naprawa" opens the build tool (granary by a full yard, a second
// producer by a shared one). Pure read of the sim (validatePlace); no DOM, so the headless balance tools use it too.
import {
  BUILDINGS, MAX_GRADE, cutsDiagonalRoad, gateCell, grade, missionSiteHint, net, rankGated, reachable, suggestLinkForSite, validatePlace,
  type BuildingType, type World,
} from '../sim/index';
import { memoryWorld } from './readWorld';

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
/** Work counters for tests/ui-read-budget.test.ts (D-751): siteExists and siteLinked answers computed, not memoized. */
export const siteStats = { sites: 0, links: 0 };

const linkMemo = new WeakMap<World, { key: string; m: Map<string, boolean> }>();
export function siteLinked(world: World, type: BuildingType, s: { x: number; y: number; facing: number }): boolean {
  // kept until the network or the building count changes (the cards ask every frame, the ghost on every pick)
  const key = `${world.state.netVersion}|${world.state.buildings.length}`;
  let memo = linkMemo.get(world);
  if (!memo || memo.key !== key) linkMemo.set(world, (memo = { key, m: new Map() }));
  const q = `${type}|${s.x}|${s.y}|${s.facing}`;
  const hit = memo.m.get(q) ?? ownerLinked(world, key, q);
  if (hit !== undefined) { memo.m.set(q, hit); return hit; }
  siteStats.links++;
  const ok = linkedNow(world, type, s);
  memo.m.set(q, ok);
  return ok;
}

/**
 * D-751: a paused reading copy (D-672) starts with empty memos, so the first frame after a command in pause redid every
 * site search the world had answered (the grow / rank cards' anchors: 0.1–0.9 ms in the valley). The answer depends only
 * on what the key holds — roads and buildings (both bump the network version), the building count, the terrain — so the
 * real world's entry under the same key is the copy's answer too. Read only: the copy never writes the world's memo.
 */
function ownerLinked(world: World, key: string, q: string): boolean | undefined {
  const owner = memoryWorld(world);
  if (owner === world) return undefined;
  const m = linkMemo.get(owner);
  return m && m.key === key ? m.m.get(q) : undefined;
}

function linkedNow(world: World, type: BuildingType, s: { x: number; y: number; facing: number }): boolean {
  const def = BUILDINGS[type], W = world.terrain.w, H = world.terrain.h, roads = world.state.roads;
  const gate = gateCell(world, s.x, s.y, def.w, def.h, s.facing);
  const foot: number[] = [];
  for (let y = s.y; y < s.y + def.h; y++) for (let x = s.x; x < s.x + def.w; x++) foot.push(y * W + x);
  const gx = gate % W, gy = (gate - gx) / W;
  // D-269: the neighbouring road counts only as the network would drive it (network.hasEdge: no building on it, a
  // diagonal step's corners free of every building, the grade) and only when it joins the stable's roads — an orphan
  // stretch or a corner walled in by an older building left the brewery born cut off (card-10 seed 1304)
  const occ = net(world).occupied, stable = world.state.buildings.find((b) => b.type === 'stable');
  const free = (c: number): boolean => !foot.includes(c) && occ[c] === -1;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = gx + dx, y = gy + dy;
    if ((!dx && !dy) || x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = y * W + x;
    if (!roads[i] || !free(i)) continue;
    if (dx && dy && (!free(gy * W + x) || !free(y * W + gx))) continue;
    if (Math.abs(grade(world.terrain, gate, i)) > MAX_GRADE + 1e-9) continue;
    if (stable && !reachable(world, stable.gate, i)) continue;
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
  let c = m.get(q);
  // D-751: the real world's answer under the same key (network, building count, rank) for a paused reading copy
  if (!(c && c.key === key)) {
    const owner = memoryWorld(world);
    const oc = owner !== world ? siteMemo.get(owner)?.get(q) : undefined;
    if (oc && oc.key === key) m.set(q, (c = oc));
  }
  if (c && c.key === key) return c.ok;
  // D-266: in the free valley only a site a road can reach counts (the card would name a building born cut off)
  siteStats.sites++;
  const s = buildSite(world, type, near, true);
  const ok = s !== null && (!rankGated(world) || s.hint || siteLinked(world, type, s));
  m.set(q, { key, ok });
  return ok;
}

/**
 * D-390: the first of `ids` (buildings, in the caller's order of preference) by which the build ghost of `type` finds
 * a site (siteExists: in the free valley, one a road reaches), or -1. A card that names a building opens the ghost
 * there; with no such anchor it must not name it (D-175).
 */
export function siteAnchor(world: World, type: BuildingType, ids: Iterable<number>): number {
  for (const id of ids) if (siteExists(world, type, id)) return id;
  return -1;
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
