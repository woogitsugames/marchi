// Free valley bot: plays the sandbox headless for 30 sim-minutes like a sensible player (more
// wagons, a farm, then mill + bakery when rank 1 unlocks them, another woodcutter, a second farm)
// and prints income per minute, silver, renown and rank-up times. Every tick it checks goods
// conservation and that every stall has a reason. npx tsx tools/bot-sandbox.ts [minutes]
import {
  applyCommand, checkInvariants, createWorld, lineCells, step, TICK_HZ, unexplainedStalls,
  type BuildingType, type Command, type World,
} from '../src/sim/index';
import { sandboxStatus } from '../src/sim/town';

export interface BotStep {
  name: string;
  /** Rank needed before the step is tried. */
  rank?: number;
  /** Earliest second. */
  after?: number;
  cmds: (w: World) => Command[];
}

const at = (w: World, x: number, y: number) => y * w.terrain.w + x;
const row = (w: World, y: number, x1: number, x2: number) => lineCells(w.terrain.w, at(w, x1, y), at(w, x2, y));
const stable = (w: World) => w.state.buildings.find((b) => b.type === 'stable')!.id;
const buy = (w: World): Command => ({ t: 'buyWagon', stable: stable(w) });
const put = (type: BuildingType, x: number, y: number, facing: number): Command => ({ t: 'place', type, x, y, facing });

/** The "decent player" plan: steps run in order, each as soon as rank, time and silver allow. */
export const DECENT: BotStep[] = [
  { name: 'buy wagon', cmds: (w) => [buy(w)] },
  { name: 'buy wagon', cmds: (w) => [buy(w)] },
  { name: 'farm by the castle road', cmds: () => [put('farm', 55, 25, 2)] },
  { name: 'buy wagon', cmds: (w) => [buy(w)] },
  { name: 'buy wagon', cmds: (w) => [buy(w)] },
  { name: 'buy wagon', cmds: (w) => [buy(w)] },
  { name: 'mill', rank: 1, cmds: () => [put('mill', 58, 25, 2)] },
  { name: 'bakery', rank: 1, cmds: () => [put('bakery', 49, 25, 2)] },
  { name: 'buy wagon', cmds: (w) => [buy(w)] },
  { name: 'road east', cmds: (w) => [{ t: 'road', surface: 1, cells: row(w, 24, 62, 72) }] },
  { name: 'second farm', cmds: () => [put('farm', 66, 25, 2)] },
  { name: 'buy wagon', cmds: (w) => [buy(w)] },
  { name: 'second woodcutter', cmds: () => [put('woodcutter', 16, 16, 3)] },
  { name: 'second sawmill', cmds: () => [put('sawmill', 16, 22, 3)] },
  { name: 'buy wagon', cmds: (w) => [buy(w)] },
  { name: 'second mill', rank: 1, cmds: () => [put('mill', 69, 25, 2)] },
  { name: 'second bakery', rank: 1, cmds: () => [put('bakery', 52, 25, 2)] },
  { name: 'buy wagon', cmds: (w) => [buy(w)] },
  { name: 'buy wagon', cmds: (w) => [buy(w)] },
  { name: 'buy wagon', cmds: (w) => [buy(w)] },
];

export interface SandboxRun {
  minutes: number;
  coins: number;
  earned: number;
  renown: number;
  rank: number;
  bestFlow: number;
  /** Minute each rank was reached (-1 = not reached). */
  rankMin: number[];
  /** Minute the income alone covered 40 silver (the price of most buildings). */
  firstBuildMin: number;
  /** Silver earned per minute, minute by minute. */
  perMinute: number[];
  wagons: number;
  buildings: number;
  done: string[];
  violations: string[];
  sold: Record<string, number>;
}

export function runSandbox(plan: readonly BotStep[], minutes = 30, opts: { checkEvery?: number; log?: boolean } = {}): SandboxRun {
  const w = createWorld('sandbox');
  const checkEvery = opts.checkEvery ?? 1;
  const violations: string[] = [];
  const done: string[] = [];
  const perMinute: number[] = [];
  let k = 0, lastEarned = 0, firstBuildMin = -1;
  const end = minutes * 60 * TICK_HZ;
  while (w.state.tick < end) {
    // try the next step once per second
    if (w.state.tick % TICK_HZ === 0 && k < plan.length) {
      const s = plan[k]!;
      const st = sandboxStatus(w);
      if ((s.rank ?? 0) <= st.rank && (s.after ?? 0) * TICK_HZ <= w.state.tick) {
        const before = JSON.stringify(w.state.coins);
        const cmds = s.cmds(w);
        // a step waits while silver is short (NO_COINS); any other refusal is a broken plan and is reported
        let ok = true;
        for (const c of cmds) {
          const r = applyCommand(w, c);
          if (!r.ok) {
            ok = false;
            if (r.err.k !== 'NO_COINS') { violations.push(`step "${s.name}" failed: ${JSON.stringify(r.err)}`); k++; }
            break;
          }
        }
        if (ok) {
          done.push(`${(w.state.tick / TICK_HZ / 60).toFixed(1)} min ${s.name}`);
          if (opts.log) console.log(`  ${(w.state.tick / TICK_HZ / 60).toFixed(2)} min  ${s.name.padEnd(26)} coins ${before} -> ${w.state.coins}`);
          k++;
        }
      }
    }
    step(w);
    if (w.state.tick % checkEvery === 0) {
      const v = [...checkInvariants(w), ...unexplainedStalls(w)];
      if (v.length && violations.length < 20) violations.push(`tick ${w.state.tick}: ${v.join('; ')}`);
    }
    if (firstBuildMin < 0 && w.state.ledger.silverEarned >= 40) firstBuildMin = w.state.tick / TICK_HZ / 60;
    if (w.state.tick % (60 * TICK_HZ) === 0) {
      perMinute.push(w.state.ledger.silverEarned - lastEarned);
      lastEarned = w.state.ledger.silverEarned;
    }
  }
  const st = sandboxStatus(w);
  return {
    minutes, coins: w.state.coins, earned: st.silverEarned, renown: st.renown, rank: st.rank, bestFlow: st.bestFlow,
    rankMin: st.rankTicks.map((t) => (t < 0 ? -1 : t / TICK_HZ / 60)), firstBuildMin, perMinute,
    wagons: w.state.wagons.length, buildings: w.state.buildings.length, done, violations, sold: { ...w.state.ledger.sold },
  };
}

export function report(r: SandboxRun): string {
  const ranks = r.rankMin.map((m, i) => `rank ${i} ${m < 0 ? '-' : m.toFixed(1) + ' min'}`).join(', ');
  return [
    `SANDBOX ${r.minutes} min: coins ${r.coins}, earned ${r.earned}, renown ${r.renown}, rank ${r.rank}, best flow ${r.bestFlow} sr/min, wagons ${r.wagons}, buildings ${r.buildings}`,
    `ranks: ${ranks}; income covered 40 silver at ${r.firstBuildMin < 0 ? '-' : r.firstBuildMin.toFixed(1) + ' min'}`,
    `income per minute: ${r.perMinute.join(' ')}`,
    `sold: ${Object.entries(r.sold).map(([g, n]) => `${g} ${n}`).join(', ')}`,
  ].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const minutes = Number(process.argv[2] ?? 30);
  const r = runSandbox(DECENT, minutes, { log: true, checkEvery: 1 });
  console.log(report(r));
  if (r.violations.length) console.log('VIOLATIONS\n' + r.violations.join('\n'));
  process.exit(r.violations.length ? 1 : 0);
}
