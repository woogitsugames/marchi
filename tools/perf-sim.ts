// Headless simulation cost with many wagons: npx tsx tools/perf-sim.ts
import { step, TICK_HZ, checkInvariants } from '../src/sim/index';
import { benchWorld } from './bench';

const rows: string[] = [];
for (const n of [50, 100, 200]) {
  const w = benchWorld(n);
  for (let i = 0; i < 60 * TICK_HZ; i++) step(w); // warm-up minute
  const ticks = 3 * 60 * TICK_HZ;
  const heap0 = process.memoryUsage().heapUsed;
  const times: number[] = [];
  for (let i = 0; i < ticks; i++) {
    const t0 = performance.now();
    step(w);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p99 = times[Math.floor(times.length * 0.99)]!;
  const max = times[times.length - 1]!;
  const bad = checkInvariants(w).length;
  const moving = w.state.wagons.filter((q) => q.next >= 0).length;
  console.error(`${n}: buildings=${w.state.buildings.length}`);
  const jsonKb = JSON.stringify(w.state).length / 1024;
  // budget at x4 = 40 ticks/s => per-frame (60 fps) cost ~ avg * 40/60
  rows.push(`| ${n} | ${avg.toFixed(3)} | ${p99.toFixed(2)} | ${max.toFixed(2)} | ${(avg * 40 / 60).toFixed(2)} | ${moving} | ${((process.memoryUsage().heapUsed - heap0) / 1048576).toFixed(1)} | ${jsonKb.toFixed(0)} | ${bad} |`);
}
console.log('| wagons | avg ms/tick | p99 ms | max ms | ms/frame at x4 | moving | heap Δ MB | save KB | invariant errors |');
console.log('|---|---|---|---|---|---|---|---|---|');
console.log(rows.join('\n'));
