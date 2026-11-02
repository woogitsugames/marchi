// Free valley (docs/design/sandbox.md S2-S4): market prices and saturation, sales keep goods
// conserved, placement validation is pure, fresh buildings undo with a full refund, ranks gate
// building types and latch, and the whole thing is deterministic and survives save/load.
import {
  BUILDINGS, FLOW_BUCKETS, FLOW_BUCKET_TICKS, MARKET, RANKS, TICK_HZ, UNDO_TICKS, applyCommand, checkInvariants,
  createWorld, deserialize, lineCells, serialize, stateHash, step, unexplainedStalls, type BuildingType, type World,
} from '../src/sim/index';
import { validatePlace } from '../src/sim/commands';
import { seedRng } from '../src/sim/rng';
import {
  canPlace, demolishQuote, lastUndoable, pricePct, quoteCents, sandboxStatus, sellAt, stepTown, unitCents,
} from '../src/sim/town';
import { DECENT, runSandbox } from '../tools/bot-sandbox';
import { genCommand } from '../tools/fuzz-lib';
import { assert, eq, test } from './harness';

const castleOf = (w: World) => w.state.buildings.find((b) => b.type === 'castle')!;
const stableOf = (w: World) => w.state.buildings.find((b) => b.type === 'stable')!;

// --- market math -----------------------------------------------------------------------------

test('market: price falls monotonically with saturation to the floor and never below', () => {
  eq(pricePct(0), 100, 'unsaturated');
  eq(pricePct(MARKET.cap), MARKET.floorPct, 'at cap');
  eq(pricePct(MARKET.cap * 5), MARKET.floorPct, 'beyond cap');
  for (let s = 1; s <= MARKET.cap; s++) assert(pricePct(s) <= pricePct(s - 1), `monotonic at ${s}`);
  for (let s = 0; s <= MARKET.cap; s++) assert(Number.isInteger(pricePct(s)), 'integer percent');
});

test('market: selling 12 planks pays the saturating quote, keeps the remainder and conserves goods', () => {
  const w = createWorld('sandbox');
  const st = w.state, castle = castleOf(w);
  // planks appear in the castle as if delivered (produced elsewhere)
  castle.stock.planks += 12;
  st.ledger.produced.planks += 12;
  const quote = quoteCents(st, 'planks', 12);
  let expect = 0, sat = 0;
  for (let i = 0; i < 12; i++) { expect += MARKET.base.planks * pricePct(sat); sat++; }
  eq(quote, expect, 'quote = sum of per-unit prices');
  const coins0 = st.coins;
  const paid = sellAt(w, castle, 'planks');
  eq(paid, Math.floor(quote / 100), 'paid whole coins');
  eq(st.coins, coins0 + paid, 'coins');
  eq(st.market.cents, quote % 100, 'remainder kept in cents');
  eq(st.market.saturation.planks, 12, 'saturation');
  eq(castle.stock.planks, 0, 'castle stock sold');
  eq(st.ledger.sold.planks, 12, 'ledger sold');
  eq(st.ledger.silverEarned, paid, 'ledger silver');
  eq(st.town.renown, paid, 'renown');
  eq(checkInvariants(w).length, 0, 'invariants: ' + checkInvariants(w).join('; '));
  // a second batch is cheaper per unit
  assert(unitCents(st, 'planks') < MARKET.base.planks * 100, 'saturated price lower');
});

test('market: saturation recovers one unit every MARKET.recoverTicks, only while the market is open', () => {
  const w = createWorld('sandbox');
  const st = w.state;
  st.market.saturation.bread = 5;
  st.market.saturation.wood = MARKET.cap;
  while ((st.tick + 1) % MARKET.recoverTicks !== 0) { stepTown(w); st.tick++; }
  stepTown(w);
  eq(st.market.saturation.bread, 4, 'one unit recovered');
  eq(st.market.saturation.wood, MARKET.cap - 1, 'from the cap too');
  const m1 = createWorld('m1');
  eq(m1.state.market.open, false, 'contract missions keep the market closed');
  eq(createWorld('lab').state.market.open, false, 'the test bench keeps it closed');
  m1.state.market.saturation.bread = 5;
  for (let i = 0; i < MARKET.recoverTicks * 2; i++) step(m1);
  eq(m1.state.market.saturation.bread, 5, 'closed market does not change');
});

// --- sandbox runs ------------------------------------------------------------------------------

test('sandbox bot: goods conserved and every stall explained every tick for 20 min, rank 1 by 12 min', () => {
  const r = runSandbox(DECENT, 20, { checkEvery: 1 });
  eq(r.violations.length, 0, 'violations: ' + r.violations.join(' | '));
  assert(r.rank >= 1, `rank ${r.rank}`);
  assert(r.rankMin[1]! > 0 && r.rankMin[1]! <= 12, `rank 1 at ${r.rankMin[1]} min`);
  assert(r.sold.planks! > 0 && r.sold.bread! > 0, 'sold planks and bread');
  assert(r.firstBuildMin > 0 && r.firstBuildMin <= 4, `income covers a building after ${r.firstBuildMin} min`);
});

