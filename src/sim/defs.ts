// Static game data: goods, building definitions, tuning constants.
import type { BuildingType, Good, GoodMap } from './types';

export const TICK_HZ = 10;
export const DT = 1 / TICK_HZ;
export const STATE_VERSION = 6;

/**
 * Every good, in the canonical order (the key order of every GoodMap, so of the state hash). The
 * single source of truth: `Good` and `GoodMap` are derived from it. Append new goods at the end
 * and add a save migration (zero entries for the new keys), see migrate() in platform/save.ts.
 */
export const GOODS = ['wood', 'planks', 'grain', 'flour', 'bread', 'fish', 'stone', 'charcoal', 'malt', 'beer'] as const;

/** The goods of state v1-v4 (saves of those versions carry exactly these keys). */
export const GOODS_V4: readonly Good[] = ['wood', 'planks', 'grain', 'flour', 'bread'];

/** A GoodMap with every good at 0, keys in GOODS order. */
export function emptyGoods(): GoodMap {
  const m = {} as GoodMap;
  for (const g of GOODS) m[g] = 0;
  return m;
}

/** A GoodMap in GOODS order from a partial map (missing goods = 0). */
export function goodsOf(p: Partial<GoodMap>): GoodMap {
  const m = emptyGoods();
  for (const g of GOODS) m[g] = p[g] ?? 0;
  return m;
}

export function sumGoods(g: GoodMap): number {
  let n = 0;
  for (const k of GOODS) n += g[k];
  return n;
}

export function isGood(v: unknown): v is Good {
  return typeof v === 'string' && (GOODS as readonly string[]).includes(v);
}

// --- Roads -----------------------------------------------------------------
export const CELL_SIZE = 4; // metres
export const MAX_GRADE = 0.14;
/** Base speeds in m/s (game-scaled). */
export const SPEED_DIRT = 3.6;
export const SPEED_COBBLE = 4.8;
export const SPEED_WOOD_BRIDGE = 2.8;
export const SPEED_STONE_BRIDGE = 4.6;
export const RAIN_DIRT = 0.55;
export const RAIN_COBBLE = 0.9;
export const RAIN_WOOD_BRIDGE = 0.85;
export const SLOPE_K_LOADED = 6;
export const SLOPE_K_EMPTY = 3;
export const SLOPE_K_DOWN = 1.5;
export const WOOD_BRIDGE_MAX_WAGONS = 3;

export const COST_DIRT = 1;
export const COST_COBBLE = 4;
export const COST_WOOD_BRIDGE = 6;
export const COST_STONE_BRIDGE = 15;
export const DEMOLISH_REFUND = 0.5;
/** Free valley (rank-gated): stone per cobbled cell and per stone-bridge cell, on top of silver (design S5). */
export const STONE_COBBLE = 1;
export const STONE_STONE_BRIDGE = 3;
/** Free valley: every granary keeps up to this much stone for building before the market gets any. */
export const STONE_RESERVE = 18;

// --- Terrain rules for placement -----------------------------------------------
/** Quarry: some cell of the footprint or the ring around it is at least this high above the water (m). */
export const QUARRY_MIN_HEIGHT = 5;
export const WAGON_PRICE = 30;
/** A building demolished this soon after it was placed is refunded in full ("undo", sandbox §2.5). */
export const UNDO_TICKS = 30 * 10;
export const MAX_WAGONS = 250;

// --- Wagons ----------------------------------------------------------------
/** Largest load of any good (the default per-good capacity). */
export const WAGON_CAPACITY = 6;
/** Units of each good one wagon carries: heavy stone fills a wagon at 4. */
export const WAGON_CAPACITY_BY_GOOD: Readonly<GoodMap> = goodsOf({
  wood: 6, planks: 6, grain: 6, flour: 6, bread: 6, fish: 6, stone: 4, charcoal: 6, malt: 6, beer: 6,
});
/** Wagon load for a good. */
export function capacityOf(good: Good): number {
  return WAGON_CAPACITY_BY_GOOD[good];
}
export const LOAD_TICKS = 3 * TICK_HZ;
export const UNLOAD_TICKS = 3 * TICK_HZ;
/** After this long without a route, a job is re-planned or cancelled. */
export const NO_ROUTE_CANCEL_TICKS = 20 * TICK_HZ;
export const DISPATCH_INTERVAL = 5; // ticks
export const TRAFFIC_DECAY_TICKS = 60 * TICK_HZ;

