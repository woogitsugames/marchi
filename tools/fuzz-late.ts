// Late free valley fuzz (research 2026-11-06): the DECENT player (+ orders, merchants) plays to a snapshot minute, then
// seeded random commands (tools/fuzz-lib genCommand: roads, diagonal multi-span bridges, demolitions incl. bridge cells,
// wagons, buildings) run from there with every check of tools/fuzz.ts (invariants + stall reasons every tick, NaN,
// stuck wagons, save/load clone, rerun determinism). Snapshots: 75 min (rank 4, trading post just open), 100 min (winter
// ice windows at 108-110 and 114-116 min ahead), 120 min (spring thaw 124-128).
//   npx tsx tools/fuzz-late.ts [--runs 60] [--ticks 9000] [--seed 1]
import { TICK_HZ, applyCommand, createWorld, serialize, step } from '../src/sim/index';
import { SNAPSHOTS, generateScenario, makeWorld, runScenario, shrink } from './fuzz-lib';
import { valleyDriver } from './robustness';

const args = process.argv.slice(2);
const opt = (n: string, d: number) => { const i = args.indexOf('--' + n); return i >= 0 ? Number(args[i + 1]) : d; };
const runs = opt('runs', 60), ticks = opt('ticks', 9000), seed0 = opt('seed', 1);

const w = createWorld('sandbox');
const d = valleyDriver();
for (const min of [75, 100, 120]) {
  while (w.state.tick < min * 60 * TICK_HZ) { for (const c of d(w)) applyCommand(w, c); step(w); }
  SNAPSHOTS.set(`valley-${min}`, serialize(w));
}
const names = [...SNAPSHOTS.keys()];
let bad = 0, postUnits = 0, iceTicks = 0;
const t0 = performance.now();
for (let r = 0; r < runs; r++) {
  const sc = generateScenario(seed0 + r, { ticks, missions: names });
  const res = runScenario(sc, { rerun: true });
  // what the run exercised: units sold at the post, ticks with a bridge closed by ice (replayed without checks)
  const x = makeWorld(sc.mission, sc.coins);
  const sold0 = Object.values(x.state.tradePost!.sold).reduce((a, b) => a + b, 0);
  let k = 0;
  for (let t = 0; t < sc.ticks; t++) {
    while (k < sc.commands.length && sc.commands[k]!.tick === x.state.tick) applyCommand(x, sc.commands[k++]!.cmd);
    step(x);
    if (x.state.wagons.some((v) => v.status.k === 'BRIDGE_CLOSED')) iceTicks++;
  }
  if (process.env.VERBOSE) console.log(sc.mission, x.state.tick, iceTicks);
  postUnits += Object.values(x.state.tradePost!.sold).reduce((a, b) => a + b, 0) - sold0;
  if (res.failure) {
    bad++;
    const f = res.failure;
    console.log(`FAIL seed=${seed0 + r} ${sc.mission} kind=${f.kind} tick=${f.tick}: ${f.detail.slice(0, 300)}`);
    if (bad <= 3) { const s = shrink(sc, f.kind); console.log(`     shrunk ${s.commands.length} cmds / ${s.ticks} ticks: ${JSON.stringify(s.commands).slice(0, 600)}`); }
  }
}
console.log(`runs=${runs} ticks/run=${ticks} failures=${bad} postUnitsSold=${postUnits} wagonTicksBridgeClosed=${iceTicks} time=${((performance.now() - t0) / 1000).toFixed(1)}s`);
process.exit(bad ? 1 : 0);
