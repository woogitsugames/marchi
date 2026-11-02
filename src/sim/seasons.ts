// Seasons in the free valley (D-31, D-33): a fixed calendar derived from the tick alone, nothing
// stored in the state. A mission opts in with `MissionDef.seasons`; createWorld / worldFromState copy
// the flag into `World.seasons` (derived like the terrain), and every hook asks `seasonal(world)`.
// Contract missions never set it, so they run bit-identically.
import { RAIN_DIRT, TICK_HZ } from './defs';
import { iceUntil } from './contract';
import type { World } from './network';
import type { BuildingType, Good, RainSpell } from './types';

export const SEASON_TICKS = 15 * 60 * TICK_HZ;
export const YEAR_TICKS = 4 * SEASON_TICKS;
/** Every change, including a bridge closure, can be announced two game minutes ahead. */
export const SEASON_WARNING_TICKS = 2 * 60 * TICK_HZ;

const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

/** Relative to the start of spring; half-open interval [start, end). */
const THAW_OFFSET: Readonly<RainSpell> = {
  start: 4 * 60 * TICK_HZ,
  end: 8 * 60 * TICK_HZ,
};
/** Two short winter closures. Bridges reopen in between; stone bridges are never affected. */
const ICE_OFFSETS: readonly Readonly<RainSpell>[] = [
  { start: 3 * 60 * TICK_HZ, end: 5 * 60 * TICK_HZ },
  { start: 9 * 60 * TICK_HZ, end: 11 * 60 * TICK_HZ },
];

export const AUTUMN_FAIR_GOOD: Good = 'beer';

export interface FairBonus {
  good: Good;
  /** Percentage of the ordinary saturation-adjusted price; 125 means +25%. */
  pricePercent: number;
}

/** This contains data, not mutations or applied production/transport changes. */
export interface SeasonEffects {
  season: Season;
  /** Production throughput, not fractional goods per recipe cycle. */
  farmYieldPercent: number;
  fisherYieldPercent: number;
  /** Only land dirt roads are affected (not cobble or either bridge surface). */
  dirtSpeedMultiplier: number;
  /** Absolute spring thaw interval, even when it is not currently active. */
  thawWindow: Readonly<RainSpell> | null;
  /** Absolute winter ice intervals, compatible with SimState.ice / iceUntil(). */
  iceWindows: readonly Readonly<RainSpell>[];
  /** Reopening tick while a winter ice interval is active, otherwise null. */
  closedBridgeUntilTick: number | null;
  /** A single good is boosted only in autumn. */
  fair: Readonly<FairBonus> | null;
}

export type SeasonChangeKind = 'season' | 'thaw-start' | 'thaw-end' | 'ice-start' | 'ice-end';

export interface SeasonChange {
  kind: SeasonChangeKind;
  /** Current season at the queried tick. */
  season: Season;
  /** Equals season for weather events; changes on a season boundary. */
  nextSeason: Season;
  atTick: number;
  ticksUntil: number;
  announceAtTick: number;
  announced: boolean;
}

function checkTick(tick: number): void {
  // Keep the next transition exact as well as the input (no wall-clock or RNG).
  if (!Number.isSafeInteger(tick) || tick < 0 || tick > Number.MAX_SAFE_INTEGER - SEASON_TICKS) {
    throw new RangeError('season tick must be a non-negative safe integer with room for one season');
  }
}

function seasonIndex(tick: number): number {
  return Math.floor(tick / SEASON_TICKS) % SEASONS.length;
}

/** Fixed 15-minute cycle: spring -> summer -> autumn -> winter -> spring. */
export function seasonAt(tick: number): Season {
  checkTick(tick);
  return SEASONS[seasonIndex(tick)]!;
}

function windowAt(start: number, relative: Readonly<RainSpell>): RainSpell {
  return { start: start + relative.start, end: start + relative.end };
}

/** Pure effect description. Repeated calls return equivalent independent objects. */
export function effectsAt(tick: number): SeasonEffects {
  const season = seasonAt(tick);
  const start = Math.floor(tick / SEASON_TICKS) * SEASON_TICKS;
  const thawWindow = season === 'spring' ? windowAt(start, THAW_OFFSET) : null;
  const iceWindows = season === 'winter' ? ICE_OFFSETS.map((w) => windowAt(start, w)) : [];
  let closedBridgeUntilTick: number | null = null;
  for (const w of iceWindows) {
    if (w.start <= tick && tick < w.end) {
      closedBridgeUntilTick = w.end;
      break;
    }
  }
  return {
    season,
    farmYieldPercent: season === 'winter' ? 60 : season === 'summer' ? 120 : 100,
    fisherYieldPercent: season === 'winter' ? 50 : 100,
    dirtSpeedMultiplier: thawWindow && thawWindow.start <= tick && tick < thawWindow.end ? RAIN_DIRT : 1,
    thawWindow,
    iceWindows,
    closedBridgeUntilTick,
    fair: season === 'autumn' ? { good: AUTUMN_FAIR_GOOD, pricePercent: 125 } : null,
  };
}

