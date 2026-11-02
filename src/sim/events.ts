/**
 * Valley events in the free valley (D-54; design docs/design/events.md, copy docs/content/events.md):
 * royal orders, seasonal fairs and a travelling merchant. Sandbox only: the slice lives in
 * `SimState.valleyEvents`, which only a 'sandbox' state carries (contract missions keep their exact
 * JSON). No penalties, no expiry, no countdowns (D-21).
 *
 * Pure part: producibleGoods / proposeValleyEvents / dismissRoyalOrder / deliverRoyalOrder /
 * acceptMerchant / dismissMerchant never mutate their input. The sim adapters at the bottom
 * (stepValleyEvents, handInOrders, the command helpers) apply them to a World atomically: event data
 * and SimState.rng are written together, goods leave the world through ledger.consumed (+ sold).
 *
 * The dynamic fair REPLACES the old fixed autumn beer +25% (seasons.ts): fairPercent() below is the
 * only fair price hook.
 */
import { GOODS, MARKET } from './defs';
import { SEASON_TICKS, type Season } from './seasons';
import { reachable, type World } from './network';
import type { RngState } from './rng';
import type { Building, BuildingType, Good, SimState } from './types';

/** D-29 rank unlocks. Each prerequisite is checked, not just the final building. */
const PRODUCTION: Record<Good, { rank: number; building: BuildingType; requires: readonly Good[] }> = {
  wood: { rank: 0, building: 'woodcutter', requires: [] },
  planks: { rank: 0, building: 'sawmill', requires: ['wood'] },
  grain: { rank: 0, building: 'farm', requires: [] },
  flour: { rank: 1, building: 'mill', requires: ['grain'] },
  bread: { rank: 1, building: 'bakery', requires: ['flour'] },
  fish: { rank: 2, building: 'fisher', requires: [] },
  stone: { rank: 2, building: 'quarry', requires: [] },
  charcoal: { rank: 3, building: 'charcoalBurner', requires: ['wood'] },
  malt: { rank: 3, building: 'malthouse', requires: ['grain'] },
  beer: { rank: 4, building: 'brewery', requires: ['malt'] },
};

const BASE_SILVER = MARKET.base;

export const EVENT_SEASON_TICKS = SEASON_TICKS;
export const FAIR_WARNING_TICKS = 1_200; // announced two simulation minutes before the season
export const ORDER_INTERVAL_TICKS = 3_600; // at most one new offer each six simulation minutes
export const FAIR_EVERY_SEASONS = 3;
export const MERCHANT_EVERY_SEASONS = 2;
export const MAX_ROYAL_ORDERS = 2;
export const FAIR_PRICE_PERCENT = 125;
export const MERCHANT_PRICE_PERCENT = 140;
export const MERCHANT_MIN_TRADE = 4;
export const MERCHANT_STOCK_RESERVE = 6;
export const MERCHANT_STONE_EXTRA_RESERVE = 18;

export type OrderTemplateId = (typeof ORDER_TEMPLATES)[number]['id'];
export interface RoyalOrder {
  id: string;
  templateId: OrderTemplateId;
  /** Offered orders wait for the player; only accepted ones take deliveries at the castle. */
  accepted: boolean;
  /** Every good in this record is required. No deadline or failure fields. */
  need: Partial<Record<Good, number>>;
  /** Goods already handed to the castle for this order. */
  delivered: Partial<Record<Good, number>>;
  rewardSilver: number;
  rewardRenown: number;
}

export interface SeasonalFair {
  id: string;
  good: Good;
  season: Season;
  /** Simulation-tick [startTick, endTick) — a market bonus window, NOT a goal deadline. */
  startTick: number;
  endTick: number;
  pricePercent: typeof FAIR_PRICE_PERCENT;
}

export interface MerchantOffer {
  id: string;
  good: Good;
  /** Maximum purchased in one voluntary transaction, at this guaranteed quote. */
  quantity: number;
  /** Fixed offer, higher than the unsaturated price and the existing 125% fair. */
  unitCents: number;
  pricePercent: typeof MERCHANT_PRICE_PERCENT;
}

/** Proposed persisted slice; rng remains the existing SimState.rng, NOT duplicated here. */
export interface ValleyEventState {
  orders: RoyalOrder[];
  nextOrderTick: number;
  /** Dismissed orders are replaceable only after at least one more unit is sold. */
  nextOrderAfterSoldUnits: number;
  lastRejectedTemplate: OrderTemplateId | null;
  sequence: number;
  fair: SeasonalFair | null;
  lastFairSeasonIndex: number;
  merchant: MerchantOffer | null;
  lastMerchantSeasonIndex: number;
  /** Totals for the HUD and the balance bench: orders fulfilled, silver from orders and the merchant. */
  ordersDone: number;
  orderSilver: number;
  merchantSilver: number;
}