// --- Time ------------------------------------------------------------------
/** One day spans a whole contract: mission 1 runs from early morning to dusk. */
export const DAY_TICKS = 1440 * TICK_HZ;
/** Mission clocks start a little after dawn (fraction of the day). */
export const START_DAY_FRACTION = 0.27;

// --- Buildings -------------------------------------------------------------
export interface Recipe {
  inputs: Partial<GoodMap>;
  outputs: Partial<GoodMap>;
  ticks: number;
}

export interface BuildingDef {
  type: BuildingType;
  w: number;
  h: number;
  recipe: Recipe | null;
  /** Max stock per input good. */
  inCap: number;
  /** Max stock per output good. */
  outCap: number;
  /** Warehouse-style total capacity (any good), 0 = none. */
  storeCap: number;
  price: number;
}

const s = TICK_HZ;
export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  woodcutter: { type: 'woodcutter', w: 2, h: 2, recipe: { inputs: {}, outputs: { wood: 1 }, ticks: 10 * s }, inCap: 0, outCap: 8, storeCap: 0, price: 20 },
  sawmill: { type: 'sawmill', w: 3, h: 2, recipe: { inputs: { wood: 1 }, outputs: { planks: 2 }, ticks: 10 * s }, inCap: 8, outCap: 12, storeCap: 0, price: 40 },
  farm: { type: 'farm', w: 3, h: 3, recipe: { inputs: {}, outputs: { grain: 1 }, ticks: 8 * s }, inCap: 0, outCap: 8, storeCap: 0, price: 30 },
  mill: { type: 'mill', w: 2, h: 2, recipe: { inputs: { grain: 1 }, outputs: { flour: 1 }, ticks: 7 * s }, inCap: 8, outCap: 8, storeCap: 0, price: 40 },
  bakery: { type: 'bakery', w: 2, h: 2, recipe: { inputs: { flour: 1 }, outputs: { bread: 2 }, ticks: 12 * s }, inCap: 8, outCap: 12, storeCap: 0, price: 40 },
  warehouse: { type: 'warehouse', w: 3, h: 2, recipe: null, inCap: 0, outCap: 0, storeCap: 60, price: 30 },
  stable: { type: 'stable', w: 3, h: 2, recipe: null, inCap: 0, outCap: 0, storeCap: 0, price: 40 },
  castle: { type: 'castle', w: 4, h: 4, recipe: null, inCap: 0, outCap: 0, storeCap: 0, price: 0 },
  // free valley chains (D-29, docs/design/sandbox.md §3); appended so map buildings keep their order
  fisher: { type: 'fisher', w: 2, h: 2, recipe: { inputs: {}, outputs: { fish: 1 }, ticks: 9 * s }, inCap: 0, outCap: 8, storeCap: 0, price: 30 },
  quarry: { type: 'quarry', w: 3, h: 2, recipe: { inputs: {}, outputs: { stone: 1 }, ticks: 12 * s }, inCap: 0, outCap: 8, storeCap: 0, price: 40 },
  charcoalBurner: { type: 'charcoalBurner', w: 2, h: 2, recipe: { inputs: { wood: 2 }, outputs: { charcoal: 1 }, ticks: 20 * s }, inCap: 8, outCap: 8, storeCap: 0, price: 35 },
  malthouse: { type: 'malthouse', w: 2, h: 2, recipe: { inputs: { grain: 2 }, outputs: { malt: 1 }, ticks: 12 * s }, inCap: 8, outCap: 8, storeCap: 0, price: 45 },
  brewery: { type: 'brewery', w: 3, h: 2, recipe: { inputs: { malt: 1 }, outputs: { beer: 2 }, ticks: 16 * s }, inCap: 8, outCap: 12, storeCap: 0, price: 60 },
};

/** Placement rule of a building type beyond "flat, dry, free" (checked by validatePlace). */
export const SITE_RULE: Partial<Record<BuildingType, 'NEAR_WATER' | 'ON_ROCK'>> = {
  fisher: 'NEAR_WATER',
  quarry: 'ON_ROCK',
};

