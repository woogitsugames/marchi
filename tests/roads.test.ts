import { applyCommand, createWorld, validateRoad, lineCells, MAX_GRADE } from '../src/sim/index';
import { cell } from '../tools/bot';
import { assert, eq, test } from './harness';

test('too steep road is rejected with the measured grade', () => {
  const w = createWorld('m1');
  // the north ridge rises steeply above row 9
  const r = validateRoad(w, lineCells(w.terrain.w, cell(w, 30, 12), cell(w, 30, 1)), 1);
  assert(!r.ok, 'rejected');
  if (!r.ok) {
    eq(r.err.k, 'TOO_STEEP', 'reason');
    if (r.err.k === 'TOO_STEEP') assert(r.err.grade > MAX_GRADE, 'grade reported ' + r.err.grade);
  }
});

test('roads cannot go through buildings; costs coins; bridge cells cost more', () => {
  const w = createWorld('m1');
  const saw = w.state.buildings.find((b) => b.type === 'sawmill')!;
  const r = validateRoad(w, [cell(w, saw.x, saw.y - 1), cell(w, saw.x, saw.y)], 1);
  assert(!r.ok && r.err.k === 'BLOCKED', 'blocked by building');
  const land = validateRoad(w, lineCells(w.terrain.w, cell(w, 60, 26), cell(w, 60, 29)), 1);
  const water = validateRoad(w, lineCells(w.terrain.w, cell(w, 60, 31), cell(w, 60, 34)), 1);
  assert(land.ok && water.ok, 'both valid');
  if (land.ok && water.ok) assert(water.cost > land.cost, 'bridge costs more');
  const coins = w.state.coins;
  const r2 = applyCommand(w, { t: 'road', surface: 1, cells: lineCells(w.terrain.w, cell(w, 60, 26), cell(w, 60, 29)) });
  assert(r2.ok, 'built');
  eq(w.state.coins, coins - (r2.ok ? r2.cost : 0), 'coins deducted');
});

test('not enough coins: command rejected, nothing changes', () => {
  const w = createWorld('m1');
  w.state.coins = 0;
  const before = JSON.stringify(w.state.roads);
  const r = applyCommand(w, { t: 'road', surface: 2, cells: lineCells(w.terrain.w, cell(w, 60, 26), cell(w, 60, 29)) });
  assert(!r.ok && r.err.k === 'NO_COINS', 'no coins');
  eq(JSON.stringify(w.state.roads), before, 'roads unchanged');
});

test('selling an idle wagon refunds half its price; busy wagons cannot be sold', () => {
  const w = createWorld('m1');
  const idle = w.state.wagons[0]!;
  const coins = w.state.coins;
  const r = applyCommand(w, { t: 'sellWagon', wagon: idle.id });
  assert(r.ok, 'sold');
  eq(w.state.coins, coins + 15, 'refund');
  eq(w.state.wagons.length, 1, 'one wagon left');
  const other = w.state.wagons[0]!;
  other.job = { id: 999, good: 'wood', qty: 1, from: 1, to: 2, phase: 'pickup' };
  const r2 = applyCommand(w, { t: 'sellWagon', wagon: other.id });
  assert(!r2.ok && r2.err.k === 'WAGON_BUSY', 'busy wagon refused');
});