export type EventSnapshot = Pick<SimState, 'tick' | 'rng' | 'town' | 'buildings' | 'ledger' | 'mission'>;

export interface EventGeneration {
  events: ValleyEventState;
  /** Copy of SimState.rng advanced only for events actually drawn; the input is untouched. */
  rng: RngState;
}

interface OrderTemplate {
  id: string;
  minRank: number;
  goods: readonly Good[];
}

/** IDs map 1:1 to bilingual historical copy in docs/content/events.md. */
export const ORDER_TEMPLATES = [
  { id: 'palisade_repair', minRank: 0, goods: ['wood'] },
  { id: 'bridge_planking', minRank: 0, goods: ['planks'] },
  { id: 'winter_granary', minRank: 0, goods: ['grain'] },
  { id: 'toll_house', minRank: 0, goods: ['wood', 'planks'] },
  { id: 'castle_stores', minRank: 0, goods: ['grain', 'wood'] },
  { id: 'border_watch', minRank: 0, goods: ['planks', 'grain'] },
  { id: 'pilgrim_shelter', minRank: 0, goods: ['wood', 'planks'] },
  { id: 'neighbor_siege', minRank: 0, goods: ['planks', 'grain'] },
  { id: 'wedding_bread', minRank: 1, goods: ['bread'] },
  { id: 'abbey_flour', minRank: 1, goods: ['flour'] },
  { id: 'knights_assembly', minRank: 1, goods: ['bread', 'planks'] },
  { id: 'harvest_almshouse', minRank: 1, goods: ['bread', 'grain'] },
  { id: 'pilgrimage_rations', minRank: 1, goods: ['bread', 'flour'] },
  { id: 'court_bakers', minRank: 1, goods: ['flour', 'grain'] },
  { id: 'lenten_fish', minRank: 2, goods: ['fish'] },
  { id: 'church_masonry', minRank: 2, goods: ['stone', 'planks'] },
  { id: 'river_garrison', minRank: 2, goods: ['fish', 'bread'] },
  { id: 'stone_gate', minRank: 2, goods: ['stone'] },
  { id: 'bridge_footings', minRank: 2, goods: ['stone', 'wood'] },
  { id: 'court_banquet', minRank: 2, goods: ['bread', 'fish'] },
  { id: 'forge_charcoal', minRank: 3, goods: ['charcoal'] },
  { id: 'abbey_malt', minRank: 3, goods: ['malt', 'grain'] },
  { id: 'smithy_repair', minRank: 3, goods: ['charcoal', 'planks'] },
  { id: 'brewers_supplies', minRank: 3, goods: ['malt', 'wood'] },
  { id: 'guardhouse_ale', minRank: 4, goods: ['beer', 'bread'] },
  { id: 'guild_meeting', minRank: 4, goods: ['beer', 'planks'] },
  { id: 'abbey_hospitality', minRank: 4, goods: ['beer', 'fish'] },
  { id: 'fair_brewers', minRank: 4, goods: ['beer', 'malt'] },
  { id: 'royal_progress', minRank: 5, goods: ['beer', 'bread', 'planks'] },
  { id: 'capital_embassy', minRank: 5, goods: ['beer', 'stone', 'charcoal'] },
] as const satisfies readonly OrderTemplate[];

/** Fixed seasonal pools; no fair is scheduled for a good this settlement cannot produce. */
const FAIR_POOL: Record<Season, readonly Good[]> = {
  spring: ['wood', 'planks', 'grain', 'flour'],
  summer: ['grain', 'flour', 'bread', 'fish', 'malt'],
  autumn: ['planks', 'grain', 'bread', 'malt', 'beer'],
  winter: ['wood', 'planks', 'fish', 'stone', 'charcoal'],
};
const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

export function freshValleyEvents(): ValleyEventState {
  return {
    orders: [], nextOrderTick: 0, nextOrderAfterSoldUnits: 0, lastRejectedTemplate: null,
    sequence: 0, fair: null, lastFairSeasonIndex: -1,
    merchant: null, lastMerchantSeasonIndex: -1,
    ordersDone: 0, orderSilver: 0, merchantSilver: 0,
  };
}

