// The free valley's trading post across the river (D-170, spec docs/specs/2026-11-04-valley-trade-post.md §1):
// a map building from the start, closed until rank 4, then a second market at 125 % with its own saturation.
import {
  MARKET, STATE_VERSION, TICK_HZ, applyCommand, checkInvariants, createWorld, deserialize, lineCells, postCents, postOpen,
  serialize, stateHash, step, tradePostOf, type Building, type Command, type World,
} from '../src/sim/index';
import { centsAt, isMarket, marketCents, sellAt } from '../src/sim/town';
import { orderOutstanding } from '../src/sim/events';
import { cureFor, heldSpanFor } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

const W = 96;
const at = (x: number, y: number) => y * W + x;
/** The player's road: column x = 39 from the castle road (y 24) down to the post's gate (y 57), wooden bridge y 34-36. */
const postRoad = (surface: 1 | 2 = 1): Command => ({ t: 'road', surface, cells: lineCells(W, at(39, 25), at(39, 57)) });
const post = (w: World): Building => tradePostOf(w)!;
const stableOf = (w: World) => w.state.buildings.find((b) => b.type === 'stable')!;
const castleOf = (w: World) => w.state.buildings.find((b) => b.type === 'castle')!;

function run(w: World, ticks: number, each?: (w: World) => void): void {
  for (let i = 0; i < ticks; i++) {
    step(w);
    each?.(w);
  }
}

/** A fresh valley at rank 4 with the road to the post and silver to spare (test setup only). */
function openValley(road = true, wagons = 2): World {
  const w = createWorld('sandbox');
  w.state.town.rank = 4;
  w.state.coins = 5000;
  if (road) eq(applyCommand(w, postRoad()).ok, true, 'road to the post');
  for (let i = 0; i < wagons; i++) applyCommand(w, { t: 'buyWagon', stable: stableOf(w).id });
  return w;
}

test('trade post: a map building of the fresh valley (id 6 at (37,58), gate road), last slice, closed; no post in missions', () => {
  const w = createWorld('sandbox');
  eq(w.state.version, STATE_VERSION, 'current version');
  const b = post(w);
  eq(`${b.id} ${b.type} ${b.x},${b.y} ${b.w}x${b.h}`, '6 tradePost 37,58 4x4', 'post');
  eq(b.gate, at(39, 57), 'gate (39,57)');
  eq(w.state.roads[b.gate], 1, 'dirt road at the gate');
  eq(w.state.nextId > 6, true, 'ids after it');
  eq(Object.keys(w.state).at(-1), 'tradePost', 'slice last');
  eq(postOpen(w), false, 'closed at rank 0');
  run(w, 60);
  eq(post(w).status.k, 'IDLE', 'closed post idles');
  for (const id of ['m1', 'lab', 'm9']) {
    const m = createWorld(id);
    assert(!('tradePost' in m.state), `${id}: no slice`);
    assert(!m.state.buildings.some((q) => q.type === 'tradePost'), `${id}: no post`);
  }
});

test('trade post: closed below rank 4 even with a road — no wagon is ever sent there', () => {
  const w = createWorld('sandbox');
  w.state.coins = 5000;
  eq(applyCommand(w, postRoad()).ok, true, 'road');
  const id = post(w).id;
  let sent = 0;
  run(w, 12 * 60 * TICK_HZ, (q) => { for (const wg of q.state.wagons) if (wg.job?.to === id) sent++; });
  eq(w.state.town.rank < 4, true, 'still below rank 4');
  eq(sent, 0, 'no job to the post');
  eq(post(w).status.k, 'IDLE', 'idle, not NO_ROAD');
});

test('trade post: rank 4 without a road is NO_ROAD (the gate stub is not enough); a road from the stable opens it', () => {
  const w = openValley(false);
  run(w, 20);
  eq(postOpen(w), true, 'open at rank 4');
  eq(post(w).status.k, 'NO_ROAD', 'gate stub only');
  eq(applyCommand(w, postRoad()).ok, true, 'road');
  run(w, 20);
  eq(post(w).status.k, 'IDLE', 'linked to the stable');
});

test('trade post: a sale pays 125 % per unit at its own saturation; castle saturation untouched; ledger, renown, flow', () => {
  const w = openValley();
  const b = post(w), st = w.state;
  const before = { castleSat: st.market.saturation.planks, sold: st.ledger.sold.planks, renown: st.town.renown, coins: st.coins, cents: st.market.cents };
  // six planks delivered (as a wagon would unload them; produced keeps the conservation books)
  b.stock.planks = 6;
  st.ledger.produced.planks += 6;
  let want = 0;
  for (let s = 0; s < 6; s++) want += Math.floor((centsAt('planks', s, 100) * 125) / 100);
  const pay = sellAt(w, b, 'planks');
  const tp = st.tradePost!;
  eq(tp.recent.at(-1)!.cents, want, 'exact cents of the sale');
  eq(tp.earnedCents, want, 'earned at the post');
  eq(pay, Math.floor((before.cents + want) / 100), 'whole silver paid');
  eq(tp.saturation.planks, 6, 'post saturation');
  eq(st.market.saturation.planks, before.castleSat, 'castle saturation untouched');
  eq(st.ledger.sold.planks, before.sold + 6, 'ledger.sold');
  eq(tp.sold.planks, 6, 'post sold');
  eq(st.town.renown, before.renown + pay, 'renown');
  eq(st.coins, before.coins + pay, 'coins');
  eq(b.stock.planks, 0, 'stock gone');
  eq(checkInvariants(w).join('; '), '', 'conservation');
  // the list keeps the last five sales, oldest first
  for (let i = 0; i < 6; i++) { b.stock.wood = 1; st.ledger.produced.wood += 1; sellAt(w, b, 'wood'); }
  eq(tp.recent.length, 5, 'five kept');
  assert(tp.recent.every((r) => r.good === 'wood'), 'the planks sale fell out');
  // recovery: one unit per good every 10 s
  const sat = tp.saturation.planks;
  run(w, 10 * TICK_HZ);
  eq(tp.saturation.planks, sat - 1, 'recovered one unit');
});

