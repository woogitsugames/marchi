// Mission XVII ("Drewno na dwa listy", D-356) strategy runner in the real simulation: doing nothing, the castle-leg
// switch (castleFirst, the wrong lever here) and the whole chain first (chainFirst), through real commands.
// Use: npx tsx tools/bot-m17.ts — prints every strategy; exit != 0 when the seal ladder breaks.
import {
  TICK_HZ, applyCommand, checkInvariants, createWorld, stars, step, unexplainedStalls, type Command, type World,
} from '../src/sim/index';
import { goldenHash } from './golden-hash';
import { mmss } from './bot-m16';

export interface M17Strategy {
  name: string;
  /** [second, commands] pairs, simulation clock; a refused command is an error. */
  steps: [number, (w: World) => Command[]][];
}
export interface M17Result {
  strategy: string;
  result: string;
  minutes: number;
  seals: number;
  /** When each castle's order was complete (minutes, -1 = never): east (planks, main contract), north (charcoal). */
  eastDone: number;
  northDone: number;
  /** Castles that missed their own deadline: 'E', 'N', 'EN' or ''. */
  late: string;
  wagons: number;
  /** Seconds the charcoal burner read NO_INPUT.CHAIN_FIRST (the new stall reason, D-356). */
  chainStallS: number;
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
export const eastLeg = (w: World): Command[] => [{ t: 'castleFirst', castle: castlesOf(w)[0] }];
export const northLeg = (w: World): Command[] => [{ t: 'castleFirst', castle: castlesOf(w)[1] }];
export const eastChain = (w: World): Command[] => [{ t: 'chainFirst', castle: castlesOf(w)[0] }];
export const northChain = (w: World): Command[] => [{ t: 'chainFirst', castle: castlesOf(w)[1] }];
export const even = (): Command[] => [{ t: 'castleFirst', castle: -1 }];
export const wagon = (w: World): Command[] => [{ t: 'buyWagon', stable: stableId(w) }];

/** The seal ladder (tests): nothing 2, the castle leg only no better (the same run: wagons are not short), the whole chain 3. */
export const M17_STRATEGIES: readonly M17Strategy[] = [
  { name: 'nic / even split', steps: [] },
  { name: 'zla / east castle leg first @0:00', steps: [[0, eastLeg]] },
  { name: 'wlasciwa / east chain first @0:00', steps: [[0, eastChain]] },
];
/** Other plays (not the ladder): later decisions, the wrong castle, wagons. */
export const M17_EXTRA: readonly M17Strategy[] = [
  { name: 'east chain first @1:00', steps: [[60, eastChain]] },
  { name: 'east chain first @2:00', steps: [[120, eastChain]] },
  { name: 'east chain first @1:30', steps: [[90, eastChain]] },
  { name: 'east chain first @3:00', steps: [[180, eastChain]] },
  { name: 'north chain first @0:00 (wrong castle)', steps: [[0, northChain]] },
  { name: 'north castle leg first @0:00', steps: [[0, northLeg]] },
  { name: '+1 wagon @0:30, no switch', steps: [[30, wagon]] },
  { name: 'east leg first + 1 wagon @0:30', steps: [[0, eastLeg], [30, wagon]] },
  { name: '+2 wagons @0:30, no switch', steps: [[30, (w) => [...wagon(w), ...wagon(w)]]] },
  { name: 'east chain first + 1 wagon @0:30', steps: [[0, eastChain], [30, wagon]] },
  { name: 'east chain first, back to even @3:00', steps: [[0, eastChain], [180, even]] },
  { name: 'east leg @0:00, then chain @1:30', steps: [[0, eastLeg], [90, eastChain]] },
];

export function runM17(strategy: M17Strategy, saveAt = -1, load?: (w: World) => World): M17Result {
  let w = createWorld('m17');
  const commandErrors: string[] = [];
  const invariantErrors: string[] = [];
  let chainTicks = 0;
  const burner = w.state.buildings.find((b) => b.type === 'charcoalBurner')!.id;
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
    const bs = w.state.buildings.find((b) => b.id === burner)!.status;
    if (bs.k === 'NO_INPUT' && bs.cause === 'CHAIN_FIRST') chainTicks++;
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
    wagons: w.state.wagons.length, chainStallS: Math.round(chainTicks / TICK_HZ), commandErrors, invariantErrors, hash: goldenHash(w),
  };
}

export function printM17(r: M17Result): void {
  const errs = [...r.commandErrors, ...r.invariantErrors];
  console.log(`m17 | ${r.strategy} | ${r.result} ${mmss(r.minutes)} | east ${mmss(r.eastDone)} north ${mmss(r.northDone)}` +
    ` | late ${r.late || '-'} | seals ${r.seals} | wagons ${r.wagons} | chain stall ${r.chainStallS} s | ${r.hash}${errs.length ? ' | errors ' + errs.join('; ') : ''}`);
}

if (process.argv[1] && /bot-m17\.ts$/.test(process.argv[1])) {
  const ladder = M17_STRATEGIES.map((s) => runM17(s));
  ladder.forEach(printM17);
  console.log('--- other plays');
  M17_EXTRA.map((s) => runM17(s)).forEach(printM17);
  const ok = ladder.every((r) => !r.commandErrors.length && !r.invariantErrors.length) && ladder.map((r) => r.seals).join('/') === '2/2/3' && ladder[1]!.minutes >= ladder[0]!.minutes;
  if (!ok) process.exitCode = 1;
}
