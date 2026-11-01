import { checkInvariants, unexplainedStalls, TICK_HZ } from '../src/sim/index';
import { runBot } from '../tools/bot';
import { assert, eq, test } from './harness';

test('mission bot wins mission 1 with goods conserved and reasons present every tick', () => {
  const r = runBot({ checkEvery: 1 });
  eq(r.violations.length, 0, 'violations: ' + r.violations.join(' | '));
  eq(r.result, 'won', 'mission result');
  assert(r.endTick < 12 * 60 * TICK_HZ, 'before the deadline');
  void checkInvariants; void unexplainedStalls;
});