export function inputGoods(type: BuildingType): Good[] {
  const r = BUILDINGS[type].recipe;
  return r ? (GOODS.filter((g) => (r.inputs[g] ?? 0) > 0) as Good[]) : [];
}

export function outputGoods(type: BuildingType): Good[] {
  const r = BUILDINGS[type].recipe;
  return r ? (GOODS.filter((g) => (r.outputs[g] ?? 0) > 0) as Good[]) : [];
}

/** Which building type produces a good (first match), for "who should make this" hints. */
export function producerOf(good: Good): BuildingType | null {
  for (const t of Object.keys(BUILDINGS) as BuildingType[]) {
    if (outputGoods(t).includes(good)) return t;
  }
  return null;
}

// --- Market and ranks (free valley, docs/design/sandbox.md §1.1-1.2, §4) -------------------------
// One table for every tuning number of the sandbox economy (tools/balance.ts sandbox, tools/bot-sandbox.ts).

export interface MarketDef {
  /** Base price per unit in silver at an unsaturated market. */
  base: GoodMap;
  /** Saturation units per good at which the price bottoms out at `floorPct`. */
  cap: number;
  /** Lowest price as a percentage of the base price. */
  floorPct: number;
  /** One saturation unit per good recovers every this many ticks. */
  recoverTicks: number;
  /** The dispatcher keeps at most this many units of one good on the way to the market. */
  inflightPerGood: number;
  /** Share of the wagon fleet (percent, at least one wagon) that may haul to the market at once. */
  wagonSharePct: number;
}

export const MARKET: MarketDef = {
  base: goodsOf({ wood: 1, planks: 3, grain: 1, flour: 3, bread: 4, fish: 3, stone: 2, charcoal: 4, malt: 4, beer: 9 }),
  cap: 24,
  floorPct: 50,
  recoverTicks: 10 * TICK_HZ,
  inflightPerGood: 12,
  wagonSharePct: 75,
};

/** Flow window: FLOW_BUCKETS buckets of FLOW_BUCKET_TICKS (18 x 10 s = 3 minutes). */
export const FLOW_BUCKETS = 18;
export const FLOW_BUCKET_TICKS = 10 * TICK_HZ;

export interface RankDef {
  /** Renown needed (cumulative silver from sales). */
  renown: number;
  /** Distinct goods ever sold. */
  goods: number;
  /** Best silver per minute ever reached over the 3-minute flow window (latched). */
  flow: number;
  /** Building types this rank unlocks in the free valley. */
  unlocks: BuildingType[];
  /** Road surfaces this rank unlocks (2 = cobble and stone bridges). */
  surfaces: number[];
  /** Castle appearance level from this rank on (render: 0 = plain keep, 1 = upgraded castle). */
  castleLevel: number;
}

/**
 * Rank 0..5: Settlement, Market village, Small town, Town, Stronghold (Gród), Capital (Stolica).
 * Gating applies only to mission 'sandbox'. Ranks 4-5 (D-29) need the new chains: 7 / 9 distinct
 * goods sold. Rank 5 unlocks no building, only the castle upgrade (castleLevel 1).
 */
export const RANKS: readonly RankDef[] = [
  { renown: 0, goods: 0, flow: 0, unlocks: ['woodcutter', 'sawmill', 'farm', 'stable', 'warehouse'], surfaces: [1], castleLevel: 0 },
  { renown: 200, goods: 2, flow: 8, unlocks: ['mill', 'bakery'], surfaces: [], castleLevel: 0 },
  { renown: 1000, goods: 4, flow: 20, unlocks: ['fisher', 'quarry'], surfaces: [2], castleLevel: 0 },
  { renown: 2500, goods: 6, flow: 60, unlocks: ['charcoalBurner', 'malthouse'], surfaces: [], castleLevel: 0 },
  { renown: 6000, goods: 7, flow: 120, unlocks: ['brewery'], surfaces: [], castleLevel: 0 },
  { renown: 13000, goods: 9, flow: 160, unlocks: [], surfaces: [], castleLevel: 1 },
];

/** Number of ranks in state v1-v4 (town.rankTicks had this many entries). */
export const RANKS_V4 = 4;
