// D-21/D-29/D-33: pure, optional sandbox proposals.
import { readFileSync } from 'node:fs';
import {
  BUILDINGS, GOODS, MARKET, RANKS, SEASON_TICKS, createWorld, emptyGoods,
  type BuildingType, type Good, type SimState,
} from '../src/sim/index';
import { seedRng } from '../src/sim/rng';
import {
  EVENT_SEASON_TICKS, FAIR_WARNING_TICKS, FAIR_EVERY_SEASONS, FAIR_PRICE_PERCENT,
  MAX_ROYAL_ORDERS, MERCHANT_EVERY_SEASONS, MERCHANT_PRICE_PERCENT,
  ORDER_INTERVAL_TICKS, ORDER_TEMPLATES, acceptMerchant, deliverRoyalOrder, dismissMerchant,
  dismissRoyalOrder, fairStage, freshValleyEvents, merchantSurplus, producibleGoods, proposeValleyEvents,
  type ValleyEventState,
} from '../src/sim/proposals/events';
import { assert, eq, test } from './harness';

const allProducerTypes: BuildingType[] = [
  'woodcutter', 'sawmill', 'farm', 'mill', 'bakery',
  'fisher', 'quarry', 'charcoalBurner', 'malthouse', 'brewery',
];
const rankGoods: Good[][] = [
  ['wood', 'planks', 'grain'],
  ['wood', 'planks', 'grain', 'flour', 'bread'],
  ['wood', 'planks', 'grain', 'flour', 'bread', 'fish', 'stone'],
  ['wood', 'planks', 'grain', 'flour', 'bread', 'fish', 'stone', 'charcoal', 'malt'],
  [...GOODS], [...GOODS],
];

function state(seed = 2026): SimState {
  const result = createWorld('sandbox').state;
  result.rng = seedRng(seed);
  return result;
}

function addBuilding(st: SimState, type: BuildingType): void {
  if (st.buildings.some((b) => b.type === type)) return;
  const def = BUILDINGS[type];
  st.buildings.push({
    id: st.nextId++, type, x: 0, y: 0, w: def.w, h: def.h, gate: 0, facing: 0,
    stock: emptyGoods(), reservedOut: emptyGoods(), incoming: emptyGoods(),
    progress: -1, status: { k: 'IDLE' }, stalledTicks: 0, capOverride: -1, placedTick: 0,
  });
}

function advanced(rank = 5, seed = 2026): SimState {
  const st = state(seed);
  st.town.rank = rank;
  for (const type of allProducerTypes) addBuilding(st, type);
  return st;
}

function generate(st: SimState, events = freshValleyEvents()): ValleyEventState {
  const result = proposeValleyEvents(st, events);
  st.rng = result.rng;
  return result.events;
}

function checkGoods(st: SimState, events: ValleyEventState): void {
  const possible = new Set(producibleGoods(st));
  for (const order of events.orders) {
    for (const good of Object.keys(order.need) as Good[]) {
      assert(possible.has(good), 'order requires unavailable ' + good);
    }
  }
  if (events.fair) assert(possible.has(events.fair.good), 'fair good is producible');
  if (events.merchant) assert(possible.has(events.merchant.good), 'merchant good is producible');
}

test('events: ten goods, ranks 0–5, 30 bilingual templates and exact D-33 seasons', () => {
  eq(GOODS.length, 10, 'ten canonical goods');
  eq(RANKS.length, 6, 'ranks 0-5');
  eq(EVENT_SEASON_TICKS, SEASON_TICKS, 'same calendar as live seasons');
  assert(ORDER_TEMPLATES.length >= 20, 'minimum story variants');
  eq(new Set(ORDER_TEMPLATES.map((t) => t.id)).size, ORDER_TEMPLATES.length, 'unique ids');
  for (let rank = 0; rank <= 5; rank++) {
    assert(ORDER_TEMPLATES.some((t) => t.minRank === rank), 'content for every rank');
  }
  for (const template of ORDER_TEMPLATES) {
    assert(template.goods.length >= 1 && template.goods.length <= 3, 'valid cargo list');
    for (const good of template.goods) assert(GOODS.includes(good), 'canonical good ' + good);
  }
});

test('events: available goods require both rank and every real producer in the chain', () => {
  for (let rank = 0; rank <= 5; rank++) {
    const st = advanced(rank);
    eq(producibleGoods(st).join(','), rankGoods[rank]!.join(','), 'rank ' + rank);
    checkGoods(st, generate(st));
  }
  const st = advanced(4);
  st.buildings = st.buildings.filter((b) => b.type !== 'malthouse');
  assert(!producibleGoods(st).includes('beer'), 'brewery without malthouse cannot make beer');
  st.buildings = st.buildings.filter((b) => b.type !== 'farm');
  for (const good of ['grain', 'flour', 'bread', 'malt', 'beer'] as Good[]) {
    assert(!producibleGoods(st).includes(good), 'missing farm excludes ' + good);
  }
});

