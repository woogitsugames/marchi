// BACKLOG P2: the bridge-jam text names why the wagon waits (oncoming / span full / yielding to a waiter),
// derived read-only from the state in src/ui/format.ts (no sim field, hashes unchanged).
import { step, TICK_HZ } from '../src/sim/index';
import { bridgeJamCause } from '../src/ui/bridgeJam';
import { benchWorld } from '../tools/bench';
import { assert, eq, test } from './harness';

test('bridge jam cause: every queued wagon gets one of the three explained causes', () => {
  const w = benchWorld(120);
  const seen = new Map<string, number>();
  for (let i = 0; i < 4 * 60 * TICK_HZ; i++) {
    step(w);
    if (i % 5) continue;
    for (const q of w.state.wagons) {
      if (q.status.k !== 'BRIDGE_JAM') continue;
      const key = bridgeJamCause(w, q.status);
      seen.set(key, (seen.get(key) ?? 0) + 1);
      const b = w.state.wagons.find((o) => o.id === (q.status as { blocker: number }).blocker)!;
      if (key === 'ONCOMING') assert(b.bridgeFrom !== q.at, 'oncoming blocker did not enter from our bank');
      if (key === 'SPAN_FULL') assert(b.bridgeFrom === q.at || b.bridgeFrom < 0, 'same-direction blocker entered from our bank');
      if (key === 'YIELD') eq(b.status.k, 'BRIDGE_JAM', 'yield blocker is itself queued');
    }
  }
  console.log('     causes', JSON.stringify([...seen]));
  assert((seen.get('UNKNOWN') ?? 0) === 0, 'no unexplained generic bridge text');
  assert((seen.get('ONCOMING') ?? 0) > 0, 'oncoming seen');
});
