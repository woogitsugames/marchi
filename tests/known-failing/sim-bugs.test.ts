// Open sim bugs found in review (docs/reviews/sim-review-01.md). Each test asserts the intended
// behaviour and fails while the bug is open.
import { applyCommand, checkInvariants, createWorld, step, type World } from '../../src/sim/index';
import { bridgeA } from '../../tools/bot';
import { assert, test } from '../harness';

/** A wagon carrying flour whose bakery gets demolished while no other building accepts flour. */
function strandedFlour(): { w: World; id: number } {
  const w = createWorld('sandbox');
  w.state.coins = 5000;
  const wh = w.state.buildings.find((b) => b.type === 'warehouse')!;
  assert(applyCommand(w, { t: 'demolish', cell: wh.y * w.terrain.w + wh.x }).ok, 'warehouse gone');
  assert(applyCommand(w, bridgeA(w)).ok, 'bridge');
  for (let i = 0; i < 20000; i++) {
    step(w);
    const q = w.state.wagons.find((x) => x.job && x.job.phase === 'dropoff' && x.job.good === 'flour');
    if (q) {
      const bak = w.state.buildings.find((b) => b.id === q.job!.to)!;
      assert(applyCommand(w, { t: 'demolish', cell: bak.y * w.terrain.w + bak.x }).ok, 'bakery gone');
      return { w, id: q.id };
    }
  }
  throw new Error('no flour delivery seen');
}

test('[F-03] stranded cargo: NO_ROUTE "stalled since" keeps counting (not reset every tick)', () => {
  const { w, id } = strandedFlour();
  const q = w.state.wagons.find((x) => x.id === id)!;
  for (let i = 0; i < 20; i++) step(w);
  assert(q.status.k === 'NO_ROUTE', 'wagon reports NO_ROUTE: ' + q.status.k);
  const since0 = (q.status as { since: number }).since;
  for (let i = 0; i < 300; i++) step(w);
  const v = checkInvariants(w);
  assert(v.length === 0, v.join('; '));
  const since1 = (q.status as { since: number }).since;
  assert(since1 === since0, `since moved from ${since0} to ${since1}: the UI shows "stalled for 0:00" forever`);
});