/**
 * Next actual effect change (including thaw and ice), strictly after tick.
 * The UI should show a warning only when announced is true; never infer time
 * from frame rate or the wall clock. Event keys are for the i18n layer.
 */
export function nextChange(tick: number): SeasonChange {
  const season = seasonAt(tick);
  const index = seasonIndex(tick);
  const start = Math.floor(tick / SEASON_TICKS) * SEASON_TICKS;
  let atTick = start + SEASON_TICKS;
  let kind: SeasonChangeKind = 'season';

  const candidate = (event: SeasonChangeKind, at: number): void => {
    if (at > tick && at < atTick) { atTick = at; kind = event; }
  };
  if (season === 'spring') {
    candidate('thaw-start', start + THAW_OFFSET.start);
    candidate('thaw-end', start + THAW_OFFSET.end);
  } else if (season === 'winter') {
    for (const w of ICE_OFFSETS) {
      candidate('ice-start', start + w.start);
      candidate('ice-end', start + w.end);
    }
  }
  const announceAtTick = atTick - SEASON_WARNING_TICKS;
  return {
    kind,
    season,
    nextSeason: kind === 'season' ? SEASONS[(index + 1) % SEASONS.length]! : season,
    atTick,
    ticksUntil: atTick - tick,
    announceAtTick,
    announced: tick >= announceAtTick,
  };
}


// --- Live hooks (cheap, allocation-free; the sim calls them every tick) ------------------------

/** Does this world run the seasonal calendar? (Data flag from the mission, never a mission id.) */
export function seasonal(world: Pick<World, 'seasons'>): boolean {
  return world.seasons === true;
}

/** Throughput percentage of a producer type at tick (100 = normal). Only farms and fishers vary. */
export function yieldPercentAt(type: BuildingType, tick: number): number {
  if (type !== 'farm' && type !== 'fisher') return 100;
  const s = seasonIndex(tick);
  if (s === 3) return type === 'farm' ? 60 : 50;
  if (s === 1 && type === 'farm') return 120;
  return 100;
}

/**
 * Ticks one production cycle needs at a throughput percentage: the recipe keeps its whole-item
 * output, the cycle gets longer or shorter (integer ceil without Math.ceil).
 */
export function cycleTicksAt(baseTicks: number, percent: number): number {
  return percent === 100 ? baseTicks : Math.floor((baseTicks * 100 + percent - 1) / percent);
}

/** Cycle length of a building's recipe in this world right now (base recipe ticks without seasons). */
export function cycleTicks(world: World, type: BuildingType, baseTicks: number): number {
  return seasonal(world) ? cycleTicksAt(baseTicks, yieldPercentAt(type, world.state.tick)) : baseTicks;
}

/** Is the spring thaw slowing land dirt roads at tick? */
export function thawAt(tick: number): boolean {
  if (seasonIndex(tick) !== 0) return false;
  const t = tick % SEASON_TICKS;
  return t >= THAW_OFFSET.start && t < THAW_OFFSET.end;
}

/** Thaw in this world right now (false without seasons). */
export function thawing(world: World): boolean {
  return seasonal(world) && thawAt(world.state.tick);
}

/** End tick of the winter ice window covering tick, or -1. */
export function seasonIceUntilAt(tick: number): number {
  if (seasonIndex(tick) !== 3) return -1;
  const start = tick - (tick % SEASON_TICKS);
  for (const w of ICE_OFFSETS) if (tick >= start + w.start && tick < start + w.end) return start + w.end;
  return -1;
}

/**
 * Wooden bridges closed until this tick, or -1: the mission's authored ice windows (state.ice,
 * mission IV) composed with the winter ice of a seasonal world. Nothing is written into state.ice.
 */
export function bridgeIceUntil(world: World): number {
  const authored = iceUntil(world.state);
  if (!seasonal(world)) return authored;
  const s = seasonIceUntilAt(world.state.tick);
  return s > authored ? s : authored;
}

/** Fair price percentage for a good at tick (125 for beer in autumn, else 100). */
export function fairPercentAt(good: Good, tick: number): number {
  return good === AUTUMN_FAIR_GOOD && seasonIndex(tick) === 2 ? 125 : 100;
}

/** Fair price percentage in this world right now (100 without seasons). */
export function fairPercent(world: World, good: Good): number {
  return seasonal(world) ? fairPercentAt(good, world.state.tick) : 100;
}

/** 1-based year of the calendar at tick (for the HUD). */
export function yearAt(tick: number): number {
  return Math.floor(tick / YEAR_TICKS) + 1;
}