function checkSnapshot(state: EventSnapshot): void {
  if (!Number.isSafeInteger(state.tick) || state.tick < 0 ||
      state.tick > Number.MAX_SAFE_INTEGER - EVENT_SEASON_TICKS) {
    throw new RangeError('event tick must be a non-negative safe integer');
  }
  if (!Number.isInteger(state.town.rank) || state.town.rank < 0 || state.town.rank > 5) {
    throw new RangeError('event rank must be in 0..5');
  }
}

/** Local sfc32 step: same algorithm/state shape as rng.ts, on a clone, never the saved tuple. */
function nextU32(rng: RngState): number {
  let [a, b, c, d] = rng;
  const t = (((a + b) >>> 0) + d) >>> 0;
  d = (d + 1) >>> 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) >>> 0;
  c = ((c << 21) | (c >>> 11)) >>> 0;
  c = (c + t) >>> 0;
  rng[0] = a >>> 0; rng[1] = b >>> 0; rng[2] = c; rng[3] = d;
  return t;
}

function draw(rng: RngState, count: number): number {
  // Modulo-free float scaling mirrors nextInt(rng, 0, count - 1) from rng.ts.
  return Math.floor(nextU32(rng) / 4294967296 * count);
}

/** A good is feasible only if its entire recipe chain is unlocked AND present on this map. */
export function producibleGoods(state: Pick<EventSnapshot, 'town' | 'buildings'>): Good[] {
  const buildingTypes = new Set<BuildingType>(state.buildings.map((b) => b.type));
  const memo = new Set<Good>();
  const feasible = (good: Good): boolean => {
    if (memo.has(good)) return true;
    const rule = PRODUCTION[good];
    if (state.town.rank < rule.rank || !buildingTypes.has(rule.building)) return false;
    if (!rule.requires.every(feasible)) return false;
    memo.add(good);
    return true;
  };
  return GOODS.filter(feasible);
}

function soldUnits(state: Pick<EventSnapshot, 'ledger'>): number {
  let total = 0;
  for (const good of GOODS) total += state.ledger.sold[good];
  return total;
}

function royalOrder(state: EventSnapshot, events: ValleyEventState, rng: RngState, goods: ReadonlySet<Good>): ValleyEventState {
  if (events.orders.length >= MAX_ROYAL_ORDERS || state.tick < events.nextOrderTick ||
      soldUnits(state) < events.nextOrderAfterSoldUnits) return events;
  const available = ORDER_TEMPLATES.filter((entry) =>
    entry.minRank <= state.town.rank && entry.goods.every((good) => goods.has(good)) &&
    entry.id !== events.lastRejectedTemplate &&
    !events.orders.some((order) => order.templateId === entry.id));
  if (available.length === 0) return events; // no draw without an attainable order
  const template = available[draw(rng, available.length)]!;
  const need: Partial<Record<Good, number>> = {};
  const delivered: Partial<Record<Good, number>> = {};
  let value = 0;
  for (const good of template.goods) {
    const baseQty = 6 + 2 * state.town.rank + draw(rng, 5);
    const quantity = Math.max(4, Math.floor(baseQty * (BASE_SILVER[good] <= 1 ? 1.5 : BASE_SILVER[good] >= 6 ? 0.75 : 1)));
    need[good] = quantity;
    delivered[good] = 0;
    value += quantity * BASE_SILVER[good];
  }
  const rewardSilver = Math.ceil(value * 1.5) + 8 + state.town.rank * 5;
  const order: RoyalOrder = {
    id: 'order-' + events.sequence, templateId: template.id, accepted: false, need, delivered,
    rewardSilver, rewardRenown: rewardSilver * 2,
  };
  return {
    ...events, orders: [...events.orders, order], sequence: events.sequence + 1,
    nextOrderTick: state.tick + ORDER_INTERVAL_TICKS, lastRejectedTemplate: null,
  };
}

