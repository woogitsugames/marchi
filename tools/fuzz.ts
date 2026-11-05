// Long-running simulation fuzzer.
//   npx tsx tools/fuzz.ts --runs 500 [--ticks 6000] [--seed 1] [--missions m1,m4] [--save] [--timing] [--no-stalls]
// Each run: a seeded random command sequence on one of the missions (default: every playable map, m1-m13 + sandbox), every tick checked for
// invariants, unexplained stalls, NaN/Infinity and stuck wagons; a save/load clone runs side by
// side from a random tick; the whole run is replayed once more for determinism.
// On failure the sequence is shrunk; --save writes it to tests/regressions/<kind>-<seed>.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_FUZZ_MISSIONS, generateScenario, runScenario, shrink, type Failure, type Scenario } from './fuzz-lib';

const args = process.argv.slice(2);
const opt = (name: string, def: number) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const flag = (name: string) => args.includes('--' + name);

const runs = opt('runs', 50);
const ticks = opt('ticks', 6000);
const seed0 = opt('seed', 1);
// --missions m4,m5,m6 (default: every playable map)
const mi = args.indexOf('--missions');
const missions = mi >= 0 ? args[mi + 1]!.split(',') : ALL_FUZZ_MISSIONS;
const save = flag('save');
const timing = flag('timing');
const checkStalls = !flag('no-stalls');
const here = dirname(fileURLToPath(import.meta.url));

const pct = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))]!;
};

let totalTicks = 0, ok = 0, rejected = 0, maxWagons = 0;
const stepMs: number[] = [], dispatchMs: number[] = [];
const failures: { seed: number; failure: Failure; shrunk: Scenario }[] = [];
const byKind = new Map<string, number>();
const perMission = new Map<string, number>();
const t0 = performance.now();

for (let r = 0; r < runs; r++) {
  const seed = seed0 + r;
  const sc = generateScenario(seed, { ticks, missions });
  perMission.set(sc.mission, (perMission.get(sc.mission) ?? 0) + 1);
  const res = runScenario(sc, { rerun: true, timing, checkStalls });
  totalTicks += res.stats.ticks * 2 + (sc.saveAt >= 0 ? res.stats.ticks - sc.saveAt : 0);
  ok += res.stats.commandsOk;
  rejected += res.stats.commandsRejected;
  maxWagons = Math.max(maxWagons, res.stats.maxWagons);
  if (timing) { stepMs.push(...res.stats.stepMs); dispatchMs.push(...res.stats.dispatchMs); }
  if (res.failure) {
    const f = res.failure;
    byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);
    console.log(`FAIL seed=${seed} ${sc.mission} kind=${f.kind} tick=${f.tick}: ${f.detail.slice(0, 300)}`);
    // shrink only the first few of each kind
    if ((byKind.get(f.kind) ?? 0) <= 3) {
      const shrunk = shrink(sc, f.kind, { checkStalls });
      console.log(`     shrunk to ${shrunk.commands.length} commands / ${shrunk.ticks} ticks: ${JSON.stringify(shrunk.commands).slice(0, 400)}`);
      failures.push({ seed, failure: f, shrunk });
      if (save) {
        const dir = join(here, '..', 'tests', 'regressions');
        mkdirSync(dir, { recursive: true });
        const file = join(dir, `${f.kind}-${seed}.json`);
        writeFileSync(file, JSON.stringify({ name: `${f.kind}-${seed}`, status: 'known-failing', expect: f.kind, note: f.detail.slice(0, 500), scenario: shrunk }, null, 1) + '\n');
        console.log(`     saved ${file}`);
      }
    }
  } else if ((r + 1) % 25 === 0) {
    console.log(`… ${r + 1}/${runs} runs, ${totalTicks} ticks`);
  }
}

console.log(`missions: ${missions.map((m) => `${m}:${perMission.get(m) ?? 0}`).join(' ')}`);
console.log(`runs=${runs} ticks/run=${ticks} simulatedTicks=${totalTicks} commandsOk=${ok} rejected=${rejected} maxWagons=${maxWagons}`);
console.log(`failures=${failures.length ? [...byKind].map(([k, n]) => `${k}:${n}`).join(',') : 0} time=${((performance.now() - t0) / 1000).toFixed(1)}s`);
if (timing) {
  console.log(`step ms (non-dispatch) p50=${pct(stepMs, 0.5).toFixed(3)} p99=${pct(stepMs, 0.99).toFixed(3)} max=${pct(stepMs, 1).toFixed(3)}`);
  console.log(`step ms (dispatch tick) p50=${pct(dispatchMs, 0.5).toFixed(3)} p99=${pct(dispatchMs, 0.99).toFixed(3)} max=${pct(dispatchMs, 1).toFixed(3)}`);
}
process.exit(byKind.size ? 1 : 0);
