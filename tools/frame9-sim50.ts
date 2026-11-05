// Day 9d: where the 50-wagon p99 of `npm run perf:sim` comes from (dispatch ticks vs the rest).
// Use: npx tsx tools/frame9-sim50.ts [wagons=50]
import { step, TICK_HZ } from '../src/sim/index';
import { benchWorld } from './bench';
const n = Number(process.argv[2] ?? 50);
const w = benchWorld(n);
for (let i = 0; i < 60 * TICK_HZ; i++) step(w);
const disp: number[] = [], other: number[] = [];
for (let i = 0; i < 3 * 60 * TICK_HZ; i++) {
  const tk = w.state.tick, t0 = performance.now(); step(w); const dt = performance.now() - t0;
  (tk % 5 === 0 ? disp : other).push(dt);
}
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * p)]!; };
const idle = w.state.wagons.filter((x) => x.status.k === 'IDLE').length;
console.log(`wagons ${n} idle ${idle}: dispatch-phase ticks (tick%5==0) n=${disp.length} p50 ${q(disp, 0.5).toFixed(2)} p90 ${q(disp, 0.9).toFixed(2)} p99 ${q(disp, 0.99).toFixed(2)} ms; other n=${other.length} p50 ${q(other, 0.5).toFixed(3)} p99 ${q(other, 0.99).toFixed(2)} ms`);
