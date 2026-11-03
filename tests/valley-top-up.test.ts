// D-94: in the free valley a workshop that is not starving asks for input only when at least
// min(load, TOP_UP_MIN) units fit; contract missions keep the one-unit top-up (their balance and golden
// hashes). Checked on every new delivery job to a workshop: the gap it was assigned against.
import { BUILDINGS, TOP_UP_MIN, applyCommand, capacityOf, createWorld, step, type World } from '../src/sim/index';
import { DECENT, runSandbox } from '../tools/bot-sandbox';
import { bridgeA } from '../tools/bot';
import { assert, test } from './harness';

interface Tally { small: number; jobs: number }

/** New jobs to a workshop this tick: was the gap < min(cap, 4) while the workshop still had a cycle in? */
function watchJobs(seen: Set<number>, t: Tally): (w: World) => void {
  return (w) => {
    for (const q of w.state.wagons) {
      const j = q.job;
      if (!j || seen.has(j.id)) continue;
      seen.add(j.id);
      const b = w.state.buildings.find((x) => x.id === j.to);
      if (!b || b.type === 'castle' || b.type === 'warehouse') continue;
      const def = BUILDINGS[b.type];
      const per = def.recipe?.inputs[j.good] ?? 1;
      const starving = b.stock[j.good] < per && b.incoming[j.good] === j.qty;
      const gap = def.inCap - b.stock[j.good] - (b.incoming[j.good] - j.qty);
      t.jobs++;
      if (!starving && gap < Math.min(capacityOf(j.good), TOP_UP_MIN)) t.small++;
    }
  };
}

test('free valley: no workshop top-up below min(load, 4) unless it is starving', () => {
  const t: Tally = { small: 0, jobs: 0 };
  runSandbox(DECENT, 30, { checkEvery: 1000, onTick: watchJobs(new Set(), t) });
  assert(t.jobs > 100, `workshop deliveries in 30 valley minutes (${t.jobs})`);
  assert(t.small === 0, `small top-ups of a fed workshop (${t.small} of ${t.jobs})`);
});

test('contract missions keep the one-unit top-up (mission I with the bridge)', () => {
  const w = createWorld('m1');
  assert(applyCommand(w, bridgeA(w)).ok, 'bridge');
  const t: Tally = { small: 0, jobs: 0 };
  const watch = watchJobs(new Set(), t);
  for (let i = 0; i < 6000 && w.state.mission.result === 'running'; i++) { step(w); watch(w); }
  assert(t.small > 0, `mission I still tops up a fed workshop with small loads (${t.small} of ${t.jobs})`);
});
