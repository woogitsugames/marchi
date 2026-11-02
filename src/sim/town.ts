// Free valley economy (docs/design/sandbox.md §1.1-1.2): the castle market, renown and ranks.
// Pure integer math: prices are whole percentages of a base price, payouts are counted in
// hundredths of a silver coin and paid in whole coins (the remainder stays in market.cents).
import {
  BUILDINGS, FLOW_BUCKETS, FLOW_BUCKET_TICKS, GOODS, MARKET, RANKS, TICK_HZ, UNDO_TICKS, emptyGoods, sumGoods,
} from './defs';
import type { World } from './network';
import type { Building, BuildingType, Good, MarketState, SimState, TownState } from './types';

// --- State -------------------------------------------------------------------------------------

export function freshMarket(open: boolean): MarketState {
  return { open, saturation: emptyGoods(), cents: 0 };
}

export function freshTown(): TownState {
  return { renown: 0, rank: 0, rankTicks: RANKS.map((_, i) => (i === 0 ? 0 : -1)), flow: new Array(FLOW_BUCKETS).fill(0), bestFlow: 0 };
}

// --- Market ------------------------------------------------------------------------------------

/** Does the castle buy goods in this world? (No contract, and the map opened its market.) */
export function marketOpen(world: World): boolean {
  const st = world.state;
  return st.market.open && st.mission.contract === null;
}

/** Is this building a market that buys deliveries right now? */
export function isMarket(world: World, b: Building): boolean {
  return b.type === 'castle' && marketOpen(world);
}

/** Price as a whole percentage of the base price for a saturation level (100 down to MARKET.floorPct). */
export function pricePct(saturation: number): number {
  const drop = Math.floor((saturation * (100 - MARKET.floorPct)) / MARKET.cap);
  return Math.max(MARKET.floorPct, 100 - drop);
}

/** Price of the next unit of g in hundredths of a silver coin. */
export function unitCents(st: Pick<SimState, 'market'>, g: Good): number {
  return MARKET.base[g] * pricePct(st.market.saturation[g]);
}

/** What selling `qty` units of g right now would pay, in hundredths (each unit saturates the next). */
export function quoteCents(st: Pick<SimState, 'market'>, g: Good, qty: number): number {
  let sat = st.market.saturation[g], cents = 0;
  for (let i = 0; i < qty; i++) {
    cents += MARKET.base[g] * pricePct(sat);
    sat = Math.min(MARKET.cap, sat + 1);
  }
  return cents;
}

/**
 * Sell everything of g in the market building's stock. The goods leave the world as consumed
 * (conservation: produced - consumed - destroyed = stock + cargo still holds), silver is paid.
 */
export function sellAt(world: World, b: Building, g: Good): number {
  const st = world.state;
  const qty = b.stock[g];
  if (qty <= 0) return 0;
  const m = st.market;
  m.cents += quoteCents(st, g, qty);
  m.saturation[g] = Math.min(MARKET.cap, m.saturation[g] + qty);
  b.stock[g] = 0;
  st.ledger.consumed[g] += qty;
  st.ledger.sold[g] += qty;
  const pay = Math.floor(m.cents / 100);
  m.cents -= pay * 100;
  st.coins += pay;
  st.ledger.silverEarned += pay;
  st.town.renown += pay;
  st.town.flow[flowBucket(st.tick)] += pay;
  updateRank(world);
  return pay;
}

function flowBucket(tick: number): number {
  return Math.floor(tick / FLOW_BUCKET_TICKS) % FLOW_BUCKETS;
}

/** Silver per minute over the flow window (the current, partial bucket included). */
export function flowPerMinute(st: Pick<SimState, 'town'>): number {
  let sum = 0;
  for (const v of st.town.flow) sum += v;
  return Math.floor((sum * 60 * TICK_HZ) / (FLOW_BUCKETS * FLOW_BUCKET_TICKS));
}

/** Once per tick, at its end: market recovery, the flow window, rank latches. */
export function stepTown(world: World): void {
  if (!marketOpen(world)) return;
  const st = world.state;
  const next = st.tick + 1;
  if (next % MARKET.recoverTicks === 0) {
    for (const g of GOODS) if (st.market.saturation[g] > 0) st.market.saturation[g]--;
  }
  if (next % FLOW_BUCKET_TICKS === 0) {
    // the bucket that just closed completes a window: latch the best rate, then open the next bucket
    st.town.bestFlow = Math.max(st.town.bestFlow, flowPerMinute(st));
    st.town.flow[flowBucket(next)] = 0;
  }
  updateRank(world);
}

// --- Ranks -------------------------------------------------------------------------------------

/** Distinct goods ever sold. */
export function goodsSold(st: Pick<SimState, 'ledger'>): number {
  let n = 0;
  for (const g of GOODS) if (st.ledger.sold[g] > 0) n++;
  return n;
}

function meets(st: SimState, rank: number): boolean {
  const r = RANKS[rank]!;
  return st.town.renown >= r.renown && goodsSold(st) >= r.goods && st.town.bestFlow >= r.flow;
}

function updateRank(world: World): void {
  const st = world.state, t = st.town;
  while (t.rank + 1 < RANKS.length && meets(st, t.rank + 1)) {
    t.rank++;
    t.rankTicks[t.rank] = st.tick;
  }
}

/** Ranks gate placement only in the free valley; missions keep everything open. */
export function rankGated(world: World): boolean {
  return world.state.mission.id === 'sandbox';
}

