// Mission XVI ("Dwa zamki", D-288) strategy runner in the real simulation: the strategies of the research table
// (docs/research/2026-11-07-two-castles.md §3 A) through real commands (castleFirst, buyWagon).
// Use: npx tsx tools/bot-m16.ts — prints every strategy; exit != 0 when the seal ladder breaks.
import {
  TICK_HZ, applyCommand, checkInvariants, createWorld, stars, step, unexplainedStalls, type Command, type World,
} from '../src/sim/index';
import { goldenHash } from './golden-hash';

export interface M16Strategy {
  name: string;
  /** [second, commands] pairs, simulation clock; a refused command is an error. */
  steps: [number, (w: World) => Command[]][];
}
export interface M16Result {
  strategy: string;
  result: string;
  minutes: number;
  seals: number;
  /** When each castle's order was complete (minutes, -1 = never): east (main contract), north. */
  eastDone: number;
  northDone: number;
  /** Castles that missed their own deadline: 'E', 'N', 'EN' or ''. */
  late: string;
  wagons: number;
  commandErrors: string[];
  invariantErrors: string[];
  hash: string;
}

/** The castles in mission order: [east (main contract), north]. */
export const castlesOf = (w: World): [number, number] => {
  const m = w.state.mission;
  return [m.contract!.castle, m.extraContracts![0]!.castle];
};
const stableId = (w: World): number => w.state.buildings.find((b) => b.type === 'stable')!.id;
export const eastFirst = (w: World): Command[] => [{ t: 'castleFirst', castle: castlesOf(w)[0] }];
export const northFirst = (w: World): Command[] => [{ t: 'castleFirst', castle: castlesOf(w)[1] }];
export const wagon = (w: World): Command[] => [{ t: 'buyWagon', stable: stableId(w) }];

/** The seal ladder (tests): nothing 1, the switch alone 2, the switch + one wagon 3. */
export const M16_STRATEGIES: readonly M16Strategy[] = [
  { name: 'nic / even split by fill', steps: [] },
  { name: 'czesciowa / east castle first @0:00', steps: [[0, eastFirst]] },
  { name: 'wlasciwa / east first @0:00 + 1 wagon @0:30', steps: [[0, eastFirst], [30, wagon]] },
];
/** Other plays of the research table (not the ladder): the wrong castle, the wrong fix, the switch too late. */
export const M16_EXTRA: readonly M16Strategy[] = [
  { name: 'east first @1:00', steps: [[60, eastFirst]] },
  { name: 'east first @1:30', steps: [[90, eastFirst]] },
  { name: 'east first @2:00 (too late)', steps: [[120, eastFirst]] },
  { name: 'north first @0:00 (wrong castle)', steps: [[0, northFirst]] },
  { name: '+1 wagon @0:30, no switch (wrong fix)', steps: [[30, wagon]] },
  { name: '+2 wagons @0:30, no switch', steps: [[30, (w) => [...wagon(w), ...wagon(w)]]] },
  { name: 'east first, back to even @3:00', steps: [[0, eastFirst], [180, () => [{ t: 'castleFirst', castle: -1 }]]] },
];

export function runM16(strategy: M16Strategy, saveAt = -1, load?: (w: World) => World): M16Result {
  let w = createWorld('m16');
  const commandErrors: string[] = [];
  const invariantErrors: string[] = [];
  while (w.state.mission.result === 'running') {
    const st = w.state;
    for (const [sec, cmds] of strategy.steps) {
      if (st.tick !== sec * TICK_HZ) continue;
      for (const cmd of cmds(w)) {
        const r = applyCommand(w, cmd);
        if (!r.ok) commandErrors.push(JSON.stringify({ t: cmd.t, error: r.err }));
      }
    }
    step(w);
    if (w.state.tick === saveAt && load) w = load(w);
    if (w.state.tick % (10 * TICK_HZ) === 0) {
      const problems = [...checkInvariants(w), ...unexplainedStalls(w)];
      if (problems.length) { invariantErrors.push('tick ' + w.state.tick + ': ' + problems.join('; ')); break; }
    }
    if (w.state.tick > 20 * 60 * TICK_HZ) { invariantErrors.push('exceeded 20-minute safety limit'); break; }
  }
  const m = w.state.mission;
  const te = m.contract!.tranches[0]!, tn = m.extraContracts![0]!.tranches[0]!;
  const min = (t: number): number => (t < 0 ? -1 : t / (60 * TICK_HZ));
  return {
    strategy: strategy.name, result: m.result, minutes: min(m.endTick), seals: stars(w),
    eastDone: min(te.doneTick), northDone: min(tn.doneTick), late: `${te.missed ? 'E' : ''}${tn.missed ? 'N' : ''}`,
    wagons: w.state.wagons.length, commandErrors, invariantErrors, hash: goldenHash(w),
  };
}

export const mmss = (min: number): string => {
  if (min < 0) return '—';
  const s = Math.round(min * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function printM16(r: M16Result): void {
  const errs = [...r.commandErrors, ...r.invariantErrors];
  console.log(`m16 | ${r.strategy} | ${r.result} ${mmss(r.minutes)} | east ${mmss(r.eastDone)} north ${mmss(r.northDone)}` +
    ` | late ${r.late || '-'} | seals ${r.seals} | wagons ${r.wagons} | ${r.hash}${errs.length ? ' | errors ' + errs.join('; ') : ''}`);
}

if (process.argv[1] && /bot-m16\.ts$/.test(process.argv[1])) {
  const ladder = M16_STRATEGIES.map((s) => runM16(s));
  ladder.forEach(printM16);
  console.log('--- other plays');
  M16_EXTRA.map((s) => runM16(s)).forEach(printM16);
  const ok = ladder.every((r) => !r.commandErrors.length && !r.invariantErrors.length) && ladder.map((r) => r.seals).join('/') === '1/2/3';
  if (!ok) process.exitCode = 1;
}
