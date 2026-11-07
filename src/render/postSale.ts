/**
 * Sale cue for the trader at the open trading post (D-323): render-only, reads the sim state and keeps nothing in it.
 * Every wagon that unloads at the post appends a `TradeSale` (with its tick) to `tradePost.recent`; the view compares
 * the newest tick with the one it saw last frame.
 */
import { TICK_HZ, type World } from '../sim/index';

/** A sale older than this (s of sim time) when first seen is not played: a load or a jump, not a wagon at the counter. */
export const SALE_FRESH_S = 2;

/** Tick of the newest sale at the trading post, or -1 when the world has no post or nothing was sold there yet. */
export function lastPostSaleTick(state: Pick<World['state'], 'tradePost'>): number {
  const r = state.tradePost?.recent;
  return r && r.length ? r[r.length - 1]!.tick : -1;
}

/**
 * Whether the trader should start his sale gesture: the newest sale changed since the last frame (`seen`), it is not
 * from the future (a save of a later game swapped in) and it happened at most SALE_FRESH_S ago. `seen` < -1 means
 * nothing seen yet (a fresh view): the first look only records, so a loaded game does not open with a gesture.
 */
export function freshPostSale(seen: number, sale: number, now: number): boolean {
  if (seen < -1 || sale === seen || sale < 0) return false;
  return sale <= now && now - sale <= SALE_FRESH_S * TICK_HZ;
}
