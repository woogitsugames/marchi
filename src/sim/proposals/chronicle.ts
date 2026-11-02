// Optional free-valley chronicle. This module only observes a completed simulation snapshot.
// It deliberately does not persist achievements or award silver: the caller owns the done IDs.
import { GOODS } from '../defs';
import { seasonAt, type Season } from '../seasons';
import type { BuildingType, Good, SimState, SurfaceKind } from '../types';

/** Conditions are serializable data; none executes commands or modifies the simulation. */
export type ChronicleCondition =
  | { kind: 'sold'; good: Good; atLeast: number }
  | { kind: 'produced'; good: Good; atLeast: number }
  | { kind: 'rank'; atLeast: number }
  | { kind: 'built'; type: BuildingType; atLeast?: number }
  | { kind: 'stocked'; type: 'warehouse'; atLeast: number }
  | { kind: 'fleet'; atLeast: number }
  | { kind: 'variety'; atLeast: number }
  | { kind: 'bestFlow'; atLeast: number }
  | { kind: 'road'; surface: SurfaceKind; atLeast: number }
  | { kind: 'season'; season: Season }
  | { kind: 'all'; of: readonly ChronicleCondition[] };

export interface ChronicleDef {
  id: string;
  condition: ChronicleCondition;
}

/**
 * One entry per concrete logistics lesson. Every condition can be reached in the free valley
 * without a deadline or a silver reward. 'built' excludes pre-placed starting buildings.
 * The 2-unit brewery output and wagon-load-sized goals avoid open-ended grind counters.
 */
export const CHRONICLE: ChronicleDef[] = [
  { id: 'planks_at_market', condition: { kind: 'sold', good: 'planks', atLeast: 1 } },
  { id: 'two_forest_goods', condition: { kind: 'all', of: [
    { kind: 'sold', good: 'wood', atLeast: 1 }, { kind: 'sold', good: 'planks', atLeast: 1 },
  ] } },
  { id: 'third_wagon', condition: { kind: 'all', of: [
    { kind: 'fleet', atLeast: 3 }, { kind: 'sold', good: 'planks', atLeast: 1 },
  ] } },
  { id: 'another_woodcutter', condition: { kind: 'all', of: [
    { kind: 'built', type: 'woodcutter' }, { kind: 'sold', good: 'planks', atLeast: 1 },
  ] } },
  { id: 'grain_at_market', condition: { kind: 'all', of: [
    { kind: 'built', type: 'farm' }, { kind: 'sold', good: 'grain', atLeast: 1 },
  ] } },
  { id: 'grain_wagonload', condition: { kind: 'sold', good: 'grain', atLeast: 6 } },
  { id: 'market_village', condition: { kind: 'rank', atLeast: 1 } },
  { id: 'mill_turns', condition: { kind: 'all', of: [
    { kind: 'built', type: 'mill' }, { kind: 'produced', good: 'flour', atLeast: 1 },
  ] } },
  { id: 'flour_at_market', condition: { kind: 'sold', good: 'flour', atLeast: 1 } },
  { id: 'oven_fires', condition: { kind: 'all', of: [
    { kind: 'built', type: 'bakery' }, { kind: 'produced', good: 'bread', atLeast: 2 },
  ] } },
  { id: 'bread_at_market', condition: { kind: 'sold', good: 'bread', atLeast: 1 } },
  { id: 'three_grain_stages', condition: { kind: 'all', of: [
    { kind: 'sold', good: 'grain', atLeast: 1 }, { kind: 'sold', good: 'flour', atLeast: 1 },
    { kind: 'sold', good: 'bread', atLeast: 1 },
  ] } },
  { id: 'five_wagons', condition: { kind: 'all', of: [
    { kind: 'fleet', atLeast: 5 }, { kind: 'variety', atLeast: 2 },
  ] } },
  { id: 'second_sawmill', condition: { kind: 'all', of: [
    { kind: 'built', type: 'sawmill' }, { kind: 'sold', good: 'planks', atLeast: 12 },
  ] } },
  { id: 'working_granary', condition: { kind: 'stocked', type: 'warehouse', atLeast: 1 } },
  { id: 'diverse_flow', condition: { kind: 'all', of: [
    { kind: 'variety', atLeast: 3 }, { kind: 'bestFlow', atLeast: 8 },
  ] } },
  { id: 'small_town', condition: { kind: 'rank', atLeast: 2 } },
  { id: 'fish_at_market', condition: { kind: 'all', of: [
    { kind: 'built', type: 'fisher' }, { kind: 'sold', good: 'fish', atLeast: 1 },
  ] } },
  { id: 'stone_at_market', condition: { kind: 'all', of: [
    { kind: 'built', type: 'quarry' }, { kind: 'sold', good: 'stone', atLeast: 1 },
  ] } },
  { id: 'stone_paved_road', condition: { kind: 'all', of: [
    { kind: 'sold', good: 'stone', atLeast: 1 }, { kind: 'road', surface: 2, atLeast: 4 },
  ] } },
  { id: 'four_goods_flow', condition: { kind: 'all', of: [
    { kind: 'variety', atLeast: 4 }, { kind: 'bestFlow', atLeast: 20 },
  ] } },
  { id: 'winter_bread_record', condition: { kind: 'all', of: [
    { kind: 'season', season: 'winter' }, { kind: 'sold', good: 'bread', atLeast: 1 },
  ] } },
  { id: 'town_rank', condition: { kind: 'rank', atLeast: 3 } },
  { id: 'charcoal_at_market', condition: { kind: 'all', of: [
    { kind: 'built', type: 'charcoalBurner' }, { kind: 'sold', good: 'charcoal', atLeast: 1 },
  ] } },
  { id: 'malt_at_market', condition: { kind: 'all', of: [
    { kind: 'built', type: 'malthouse' }, { kind: 'sold', good: 'malt', atLeast: 1 },
  ] } },
  { id: 'wood_for_two_trades', condition: { kind: 'all', of: [
    { kind: 'sold', good: 'planks', atLeast: 12 }, { kind: 'sold', good: 'charcoal', atLeast: 1 },
  ] } },
  { id: 'stronghold_rank', condition: { kind: 'rank', atLeast: 4 } },
  { id: 'brewery_brews', condition: { kind: 'all', of: [
    { kind: 'built', type: 'brewery' }, { kind: 'produced', good: 'beer', atLeast: 2 },
  ] } },
  { id: 'beer_at_market', condition: { kind: 'sold', good: 'beer', atLeast: 1 } },
  { id: 'seven_trade_goods', condition: { kind: 'all', of: [
    { kind: 'variety', atLeast: 7 }, { kind: 'bestFlow', atLeast: 60 },
  ] } },
];

