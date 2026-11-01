import { checkInvariants, step, TICK_HZ } from '../src/sim/index';
import { benchWorld } from '../tools/bench';
import { assert, test } from './harness';

test('stress 120 wagons over one-lane bridges: no starvation, invariants hold', () => {
  const w = benchWorld(120);
  let maxWait = 0;
  for (let i = 0; i < 8 * 60 * TICK_HZ; i++) {
    step(w);
    for (const q of w.state.wagons) {
      if (q.status.k === 'BRIDGE_JAM') maxWait = Math.max(maxWait, w.state.tick - q.status.since);
    }
    if (i % 100 === 0) {
      const v = checkInvariants(w);
      assert(v.length === 0, v.join('; '));
    }
  }
  console.log(`     max bridge wait ${(maxWait / TICK_HZ).toFixed(0)} s`);
  // Two one-lane bridges for 120 wagons are deliberately overloaded: queues are long, but bounded.
  assert(maxWait < 330 * TICK_HZ, 'a wagon waited more than 5.5 minutes at a bridge: ' + maxWait / TICK_HZ);
});