test('events: no producer means no offered good or RNG advancement', () => {
  const st = state();
  st.buildings = st.buildings.filter((b) => b.type === 'castle' || b.type === 'stable');
  st.tick = 2 * EVENT_SEASON_TICKS - FAIR_WARNING_TICKS;
  const initial = freshValleyEvents();
  const snapshot = JSON.stringify(st);
  const result = proposeValleyEvents(st, initial);
  eq(JSON.stringify(st), snapshot, 'snapshot not mutated');
  eq(JSON.stringify(initial), JSON.stringify(freshValleyEvents()), 'event state not mutated');
  eq(JSON.stringify(result.rng), JSON.stringify(st.rng), 'no needless RNG draws');
  eq(result.events.orders.length, 0, 'no orders without goods');
  eq(result.events.fair, null, 'no fair without goods');
});

test('events: a saved state with same seed has the same event stream', () => {
  const trace = (seed: number, saveLoad: boolean): string => {
    let st = advanced(5, seed);
    st.buildings.find((b) => b.type === 'warehouse')!.stock.planks = 40;
    let events = freshValleyEvents();
    const log: string[] = [];
    for (let i = 0; i < 50; i++) {
      st.tick = i * 1_800;
      st.ledger.sold.wood++;
      const before = JSON.stringify(st);
      const result = proposeValleyEvents(st, events);
      eq(JSON.stringify(st), before, 'pure generator');
      st.rng = result.rng;
      events = result.events;
      checkGoods(st, events);
      log.push(JSON.stringify({ rng: st.rng, events }));
      if (saveLoad && i === 20) {
        st = JSON.parse(JSON.stringify(st)) as SimState;
        events = JSON.parse(JSON.stringify(events)) as ValleyEventState;
      }
    }
    return log.join('\n');
  };
  eq(trace(19, false), trace(19, true), 'JSON reload continues bit-identically');
  eq(trace(19, false), trace(19, false), 'same seed deterministic');
  assert(trace(19, false) !== trace(20, false), 'seed affects draws');
});

test('events: max two orders, six-minute offer cadence, no repeated draws', () => {
  const st = advanced();
  let events = generate(st);
  eq(events.orders.length, 1, 'first offer');
  eq(JSON.stringify(proposeValleyEvents(st, events).rng), JSON.stringify(st.rng), 'no duplicate RNG draw');
  st.tick = ORDER_INTERVAL_TICKS - 1;
  eq(generate(st, events).orders.length, 1, 'not before six simulated minutes');
  st.tick++;
  events = generate(st, events);
  eq(events.orders.length, 2, 'second slot');
  for (let i = 0; i < 20; i++) {
    st.tick += ORDER_INTERVAL_TICKS;
    events = generate(st, events);
    assert(events.orders.length <= MAX_ROYAL_ORDERS, 'never exceeds two');
    eq(new Set(events.orders.map((o) => o.templateId)).size, events.orders.length, 'distinct stories');
    for (const order of events.orders) {
      eq(order.rewardRenown, order.rewardSilver * 2, 'double renown');
      assert(!('deadlineTick' in order), 'no deadline');
    }
  }
});

test('events: discarding needs a later delivery; completed orders pay exactly once', () => {
  const st = advanced(2);
  let events = generate(st);
  const rejected = events.orders[0]!;
  events = dismissRoyalOrder(st, events, rejected.id);
  eq(events.orders.length, 0, 'decline is free');
  eq(generate(st, events).orders.length, 0, 'no instant reroll');
  st.ledger.sold.wood++;
  events = generate(st, events);
  eq(events.orders.length, 1, 'a later sale replenishes an offer');
  assert(events.orders[0]!.templateId !== rejected.templateId, 'new story');
  const order = events.orders[0]!;
  let paid: { silver: number; renown: number } | null = null;
  for (const good of Object.keys(order.need) as Good[]) {
    const r = deliverRoyalOrder(events, order.id, good, 10_000);
    events = r.events;
    paid = r.reward;
  }
  eq(events.orders.length, 0, 'completed order removed');
  eq(paid?.silver, order.rewardSilver, 'silver reward');
  eq(paid?.renown, order.rewardRenown, 'renown reward');
  eq(deliverRoyalOrder(events, order.id, 'wood', 10).reward, null, 'cannot pay twice');
  let threw = false;
  try { deliverRoyalOrder(events, order.id, 'wood', -1); } catch (e) { threw = e instanceof RangeError; }
  assert(threw, 'reject negative delivery');
});