function seasonalFair(state: EventSnapshot, events: ValleyEventState, rng: RngState, goods: ReadonlySet<Good>): ValleyEventState {
  const currentIndex = Math.floor(state.tick / EVENT_SEASON_TICKS);
  const nextIndex = currentIndex + 1;
  const nextStart = nextIndex * EVENT_SEASON_TICKS;
  const targetIndex = nextIndex % FAIR_EVERY_SEASONS === FAIR_EVERY_SEASONS - 1 &&
    state.tick >= nextStart - FAIR_WARNING_TICKS ? nextIndex : currentIndex;
  if (targetIndex % FAIR_EVERY_SEASONS !== FAIR_EVERY_SEASONS - 1 ||
      targetIndex <= events.lastFairSeasonIndex) return events;
  const startTick = targetIndex * EVENT_SEASON_TICKS;
  const season = SEASONS[targetIndex % SEASONS.length]!;
  const candidates = FAIR_POOL[season].filter((good) => goods.has(good));
  if (candidates.length === 0) {
    // Until the season actually starts, a newly-built producer may still qualify.
    return state.tick >= startTick ? { ...events, fair: null, lastFairSeasonIndex: targetIndex } : events;
  }
  return {
    ...events, fair: {
      id: 'fair-' + targetIndex, good: candidates[draw(rng, candidates.length)]!, season,
      startTick, endTick: startTick + EVENT_SEASON_TICKS, pricePercent: FAIR_PRICE_PERCENT,
    }, lastFairSeasonIndex: targetIndex,
  };
}

/** Announced / active / hidden are derived from the tick; no countdown is persisted. */
export function fairStage(fair: SeasonalFair | null, tick: number): 'upcoming' | 'active' | 'none' {
  if (!fair || tick >= fair.endTick || tick < fair.startTick - FAIR_WARNING_TICKS) return 'none';
  return tick < fair.startTick ? 'upcoming' : 'active';
}

/** Unreserved finished outputs and warehouse stock, excluding market/castle and recipe inputs. */
export function merchantSurplus(state: Pick<EventSnapshot, 'buildings' | 'town'>, usable: (b: Building) => boolean = () => true): Partial<Record<Good, number>> {
  const goods = new Set(producibleGoods(state));
  const available: Partial<Record<Good, number>> = {};
  for (const good of goods) {
    let units = 0;
    for (const b of state.buildings) {
      if (b.type !== 'warehouse' && b.type !== PRODUCTION[good].building) continue;
      if (!usable(b)) continue;
      units += Math.max(0, b.stock[good] - b.reservedOut[good]);
    }
    // Keeps a working stock for chains; stone gets the existing free-valley building reserve.
    const reserve = MERCHANT_STOCK_RESERVE + (good === 'stone' ? MERCHANT_STONE_EXTRA_RESERVE : 0);
    const spare = Math.max(0, units - reserve);
    if (spare >= MERCHANT_MIN_TRADE) available[good] = spare;
  }
  return available;
}

function merchantOffer(state: EventSnapshot, events: ValleyEventState, rng: RngState, usable: (b: Building) => boolean): ValleyEventState {
  const seasonIndex = Math.floor(state.tick / EVENT_SEASON_TICKS);
  if (seasonIndex % MERCHANT_EVERY_SEASONS !== 0 || events.merchant ||
      events.lastMerchantSeasonIndex >= seasonIndex) return events;
  const surplus = merchantSurplus(state, usable);
  const candidates = GOODS.filter((good) => (surplus[good] ?? 0) >= MERCHANT_MIN_TRADE);
  if (candidates.length === 0) return events;
  const good = candidates[draw(rng, candidates.length)]!;
  return {
    ...events,
    merchant: {
      id: 'merchant-' + events.sequence, good, quantity: Math.min(12, surplus[good]!),
      unitCents: BASE_SILVER[good] * MERCHANT_PRICE_PERCENT,
      pricePercent: MERCHANT_PRICE_PERCENT,
    },
    sequence: events.sequence + 1, lastMerchantSeasonIndex: seasonIndex,
  };
}

/**
 * One deterministic event-generation pass. Pure and safe for save/replay.
 * The caller must persist BOTH return values; calling twice with the old snapshot repeats RNG draws.
 * No event is generated outside the free valley. No timers, penalties or random wall-clock calls.
 */
export function proposeValleyEvents(state: EventSnapshot, events: ValleyEventState, usable: (b: Building) => boolean = () => true): EventGeneration {
  checkSnapshot(state);
  const rng = [...state.rng] as RngState;
  if (state.mission.id !== 'sandbox') return { events, rng };
  const goods = new Set(producibleGoods(state));
  let next = events;
  // Do not hold expired fair offers in the HUD; lastFairSeasonIndex prevents re-rolling them.
  if (next.fair !== null && state.tick >= next.fair.endTick) next = { ...next, fair: null };
  next = seasonalFair(state, next, rng, goods);
  next = royalOrder(state, next, rng, goods);
  next = merchantOffer(state, next, rng, usable);
  return { events: next, rng };
}

