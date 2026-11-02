// Static game data: goods, building definitions, tuning constants.
import type { BuildingType, Good, GoodMap } from './types';

export const TICK_HZ = 10;
export const DT = 1 / TICK_HZ;
export const STATE_VERSION = 4;

export const GOODS: readonly Good[] = ['wood', 'planks', 'grain', 'flour', 'bread'];

export function emptyGoods(): GoodMap {
  return { wood: 0, planks: 0, grain: 0, flour: 0, bread: 0 };
}

export function sumGoods(g: GoodMap): number {
  return g.wood + g.planks + g.grain + g.flour + g.bread;
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
export const WAGON_PRICE = 30;
/** A building demolished this soon after it was placed is refunded in full ("undo", sandbox §2.5). */
export const UNDO_TICKS = 30 * 10;
export const MAX_WAGONS = 250;

// --- Wagons ----------------------------------------------------------------
export const WAGON_CAPACITY = 6;
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
  base: { wood: 1, planks: 3, grain: 1, flour: 3, bread: 4 },
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
}

/** Rank 0..3: Settlement, Market village, Small town, Town. Gating applies only to mission 'sandbox'. */
export const RANKS: readonly RankDef[] = [
  { renown: 0, goods: 0, flow: 0, unlocks: ['woodcutter', 'sawmill', 'farm', 'stable', 'warehouse'], surfaces: [1] },
  { renown: 200, goods: 2, flow: 8, unlocks: ['mill', 'bakery'], surfaces: [] },
  { renown: 1000, goods: 4, flow: 20, unlocks: [], surfaces: [2] },
  { renown: 3000, goods: 5, flow: 40, unlocks: [], surfaces: [] },
];