test('trade post: market-good pairs — at equal saturation the post pays more; an accepted order sends its good to the castle only', () => {
  const w = openValley(true, 6);
  const b = post(w), c = castleOf(w);
  assert(isMarket(w, b) && isMarket(w, c), 'two markets');
  for (const g of ['wood', 'planks'] as const) assert(marketCents(w, b, g) > marketCents(w, c, g), `${g}: post pays more`);
  eq(marketCents(w, b, 'planks'), postCents(w, 'planks'), 'post price');
  // an accepted order for planks: planks go to the castle while owed, never to the post
  w.state.valleyEvents!.orders = [{ id: 'order-99', templateId: 'palisade_repair', accepted: true, need: { planks: 24 }, delivered: { planks: 0 }, rewardSilver: 10, rewardRenown: 20 }];
  let toPost = 0, toCastle = 0;
  const seen = new Set<string>();
  run(w, 6 * 60 * TICK_HZ, (q) => {
    if (orderOutstanding(q.state, 'planks') <= 0) return;
    for (const wg of q.state.wagons) {
      if (wg.job?.good !== 'planks' || wg.job.phase !== 'pickup' || wg.job.to === c.id && seen.has(`${wg.id}`)) continue;
      // a job just assigned while planks are owed
      if (wg.job.to === b.id) toPost++;
      if (wg.job.to === c.id) { toCastle++; seen.add(`${wg.id}`); }
    }
  });
  eq(toPost, 0, 'no planks to the post while the order owes them');
  assert(toCastle > 0, 'planks to the castle');
  assert((w.state.valleyEvents!.orders[0]?.delivered.planks ?? 24) > 0 || w.state.valleyEvents!.ordersDone > 0, 'the order took planks');
  eq(checkInvariants(w).join('; '), '', 'invariants');
});

test('trade post: live trade conserves goods every tick; it cannot be demolished', () => {
  const w = openValley(true, 4);
  run(w, 5 * 60 * TICK_HZ, (q) => {
    if (q.state.tick % 10 === 0) eq(checkInvariants(q).join('; '), '', `tick ${q.state.tick}`);
  });
  assert(w.state.tradePost!.earnedCents > 0, 'the post bought something');
  const r = applyCommand(w, { t: 'demolish', cell: at(38, 59) });
  eq(r.ok ? 'ok' : r.err.k, 'CANNOT_DEMOLISH', 'demolish refused');
});

test('trade post: winter ice holds a loaded wagon at the wooden bridge (card pave); a stone span lets it through', () => {
  const w = openValley(true, 4);
  const b = post(w);
  // stone for paving the bridge (3 cells x 3 stone), kept in the castle like a delivered load
  castleOf(w).stock.stone += 9;
  w.state.ledger.produced.stone += 9;
  let heldAt = -1;
  while (heldAt < 0 && w.state.tick < 60 * 60 * TICK_HZ) {
    step(w);
    if (heldSpanFor(w, b) && cureFor(w, b.id) === 'pave') heldAt = w.state.tick;
  }
  assert(heldAt > 0, 'a wagon to the post was held by ice with the cure "pave"');
  const held = w.state.wagons.find((q) => q.status.k === 'BRIDGE_CLOSED' && q.job?.to === b.id)!;
  assert(!!held, 'the held wagon');
  const bridge: Command = { t: 'road', surface: 2, cells: lineCells(W, at(39, 34), at(39, 36)) };
  const r = applyCommand(w, bridge);
  eq(r.ok ? 'ok' : JSON.stringify(r.err), 'ok', 'pave the span');
  const until = w.state.tick + 60 * TICK_HZ;
  while (w.state.tick < until && w.state.wagons.find((q) => q.id === held.id)!.status.k === 'BRIDGE_CLOSED') step(w);
  assert(w.state.wagons.find((q) => q.id === held.id)!.status.k !== 'BRIDGE_CLOSED', 'the wagon drives on in the same winter');
  eq(checkInvariants(w).join('; '), '', 'invariants');
});

test('trade post: same commands => same hash; save/load before and after rank 4 continues identically', () => {
  const play = (saveAt: number): string => {
    let w = createWorld('sandbox');
    w.state.coins = 5000;
    for (let i = 0; i < 8 * 60 * TICK_HZ; i++) {
      if (i === 30) applyCommand(w, postRoad());
      if (i === 60) for (let k = 0; k < 3; k++) applyCommand(w, { t: 'buyWagon', stable: stableOf(w).id });
      if (i === 2 * 60 * TICK_HZ) w.state.town.rank = 4;
      step(w);
      if (i === saveAt) w = deserialize(serialize(w));
    }
    return stateHash(w);
  };
  const a = play(-1);
  eq(play(-1), a, 'deterministic');
  eq(play(60 * TICK_HZ), a, 'save/load before rank 4');
  eq(play(5 * 60 * TICK_HZ), a, 'save/load while trading');
  assert(MARKET.cap === 24, 'market cap');
});