/** No penalty. A dismissed order can be replaced after a new market delivery, not immediately. */
export function dismissRoyalOrder(state: EventSnapshot, events: ValleyEventState, id: string): ValleyEventState {
  const order = events.orders.find((entry) => entry.id === id);
  if (!order) return events;
  return {
    ...events, orders: events.orders.filter((entry) => entry.id !== id),
    nextOrderTick: state.tick, nextOrderAfterSoldUnits: soldUnits(state) + 1,
    lastRejectedTemplate: order.templateId,
  };
}

export interface OrderDelivery {
  events: ValleyEventState;
  accepted: number;
  /** If completed, award once in the future atomic sim transaction with goods consumption. */
  reward: { silver: number; renown: number } | null;
}

/** Pure progress accounting; the future sim adapter must debit castle stock + ledger.consumed. */
export function deliverRoyalOrder(events: ValleyEventState, id: string, good: Good, quantity: number): OrderDelivery {
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new RangeError('quantity must be a non-negative safe integer');
  const index = events.orders.findIndex((entry) => entry.id === id);
  if (index < 0) return { events, accepted: 0, reward: null };
  const order = events.orders[index]!;
  const accepted = Math.min(quantity, Math.max(0, (order.need[good] ?? 0) - (order.delivered[good] ?? 0)));
  if (accepted === 0) return { events, accepted: 0, reward: null };
  const delivered = { ...order.delivered, [good]: (order.delivered[good] ?? 0) + accepted };
  const complete = GOODS.every((g) => (delivered[g] ?? 0) >= (order.need[g] ?? 0));
  const orders = events.orders.slice();
  if (complete) orders.splice(index, 1);
  else orders[index] = { ...order, delivered };
  return {
    events: { ...events, orders }, accepted,
    reward: complete ? { silver: order.rewardSilver, renown: order.rewardRenown } : null,
  };
}

/** Leave the merchant offer without loss; the next one can appear in a later eligible season. */
export function dismissMerchant(events: ValleyEventState): ValleyEventState {
  return events.merchant ? { ...events, merchant: null } : events;
}

/** Close one voluntary sale exactly once; the sim adapter must validate stock and transfer goods. */
export function acceptMerchant(events: ValleyEventState, id: string, quantity: number): {
  events: ValleyEventState; good: Good | null; accepted: number; cents: number;
} {
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new RangeError('quantity must be a non-negative safe integer');
  const offer = events.merchant;
  if (!offer || offer.id !== id || quantity === 0) return { events, good: null, accepted: 0, cents: 0 };
  const accepted = Math.min(quantity, offer.quantity);
  return {
    events: { ...events, merchant: null }, good: offer.good,
    accepted, cents: accepted * offer.unitCents,
  };
}


// --- Sim adapters (D-54) -------------------------------------------------------------------------

/** Event generation runs once per sim second, at the end of the tick (after market and ledger). */
export const EVENT_CHECK_TICKS = 10;

function castleOf(world: World): Building | null {
  for (const b of world.state.buildings) if (b.type === 'castle') return b;
  return null;
}

/** A source the merchant can reach: connected by road to the castle gate. */
function usableFor(world: World): (b: Building) => boolean {
  const castle = castleOf(world);
  return (b) => !!castle && reachable(world, b.gate, castle.gate);
}

/** One generation pass for the world (sandbox states only); writes events and rng together. */
export function stepValleyEvents(world: World): void {
  const st = world.state;
  const ev = st.valleyEvents;
  if (!ev || st.mission.id !== 'sandbox') return;
  const r = proposeValleyEvents(st, ev, usableFor(world));
  st.valleyEvents = r.events;
  st.rng = r.rng;
}

/** Fair price percentage for a good right now (125 during its fair, else 100). The only fair hook. */
export function fairPercent(world: World, good: Good): number {
  const ev = world.state.valleyEvents;
  if (!ev || !ev.fair || ev.fair.good !== good) return 100;
  return fairStage(ev.fair, world.state.tick) === 'active' ? ev.fair.pricePercent : 100;
}

/** Units of g still owed to accepted royal orders (dispatcher priority, HUD). */
export function orderOutstanding(st: Pick<SimState, 'valleyEvents'>, g: Good): number {
  const ev = st.valleyEvents;
  if (!ev) return 0;
  let n = 0;
  for (const o of ev.orders) if (o.accepted) n += Math.max(0, (o.need[g] ?? 0) - (o.delivered[g] ?? 0));
  return n;
}

