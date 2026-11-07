// Mission definitions: map spec, pre-placed buildings and roads, contract.
import { freshValleyEvents } from './events';
import { GOODS, STATE_VERSION, TICK_HZ, emptyGoods, goodsOf } from './defs';
import { lineCells, place, spawnWagon } from './commands';
import { nextInt, seedRng } from './rng';
import { generateValley, type ValleySpec } from './terrain';
import { M2_VALLEY, M3_VALLEY, PROPOSED_MISSIONS } from './missions-proposed';
import { S2_MISSIONS } from './missions-s2';
import { PROPOSED_MISSIONS_7_9 } from './proposals/missions-7-9';
import { PROPOSED_MISSIONS_10_12 } from './proposals/missions-10-12';
import { M13_MISSION } from './proposals/m13';
import { MISSIONS_14_15 } from './proposals/missions-14-15';
import { M16_MISSION } from './proposals/m16';
import { freshMarket, freshTown } from './town';
import { freshTradePost, placeTradePost } from './tradePost';
import type { World } from './network';
import type { BuildingType, Good, GoodMap, RainSpell, SimState, Terrain } from './types';

export const VALLEY_W = 96;
export const VALLEY_H = 72;

export function valleySpec(seed: number): ValleySpec {
  return {
    w: VALLEY_W,
    h: VALLEY_H,
    seed,
    waterLevel: 10,
    spacing: 12,
    riverY: [29, 31, 34, 35.5, 35, 34, 35.5, 38, 40],
    riverHalfWidth: [2.2, 2.0, 1.8, 1.45, 1.35, 1.6, 2.0, 2.2, 2.4],
    hills: [
      { x: 78, y: 54, r: 18, h: 5 },
      { x: 8, y: 60, r: 14, h: 4 },
    ],
    northRidge: 9,
    southRidge: 64,
    forestNorthOf: 21,
    fields: [
      { x: 10, y: 44, w: 8, h: 12 },
      { x: 22, y: 50, w: 10, h: 8 },
    ],
  };
}

/** Map id -> valley spec for a seed. */
const MAP_SPECS: Record<string, (seed: number) => ValleySpec> = {
  valley1: valleySpec,
  'valley-m2': (seed) => ({ ...M2_VALLEY, seed }),
  'valley-m3': (seed) => ({ ...M3_VALLEY, seed }),
  // Mission IV reuses the mission II river (same generator input); own id so saves name their map.
  'valley-m4': (seed) => ({ ...M2_VALLEY, seed }),
  'valley-m5': (seed) => ({ ...M3_VALLEY, seed }),
  'valley-m6': (seed) => ({ ...M3_VALLEY, seed }),
  // Missions VII-IX reuse the mission II river, the original valley and the mission III valley.
  'valley-m7': (seed) => ({ ...M2_VALLEY, seed }),
  'valley-m8': (seed) => valleySpec(seed),
  'valley-m9': (seed) => ({ ...M3_VALLEY, seed }),
};

const terrainCache = new Map<string, Terrain>();

/** Known map id (own key only, so '__proto__' / 'constructor' are not maps). */
export function isMapId(mapId: string): boolean {
  return Object.prototype.hasOwnProperty.call(MAP_SPECS, mapId);
}

/** Grid size of a map without generating its terrain; null for an unknown map id. */
export function mapSize(mapId: string): { w: number; h: number } | null {
  if (!isMapId(mapId)) return null;
  const s = MAP_SPECS[mapId]!(0);
  return { w: s.w, h: s.h };
}

export function terrainFor(mapId: string, seed: number): Terrain {
  const key = mapId + ':' + seed;
  let t = terrainCache.get(key);
  if (!t) {
    const spec = isMapId(mapId) ? MAP_SPECS[mapId] : undefined;
    if (!spec) throw new Error('unknown map ' + mapId);
    t = generateValley(spec(seed));
    terrainCache.set(key, t);
  }
  return t;
}

interface Placement {
  type: BuildingType; x: number; y: number; facing: number; stock?: Partial<GoodMap>;
  /** Warehouse capacity override (mission VI's small granary). */
  cap?: number;
}

/** An authored build site (top-left cell and gate facing, as the `place` command takes them). */
export interface SiteHint { type: BuildingType; x: number; y: number; facing: number }

/** A contract tranche as authored: goods due by `dueMin` mission minutes. */
export interface TrancheDef { need: Partial<GoodMap>; dueMin: number }

/** Two castles (D-288): one castle's order; `name` keys its player-facing name (UI read only, never in the state). */
export interface CastleOrderDef extends TrancheDef { name: 'east' | 'north' }

