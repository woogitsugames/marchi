// Balance check: compare strategies per mission. npx tsx tools/balance.ts [m2 m3 m4 m5 m6 sandbox]
// Target per mission: no action = 1 seal, partial fix = 2, the lesson's fix = 3, 5-12 minutes.
// The free valley ('sandbox') runs a fixed 30-minute horizon instead (docs/design/sandbox.md §4.5):
// target rank 1 at 8-12 min and rank 2 at 20-30 min for the decent plan, rank 0 for "nothing".
import { applyCommand, createWorld, lineCells, step, stars, TICK_HZ, type Command, type World } from '../src/sim/index';
import { DECENT, report, runSandbox, type BotStep } from './bot-sandbox';

export type Strat = { name: string; at: number; expect?: number; cmds: (w: World) => Command[] };
const col = (w: World, x: number, y1: number, y2: number) => lineCells(w.terrain.w, y1 * w.terrain.w + x, y2 * w.terrain.w + x);
const row = (w: World, y: number, x1: number, x2: number) => lineCells(w.terrain.w, y * w.terrain.w + x1, y * w.terrain.w + x2);
const stable = (w: World) => w.state.buildings.find((b) => b.type === 'stable')!.id;
const buy = (w: World, n: number): Command[] => Array.from({ length: n }, () => ({ t: 'buyWagon', stable: stable(w) }) as Command);
/** m5/m6: the road cells that connect the big granary next to the sawmill. */
const granaryLink = (w: World): Command => ({ t: 'road', surface: 1, cells: col(w, 37, 38, 39) });

export const plans: Record<string, Strat[]> = {
  m1: [
    { name: 'nothing (no crossing)', at: 0, cmds: () => [] },
    { name: 'wooden bridge x=41 @0:10', at: 10, cmds: (w) => [{ t: 'road', surface: 1, cells: col(w, 41, 24, 44) }] },
    { name: 'bridge + 2 wagons @0:10', at: 10, cmds: (w) => [{ t: 'road', surface: 1, cells: col(w, 41, 24, 44) }, ...buy(w, 2)] },
  ],
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
  m4: [
    { name: 'nothing', at: 0, expect: 1, cmds: () => [] },
    { name: 'buy 3 wagons @1:00', at: 60, cmds: (w) => buy(w, 3) },
    { name: 'stone bridge late @4:00 (iced)', at: 240, expect: 2, cmds: (w) => [{ t: 'road', surface: 2, cells: col(w, 51, 30, 42) }] },
    { name: 'stone bridge before ice @1:00', at: 60, expect: 3, cmds: (w) => [{ t: 'road', surface: 2, cells: col(w, 51, 30, 42) }] },
  ],
  m5: [
    { name: 'nothing', at: 0, expect: 1, cmds: () => [] },
    { name: 'connect granary @0:30', at: 30, cmds: (w) => [granaryLink(w)] },
    { name: 'buy 1 wagon @0:30', at: 30, expect: 2, cmds: (w) => buy(w, 1) },
    { name: 'buy 2 wagons @0:30', at: 30, cmds: (w) => buy(w, 2) },
    { name: 'connect granary + 1 wagon @0:30', at: 30, expect: 3, cmds: (w) => [granaryLink(w), ...buy(w, 1)] },
  ],
  m6: [
    { name: 'nothing', at: 0, expect: 1, cmds: () => [] },
    { name: 'buy 1 wagon @0:30', at: 30, expect: 2, cmds: (w) => buy(w, 1) },
    { name: 'connect big granary @0:30', at: 30, expect: 3, cmds: (w) => [granaryLink(w)] },
    { name: 'build granary by the mill @0:30', at: 30, cmds: (w) => [{ t: 'place', type: 'warehouse', x: 50, y: 42, facing: 2 }, { t: 'road', surface: 1, cells: col(w, 51, 40, 41) }] },
    { name: 'cut 3rd farm road @0:30', at: 30, cmds: () => [] },
    { name: 'connect big granary late @5:00', at: 300, cmds: (w) => [granaryLink(w)] },
  ],
};
// cut the third farm off the network (redirecting grain away from the small granary)
plans.m6![4]!.cmds = (w) => [{ t: 'demolish', cell: 46 * w.terrain.w + 39 }];

