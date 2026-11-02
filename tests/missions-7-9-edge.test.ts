// Missions VII-IX: destructive operations, exact stone diagnostics, and an actionable rival ID.
import {
  applyCommand, checkInvariants, createWorld, explainBuilding, inputGoods, lineCells,
  roadStoneCost, stateHash, step, stoneAvailable, validateRoad, type World,
} from '../src/sim/index';
import { assert, eq, test } from './harness';

function m8WithStoneInTransit(): { world: World; wagonId: number; quarryId: number } {
  const world = createWorld('m8');
  const quarry = world.state.buildings.find((b) => b.type === 'quarry');
  assert(quarry, 'm8 quarry exists');
  for (let i = 0; i < 8000; i++) {
    step(world);
    const wagon = world.state.wagons.find((q) =>
      q.job?.from === quarry.id && q.job.good === 'stone' &&
      q.job.phase === 'dropoff' && q.cargoGood === 'stone' && q.cargoQty > 0);
    if (wagon) return { world, wagonId: wagon.id, quarryId: quarry.id };
  }
  throw new Error('m8 never loaded a stone wagon from the quarry within 8000 ticks');
}

function clean(w: World, label: string): void {
  const violations = checkInvariants(w);
  assert(violations.length === 0, label + ': ' + violations.join('; '));
}

test('m8: demolishing a quarry with stone on a wagon destroys only stock, not cargo or reservations', () => {
  const { world: w, wagonId, quarryId } = m8WithStoneInTransit();
  const quarry = w.state.buildings.find((b) => b.id === quarryId)!;
  const wagon = w.state.wagons.find((q) => q.id === wagonId)!;
  const cargo = wagon.cargoQty;
  const stock = quarry.stock.stone;
  const destroyed = w.state.ledger.destroyed.stone;
  clean(w, 'before quarry demolition');
  const demolition = applyCommand(w, { t: 'demolish', cell: quarry.y * w.terrain.w + quarry.x });
  assert(demolition.ok, 'quarry demolition accepted');
  assert(!w.state.buildings.some((b) => b.id === quarryId), 'quarry removed');
  eq(w.state.ledger.destroyed.stone, destroyed + stock, 'only quarry stock accounted as destroyed');
  eq(w.state.wagons.find((q) => q.id === wagonId)!.cargoQty, cargo, 'in-flight stone preserved');
  clean(w, 'immediately after quarry demolition');
  let cargoDelivered = false;
  for (let i = 0; i < 2500; i++) {
    step(w);
    clean(w, 'after demolition tick ' + w.state.tick);
    const current = w.state.wagons.find((q) => q.id === wagonId)!;
    if (current.cargoQty === 0) { cargoDelivered = true; break; }
  }
  assert(cargoDelivered, 'loaded stone can still finish its delivery after quarry demolition');
});

test('m8: selling a loaded stone wagon is rejected atomically with WAGON_BUSY', () => {
  const { world: w, wagonId } = m8WithStoneInTransit();
  const wagon = w.state.wagons.find((q) => q.id === wagonId)!;
  assert(wagon.cargoQty > 0 && wagon.job !== null, 'wagon has a real job and a nonempty load');
  const before = stateHash(w);
  const result = applyCommand(w, { t: 'sellWagon', wagon: wagonId });
  assert(!result.ok, 'selling a loaded wagon must be rejected');
  if (!result.ok) {
    eq(result.err.k, 'WAGON_BUSY', 'correct rejection reason');
    if (result.err.k === 'WAGON_BUSY') eq(result.err.wagon, wagonId, 'rejection identifies the wagon');
  }
  eq(stateHash(w), before, 'rejected sale changes neither cargo, reservations, silver nor state');
  clean(w, 'after rejected loaded-wagon sale');
  for (let i = 0; i < 600; i++) step(w);
  clean(w, 'after continuing rejected sale');
});

