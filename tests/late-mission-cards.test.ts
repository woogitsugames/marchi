// Late missions (X-XVII) stall-card hunt (D-610..D-618): every red card offers something to press, or the dead-end
// letter says the order is lost. XVII's contest is the castles' switch (calm pin, castle card), a castle cut off reads
// "no road" with the road to it, a stranded wagon's road piece is linked, a taken-down producer the mission can rebuild
// is offered, one it cannot ends the order early (D-613), a finished workshop's starvation is calm.
import {
  TICK_HZ, applyCommand, buildingById, createWorld, explainBuilding, net, newPaceLog, reachable, samplePace, step,
  type Building, type BuildingStatus, type World,
} from '../src/sim/index';
import {
  calmStall, calmWhy, cureFor, cutOffConsumer, cutOffSource, gapTarget, producerCure, rankStalls, sampleInputWaits,
  sharedContested, sharedOneCard,
} from '../src/ui/stalls';
import { castleCard, sampleFleet } from '../src/ui/paceCard';
import { deadEnd, type DeadEndSource } from '../src/ui/deadEnd';
import { castlesOf, eastChain, northChain } from '../tools/bot-m17';
import { pl, PENDING_KEYS } from '../src/i18n/pl';
import { en } from '../src/i18n/en';
import { assert, eq, test } from './harness';

const typeOf = (w: World, t: string): Building => w.state.buildings.find((b) => b.type === t)!;

/** Take back every road cell next to building b's gate (not other gates): b is off the network. */
function cutGate(w: World, b: Building): void {
  const W = w.terrain.w;
  for (const d of [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1]) {
    const c = b.gate + d;
    if (w.state.roads[c] && net(w).gateOf[c] === -1) {
      const r = applyCommand(w, { t: 'demolish', cell: c });
      assert(r.ok, `demolish road ${c}: ${JSON.stringify(r)}`);
    }
  }
}

/** Seconds (sampled once a second) the HUD's red card has nothing to press: run lengths of the longest. */
function deadRedSeconds(w: World, until: (w: World) => boolean): number {
  let run = 0, worst = 0;
  while (w.state.mission.result === 'running' && !until(w)) {
    step(w); sampleInputWaits(w); sampleFleet(w);
    if (w.state.tick % TICK_HZ) continue;
    const r = rankStalls(w)[0];
    const dead = !!r && !r.minor && cureFor(w, r.id) === null && !deadEnd(w);
    run = dead ? run + 1 : 0;
    worst = Math.max(worst, run);
  }
  return worst;
}

test('D-610: XVII — no red card without a cure at the even split, the leg switch or the chain switch', () => {
  for (const [name, cmds] of [['even', null], ['east chain', eastChain], ['north chain', northChain]] as const) {
    const w = createWorld('m17');
    if (cmds) for (const c of cmds(w)) assert(applyCommand(w, c).ok, name);
    const worst = deadRedSeconds(w, () => false);
    assert(worst <= 3, `${name}: longest red card with nothing to press ${worst} s (was 76 s at the even split)`);
  }
});

test('D-610: XVII — the starved workshop of the other chain is a calm pin; never in XVI', () => {
  const w = createWorld('m17');
  for (const c of eastChain(w)) applyCommand(w, c);
  const burner = typeOf(w, 'charcoalBurner');
  let seen = 0;
  for (let i = 0; i < 90 * TICK_HZ; i++) {
    step(w);
    if (burner.status.k === 'NO_INPUT' && burner.status.cause === 'CHAIN_FIRST') {
      seen++;
      assert(calmStall(w, burner, JSON.stringify(burner.status)), 'CHAIN_FIRST is calm');
    }
  }
  assert(seen > 0, 'the burner read CHAIN_FIRST');
  const v = createWorld('m16');
  const b = v.state.buildings.find((q) => q.type !== 'castle' && q.type !== 'stable')!;
  b.status = { k: 'NO_INPUT', good: 'wood', cause: 'CONTESTED', blockedBy: b.id } as BuildingStatus;
  assert(!calmStall(v, b, 'xvi'), 'XVI keeps its contest red');
});

