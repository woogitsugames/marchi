// first-10-minutes-e (day 9h): N7 — a surplus yard's status title follows the calm variant, never "no wagon";
// N8 — a wagon shortage that resolved while its sheet opened still offers the wagon for a short memory.
import { TICK_HZ, applyCommand, buildingById, createWorld, explainBuilding, outputSurplus, step, suggestLinkToStable } from '../src/sim/index';
import { pl } from '../src/i18n/pl';
import { FLEET_ENOUGH_PER_PRODUCER, fleetEnough, paceCard } from '../src/ui/paceCard';
import { statusKey } from '../src/ui/stallKinds';
import { BUSY_MEMO_TICKS, StallRanking, gapTarget, noteWagonWaits, rankStalls, recentWagonWait } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

test('N7: a full yard nobody needs reads as the surplus, a needed one as "no wagon"', () => {
  const w = createWorld('m4');
  const farm = w.state.buildings.find((b) => b.type === 'farm')!;
  const mill = w.state.buildings.find((b) => b.type === 'mill')!;
  farm.status = { k: 'OUTPUT_FULL', good: 'grain', cause: 'NO_WAGON', blockedBy: -1 };
  mill.status = { k: 'WORKING' };
  eq(outputSurplus(w, farm.id), 'SPARE', 'setup: a surplus');
  const calm = pl[statusKey(farm.status, w, farm.id)];
  assert(calm.includes('nikt') && !calm.includes('brak wozu'), `calm title (${calm})`);
  eq(statusKey(farm.status, w), 'status.OUTPUT_FULL.NO_WAGON', 'without the building id: the plain cause');
  mill.status = { k: 'NO_WAGON', good: 'grain', cause: 'ALL_BUSY' };
  eq(statusKey(farm.status, w, farm.id), 'status.OUTPUT_FULL.NO_WAGON', 'the mill waits: "brak wozu"');
});

test('N8: the castle\'s short "all wagons busy" is remembered for 20 s after it resolves', () => {
  const w = createWorld('m1');
  const castle = w.state.buildings.find((b) => b.type === 'castle')!;
  const r = new StallRanking();
  let seenAt = -1, resolvedAt = -1;
  while (w.state.tick < 6 * 60 * TICK_HZ && resolvedAt < 0) {
    step(w);
    r.get(w);
    // the player taps the missing crossing from the worst stall's sheet (as tests/m1-eye-fix.test.ts)
    const top = w.state.tick % (10 * TICK_HZ) === 0 ? rankStalls(w)[0] : undefined;
    if (top) {
      const chain = explainBuilding(w, top.id, 5, true);
      const tg = gapTarget(w, chain.length ? chain : [{ kind: 'building', id: top.id, status: buildingById(w, top.id)!.status }]);
      const sg = tg >= 0 ? suggestLinkToStable(w, tg) : null;
      if (sg) applyCommand(w, { t: 'road', surface: 1, cells: sg.cells });
    }
    const busy = castle.status.k === 'NO_WAGON' && castle.status.cause === 'ALL_BUSY' && castle.stalledTicks >= 20;
    if (busy && seenAt < 0) seenAt = w.state.tick;
    if (seenAt >= 0 && !busy && castle.status.k !== 'NO_WAGON') resolvedAt = w.state.tick;
  }
  assert(resolvedAt > 0, `the castle waited for a free wagon and got one (seen at ${seenAt})`);
  assert(recentWagonWait(w, castle.id) >= 0, 'just resolved: the sheet still offers the wagon');
  while (w.state.tick <= resolvedAt + BUSY_MEMO_TICKS + 1) { step(w); noteWagonWaits(w); }
  const back = castle.status.k === 'NO_WAGON';
  if (!back) eq(recentWagonWait(w, castle.id) >= 0, false, 'forgotten after 20 s');
});

test('V2: the rank card goes before the fleet card once the valley has two wagons per producer', () => {
  const w = createWorld('sandbox');
  const producers = w.state.buildings.filter((b) => b.type !== 'castle' && b.type !== 'stable' && b.type !== 'warehouse').length;
  eq(fleetEnough(w), w.state.wagons.length >= FLEET_ENOUGH_PER_PRODUCER * producers, 'the rule');
  eq(fleetEnough(w), false, 'the start fleet is not enough');
  const stable = w.state.buildings.find((b) => b.type === 'stable')!;
  while (!fleetEnough(w)) assert(applyCommand(w, { t: 'buyWagon', stable: stable.id }).ok, 'wagon bought');
  const pc = paceCard(w, null);
  eq(pc?.k, 'rank', 'the rank card takes the slot');
  // never in a mission: no rank card with a contract
  const m = createWorld('m1');
  eq(paceCard(m, null)?.k === 'rank', false, 'mission I: no rank card');
});