export interface MissionDef {
  id: string;
  mapId: string;
  seed: number;
  coins: number;
  wagons: number;
  buildings: Placement[];
  /** Road polylines as waypoint lists [x,y][]. */
  roads: [number, number][][];
  /** Goods the castle orders (missing goods = 0), or null for no contract. */
  contract: Partial<GoodMap> | null;
  deadlineMin: number;
  star3Min: number;
  star2Min: number;
  /** Fixed weather instead of the seeded rain schedule. */
  rain?: RainSpell[];
  /** Authored roads keep their water cells (pre-built bridges). */
  roadsOverWater?: boolean;
  /** Ice windows (ticks): wooden bridges cannot be entered (mission IV). */
  ice?: RainSpell[];
  /** Contract in tranches (mission V). `contract` must equal their sum; the last dueMin is the deadline. */
  tranches?: TrancheDef[];
  /**
   * Two castles (mission XVI, D-288): one order per castle, in the order the castles stand in `buildings`, each due by
   * its own `dueMin` (one tranche). The first castle holds the main contract (`contract` must equal its need; its
   * deadline, star and end ticks are the mission's); the others become `state.mission.extraContracts`. Not combined
   * with `tranches`.
   */
  castles?: CastleOrderDef[];
  /** The castle buys goods (default: open when there is no contract). Test maps close it. */
  market?: boolean;
  /** Building types the player may place in this contract mission (D-28); omitted = none. Sandbox: rank-gated. */
  buildable?: BuildingType[];
  /**
   * Authored good sites for buildable types (D-107): where the lesson's building belongs. Read only by the UI
   * (the build ghost a "Naprawa" opens starts here when the site is free); never copied into the state.
   */
  siteHints?: SiteHint[];
  /**
   * Cobbles and stone bridges take stone from the granaries, which keep a stone reserve (mission VIII,
   * D-32). Copied into `state.mission.roadStone`; the free valley does this through rank gating.
   */
  roadStone?: boolean;
  /** The seasonal calendar runs (free valley, D-33): derived into World.seasons, never stored in the state. */
  seasons?: boolean;
}

/** Does this mission run the seasonal calendar? */
export function missionSeasons(missionId: string): boolean {
  return MISSIONS[missionId]?.seasons === true;
}

/** Building types the player may place in a mission, or 'ranked' for the sandbox (rank gating applies). */
export function missionBuildable(missionId: string): BuildingType[] | 'ranked' {
  if (missionId === 'sandbox') return 'ranked';
  return MISSIONS[missionId]?.buildable ?? [];
}

/**
 * Two castles (D-288): the authored name key of this castle ('east' / 'north'), or null (one castle, or not a castle
 * holding an order). UI read helper: the castles' orders follow `castles` in building order.
 */
export function castleNameKey(world: World, castleId: number): CastleOrderDef['name'] | null {
  const m = world.state.mission;
  const defs = MISSIONS[m.id]?.castles;
  if (!defs || !m.contract) return null;
  if (m.contract.castle === castleId) return defs[0]?.name ?? null;
  const i = (m.extraContracts ?? []).findIndex((c) => c.castle === castleId);
  return i >= 0 ? defs[i + 1]?.name ?? null : null;
}

/** The mission's authored site for this building type (D-107), or null. UI read helper; no sim effect. */
export function missionSiteHint(missionId: string, type: BuildingType): SiteHint | null {
  return MISSIONS[missionId]?.siteHints?.find((h) => h.type === type) ?? null;
}

/**
 * Read helper for the UI: demolishing this building is final in a contract mission — its type is not
 * on the mission's build list, so it can never stand again and the contract may become unwinnable.
 * The sim still allows the demolition (replays stay valid); the demolish tool asks for a second tap.
 */
export function demolishIsFinal(world: World, buildingId: number): boolean {
  const st = world.state;
  if (!st.mission.contract) return false;
  const b = st.buildings.find((x) => x.id === buildingId);
  if (!b || b.type === 'castle' || b.type === 'stable') return false; // the sim refuses these anyway
  const can = missionBuildable(st.mission.id);
  return can !== 'ranked' && !can.includes(b.type);
}