test('D-612: XVII castle card — the other chain first reads "after" with that castle; the leg alone keeps the card', () => {
  const w = createWorld('m17');
  const [east, north] = castlesOf(w);
  for (const c of northChain(w)) applyCommand(w, c);
  const log = newPaceLog();
  let card = null as ReturnType<typeof castleCard>;
  for (let i = 0; i < 70 * TICK_HZ && !card; i++) { step(w); samplePace(log, w); card = castleCard(w, log); }
  assert(card, 'a castle card with the north chain first');
  eq(card!.producer, east, 'the east castle is late');
  eq(card!.share, 'after', 'its share: after the north chain');
  eq(card!.rival, north, 'the rival is the north castle');
  const v = createWorld('m17');
  applyCommand(v, { t: 'castleFirst', castle: castlesOf(v)[0] });
  const lv = newPaceLog();
  let c2 = null as ReturnType<typeof castleCard>;
  for (let i = 0; i < 70 * TICK_HZ && !c2; i++) { step(v); samplePace(lv, v); c2 = castleCard(v, lv); }
  assert(c2 && c2.producer === castlesOf(v)[0] && c2.share === 'even', 'east leg first: still late, the wood still split evenly');
});

test('D-611: a mission castle cut off from the roads reads "no road" and gets the road to it', () => {
  const w = createWorld('m13');
  const castle = typeOf(w, 'castle'), saw = typeOf(w, 'sawmill'), stable = typeOf(w, 'stable');
  cutGate(w, castle);
  assert(!reachable(w, castle.gate, stable.gate), 'castle off the network');
  castle.status = { k: 'NO_INPUT', good: 'planks', cause: 'NONE_AVAILABLE', blockedBy: saw.id };
  saw.status = { k: 'WORKING' };
  const chain = explainBuilding(w, castle.id, 5, true);
  eq(cutOffConsumer(w, chain), castle.id, 'the castle is the cut-off consumer');
  eq(gapTarget(w, chain), castle.id, 'the gap finder links the castle');
  eq(cureFor(w, castle.id), 'road', 'cure: road');
});

test('D-611: a producer cut off from the roads is the gap for its waiting castle (XIV burner)', () => {
  const w = createWorld('m14');
  const castle = typeOf(w, 'castle'), burner = typeOf(w, 'charcoalBurner'), stable = typeOf(w, 'stable');
  cutGate(w, burner);
  assert(!reachable(w, burner.gate, stable.gate), 'burner off the network');
  castle.status = { k: 'NO_INPUT', good: 'charcoal', cause: 'NONE_AVAILABLE', blockedBy: burner.id };
  burner.status = { k: 'WORKING' };
  const chain = explainBuilding(w, castle.id, 5, true);
  eq(cutOffSource(w, chain), burner.id, 'the burner is the cut-off source');
  eq(gapTarget(w, chain), burner.id, 'the gap finder links the burner');
  eq(cureFor(w, castle.id), 'road', 'cure: road');
});

test('D-618: wagons stranded on a cut-off castle — the gap finder links the castle, not the waiting workshop', () => {
  const w = createWorld('m13');
  const castle = typeOf(w, 'castle'), bakery = typeOf(w, 'bakery');
  cutGate(w, castle);
  for (const v of w.state.wagons) v.at = castle.gate;
  bakery.status = { k: 'NO_WAGON', good: 'flour', cause: 'NONE_CAN_REACH' };
  eq(gapTarget(w, [{ kind: 'building', id: bakery.id, status: bakery.status }]), castle.id, 'the stranded piece');
});

