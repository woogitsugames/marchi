// Reproduction from seed 91. Do not shrink with fuzz-lib: its current shrinker
// compares absolute snapshot command ticks with a relative scenario duration.
import { TICK_HZ, applyCommand, createWorld, serialize, step } from '../../src/sim/index';
import { SNAPSHOTS, generateScenario, runScenario } from '../../tools/fuzz-lib';
import { valleyDriver } from '../../tools/robustness';
import { assert, test } from '../harness';

test('seed 91: late-valley wagons must not remain stuck', () => {
  const world = createWorld('sandbox');
  const drive = valleyDriver();
  const names = ['valley-75', 'valley-100', 'valley-120'];
  try {
    for (const minute of [75, 100, 120]) {
      while (world.state.tick < minute * 60 * TICK_HZ) {
        for (const cmd of drive(world)) applyCommand(world, cmd);
        step(world);
      }
      SNAPSHOTS.set(`valley-${minute}`, serialize(world));
    }
    const scenario = generateScenario(91, { ticks: 9000, missions: names });
    const result = runScenario(scenario, { rerun: true });
    assert(!result.failure, `${result.failure?.kind} @${result.failure?.tick}: ${result.failure?.detail}`);
  } finally {
    for (const name of names) SNAPSHOTS.delete(name);
  }
});
