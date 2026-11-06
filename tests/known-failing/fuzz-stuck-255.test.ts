// Minimal reproduction: fuzz seed 255, mission II, demolition while bridge traffic is active.
// The known-failing runner expects the correct outcome and reports the open bug as FAIL.
import { runScenario } from '../../tools/fuzz-lib';
import { assert, test } from '../harness';

test('seed 255: a wagon must not remain stuck after a road demolition', () => {
  const result = runScenario({
    mission: 'm2', coins: 4000, ticks: 5102, saveAt: -1,
    commands: [{ tick: 2065, cmd: { t: 'demolish', cell: 2937 } }],
  });
  assert(!result.failure, `${result.failure?.kind} @${result.failure?.tick}: ${result.failure?.detail}`);
});
