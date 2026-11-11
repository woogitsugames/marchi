// Early "no road to victory" (D-48).
import { BUILDINGS, applyCommand, createWorld } from '../src/sim/index';
import { bridgeA, stableId } from '../tools/bot';
import { WAGON_REFUND, deadEnd, type DeadEndRoute, type DeadEndSource } from '../src/ui/deadEnd';
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

test('D-635: the second castle (XVI, XVII) cut off with no silver to link it -> dead end for that castle', () => {
  for (const m of ['m16', 'm17']) {
    const w = createWorld(m);
    const st = w.state;
    const second = st.mission.extraContracts![0]!.castle;
    eq(deadEnd(w), null, `${m}: both castles linked at the start`);
    // the road cell beside the second castle's gate (its only link)
    assert(applyCommand(w, { t: 'demolish', cell: 3136 }).ok, `${m}: road taken back`);
    st.coins = 0;
    st.wagons.length = 1;
    const d = deadEnd(w) as DeadEndRoute | null;
    assert(d !== null && d.k === 'NO_ROUTE_TO_CASTLE', `${m}: ${JSON.stringify(d)}`);
    eq(d!.castle, second, `${m}: the second castle`);
    st.coins = d!.cost;
    eq(deadEnd(w), null, `${m}: silver for the link -> winnable`);
  }
});

test('D-636: a cycle already running counts toward what the map can still bring (no false letter)', () => {
  // fuzz m17 seed 104: the woodcutter taken down at 4:40, the sawmill's last cycle running — the letter said 10 of 12
  // planks left and cleared at 5:01 when that cycle came out
  const w = createWorld('m13');
  const mill = w.state.buildings.find((b) => b.type === 'mill')!;
  const bakery = w.state.buildings.find((b) => b.type === 'bakery')!;
  assert(applyCommand(w, { t: 'demolish', cell: mill.y * w.terrain.w + mill.x }).ok, 'mill taken down');
  const need = w.state.mission.contract!.need.bread;
  for (const g of ['grain', 'flour', 'bread'] as const) for (const b of w.state.buildings) if (b.type !== 'castle') b.stock[g] = 0;
  const per = BUILDINGS.bakery.recipe!.outputs.bread!;
  bakery.stock.bread = need - per;
  bakery.progress = -1;
  const d = deadEnd(w) as DeadEndSource | null;
  assert(d !== null && d.k === 'NO_SOURCE' && d.left === need - per, `one cycle short: ${JSON.stringify(d)}`);
  bakery.progress = 3;
  eq(deadEnd(w), null, 'the running cycle brings the last loaves');
});
