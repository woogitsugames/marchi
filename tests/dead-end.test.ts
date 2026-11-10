// Early "no road to victory" (D-48).
import { applyCommand, createWorld } from '../src/sim/index';
import { bridgeA, stableId } from '../tools/bot';
import { WAGON_REFUND, deadEnd, type DeadEndRoute } from '../src/ui/deadEnd';
import { assert, eq, test } from './harness';

test('mission I at the start: castle across the river but the bridge is affordable -> not a dead end', () => {
  eq(deadEnd(createWorld('m1')), null, 'winnable');
});

test('mission I with no silver and only spare-wagon refunds below the crossing -> dead end with the numbers', () => {
  const w = createWorld('m1');
  w.state.coins = 0;
  const d = deadEnd(w) as DeadEndRoute | null;
  assert(d !== null, 'dead end detected');
  eq(d!.k, 'NO_ROUTE_TO_CASTLE', 'cause');
  eq(d!.raise, (w.state.wagons.length - 1) * WAGON_REFUND, 'refund of all wagons but one');
  assert(d!.cost > d!.coins + d!.raise, `cost ${d!.cost} > ${d!.coins} + ${d!.raise}`);
});

test('enough silver once the spare wagons are sold -> not a dead end', () => {
  const poor = createWorld('m1');
  poor.state.coins = 0;
  const cost = (deadEnd(poor) as DeadEndRoute).cost;
  const w = createWorld('m1');
  for (let i = 0; i < 4; i++) applyCommand(w, { t: 'buyWagon', stable: stableId(w) });
  const raise = (w.state.wagons.length - 1) * WAGON_REFUND;
  w.state.coins = Math.max(0, cost - raise);
  eq(deadEnd(w), null, `refunds close the gap (cost ${cost}, refunds ${raise})`);
  w.state.coins = Math.max(0, cost - raise - 1);
  if (cost - raise - 1 >= 0) assert(deadEnd(w) !== null, 'one silver short is a dead end');
});

test('once the castle is connected nothing is reported, whatever the silver', () => {
  const w = createWorld('m1');
  assert(applyCommand(w, bridgeA(w)).ok, 'bridge');
  w.state.coins = 0;
  eq(deadEnd(w), null, 'connected');
});

test('deadEnd only reads: the state hash is unchanged', () => {
  const w = createWorld('m1');
  w.state.coins = 0;
  const before = JSON.stringify(w.state);
  deadEnd(w);
  eq(JSON.stringify(w.state), before, 'no writes');
});