function matches(state: SimState, condition: ChronicleCondition): boolean {
  switch (condition.kind) {
    case 'sold': return state.ledger.sold[condition.good] >= condition.atLeast;
    case 'produced': return state.ledger.produced[condition.good] >= condition.atLeast;
    case 'rank': return state.town.rank >= condition.atLeast;
    case 'built':
      return state.buildings.filter((b) => b.type === condition.type && b.placedTick >= 0).length >= (condition.atLeast ?? 1);
    case 'stocked':
      return state.buildings.some((b) => b.type === condition.type && b.placedTick >= 0 &&
        GOODS.reduce((n, g) => n + b.stock[g], 0) >= condition.atLeast);
    case 'fleet': return state.wagons.length >= condition.atLeast;
    case 'variety': return GOODS.filter((g) => state.ledger.sold[g] > 0).length >= condition.atLeast;
    case 'bestFlow': return state.town.bestFlow >= condition.atLeast;
    case 'road': {
      let cells = 0;
      for (const surface of state.roads) if (surface === condition.surface && ++cells >= condition.atLeast) return true;
      return false;
    }
    case 'season': return seasonAt(state.tick) === condition.season;
    case 'all': return condition.of.every((c) => matches(state, c));
  }
}

/**
 * Return just newly eligible IDs, in CHRONICLE order. The input snapshot and previous IDs are
 * never changed; call the function at regular tick boundaries and persist IDs outside SimState.
 */
export function checkChronicle(state: SimState, prevDone: ReadonlySet<string> | readonly string[]): string[] {
  if (state.mission.id !== 'sandbox') return [];
  const alreadyDone = (id: string): boolean => Array.isArray(prevDone)
    ? (prevDone as readonly string[]).includes(id)
    : (prevDone as ReadonlySet<string>).has(id);
  const newIds: string[] = [];
  for (const entry of CHRONICLE) {
    if (!alreadyDone(entry.id) && matches(state, entry.condition)) newIds.push(entry.id);
  }
  return newIds;
}
