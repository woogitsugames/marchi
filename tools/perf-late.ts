// Late free-valley tick cost (night 2026-11-10, D-470): the DECENT player (tools/robustness valleyDriver) plays to
// minute `--from` (default 100), then `--min` (default 20) minutes of play are timed per `step` (driver commands are
// applied outside the timed region). Each rep replays from tick 0. Prints avg / p50 / p99 / max ms per tick, wagons, buildings and the final hash, so
// two checkouts can be compared on the same run (the hash must match).
//   npx tsx tools/perf-late.ts [--from 100] [--min 20] [--reps 3]
import { TICK_HZ, applyCommand, createWorld, step } from '../src/sim/index';
import { hashState } from '../src/sim/hash';
import { valleyDriver } from './robustness';

const args = process.argv.slice(2);
const opt = (n: string, d: number) => { const i = args.indexOf('--' + n); return i >= 0 ? Number(args[i + 1]) : d; };
const from = opt('from', 100), mins = opt('min', 20), reps = opt('reps', 3);

const avgs: number[] = [];
for (let r = 0; r < reps; r++) {
  // each rep replays the whole run (the driver keeps its plan position in a closure, so no snapshot is cloned)
  const w = createWorld('sandbox');
  const d = valleyDriver();
  while (w.state.tick < from * 60 * TICK_HZ) { for (const c of d(w)) applyCommand(w, c); step(w); }
  const t: number[] = [];
  const end = w.state.tick + mins * 60 * TICK_HZ;
  while (w.state.tick < end) {
    for (const c of d(w)) applyCommand(w, c);
    const a = performance.now();
    step(w);
    t.push(performance.now() - a);
  }
  t.sort((x, y) => x - y);
  const avg = t.reduce((x, y) => x + y, 0) / t.length;
  avgs.push(avg);
  console.log(`rep ${r}: ticks=${t.length} avg=${avg.toFixed(4)} p50=${t[t.length >> 1]!.toFixed(4)} p99=${t[Math.floor(t.length * 0.99)]!.toFixed(3)} max=${t[t.length - 1]!.toFixed(2)} wagons=${w.state.wagons.length} buildings=${w.state.buildings.length} hash=${hashState(w.state)}`);
}
avgs.sort((x, y) => x - y);
console.log(`median avg ms/tick: ${avgs[avgs.length >> 1]!.toFixed(4)}`);
