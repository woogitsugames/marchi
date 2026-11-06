// Reproduction from seed 91. Do not shrink with fuzz-lib: its current shrinker
// compares absolute snapshot command ticks with a relative scenario duration.
import { TICK_HZ, applyCommand, createWorld, serialize, step } from '../../src/sim/index';
import { SNAPSHOTS, runScenario } from '../../tools/fuzz-lib';
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
    const scenario = { mission: 'valley-75', coins: 4000, ticks: 9000, saveAt: 1034, commands: [
      { tick: 46978, cmd: { t: 'place' as const, type: 'bakery' as const, x: 43, y: 27, facing: 1 as const } },
      { tick: 47796, cmd: { t: 'buyWagon' as const, stable: 3 } },
      { tick: 48643, cmd: { t: 'buyWagon' as const, stable: 3 } },
      { tick: 48981, cmd: { t: 'buyWagon' as const, stable: 3 } },
      { tick: 50580, cmd: { t: 'demolish' as const, cell: 2823 } },
    ] };
    const result = runScenario(scenario, { rerun: true });
    assert(!result.failure, `${result.failure?.kind} @${result.failure?.tick}: ${result.failure?.detail}`);
  } finally {
    for (const name of names) SNAPSHOTS.delete(name);
  }
});
