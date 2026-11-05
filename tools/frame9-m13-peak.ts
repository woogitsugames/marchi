// Day 9 frame-cost research: which mission is busiest and when? Runs missions in the real sim (no player commands
// except optional wagon buys at 0:20) and prints the per-minute wagons moving / stalled buildings and the peak second
// (the tick to fast-forward the browser to). Use: npx tsx tools/frame9-m13-peak.ts [mission=buys ...]
//   e.g. m13=3 m13=5 m12=0 m6=0
import { MISSIONS, TICK_HZ, applyCommand, createWorld, step } from '../src/sim/index';
const args = process.argv.slice(2).length ? process.argv.slice(2) : ['m13=3', 'm13=5', 'm12=0', 'm6=0', 'm2=0'];
for (const key of Object.keys(MISSIONS)) {
  const w = createWorld(key as never);
  process.stdout.write(`${key}:${w.state.buildings.length}b/${w.state.wagons.length}w  `);
}
console.log();
for (const a of args) {
  const [key, nS] = a.split('='); const n = Number(nS);
  const w = createWorld(key as never);
  const st = w.state;
  const stable = st.buildings.find((b) => b.type === 'stable')?.id;
  let best = { sec: 0, moving: 0, stalled: 0 };
  const perMin: string[] = [];
  let accM = 0, accS = 0;
  while (st.mission.result === 'running' && st.tick < 20 * 60 * TICK_HZ) {
    if (st.tick === 20 * TICK_HZ && stable !== undefined) for (let i = 0; i < n; i++) applyCommand(w, { t: 'buyWagon', stable } as never);
    step(w);
    if (st.tick % TICK_HZ === 0) {
      const moving = st.wagons.filter((x) => x.next >= 0).length;
      const stalled = st.buildings.filter((b) => b.stalledTicks > 0).length;
      accM += moving; accS += stalled;
      if (st.tick % (60 * TICK_HZ) === 0) { perMin.push(`${(accM / 60).toFixed(1)}/${(accS / 60).toFixed(1)}`); accM = accS = 0; }
      if (moving > best.moving) best = { sec: st.tick / TICK_HZ, moving, stalled };
    }
  }
  console.log(`${a}: ${st.mission.result} at ${(st.tick / TICK_HZ / 60).toFixed(2)} min, wagons ${st.wagons.length}, buildings ${st.buildings.length}, peak ${JSON.stringify(best)}; per-min moving/stalled ${perMin.join(' ')}`);
}
