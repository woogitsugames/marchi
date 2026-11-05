// Free valley late game (D-170, spec docs/specs/2026-11-04-valley-trade-post.md): the trading post across the
// river. A map building of the free valley that buys every good from rank 4 at 125 % of the castle formula, with its
// own saturation. Pure integer math (+ - * /, Math.floor/min/max); the slice lives in `SimState.tradePost`, only in
// 'sandbox' states, so contract missions serialize exactly as before.
import { GOODS, MARKET, TRADE_POST, emptyGoods } from './defs';
import { place } from './commands';
import { fairPercent } from './events';
import { reachable, type World } from './network';
import { centsAt, marketOpen } from './town';
import type { Building, Good, TradePostState, TradeSale } from './types';

export function freshTradePost(building: number): TradePostState {
  return { building, saturation: emptyGoods(), sold: emptyGoods(), earnedCents: 0, recent: [] };
}

/**
 * Places the trading post on the first free site of TRADE_POST.sites (place(..., free = true): no silver, no rank
 * gate, placedTick -1, the gate cell gets a dirt road as for every map building). Returns the building id or -1.
 * Used by buildMission (new free valley) and by the v8 -> v9 migration (on a clone of the old state).
 */
export function placeTradePost(world: World): number {
  for (const s of TRADE_POST.sites) {
    const r = place(world, 'tradePost', s.x, s.y, TRADE_POST.facing, true);
    if (r.ok) return world.state.buildings[world.state.buildings.length - 1]!.id;
  }
  return -1;
}

/** The post building of this world, or null (not the free valley, or no site). */
export function tradePostOf(world: World): Building | null {
  const tp = world.state.tradePost;
  if (!tp || tp.building < 0) return null;
  for (const b of world.state.buildings) if (b.id === tp.building) return b;
  return null;
}

/** Does the post buy right now? Free valley, market open, rank >= TRADE_POST.rank, the slice and building exist. */
export function postOpen(world: World): boolean {
  const tp = world.state.tradePost;
  return !!tp && tp.building >= 0 && marketOpen(world) && world.state.town.rank >= TRADE_POST.rank;
}

/** Price of the next unit of g at the post, in hundredths of silver (own saturation, fair, 125 %). */
export function postCents(world: World, g: Good): number {
  const tp = world.state.tradePost;
  const sat = tp ? tp.saturation[g] : 0;
  return Math.floor((centsAt(g, sat, fairPercent(world, g)) * TRADE_POST.pricePct) / 100);
}

/** Is the post's gate in the same road component as the gate of any stable? */
export function linkedToStable(world: World, b: Building): boolean {
  for (const s of world.state.buildings) if (s.type === 'stable' && reachable(world, s.gate, b.gate)) return true;
  return false;
}

/** Sell everything of g in the post's stock (one wagon unloading). Returns the hundredths paid (exact). */
export function sellAtPost(world: World, b: Building, g: Good): number {
  const tp = world.state.tradePost!;
  const qty = b.stock[g];
  let cents = 0;
  for (let i = 0; i < qty; i++) {
    cents += postCents(world, g);
    tp.saturation[g] = Math.min(MARKET.cap, tp.saturation[g] + 1);
  }
  tp.earnedCents += cents;
  tp.sold[g] += qty;
  tp.recent.push({ tick: world.state.tick, good: g, qty, cents });
  if (tp.recent.length > TRADE_POST.recentMax) tp.recent.shift();
  return cents;
}

/** Once per tick, at its end (from stepTown): the post's saturation recovers at its own pace. */
export function recoverTradePost(world: World, next: number): void {
  const tp = world.state.tradePost;
  if (tp && next % TRADE_POST.recoverTicks === 0) for (const g of GOODS) if (tp.saturation[g] > 0) tp.saturation[g]--;
}

// --- Read-only view for the UI -------------------------------------------------------------------

export interface TradePostPrice {
  good: Good;
  /** Price of the next unit at the post and at the castle, in hundredths of silver. */
  cents: number;
  castleCents: number;
  /** Post price in percent of the good's base price. */
  pct: number;
  saturation: number;
  sold: number;
}

export interface TradePostStatus {
  building: Building;
  open: boolean;
  /** The post's gate shares a road component with a stable's gate. */
  linked: boolean;
  prices: TradePostPrice[];
  /** Newest first. */
  recent: TradeSale[];
  /** Whole silver earned at the post. */
  earned: number;
  /** Units sold at the post in total. */
  units: number;
}

/** Everything the post's sheet shows, or null when this world has no post. Pure read. */
export function tradePostStatus(world: World): TradePostStatus | null {
  const b = tradePostOf(world);
  const tp = world.state.tradePost;
  if (!b || !tp) return null;
  const prices: TradePostPrice[] = [];
  let units = 0;
  for (const g of GOODS) {
    units += tp.sold[g];
    if (MARKET.base[g] <= 0) continue;
    const cents = postCents(world, g);
    const castleCents = centsAt(g, world.state.market.saturation[g], fairPercent(world, g));
    prices.push({ good: g, cents, castleCents, pct: Math.floor((cents * 100) / (MARKET.base[g] * 100)), saturation: tp.saturation[g], sold: tp.sold[g] });
  }
  return {
    building: b, open: postOpen(world), linked: linkedToStable(world, b), prices,
    recent: tp.recent.slice().reverse(), earned: Math.floor(tp.earnedCents / 100), units,
  };
}
