// Regression (review F-02): read-only helpers called between ticks (the UI asks for wagon ETAs every
// frame) must not change what the next step() computes. wagonEta -> findPath -> dijkstra used to fill
// the per-tick bridge-penalty cache (world.queue) with pre-step data, which the step then reused.
import { stateHash, step, wagonEta } from '../src/sim/index';
import { benchWorld } from '../tools/bench';
import { test } from './harness';

test('UI reads between ticks (wagonEta) do not change the simulation', () => {
  const a = benchWorld(120), b = benchWorld(120);
  for (let t = 0; t < 2000; t++) {
    // one ETA of a wagon heading to a pickup is enough: it runs a full path search
    const q = b.state.wagons.find((x) => x.job && x.job.phase === 'pickup') ?? b.state.wagons[0]!;
    wagonEta(b, q.id);
    step(a);
    step(b);
    if (t % 50 === 0 || t === 1999) {
      if (stateHash(a) !== stateHash(b)) throw new Error(`diverged by tick ${a.state.tick}`);
    }
  }
});
