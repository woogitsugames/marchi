// D-230: a wagon that loses its route while standing on a one-lane wooden span drives off to the
// nearest bridgehead and waits there with NO_ROUTE, instead of parking on the span and holding
// every wagon at the other bank in BRIDGE_JAM forever. Repros from the GPT long fuzz (order 93,
// docs/research/gpt-fuzz-2026-11.md): seed 255 (mission II) and seed 91 (free valley at 75 min).
import { TICK_HZ, applyCommand, createWorld, serialize, step } from '../src/sim/index';
import { net } from '../src/sim/network';
import { explainWagon } from '../src/sim/diagnose';
import { SNAPSHOTS, makeWorld, runScenario } from '../tools/fuzz-lib';
import { valleyDriver } from '../tools/robustness';
import { assert, eq, test } from './harness';

test('seed 255: demolished road behind a bridge does not deadlock it; the jam names the stranded wagon', () => {
  const result = runScenario({
    mission: 'm2', coins: 4000, ticks: 5102, saveAt: -1,
    commands: [{ tick: 2065, cmd: { t: 'demolish', cell: 2937 } }],
  });
  assert(!result.failure, `${result.failure?.kind} @${result.failure?.tick}: ${result.failure?.detail}`);

  // the cause while it lasts: wagon 12 queues behind wagon 14, which is on the span without a route
  const w = makeWorld('m2', 4000);
  let jamSeen = false, offSpanAt = -1, crossed = false;
  while (w.state.tick < 2600) {
    if (w.state.tick === 2065) assert(applyCommand(w, { t: 'demolish', cell: 2937 }).ok, 'demolish');
    step(w);
    const c = net(w);
    const a = w.state.wagons.find((x) => x.id === 12)!, b = w.state.wagons.find((x) => x.id === 14)!;
    if (a.status.k === 'BRIDGE_JAM') {
      jamSeen = true;
      eq(a.status.blocker, 14, 'jam names the stranded wagon');
      eq(b.status.k, 'NO_ROUTE', 'stranded wagon keeps NO_ROUTE while it clears the span');
      const chain = explainWagon(w, 12);
      assert(chain.some((l) => l.kind === 'wagon' && l.id === 14 && l.status.k === 'NO_ROUTE'), 'explanation reaches NO_ROUTE');
    }
    if (offSpanAt < 0 && w.state.tick > 2074 && c.span[b.at] < 0 && b.next < 0) offSpanAt = w.state.tick;
    if (jamSeen && a.status.k !== 'BRIDGE_JAM' && c.span[a.at] >= 0) crossed = true;
  }
  assert(jamSeen, 'the short jam happens');
  assert(offSpanAt > 0 && offSpanAt < 2200, `stranded wagon left the span (at ${offSpanAt})`);
  assert(crossed, 'the queued wagon crossed after the span cleared');
});

test('seed 91: late-valley wagons do not remain stuck at a bridge after a demolition', () => {
  const world = createWorld('sandbox');
  const drive = valleyDriver();
  while (world.state.tick < 75 * 60 * TICK_HZ) {
    for (const cmd of drive(world)) applyCommand(world, cmd);
    step(world);
  }
  SNAPSHOTS.set('valley-75', serialize(world));
  try {
    const result = runScenario({ mission: 'valley-75', coins: 4000, ticks: 9000, saveAt: 1034, commands: [
      { tick: 46978, cmd: { t: 'place', type: 'bakery', x: 43, y: 27, facing: 1 } },
      { tick: 47796, cmd: { t: 'buyWagon', stable: 3 } },
      { tick: 48643, cmd: { t: 'buyWagon', stable: 3 } },
      { tick: 48981, cmd: { t: 'buyWagon', stable: 3 } },
      { tick: 50580, cmd: { t: 'demolish', cell: 2823 } },
    ] }, { rerun: true });
    assert(!result.failure, `${result.failure?.kind} @${result.failure?.tick}: ${result.failure?.detail}`);
  } finally {
    SNAPSHOTS.delete('valley-75');
  }
});