test('D-615: XIV burner taken down — the castle card offers a new burner (the mission builds it)', () => {
  const w = createWorld('m14');
  const castle = typeOf(w, 'castle'), burner = typeOf(w, 'charcoalBurner');
  assert(applyCommand(w, { t: 'demolish', cell: burner.y * w.terrain.w + burner.x }).ok, 'burner taken down');
  for (let i = 0; i < 30 * TICK_HZ; i++) step(w);
  const s = castle.status;
  assert(s.k === 'NO_INPUT' && s.cause === 'NONE_AVAILABLE' && s.blockedBy < 0, `castle waits with no producer: ${JSON.stringify(s)}`);
  eq(cureFor(w, castle.id), 'producer', 'cure: a producer');
  const pc = producerCure(w, castle)!;
  eq(pc.type, 'charcoalBurner', 'a charcoal burner');
  eq(pc.source, 'missing', 'nobody makes it');
  eq(buildingById(w, pc.producer)!.type, 'woodcutter', 'the ghost opens by its wood');
  eq(deadEnd(w), null, 'not a dead end: it can be built again');
  for (const k of ['fix.producerMissing', 'deadEnd.noSource'] as const) {
    assert(pl[k] && en[k] && (PENDING_KEYS as readonly string[]).includes(k), `${k} in pl, en and pending`);
  }
});

test('D-613: XIII mill and bakery taken down — the order cannot be filled: dead-end letter at once', () => {
  const w = createWorld('m13');
  for (const t of ['mill', 'bakery']) {
    const b = typeOf(w, t);
    assert(applyCommand(w, { t: 'demolish', cell: b.y * w.terrain.w + b.x }).ok, t);
  }
  step(w);
  const d = deadEnd(w) as DeadEndSource | null;
  assert(d && d.k === 'NO_SOURCE', `NO_SOURCE: ${JSON.stringify(d)}`);
  eq(d!.good, 'bread', 'bread');
  assert(d!.left < d!.need, `left ${d!.left} < need ${d!.need}`);
  eq(deadEnd(createWorld('m13')), null, 'the fresh mission is winnable');
  const before = JSON.stringify(w.state);
  deadEnd(w);
  eq(JSON.stringify(w.state), before, 'deadEnd only reads');
});

test('D-614/D-617: a workshop starving after its order is in, or for a good nothing can bring, is calm', () => {
  const w = createWorld('m13');
  const castle = typeOf(w, 'castle'), saw = typeOf(w, 'sawmill'), mill = typeOf(w, 'mill'), granary = typeOf(w, 'warehouse');
  castle.stock.planks = w.state.mission.contract!.need.planks;
  saw.status = { k: 'NO_INPUT', good: 'wood', cause: 'NONE_AVAILABLE', blockedBy: -1 };
  eq(calmWhy(w, saw), 'orderFilled', 'planks in: the sawmill waits for nothing');
  granary.stock.grain = 0;
  for (const v of w.state.wagons) if (v.cargoGood === 'grain') v.cargoQty = 0;
  mill.status = { k: 'NO_INPUT', good: 'grain', cause: 'NONE_AVAILABLE', blockedBy: -1 };
  assert(calmStall(w, mill, 'starved'), 'no grain anywhere and no farm to build: calm');
  granary.stock.grain = 3;
  assert(!calmStall(w, mill, 'starved-2'), 'grain left in the granary: still a stall');
});

test('D-616/D-670: X — every contest, before and after the shared card, offers the second woodcutter', () => {
  const w = createWorld('m10');
  const saw = typeOf(w, 'sawmill');
  let early = 0, shown = false, contested = 0;
  while (w.state.mission.result === 'running' && w.state.tick < 8 * 60 * TICK_HZ) {
    step(w); sampleInputWaits(w);
    if (sharedOneCard(w, saw)) shown = true;
    const c = saw.status.k === 'NO_INPUT' && saw.status.cause === 'CONTESTED';
    if (!c || w.state.tick % TICK_HZ) continue;
    if (!shown) early++; else contested++;
    assert(sharedContested(w, saw), `contest at ${w.state.tick / TICK_HZ} s`);
    eq(cureFor(w, saw.id), 'producer', `cure at ${w.state.tick / TICK_HZ} s: second woodcutter (owner 2026-11-11, D-670)`);
  }
  assert(early > 0 && contested > 0, `contest before (${early} s) and after (${contested} s) the card`);
});