test('m8: building cobbles without stone returns exact NO_STONE {need,have}; valid stock is consumed once', () => {
  const w = createWorld('m8');
  const path = lineCells(w.terrain.w, 44 * w.terrain.w + 45, 44 * w.terrain.w + 56);
  const need = roadStoneCost(w, path, 2);
  eq(need, 12, 'twelve new land cobbles need twelve stones');
  const warehouse = w.state.buildings.find((b) => b.type === 'warehouse')!;
  const checkBlocked = (have: number): void => {
    eq(stoneAvailable(w), have, 'unreserved stones in granary');
    const before = stateHash(w);
    const validation = validateRoad(w, path, 2);
    assert(!validation.ok, 'paving with ' + have + ' stones must fail');
    if (!validation.ok) {
      eq(validation.err.k, 'NO_STONE', 'not an unrelated construction error');
      if (validation.err.k === 'NO_STONE') {
        eq(validation.err.need, need, 'precise missing-stone requirement');
        eq(validation.err.have, have, 'precise available-stone count');
      }
    }
    const attempted = applyCommand(w, { t: 'road', surface: 2, cells: path });
    assert(!attempted.ok, 'rejected road command');
    if (!attempted.ok) eq(JSON.stringify(attempted.err), JSON.stringify({ k: 'NO_STONE', need, have }),
      'exact error payload');
    eq(stateHash(w), before, 'failed command is pure/atomic');
    clean(w, 'after NO_STONE rejection');
  };

  checkBlocked(0);
  // Controlled legal inventory fixture: keep conservation valid while testing the precise partial count.
  warehouse.stock.stone += 5;
  w.state.ledger.produced.stone += 5;
  checkBlocked(5);
  warehouse.stock.stone += 7;
  w.state.ledger.produced.stone += 7;
  eq(stoneAvailable(w), need, 'exactly enough stone to build');
  const before = w.state.ledger.consumed.stone;
  const result = applyCommand(w, { t: 'road', surface: 2, cells: path });
  assert(result.ok, 'with sufficient stone the same road can be built');
  if (result.ok) eq(result.stone, need, 'paving reports the exact amount consumed');
  eq(w.state.ledger.consumed.stone, before + need, 'ledger consumes stone once');
  eq(stoneAvailable(w), 0, 'no extra stone remains');
  assert(path.every((cell) => w.state.roads[cell] === 2), 'all target cobbles upgraded');
  clean(w, 'after successful paving');
});

test('m9: CONTESTED names the actual competing wood consumer and explanation follows it', () => {
  const w = createWorld('m9');
  const sawmill = w.state.buildings.find((b) => b.type === 'sawmill')!;
  const charcoal = w.state.buildings.find((b) => b.type === 'charcoalBurner')!;
  let found = false;
  for (let t = 0; t < 8000; t++) {
    step(w);
    const waiting = [sawmill, charcoal].find((b) =>
      b.status.k === 'NO_INPUT' && b.status.cause === 'CONTESTED' && b.status.good === 'wood');
    if (!waiting) continue;
    const status = waiting.status;
    if (status.k !== 'NO_INPUT' || status.cause !== 'CONTESTED') continue;
    const other = waiting.id === sawmill.id ? charcoal : sawmill;
    eq(status.blockedBy, other.id, 'CONTESTED points to the other wood consumer');
    assert(inputGoods(other.type).includes(status.good), 'the rival really needs the same good');
    assert(w.state.wagons.some((q) => q.job?.good === status.good && q.job.to === other.id),
      'a live wagon assignment proves the rival is actually consuming that good');
    const links = explainBuilding(w, waiting.id);
    eq(links[0]?.id, waiting.id, 'cause chain starts at the blocked building');
    eq(links[1]?.id, other.id, 'cause chain points to the competing consumer');
    clean(w, 'm9 contested');
    found = true;
    break;
  }
  assert(found, 'm9 must exercise a real wood CONTESTED state before its deadline');
});