/**
 * Goods arriving at the castle market go first to accepted royal orders (oldest first): they leave
 * the world as consumed and sold (to the crown, not the market: no saturation, no market price).
 * A completed order pays its silver and renown once. Returns units taken; the rest is sold as usual.
 */
export function handInOrders(world: World, castle: Building, g: Good): number {
  const st = world.state;
  let ev = st.valleyEvents;
  if (!ev || !ev.orders.some((o) => o.accepted)) return 0;
  let taken = 0;
  for (const order of ev.orders.slice()) {
    if (!order.accepted) continue;
    const have = castle.stock[g];
    if (have <= 0) break;
    const r = deliverRoyalOrder(ev, order.id, g, have);
    if (r.accepted === 0) continue;
    ev = r.events;
    castle.stock[g] -= r.accepted;
    st.ledger.consumed[g] += r.accepted;
    st.ledger.sold[g] += r.accepted;
    taken += r.accepted;
    if (r.reward) {
      st.coins += r.reward.silver;
      st.ledger.silverEarned += r.reward.silver;
      st.town.renown += r.reward.renown;
      ev = { ...ev, ordersDone: ev.ordersDone + 1, orderSilver: ev.orderSilver + r.reward.silver };
    }
  }
  st.valleyEvents = ev;
  return taken;
}

export type EventCommandError = { k: 'NO_EVENT' } | { k: 'NO_SURPLUS' };

/** Accept an offered royal order: from now on castle deliveries count towards it. */
export function acceptOrder(world: World, id: string): EventCommandError | null {
  const ev = world.state.valleyEvents;
  const order = ev?.orders.find((o) => o.id === id);
  if (!ev || !order || order.accepted) return { k: 'NO_EVENT' };
  world.state.valleyEvents = { ...ev, orders: ev.orders.map((o) => (o.id === id ? { ...o, accepted: true } : o)) };
  return null;
}

/** Set an order aside (offered or accepted): no loss; delivered goods stay delivered (D-21). */
export function declineOrder(world: World, id: string): EventCommandError | null {
  const st = world.state;
  const ev = st.valleyEvents;
  if (!ev || !ev.orders.some((o) => o.id === id)) return { k: 'NO_EVENT' };
  st.valleyEvents = dismissRoyalOrder(st, ev, id);
  return null;
}

/** Put the merchant's offer aside. */
export function declineMerchant(world: World, id: string): EventCommandError | null {
  const ev = world.state.valleyEvents;
  if (!ev || !ev.merchant || ev.merchant.id !== id) return { k: 'NO_EVENT' };
  world.state.valleyEvents = dismissMerchant(ev);
  return null;
}

/**
 * Sell surplus to the merchant at the fixed quote: re-checks the surplus now (unreserved, connected
 * to the castle, working reserve kept), takes it from producers first, then granaries (lowest id
 * first), books consumed + sold, pays through market.cents. Not market income: no saturation and no
 * silver/min flow (the rank flow requirement stays a measure of the market). Returns units sold.
 */
export function sellToMerchant(world: World, id: string): { err: EventCommandError } | { sold: number; silver: number } {
  const st = world.state;
  const ev = st.valleyEvents;
  const offer = ev?.merchant;
  if (!ev || !offer || offer.id !== id) return { err: { k: 'NO_EVENT' } };
  const g = offer.good;
  const surplus = merchantSurplus(st, usableFor(world))[g] ?? 0;
  const qty = Math.min(offer.quantity, surplus);
  if (qty <= 0) return { err: { k: 'NO_SURPLUS' } };
  const usable = usableFor(world);
  let left = qty;
  for (const pass of [PRODUCTION[g].building, 'warehouse'] as const) {
    for (const b of st.buildings) {
      if (left <= 0) break;
      if (b.type !== pass || !usable(b)) continue;
      const k = Math.min(left, b.stock[g] - b.reservedOut[g]);
      if (k <= 0) continue;
      b.stock[g] -= k;
      left -= k;
    }
  }
  const sold = qty - left;
  const sale = acceptMerchant(ev, id, sold);
  st.ledger.consumed[g] += sold;
  st.ledger.sold[g] += sold;
  const m = st.market;
  m.cents += sale.cents;
  const pay = Math.floor(m.cents / 100);
  m.cents -= pay * 100;
  st.coins += pay;
  st.ledger.silverEarned += pay;
  st.town.renown += pay;
  st.valleyEvents = { ...sale.events, merchantSilver: sale.events.merchantSilver + pay };
  return { sold, silver: pay };
}