test('sandbox: no deadline and no loss; doing nothing keeps silver positive and the rank at 0', () => {
  const r = runSandbox([], 30, { checkEvery: 20 });
  eq(r.violations.length, 0, 'violations: ' + r.violations.join(' | '));
  eq(r.rank, 0, 'rank');
  assert(r.coins >= 260, `coins ${r.coins}`);
  assert(r.earned > 0, 'the start settlement earns');
  const w = createWorld('sandbox');
  for (let i = 0; i < 45 * 60 * TICK_HZ; i++) step(w);
  eq(w.state.mission.result, 'running', 'still running after 45 min');
});

function scriptedSandbox(ticks: number, saveAt = -1): string {
  let w = createWorld('sandbox');
  let k = 0;
  while (w.state.tick < ticks) {
    if (w.state.tick % TICK_HZ === 0 && k < DECENT.length) {
      const s = DECENT[k]!;
      if ((s.rank ?? 0) <= w.state.town.rank) {
        const r = applyCommand(w, s.cmds(w)[0]!);
        if (r.ok || r.err.k !== 'NO_COINS') k++;
      }
    }
    step(w);
    if (w.state.tick === saveAt) w = deserialize(serialize(w));
  }
  return stateHash(w);
}

test('sandbox determinism: same commands => same hash; save/load mid-run continues identically', () => {
  const a = scriptedSandbox(9000), b = scriptedSandbox(9000), c = scriptedSandbox(9000, 4321);
  eq(a, b, 'two runs');
  eq(c, a, 'save/load at tick 4321');
});

// --- placement ---------------------------------------------------------------------------------

test('validatePlace is pure and agrees with place on fuzzed placements (sandbox, m1)', () => {
  for (const id of ['sandbox', 'm1']) {
    const w = createWorld(id);
    w.state.coins = 4000;
    w.state.town.rank = id === 'sandbox' ? 1 : 0;
    const rng = seedRng(4242);
    let placed = 0, refused = 0;
    for (let i = 0; i < 400; i++) {
      const cmd = genCommand(w, rng);
      if (cmd.t !== 'place') { if (i % 3 === 0) step(w); continue; }
      const before = stateHash(w);
      const v = validatePlace(w, cmd.type, cmd.x, cmd.y, cmd.facing);
      eq(stateHash(w), before, 'validatePlace does not mutate');
      const r = applyCommand(w, cmd);
      eq(JSON.stringify(r), JSON.stringify(v), `place agrees with validatePlace for ${JSON.stringify(cmd)}`);
      if (r.ok) placed++; else refused++;
    }
    assert(placed > 0 && refused > 0, `${id}: both outcomes seen (${placed} placed, ${refused} refused)`);
    eq(checkInvariants(w).length, 0, 'invariants');
  }
});

test('undo: demolishing a fresh building within 30 s refunds 100 %, later 50 %; placedTick recorded', () => {
  const w = createWorld('sandbox');
  const st = w.state;
  const c0 = st.coins;
  const earned0 = st.ledger.silverEarned;
  assert(applyCommand(w, { t: 'place', type: 'farm', x: 55, y: 25, facing: 2 }).ok, 'farm placed');
  const farm = st.buildings[st.buildings.length - 1]!;
  eq(farm.placedTick, st.tick, 'placedTick');
  eq(castleOf(w).placedTick, -1, 'map buildings are not undoable');
  const u = lastUndoable(w);
  assert(u !== null && u.building === farm.id && u.refund === BUILDINGS.farm.price, 'undo offer');
  // 5 s later (before the farm's first 8 s harvest: an empty building)
  for (let i = 0; i < 50; i++) step(w);
  const q = demolishQuote(w, farm);
  assert(q.full && q.secondsLeft === (UNDO_TICKS - 50) / TICK_HZ, 'still fresh: ' + JSON.stringify(q));
  assert(applyCommand(w, { t: 'demolish', cell: farm.y * w.terrain.w + farm.x }).ok, 'undone');
  eq(st.coins, c0 + (st.ledger.silverEarned - earned0), 'full refund (plus market income meanwhile)');
  eq(lastUndoable(w), null, 'nothing left to undo');
  // late demolition: half
  assert(applyCommand(w, { t: 'place', type: 'warehouse', x: 40, y: 25, facing: 2 }).ok, 'warehouse placed');
  const wh = st.buildings[st.buildings.length - 1]!;
  for (let i = 0; i <= UNDO_TICKS; i++) step(w);
  eq(demolishQuote(w, wh).full, false, 'window closed');
  const c1 = st.coins;
  assert(applyCommand(w, { t: 'demolish', cell: wh.y * w.terrain.w + wh.x }).ok, 'demolished');
  eq(st.coins, c1 + Math.floor(BUILDINGS.warehouse.price * 0.5), 'half refund');
  eq(checkInvariants(w).length, 0, 'invariants');
});

