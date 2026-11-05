// D-156 (dispatcher 2, L1): a job held for a busy wagon (WAGON_DUE) is calm and never offers "buy a wagon";
// the hold happens only with a fleet of at least the mission's starting wagons + DISPATCH2.fleetGate.
import { applyCommand, createWorld, MISSIONS, step, type World } from '../src/sim/index';
import { DISPATCH2 } from '../src/sim/logistics';
import { stableId } from '../tools/bot';
import { isStall, isCritical } from '../src/ui/stallKinds';
import { cureFor } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

function run(id: string, extra: number, each: (w: World) => void): void {
  const w = createWorld(id);
  for (let i = 0; i < extra; i++) assert(applyCommand(w, { t: 'buyWagon', stable: stableId(w) }).ok, 'buy wagon');
  while (w.state.mission.result === 'running') { step(w); if (w.state.tick % 5 === 1) each(w); } // right after a dispatch
}

test('D-156: no job is held with the authored fleet or one extra wagon (m8, m3, m4)', () => {
  eq(DISPATCH2.fleetGate, 2, 'fleet gate');
  for (const id of ['m8', 'm3', 'm4']) for (const extra of [0, 1]) {
    let due = 0;
    run(id, extra, (w) => { for (const b of w.state.buildings) if (b.status.k === 'WAGON_DUE') due++; });
    eq(due, 0, `${id} +${extra} wagons: WAGON_DUE samples`);
  }
});

test('D-156: WAGON_DUE under L1 is calm, names a busy wagon, offers no wagon cure and ends within a minute (m8 +2)', () => {
  assert(MISSIONS.m8!.wagons + 2 >= MISSIONS.m8!.wagons + DISPATCH2.fleetGate, 'm8 +2 opens the gate');
  let samples = 0, longest = 0;
  const since = new Map<string, number>();
  run('m8', 2, (w) => {
    const now = new Set<string>();
    for (const b of w.state.buildings) {
      const s = b.status;
      if (s.k !== 'WAGON_DUE') continue;
      samples++;
      const key = `${b.id}:${s.good}`;
      now.add(key);
      if (!since.has(key)) since.set(key, w.state.tick);
      longest = Math.max(longest, w.state.tick - since.get(key)!);
      assert(!isStall(s) && !isCritical(s, b.stalledTicks), `${b.type} ${b.id}: WAGON_DUE is not a stall`);
      eq(b.stalledTicks, 0, `${b.type} ${b.id}: stall clock`);
      assert(s.at > w.state.tick, `${b.type} ${b.id}: the arrival is in the future`);
      const wagon = w.state.wagons.find((q) => q.id === s.wagon);
      assert(wagon && wagon.job !== null, `${b.type} ${b.id}: the named wagon is busy (tick ${w.state.tick} at ${s.at} wagon ${JSON.stringify(wagon && [wagon.job, wagon.busyTicks, wagon.status])})`);
      assert(cureFor(w, b.id) !== 'wagon', `${b.type} ${b.id}: no "buy a wagon" for a held job`);
    }
    for (const k of [...since.keys()]) if (!now.has(k)) since.delete(k);
  });
  assert(samples > 100, `holds happen with a big fleet: ${samples}`);
  assert(longest <= 60 * 10, `a hold ends within a minute: ${longest} ticks`);
});