/** Free valley strategies (30 sim-minutes). `want` = [rank reached at the end, earliest minute, latest minute] per rank. */
export type SandboxStrat = { name: string; plan: BotStep[]; endRank?: number; rank1?: [number, number]; rank2?: [number, number] };
const sbStable = (w: World) => w.state.buildings.find((b) => b.type === 'stable')!.id;
const sbBuy = (n: number): BotStep[] => Array.from({ length: n }, () => ({ name: 'buy wagon', cmds: (w: World) => [{ t: 'buyWagon', stable: sbStable(w) } as Command] }));
export const sandboxPlans: SandboxStrat[] = [
  { name: 'nothing', plan: [], endRank: 0 },
  { name: 'only wagons (5 more)', plan: sbBuy(5) },
  { name: 'decent: wagons, farm, mill+bakery', plan: DECENT, rank1: [8, 12], rank2: [20, 30] },
  { name: '3 wagons + cobble @2:00 (locked)', plan: [...sbBuy(3), { name: 'cobble', after: 120, cmds: (w) => [{ t: 'road', surface: 2, cells: row(w, 24, 30, 46) }] }] },
];

export interface BalanceRow { mission: string; strat: string; result: string; minutes: number; seals: number; missed: number; coins: number; errors: string[] }

export function runStrategy(id: string, s: Strat): BalanceRow {
  const w = createWorld(id);
  const errors: string[] = [];
  while (w.state.mission.result === 'running') {
    if (w.state.tick === s.at * TICK_HZ) for (const c of s.cmds(w)) { const r = applyCommand(w, c); if (!r.ok) errors.push(r.err.k); }
    step(w);
  }
  const c = w.state.mission.contract;
  return {
    mission: id, strat: s.name, result: w.state.mission.result, minutes: w.state.mission.endTick / TICK_HZ / 60,
    seals: stars(w), missed: c ? c.tranches.filter((t) => t.missed).length : 0, coins: w.state.coins, errors,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let bad = 0;
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : [...Object.keys(plans), 'sandbox'];
  if (ids.includes('sandbox')) {
    for (const s of sandboxPlans) {
      const r = runSandbox(s.plan, 30, { checkEvery: 10 });
      const inRange = (m: number, w?: [number, number]) => !w || (m >= w[0] && m <= w[1]);
      const ok = (s.endRank === undefined || r.rank === s.endRank) && inRange(r.rankMin[1]!, s.rank1) && inRange(r.rankMin[2]!, s.rank2) &&
        r.violations.filter((v) => !v.includes('"LOCKED"')).length === 0;
      if (!ok) bad++;
      console.log(`sandbox | ${s.name.padEnd(36)} | ${report(r).split('\n').join(' | ')}${r.violations.length ? ' | ' + r.violations.slice(0, 2).join('; ') : ''}${ok ? '' : '  <-- OFF'}`);
    }
  }
  for (const id of ids.filter((x) => x !== 'sandbox')) {
    for (const s of plans[id]!) {
      const r = runStrategy(id, s);
      const ok = s.expect === undefined || s.expect === r.seals;
      if (!ok) bad++;
      console.log(`${id} | ${s.name.padEnd(36)} | ${r.result} ${r.minutes.toFixed(2)} min | seals ${r.seals}${s.expect !== undefined ? ` (want ${s.expect})` : ''}${r.missed ? ` | late tranches ${r.missed}` : ''} | coins ${r.coins} ${r.errors.join(',')}${ok ? '' : '  <-- OFF'}`);
    }
  }
  process.exit(bad ? 1 : 0);
}