test('undo: a fresh building that already holds goods refunds half', () => {
  const w = createWorld('sandbox');
  const st = w.state;
  assert(applyCommand(w, { t: 'place', type: 'farm', x: 55, y: 25, facing: 2 }).ok, 'farm placed');
  const farm = st.buildings[st.buildings.length - 1]!;
  while (farm.stock.grain === 0) step(w);
  assert(st.tick - farm.placedTick <= UNDO_TICKS, 'still inside the window');
  eq(demolishQuote(w, farm).full, false, 'not empty');
  eq(demolishQuote(w, farm).refund, Math.floor(BUILDINGS.farm.price * 0.5), 'half');
});

// --- ranks -------------------------------------------------------------------------------------

test('ranks gate placement in the free valley only', () => {
  const w = createWorld('sandbox');
  w.state.coins = 1000;
  const r = applyCommand(w, { t: 'place', type: 'mill', x: 58, y: 25, facing: 2 });
  assert(!r.ok && r.err.k === 'LOCKED' && r.err.rank === 1, 'mill locked at rank 0: ' + JSON.stringify(r));
  const c = applyCommand(w, { t: 'place', type: 'castle', x: 70, y: 26, facing: 2 });
  assert(!c.ok && c.err.k === 'NOT_PLACEABLE', 'castle never placeable: ' + JSON.stringify(c));
  const W = w.terrain.w;
  const cob = applyCommand(w, { t: 'road', surface: 2, cells: lineCells(W, 24 * W + 30, 24 * W + 40) });
  assert(!cob.ok && cob.err.k === 'LOCKED' && cob.err.rank === 2, 'cobble locked until rank 2: ' + JSON.stringify(cob));
  assert(applyCommand(w, { t: 'road', surface: 1, cells: lineCells(W, 26 * W + 64, 26 * W + 70) }).ok, 'dirt road open');
  for (const t of RANKS[0]!.unlocks) assert(canPlace(w, t).ok, `${t} open at rank 0`);
  w.state.town.rank = 1;
  assert(applyCommand(w, { t: 'place', type: 'mill', x: 58, y: 25, facing: 2 }).ok, 'mill at rank 1');
  // missions keep everything open
  const m = createWorld('m1');
  m.state.coins = 1000;
  for (const t of Object.keys(BUILDINGS) as BuildingType[]) assert(canPlace(m, t).ok, `m1: ${t} open`);
  const st = sandboxStatus(m);
  eq(st.gated, false, 'm1 not gated');
  eq(st.market, false, 'm1 market closed');
});

test('ranks latch on renown + distinct goods + best flow and never go down', () => {
  const w = createWorld('sandbox');
  const st = w.state, r1 = RANKS[1]!;
  st.town.renown = r1.renown;
  st.ledger.sold.planks = 1; st.ledger.consumed.planks = 1; st.ledger.produced.planks = 1;
  st.town.bestFlow = r1.flow;
  stepTown(w);
  eq(st.town.rank, 0, 'one good is not enough');
  st.ledger.sold.wood = 1; st.ledger.consumed.wood = 1; st.ledger.produced.wood = 1;
  stepTown(w);
  eq(st.town.rank, 1, 'rank 1');
  eq(st.town.rankTicks[1], st.tick, 'rank tick');
  st.town.bestFlow = 0; // latches cannot be lost in play; even so the rank stays
  stepTown(w);
  eq(st.town.rank, 1, 'never down');
  const s = sandboxStatus(w);
  eq(s.rank, 1, 'status rank');
  assert(s.next !== null && s.next.rank === 2 && s.next.renown === RANKS[2]!.renown, 'next goal');
  assert(s.unlocked.includes('mill') && s.locked.length === 0, 'unlocked list: ' + JSON.stringify(s));
  eq(s.prices.length, 5, 'prices for every good');
});

test('flow window: best silver/min latches from the 18 x 10 s ring', () => {
  const w = createWorld('sandbox');
  const st = w.state;
  eq(FLOW_BUCKETS * FLOW_BUCKET_TICKS, 180 * TICK_HZ, 'three minutes');
  const castle = castleOf(w);
  // sell 3 bread every 10 s for 3 minutes => 3 * 4 * 18 / 3 = 72 silver/min while unsaturated
  for (let b = 0; b < FLOW_BUCKETS; b++) {
    castle.stock.bread += 3; st.ledger.produced.bread += 3;
    sellAt(w, castle, 'bread');
    for (let i = 0; i < FLOW_BUCKET_TICKS; i++) step(w);
  }
  assert(st.town.bestFlow >= 20, `best flow ${st.town.bestFlow}`);
  const best = st.town.bestFlow;
  for (let i = 0; i < FLOW_BUCKETS * FLOW_BUCKET_TICKS; i++) step(w);
  eq(st.town.bestFlow, best, 'latched while nothing sells');
  eq(stableOf(w).type, 'stable', 'world intact');
  eq(unexplainedStalls(w).length, 0, 'stalls explained');
});
