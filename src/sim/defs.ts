// Static game data: goods, building definitions, tuning constants.
import type { BuildingType, Good, GoodMap } from './types';

export const TICK_HZ = 10;
export const DT = 1 / TICK_HZ;
export const STATE_VERSION = 3;

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