export const MISSIONS: Record<string, MissionDef> = {
  m1: {
    id: 'm1',
    mapId: 'valley1',
    seed: 1301,
    coins: 180,
    wagons: 2,
    buildings: [
      { type: 'woodcutter', x: 14, y: 13, facing: 0, stock: { wood: 2 } },
      { type: 'sawmill', x: 28, y: 20, facing: 0 },
      { type: 'stable', x: 46, y: 21, facing: 0 },
      { type: 'farm', x: 18, y: 46, facing: 2, stock: { grain: 3 } },
      { type: 'mill', x: 42, y: 37, facing: 0 },
      { type: 'bakery', x: 54, y: 46, facing: 2 },
      { type: 'warehouse', x: 62, y: 46, facing: 2 },
      { type: 'castle', x: 77, y: 50, facing: 3 },
    ],
    roads: [
      [[15, 15], [15, 24], [56, 24]],
      [[29, 22], [29, 24]],
      [[47, 23], [47, 24]],
      [[12, 44], [70, 44], [72, 46], [72, 52], [76, 52]],
      [[19, 45], [19, 44]],
      [[43, 39], [43, 44]],
    ],
    contract: { wood: 0, planks: 30, grain: 0, flour: 0, bread: 20 },
    deadlineMin: 12,
    star3Min: 9.25,
    star2Min: 10.75,
  },
  // Free valley (docs/design/sandbox.md §4.1): a settlement whose woodcutter and sawmill already
  // reach the castle market, so silver flows from the first minute. No contract, no deadline, no loss.
  sandbox: {
    id: 'sandbox',
    mapId: 'valley1',
    seed: 1301,
    coins: 260,
    wagons: 2,
    buildings: [
      { type: 'woodcutter', x: 14, y: 13, facing: 0, stock: { wood: 4 } },
      { type: 'sawmill', x: 16, y: 20, facing: 3, stock: { wood: 4, planks: 6 } },
      { type: 'stable', x: 46, y: 21, facing: 0 },
      { type: 'warehouse', x: 52, y: 21, facing: 0 },
      { type: 'castle', x: 60, y: 19, facing: 0 },
    ],
    roads: [
      [[15, 15], [15, 24], [62, 24]],
      [[47, 23], [47, 24]],
      [[53, 23], [53, 24]],
      [[62, 23], [62, 24]],
    ],
    contract: null,
    deadlineMin: 0,
    star3Min: 0,
    star2Min: 0,
    seasons: true,
  },
  // Test bench (not in the menu): the mission I layout without a contract and with a closed
  // market, i.e. the free valley as it was before the market (state v3). Tests and tools/bench use it.
  lab: {
    id: 'lab',
    mapId: 'valley1',
    seed: 1301,
    coins: 600,
    wagons: 4,
    buildings: [],
    roads: [],
    contract: null,
    deadlineMin: 0,
    star3Min: 0,
    star2Min: 0,
    market: false,
  },
};
MISSIONS.m2 = PROPOSED_MISSIONS.m2;
MISSIONS.m3 = PROPOSED_MISSIONS.m3;
MISSIONS.m4 = S2_MISSIONS.m4;
MISSIONS.m5 = S2_MISSIONS.m5;
MISSIONS.m6 = S2_MISSIONS.m6;
MISSIONS.m7 = PROPOSED_MISSIONS_7_9.m7;
MISSIONS.m8 = PROPOSED_MISSIONS_7_9.m8;
MISSIONS.m9 = PROPOSED_MISSIONS_7_9.m9;
MISSIONS.m10 = PROPOSED_MISSIONS_10_12.m10;
MISSIONS.m11 = PROPOSED_MISSIONS_10_12.m11;
MISSIONS.m12 = PROPOSED_MISSIONS_10_12.m12;
MISSIONS.m13 = M13_MISSION;
MISSIONS.m14 = MISSIONS_14_15.m14;
MISSIONS.m15 = MISSIONS_14_15.m15;
MISSIONS.m16 = M16_MISSION;
MISSIONS.lab!.buildings = MISSIONS.m1!.buildings;
MISSIONS.lab!.roads = MISSIONS.m1!.roads;

function rainSpells(rng: SimState['rng']): RainSpell[] {
  const out: RainSpell[] = [];
  let t = nextInt(rng, 150, 240) * TICK_HZ;
  for (let i = 0; i < 12; i++) {
    const len = nextInt(rng, 60, 130) * TICK_HZ;
    out.push({ start: t, end: t + len });
    t += len + nextInt(rng, 150, 330) * TICK_HZ;
  }
  return out;
}

