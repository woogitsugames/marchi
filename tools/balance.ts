// Balance check: compare strategies per mission. npx tsx tools/balance.ts
import { applyCommand, createWorld, lineCells, step, stars, TICK_HZ, type Command, type World } from '../src/sim/index';

type Strat = { name: string; at: number; cmds: (w: World) => Command[] };
const col = (w: World, x: number, y1: number, y2: number) => lineCells(w.terrain.w, y1 * w.terrain.w + x, y2 * w.terrain.w + x);
const row = (w: World, y: number, x1: number, x2: number) => lineCells(w.terrain.w, y * w.terrain.w + x1, y * w.terrain.w + x2);
const stable = (w: World) => w.state.buildings.find((b) => b.type === 'stable')!.id;
const buy = (w: World, n: number): Command[] => Array.from({ length: n }, () => ({ t: 'buyWagon', stable: stable(w) }) as Command);

const plans: Record<string, Strat[]> = {
  m2: [
    { name: 'nothing', at: 0, cmds: () => [] },
    { name: 'buy 2 wagons', at: 0, cmds: (w) => buy(w, 2) },
    { name: 'buy 2 + stone bridge @45s', at: 45, cmds: (w) => [...buy(w, 2), { t: 'road', surface: 2, cells: col(w, 51, 30, 42) }] },
    { name: 'buy 2 + 2nd wooden bridge x=63 @45s', at: 45, cmds: (w) => [...buy(w, 2), { t: 'road', surface: 1, cells: col(w, 63, 30, 42) }] },
  ],
  m3: [
    { name: 'nothing', at: 0, cmds: () => [] },
    { name: 'buy 2 wagons', at: 0, cmds: (w) => buy(w, 2) },
    { name: 'buy 2 + cobble corridor @25s', at: 25, cmds: (w) => [...buy(w, 2), { t: 'road', surface: 2, cells: row(w, 40, 32, 80) }] },
  ],
};

for (const id of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(plans)) {
  for (const s of plans[id]!) {
    const w = createWorld(id);
    let jamTicks = 0;
    const errs: string[] = [];
    while (w.state.mission.result === 'running') {
      if (w.state.tick === s.at * TICK_HZ) for (const c of s.cmds(w)) { const r = applyCommand(w, c); if (!r.ok) errs.push(r.err.k); }
      step(w);
      for (const q of w.state.wagons) if (q.status.k === 'BRIDGE_JAM') jamTicks++;
    }
    console.log(`${id} | ${s.name.padEnd(38)} | ${w.state.mission.result} ${(w.state.mission.endTick / TICK_HZ / 60).toFixed(2)} min | seals ${stars(w)} | coins ${w.state.coins} | jam wagon-s ${(jamTicks / TICK_HZ).toFixed(0)} ${errs.join(',')}`);
  }
}
