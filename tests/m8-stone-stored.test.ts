// D-95 (owner decision): mission VIII's quarry waits "no wagon" for the granary's road-stone reserve while
// the granary already holds paving stone. Read-only: the card says how much stone there is, no "Kup wóz";
// the sim (and so every hash) is untouched.
import { createWorld, explainBuilding, step, stoneAvailable, stoneInStore, STONE_COBBLE } from '../src/sim/index';
import { calmWhy, cureFor, rankStalls } from '../src/ui/stalls';
import { DECENT, runSandbox } from '../tools/bot-sandbox';
import { assert, eq, test } from './harness';

test('m8: a quarry waiting for the reserve run with stone in the granary is calm, no wagon cure, real numbers', () => {
  const w = createWorld('m8');
  let seen = 0;
  while (w.state.mission.result === 'running') {
    step(w);
    if (w.state.tick % 20) continue;
    const q = w.state.buildings.find((b) => b.type === 'quarry')!;
    const s = q.status;
    if (s.k !== 'OUTPUT_FULL' || s.cause !== 'NO_WAGON') { eq(stoneInStore(w, q.id), 0, 'only for a full quarry waiting for a wagon'); continue; }
    const n = stoneInStore(w, q.id);
    eq(n, stoneAvailable(w), 'the stone the granaries really hold');
    assert(n >= STONE_COBBLE, 'enough for at least one cobbled cell');
    eq(cureFor(w, q.id), null, 'no "Kup wóz"');
    eq(calmWhy(w, q), 'stoneStored', 'the card says why');
    eq(explainBuilding(w, q.id, 5, true).length, 1, 'the chain ends at the quarry (the Why sheet shows the line)');
    const e = rankStalls(w).find((x) => x.id === q.id);
    if (e) assert(!e.crit, 'not the critical stall');
    seen++;
  }
  assert(seen > 50, `samples of the waiting quarry (${seen})`);
});

test('free valley: a quarry waiting for a wagon is not affected (the market buys stone)', () => {
  let checked = 0;
  runSandbox(DECENT, 40, {
    checkEvery: 1000,
    onTick: (w) => {
      if (w.state.tick % 50) return;
      for (const b of w.state.buildings) if (b.type === 'quarry') { eq(stoneInStore(w, b.id), 0, 'valley quarry'); checked++; }
    },
  });
  assert(checked > 0, 'a valley quarry was checked');
});