test('events: every third 15-minute season offers an advance-announced 25% fair', () => {
  const st = advanced();
  let events = freshValleyEvents();
  const first = 2 * EVENT_SEASON_TICKS;
  st.tick = first - FAIR_WARNING_TICKS - 1;
  events = generate(st, events);
  eq(events.fair, null, 'no premature announcement');
  st.tick++;
  events = generate(st, events);
  eq(events.fair?.startTick, first, 'announcement 2min in advance');
  eq(events.fair?.pricePercent, FAIR_PRICE_PERCENT, '25 percent');
  eq(fairStage(events.fair, st.tick), 'upcoming', 'upcoming state');
  st.tick = first;
  events = generate(st, events);
  eq(fairStage(events.fair, st.tick), 'active', 'active season');
  st.tick += EVENT_SEASON_TICKS;
  events = generate(st, events);
  eq(events.fair, null, 'bonus ends naturally');
  let total = 0;
  for (let season = 0; season < 14; season++) {
    st.tick = season * EVENT_SEASON_TICKS;
    events = generate(st, events);
    if (events.fair?.startTick === st.tick) {
      total++;
      checkGoods(st, events);
    }
  }
  assert(total >= 3, 'regular seasonal fair cadence');
  eq(FAIR_EVERY_SEASONS, 3, 'every third season');
});

test('events: unreserved warehouse and producer outputs are merchant-only surplus', () => {
  const st = advanced(4);
  const warehouse = st.buildings.find((b) => b.type === 'warehouse')!;
  const sawmill = st.buildings.find((b) => b.type === 'sawmill')!;
  const castle = st.buildings.find((b) => b.type === 'castle')!;
  castle.stock.planks = 200;
  sawmill.stock.wood = 50; // input, not sawmill output
  eq(merchantSurplus(st).planks ?? 0, 0, 'do not sell castle stock');
  eq(merchantSurplus(st).wood ?? 0, 0, 'do not sell producer inputs');
  warehouse.stock.planks = 17;
  warehouse.reservedOut.planks = 5;
  eq(merchantSurplus(st).planks, 6, 'unreserved after working reserve');
  warehouse.stock.stone = 27;
  eq(merchantSurplus(st).stone ?? 0, 0, 'keep 18 extra stone for roads');
  warehouse.stock.stone = 28;
  eq(merchantSurplus(st).stone, 4, 'only surplus stone');
});

test('events: merchant buys one good at 140%, one offer per two seasons, sale only once', () => {
  const st = state();
  st.buildings.find((b) => b.type === 'warehouse')!.stock.planks = 25;
  let events = generate(st);
  const first = events.merchant!;
  eq(first.good, 'planks', 'available good');
  eq(first.pricePercent, MERCHANT_PRICE_PERCENT, 'premium');
  eq(first.unitCents, MARKET.base.planks * 140, 'correct quote in cents');
  const source = JSON.stringify(events);
  const sale = acceptMerchant(events, first.id, 100);
  eq(JSON.stringify(events), source, 'sale does not mutate caller');
  eq(sale.accepted, first.quantity, 'bounded offer');
  eq(sale.cents, sale.accepted * first.unitCents, 'fixed quote');
  eq(acceptMerchant(sale.events, first.id, 1).accepted, 0, 'one-time settlement');
  events = dismissMerchant(events);
  st.tick = EVENT_SEASON_TICKS;
  events = generate(st, events);
  eq(events.merchant, null, 'not every season');
  st.tick = MERCHANT_EVERY_SEASONS * EVENT_SEASON_TICKS;
  events = generate(st, events);
  assert(events.merchant !== null && events.merchant.id !== first.id, 'new visit later');
});

test('events: contract missions untouched; invalid rank and tick rejected', () => {
  const st = createWorld('m1').state;
  const initial = freshValleyEvents();
  const result = proposeValleyEvents(st, initial);
  eq(result.events, initial, 'contract mission disabled');
  eq(JSON.stringify(result.rng), JSON.stringify(st.rng), 'no mission RNG draws');
  const sandbox = state();
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    sandbox.tick = value;
    let threw = false;
    try { proposeValleyEvents(sandbox, initial); } catch (e) { threw = e instanceof RangeError; }
    assert(threw, 'invalid tick rejected');
  }
  sandbox.tick = 0;
  for (const value of [-1, 6, 1.5]) {
    sandbox.town.rank = value;
    let threw = false;
    try { proposeValleyEvents(sandbox, initial); } catch (e) { threw = e instanceof RangeError; }
    assert(threw, 'invalid rank rejected');
  }
});

test('events: all content template IDs have complete Polish and English rows', () => {
  const content = readFileSync(new URL('../docs/content/events.md', import.meta.url), 'utf8');
  const tick = String.fromCharCode(96);
  const rows = content.split('\n').filter((line) => line.startsWith('| ' + tick));
  const ids = new Set<string>();
  for (const row of rows) {
    const cols = row.split('|').slice(1, -1).map((part) => part.trim());
    eq(cols.length, 5, 'template, rank, goods, PL, EN');
    const id = cols[0]!.slice(1, -1);
    assert(ORDER_TEMPLATES.some((t) => t.id === id), 'known ID: ' + id);
    assert(!ids.has(id), 'unique ID: ' + id);
    ids.add(id);
    assert(cols[3]!.length >= 20 && cols[4]!.length >= 20, 'complete bilingual text');
  }
  eq(ids.size, ORDER_TEMPLATES.length, 'every story has both languages');
});
