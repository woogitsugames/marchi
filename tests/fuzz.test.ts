// Seeded random / property tests for the simulation (short mode; `npx tsx tools/fuzz.ts --runs 500`
// is the long mode). Every tick: checkInvariants(), unexplainedStalls(), no NaN/Infinity, no
// wagon with a job frozen for 5 sim-minutes; a save/load clone runs side by side; each scenario
// is replayed a second time for determinism.
import {
  applyCommand, checkInvariants, createWorld, deserialize, serialize, stateHash, step, unexplainedStalls,
  type World,
} from '../src/sim/index';
import { bridgeA, bridgeB, stableId } from '../tools/bot';
import { generateScenario, nonFinitePaths, runScenario } from '../tools/fuzz-lib';
import { assert, eq, test } from './harness';

const SHORT_RUNS = 12;
const SHORT_TICKS = 3000;

test(`fuzz: ${SHORT_RUNS} seeded command sequences (m1 + sandbox) keep every invariant`, () => {
  const fails: string[] = [];
  let ticks = 0;
  for (let seed = 1; seed <= SHORT_RUNS; seed++) {
    const sc = generateScenario(seed, { ticks: SHORT_TICKS, minCmds: 10, maxCmds: 40 });
    const r = runScenario(sc, { rerun: true });
    ticks += r.stats.ticks;
    if (r.failure) fails.push(`seed ${seed} ${sc.mission}: ${r.failure.kind} @${r.failure.tick} ${r.failure.detail.slice(0, 200)}`);
  }
  assert(fails.length === 0, `failures (shrink with tools/fuzz.ts --seed N --runs 1):\n${fails.join('\n')}`);
  assert(ticks === SHORT_RUNS * SHORT_TICKS, 'all ticks ran');
});

test('fuzz: generator is deterministic (same seed -> same commands)', () => {
  const a = generateScenario(77, { ticks: 1500 });
  const b = generateScenario(77, { ticks: 1500 });
  eq(JSON.stringify(a), JSON.stringify(b), 'scenario');
  assert(a.commands.length > 0, 'has commands');
});

test('fuzz: NaN/Infinity detector sees what JSON.stringify would hide', () => {
  eq(nonFinitePaths({ a: [1, 2, { b: NaN }], c: Infinity }).length, 2, 'two bad numbers');
  eq(nonFinitePaths(createWorld('m1').state).length, 0, 'fresh state clean');
});

// --- demolition in every phase of a job ---------------------------------------

type Phase = 'TO_PICKUP' | 'LOADING' | 'TO_DROPOFF' | 'UNLOADING';
const PHASES: Phase[] = ['TO_PICKUP', 'LOADING', 'TO_DROPOFF', 'UNLOADING'];

function busyWorld(): World {
  const w = createWorld('sandbox');
  w.state.coins = 5000;
  assert(applyCommand(w, bridgeA(w)).ok, 'bridge A');
  assert(applyCommand(w, bridgeB(w)).ok, 'bridge B');
  for (let i = 0; i < 6; i++) applyCommand(w, { t: 'buyWagon', stable: stableId(w) });
  return w;
}

function checkedSteps(w: World, n: number, label: string): void {
  for (let i = 0; i < n; i++) {
    step(w);
    const v = checkInvariants(w);
    if (v.length) throw new Error(`${label} tick ${w.state.tick}: ${v.join('; ')}`);
    const u = unexplainedStalls(w);
    if (u.length) throw new Error(`${label} tick ${w.state.tick}: ${u.join('; ')}`);
  }
}

for (const phase of PHASES) {
  for (const end of ['source', 'destination'] as const) {
    test(`demolish the job ${end} while a wagon is ${phase}: reservations stay exact`, () => {
      const w = busyWorld();
      let target = -1;
      for (let i = 0; i < 20000 && target < 0; i++) {
        checkedSteps(w, 1, 'warmup');
        for (const q of w.state.wagons) {
          if (q.status.k !== phase || !q.job) continue;
          const id = end === 'source' ? q.job.from : q.job.to;
          const b = w.state.buildings.find((x) => x.id === id);
          if (b && b.type !== 'castle' && b.type !== 'stable') { target = id; break; }
        }
      }
      assert(target >= 0, `no wagon reached ${phase} with a demolishable ${end}`);
      const b = w.state.buildings.find((x) => x.id === target)!;
      const r = applyCommand(w, { t: 'demolish', cell: b.y * w.terrain.w + b.x });
      assert(r.ok, 'demolished: ' + JSON.stringify(r));
      // invariants must already hold between the command and the next tick
      const v = checkInvariants(w);
      assert(v.length === 0, 'right after demolish: ' + v.join('; '));
      checkedSteps(w, 1500, `after demolish (${phase}, ${end})`);
      // save/load after the demolition continues identically
      const w2 = deserialize(serialize(w));
      for (let i = 0; i < 600; i++) { step(w); step(w2); }
      eq(stateHash(w2), stateHash(w), 'save/load continuation');
    });
  }
}
