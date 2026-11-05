// The pace card's fleet kind (day 9a, D-127): a producer's yard full for 20 s or more while every wagon was on the
// road the whole last minute and the forecast misses a seal is lost production worth a wagon. Its own status
// (WAITING_PICKUP) is calm, so the stall card never said so (mission XI: "(no card)" or a calm farm at every look).
import { TICK_HZ, WAGON_PRICE, applyCommand, createWorld, newPaceLog, samplePace, stateHash, step, type PaceLog, type World } from '../src/sim/index';
import { FLEET_ROOM_TICKS, FLEET_WAIT_TICKS, fleetBusyShare, fleetCueFor, forecastFor, paceCard, sampleFleet } from '../src/ui/paceCard';
import { assert, eq, test } from './harness';

/** Run until `until` (or the first card the predicate accepts), sampling as the app does every tick. */
function runTo(w: World, log: PaceLog, until: number, stop: (pc: ReturnType<typeof paceCard>) => boolean = () => false): ReturnType<typeof paceCard> {
  while (w.state.mission.result === 'running' && w.state.tick < until) {
    step(w);
    samplePace(log, w);
    sampleFleet(w);
    if (w.state.tick % TICK_HZ) continue;
    const pc = paceCard(w, forecastFor(w, log));
    if (stop(pc)) return pc;
  }
  return null;
}

test('fleet card: XI names the farm waiting for a wagon while all three are on the road', () => {
  const w = createWorld('m11');
  const log = newPaceLog();
  const pc = runTo(w, log, 7 * 60 * TICK_HZ, (p) => p?.k === 'fleet');
  if (!pc || pc.k !== 'fleet') throw new Error('expected the fleet card within 7 minutes');
  const farm = w.state.buildings.find((b) => b.id === pc.producer)!;
  eq(farm.type, 'farm', 'the subject is the farm');
  eq(pc.good, 'grain', 'its grain waits');
  eq(farm.status.k, 'WAITING_PICKUP', 'the farm waits for its pickup');
  eq(pc.wagons, 3, 'three wagons');
  assert(pc.waitTicks >= FLEET_WAIT_TICKS, 'the yard has been full for 20 s or more');
  assert(fleetBusyShare(w) >= 0.9, 'the fleet was on the road the whole last minute');
  assert(pc.seals < 3, 'only while the forecast misses a seal');
  const f = forecastFor(w, log)!;
  assert(!!f.aim && f.aim.byTick - w.state.tick >= FLEET_ROOM_TICKS, 'a better seal is in reach, with time for a wagon to pay off');
  // read-only, and the sampling never touches the state
  const hash = stateHash(w);
  paceCard(w, f);
  fleetBusyShare(w);
  eq(stateHash(w), hash, 'read-only');
  // the cure is "Kup wóz": after it a wagon idles at the stable, and the card steps aside
  const stable = w.state.buildings.find((b) => b.type === 'stable')!;
  assert(applyCommand(w, { t: 'buyWagon', stable: stable.id }).ok, 'the wagon is affordable');
  const after = paceCard(w, forecastFor(w, log));
  assert(!after || after.k !== 'fleet', 'no fleet card while a new wagon idles');
});

test('fleet card: sampling the fleet leaves the sim hash unchanged', () => {
  const a = createWorld('m11'), b = createWorld('m11');
  for (let i = 0; i < 200 * TICK_HZ; i++) { step(a); step(b); sampleFleet(b); }
  eq(stateHash(b), stateHash(a), 'same hash with and without the UI sampling');
});

test('fleet card: a world never sampled shows none (a loaded save waits a minute)', () => {
  const w = createWorld('m11');
  const log = newPaceLog();
  while (w.state.tick < 7 * 60 * TICK_HZ) {
    step(w);
    samplePace(log, w);
    if (w.state.tick % (5 * TICK_HZ) === 0) {
      const pc = paceCard(w, forecastFor(w, log));
      assert(!pc || pc.k !== 'fleet', 'no fleet card without the fleet log');
    }
  }
});

test('fleet card: not without silver for a wagon', () => {
  const w = createWorld('m11');
  const log = newPaceLog();
  const pc = runTo(w, log, 7 * 60 * TICK_HZ, (p) => p?.k === 'fleet');
  assert(pc?.k === 'fleet', 'the card appears with the silver');
  const coins = w.state.coins;
  w.state.coins = WAGON_PRICE - 1;
  const poor = paceCard(w, forecastFor(w, log));
  w.state.coins = coins;
  assert(!poor || poor.k !== 'fleet', 'no fleet card when a wagon cannot be bought');
});

for (const id of ['m7', 'm12']) {
  test(`fleet card: ${id} (wagons idle or the order on time) never shows it`, () => {
    const w = createWorld(id);
    const log = newPaceLog();
    const pc = runTo(w, log, 12 * 60 * TICK_HZ, (p) => p?.k === 'fleet');
    assert(pc === null, `no fleet card in ${id}`);
  });
}

test('fleet card: a mud stretch the player cannot pay for yields to the wagon he can (VIII, 40 silver)', () => {
  const w = createWorld('m8');
  const log = newPaceLog();
  // D-165 lane: around 3:10 a yard waits with every wagon busy (the fleet card qualifies)
  runTo(w, log, 190 * TICK_HZ);
  const f = forecastFor(w, log);
  const rich = paceCard(w, f);
  eq(rich?.k, 'mud', 'with the silver, the mud card (its button reports the missing stone, D-116)');
  const coins = w.state.coins;
  w.state.coins = 40;
  const poor = paceCard(w, f);
  w.state.coins = coins;
  eq(poor?.k, 'fleet', 'with 40 silver the cobbles are out of reach, a wagon is not');
});

test('fleet cue: the sheet of any qualifying yard offers the wagon, a calm one does not (D-128)', () => {
  const w = createWorld('m11');
  const log = newPaceLog();
  const pc = runTo(w, log, 7 * 60 * TICK_HZ, (p) => p?.k === 'fleet');
  if (!pc || pc.k !== 'fleet') throw new Error('expected the fleet card');
  const f = forecastFor(w, log);
  for (const b of w.state.buildings) {
    const cue = fleetCueFor(w, f, b);
    if (b.id === pc.producer) eq(cue?.producer, b.id, 'the named yard qualifies');
    else if (cue) eq(b.status.k, 'WAITING_PICKUP', 'only a pickup wait qualifies');
  }
  eq(w.state.wagons.find((q) => q.id === pc.wagon)?.job?.from, pc.producer, 'the cue names the wagon on its way to the yard');
});