/** Rank that unlocks a building type, or -1 when it cannot be placed by the player in the free valley. */
export function unlockRank(type: BuildingType): number {
  for (let i = 0; i < RANKS.length; i++) if (RANKS[i]!.unlocks.includes(type)) return i;
  return -1;
}

/** Rank that unlocks a road surface (1 dirt / wooden bridge, 2 cobble / stone bridge). */
export function surfaceRank(surface: number): number {
  for (let i = 0; i < RANKS.length; i++) if (RANKS[i]!.surfaces.includes(surface)) return i;
  return 0;
}

export type RankGateError = { k: 'LOCKED'; rank: number } | { k: 'NOT_PLACEABLE' };

/** Can the player place this type here at all (rank gate)? Ignores position and silver. */
export function canPlace(world: World, type: BuildingType): { ok: true } | { ok: false; err: RankGateError } {
  if (!rankGated(world)) return { ok: true };
  const need = unlockRank(type);
  if (need < 0) return { ok: false, err: { k: 'NOT_PLACEABLE' } };
  if (world.state.town.rank < need) return { ok: false, err: { k: 'LOCKED', rank: need } };
  return { ok: true };
}

/** Can the player build this road surface (rank gate)? */
export function canSurface(world: World, surface: number): { ok: true } | { ok: false; err: RankGateError } {
  if (!rankGated(world)) return { ok: true };
  const need = surfaceRank(surface);
  if (world.state.town.rank < need) return { ok: false, err: { k: 'LOCKED', rank: need } };
  return { ok: true };
}

// --- Undo (sandbox §2.5) -----------------------------------------------------------------------

export interface DemolishQuote {
  refund: number;
  /** True while the building is "fresh": demolishing it now returns the full price. */
  full: boolean;
  /** Sim seconds left in the full-refund window (0 when not fresh). */
  secondsLeft: number;
}

/** What demolishing building `b` would refund right now (pure). */
export function demolishQuote(world: World, b: Building): DemolishQuote {
  const st = world.state;
  const price = BUILDINGS[b.type].price;
  const age = st.tick - b.placedTick;
  const fresh = b.placedTick >= 0 && age <= UNDO_TICKS &&
    sumGoods(b.stock) === 0 && sumGoods(b.reservedOut) === 0 && sumGoods(b.incoming) === 0;
  if (fresh) return { refund: price, full: true, secondsLeft: Math.floor((UNDO_TICKS - age) / TICK_HZ) };
  return { refund: Math.floor(price * 0.5), full: false, secondsLeft: 0 };
}

/** The most recently placed building that can still be undone with a full refund, or null. */
export function lastUndoable(world: World): { building: number; type: BuildingType; refund: number; secondsLeft: number } | null {
  let best: Building | null = null;
  for (const b of world.state.buildings) if (b.placedTick >= 0 && (!best || b.placedTick >= best.placedTick)) best = b;
  if (!best) return null;
  const q = demolishQuote(world, best);
  return q.full ? { building: best.id, type: best.type, refund: q.refund, secondsLeft: q.secondsLeft } : null;
}

// --- Read helper for the UI --------------------------------------------------------------------

export interface PriceInfo {
  good: Good;
  /** Base price in silver. */
  base: number;
  /** Current price, percent of base (MARKET.floorPct..100). */
  pct: number;
  /** Current price of the next unit in hundredths of silver. */
  cents: number;
  saturation: number;
  /** Units sold so far. */
  sold: number;
}

export interface RankGoal {
  rank: number;
  renown: number;
  goods: number;
  flow: number;
}

export interface SandboxStatus {
  /** The castle buys goods (free valley). */
  market: boolean;
  /** Ranks gate building types (mission 'sandbox' only). */
  gated: boolean;
  rank: number;
  renown: number;
  /** Requirements of the next rank, or null at the top rank. */
  next: RankGoal | null;
  /** Progress towards `next`. */
  goodsSold: number;
  bestFlow: number;
  flowNow: number;
  silverEarned: number;
  /** Tick each rank was reached (-1 = not yet). */
  rankTicks: number[];
  unlocked: BuildingType[];
  locked: { type: BuildingType; rank: number }[];
  prices: PriceInfo[];
}

export function sandboxStatus(world: World): SandboxStatus {
  const st = world.state, t = st.town;
  const nr = t.rank + 1 < RANKS.length ? RANKS[t.rank + 1]! : null;
  const unlocked: BuildingType[] = [], locked: { type: BuildingType; rank: number }[] = [];
  for (const type of Object.keys(BUILDINGS) as BuildingType[]) {
    const r = canPlace(world, type);
    if (r.ok) unlocked.push(type);
    else if (r.err.k === 'LOCKED') locked.push({ type, rank: r.err.rank });
  }
  return {
    market: marketOpen(world),
    gated: rankGated(world),
    rank: t.rank,
    renown: t.renown,
    next: nr ? { rank: t.rank + 1, renown: nr.renown, goods: nr.goods, flow: nr.flow } : null,
    goodsSold: goodsSold(st),
    bestFlow: t.bestFlow,
    flowNow: flowPerMinute(st),
    silverEarned: st.ledger.silverEarned,
    rankTicks: t.rankTicks.slice(),
    unlocked,
    locked,
    prices: GOODS.map((g) => ({
      good: g, base: MARKET.base[g], pct: pricePct(st.market.saturation[g]), cents: unitCents(st, g),
      saturation: st.market.saturation[g], sold: st.ledger.sold[g],
    })),
  };
}