export function buildMission(missionId: string, seedOverride?: number): { terrain: Terrain; state: SimState } {
  const def = MISSIONS[missionId];
  if (!def) throw new Error('unknown mission ' + missionId);
  const seed = seedOverride ?? def.seed;
  const terrain = terrainFor(def.mapId, seed);
  const rng = seedRng(seed);
  const n = terrain.w * terrain.h;
  const state: SimState = {
    version: STATE_VERSION,
    mapId: def.mapId,
    seed,
    tick: 0,
    rng,
    coins: def.coins,
    roads: new Array(n).fill(0),
    netVersion: 1,
    traffic: new Array(n).fill(0),
    buildings: [],
    wagons: [],
    nextId: 1,
    nextWagonN: 1,
    rain: [],
    ice: (def.ice ?? []).map((r) => ({ ...r })),
    mission: { id: def.id, contract: null, result: 'running', endTick: -1, roadStone: def.roadStone ?? false },
    ledger: { produced: emptyGoods(), consumed: emptyGoods(), destroyed: emptyGoods(), stallSeconds: {}, silverEarned: 0, sold: emptyGoods() },
    market: freshMarket(def.market ?? def.contract === null),
    town: freshTown(),
  };
  if (def.id === 'sandbox') state.valleyEvents = freshValleyEvents();
  state.rain = rainSpells(state.rng);
  if (def.rain) state.rain = def.rain.map((r) => ({ ...r }));
  const world: World = { terrain, state, cache: null, scratch: null };
  for (const p of def.buildings) {
    const r = place(world, p.type, p.x, p.y, p.facing, true);
    if (!r.ok) throw new Error(`mission ${def.id}: cannot place ${p.type} at ${p.x},${p.y}: ${JSON.stringify(r.err)}`);
    const b = state.buildings[state.buildings.length - 1]!;
    if (p.cap !== undefined) b.capOverride = p.cap;
    if (p.stock) {
      for (const [g, v] of Object.entries(p.stock) as [Good, number][]) {
        b.stock[g] += v;
        state.ledger.produced[g] += v; // initial stock counts as produced (conservation)
      }
    }
  }
  // the free valley's trading post (state v9, D-170): a map building after the map's own, the slice last in key order
  if (def.id === 'sandbox') state.tradePost = freshTradePost(placeTradePost(world));
  for (const poly of def.roads) {
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1]!, b = poly[i]!;
      for (const c of lineCells(terrain.w, a[1] * terrain.w + a[0], b[1] * terrain.w + b[0])) {
        if (!state.roads[c] && (def.roadsOverWater || !terrain.water[c])) state.roads[c] = 1;
      }
    }
  }
  state.netVersion++;
  const stable = state.buildings.find((b) => b.type === 'stable');
  if (stable) for (let i = 0; i < def.wagons; i++) spawnWagon(world, stable.id);
  const castle = state.buildings.find((b) => b.type === 'castle');
  if (def.contract && castle) {
    state.mission.contract = {
      need: goodsOf(def.contract),
      castle: castle.id,
      // ticks are integers (8.45 min * 600 is 5069.999… in floating point)
      deadlineTick: Math.round(def.deadlineMin * 60 * TICK_HZ),
      star3Tick: Math.round(def.star3Min * 60 * TICK_HZ),
      star2Tick: Math.round(def.star2Min * 60 * TICK_HZ),
      tranches: (def.tranches ?? []).map((t) => ({
        need: goodsOf(t.need), deadlineTick: Math.round(t.dueMin * 60 * TICK_HZ), doneTick: -1, missed: false,
      })),
    };
    if (def.tranches) {
      for (const g of GOODS) {
        let sum = 0;
        for (const t of def.tranches) sum += t.need[g] ?? 0;
        if (sum !== (def.contract[g] ?? 0)) throw new Error(`mission ${def.id}: tranches of ${g} sum to ${sum}, contract says ${def.contract[g]}`);
      }
    }
    if (def.castles) addCastleOrders(def, state);
  }
  return { terrain, state };
}

/**
 * Two castles (D-288): the main contract gets the first castle's deadline as its one tranche, every further castle
 * (in `buildings` order) an order of its own with one tranche; the mission clock (deadline, stars) stays the main one.
 */
function addCastleOrders(def: MissionDef, state: SimState): void {
  const orders = def.castles!, main = state.mission.contract!;
  const castles = state.buildings.filter((b) => b.type === 'castle');
  if (def.tranches) throw new Error(`mission ${def.id}: castles and tranches do not combine`);
  if (orders.length < 2 || castles.length !== orders.length) throw new Error(`mission ${def.id}: ${orders.length} castle orders for ${castles.length} castles`);
  for (const g of GOODS) {
    if ((orders[0]!.need[g] ?? 0) !== (def.contract![g] ?? 0)) throw new Error(`mission ${def.id}: the first castle order must equal the contract`);
  }
  const tick = (min: number): number => Math.round(min * 60 * TICK_HZ);
  const one = (t: TrancheDef) => [{ need: goodsOf(t.need), deadlineTick: tick(t.dueMin), doneTick: -1, missed: false }];
  main.tranches = one(orders[0]!);
  state.mission.extraContracts = orders.slice(1).map((t, i) => ({
    need: goodsOf(t.need), castle: castles[i + 1]!.id,
    deadlineTick: main.deadlineTick, star3Tick: main.star3Tick, star2Tick: main.star2Tick, tranches: one(t),
  }));
}
