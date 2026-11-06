// Optional free-valley chronicle. This module only observes a completed simulation snapshot.
// It deliberately does not persist achievements or award silver: the caller owns the done IDs.
import { GOODS } from '../defs';
import { reachable, type World } from '../network';
import { seasonAt, seasonIceUntilAt, type Season } from '../seasons';
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
  /** Units sold at the trading post (TradePostState.sold), kept apart from the castle's ledger.sold. */
  | { kind: 'postSold'; atLeast: number }
  /** Kinds of goods sold at the trading post. */
  | { kind: 'postVariety'; atLeast: number }
  /** The trading post's gate is joined to the castle gate by road right now (live graph; needs the World). */
  | { kind: 'postRoad' }
  /** A wagon is waiting right now at a wooden span closed by ice (proof the crossing froze, not just winter). */
  | { kind: 'iceHeld' }
  /** No seasonal ice window is open and no wagon waits at a frozen span. */
  | { kind: 'iceFree' }
  /** Another entry is already in the chronicle (history the snapshot does not keep: the caller's done IDs). */
  | { kind: 'after'; id: string }
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
/** 'A record of trade' (D-241): the latched 3-minute flow window above the rank-5 requirement (160 silver/min). */
export const FLOW_RECORD = 200;

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
  // late valley (gpt 74, docs/content/chronicle-late.md, D-241): the trading post, the frozen crossing, rank 5
  { id: 'post_connected', condition: { kind: 'postRoad' } },
  { id: 'post_first_sale', condition: { kind: 'postSold', atLeast: 1 } },
  { id: 'post_three_goods', condition: { kind: 'postVariety', atLeast: 3 } },
  { id: 'frozen_bridge', condition: { kind: 'iceHeld' } },
  { id: 'bridge_thaw', condition: { kind: 'all', of: [{ kind: 'after', id: 'frozen_bridge' }, { kind: 'iceFree' }] } },
  { id: 'capital_rank', condition: { kind: 'rank', atLeast: 5 } },
  { id: 'flow_record', condition: { kind: 'bestFlow', atLeast: FLOW_RECORD } },
];

function postConnected(world: World | undefined): boolean {
  const post = world?.state.tradePost;
  if (!world || !post || post.building < 0) return false;
  const building = world.state.buildings.find((b) => b.id === post.building);
  const castle = world.state.buildings.find((b) => b.type === 'castle');
  return !!building && !!castle && reachable(world, building.gate, castle.gate);
}

function matches(state: SimState, condition: ChronicleCondition, done: (id: string) => boolean, world?: World): boolean {
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
    case 'postSold': return !!state.tradePost && GOODS.reduce((n, g) => n + state.tradePost!.sold[g], 0) >= condition.atLeast;
    case 'postVariety': return !!state.tradePost && GOODS.filter((g) => state.tradePost!.sold[g] > 0).length >= condition.atLeast;
    case 'postRoad': return postConnected(world);
    case 'iceHeld': return state.wagons.some((w) => w.status.k === 'BRIDGE_CLOSED');
    case 'iceFree': return seasonIceUntilAt(state.tick) < 0 && !state.wagons.some((w) => w.status.k === 'BRIDGE_CLOSED');
    case 'after': return done(condition.id);
    case 'all': return condition.of.every((c) => matches(state, c, done, world));
  }
}

/**
 * Return just newly eligible IDs, in CHRONICLE order. The input snapshot and previous IDs are
 * never changed; call the function at regular tick boundaries and persist IDs outside SimState.
 * `world` (the same state's World) is needed only by 'postRoad'; without it that entry never fires.
 * 'after' reads prevDone only, so an entry and its sequel are never recorded in the same call.
 */
export function checkChronicle(state: SimState, prevDone: ReadonlySet<string> | readonly string[], world?: World): string[] {
  if (state.mission.id !== 'sandbox') return [];
  const alreadyDone = (id: string): boolean => Array.isArray(prevDone)
    ? (prevDone as readonly string[]).includes(id)
    : (prevDone as ReadonlySet<string>).has(id);
  const newIds: string[] = [];
  for (const entry of CHRONICLE) {
    if (!alreadyDone(entry.id) && matches(state, entry.condition, alreadyDone, world)) newIds.push(entry.id);
  }
  return newIds;
}
