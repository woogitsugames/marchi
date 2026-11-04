// Mission XIII ("Pierwsze piętro łańcucha", D-102) strategy runner in the real simulation.
// Use: npx tsx tools/bot-m13.ts — prints every strategy; exit != 0 when the seal ladder breaks.
import {
  MISSIONS, TICK_HZ, applyCommand, checkInvariants, createWorld, stars, stateHash, step, unexplainedStalls,
  type Command, type World,
} from '../src/sim/index';

export interface M13Strategy {
  name: string;
  /** [second, wagons to buy] pairs, simulation clock. */
  buys: [number, number][];
}
export interface M13Result {
  strategy: string;
  result: string;
  minutes: number;
  seals: number;
  wagons: number;
  commandErrors: string[];
  invariantErrors: string[];
  /** Seconds (sampled once a second) with some building NO_WAGON / ALL_BUSY, and the first such second. */
  allBusySamples: number;
  firstAllBusy: number;
  /** Seconds with a workshop waiting for its input (WAITING_DELIVERY) while the granary still had it. */
  starvedWithStock: number;
  delivered: string;
  hash: string;
}

const stableId = (w: World): number => w.state.buildings.find((b) => b.type === 'stable')!.id;

/** The seal ladder (tests): nothing, a late single wagon, wagons bought as soon as the stall shows. */
export const M13_STRATEGIES: readonly M13Strategy[] = [
  { name: 'nic / one wagon for the map', buys: [] },
  { name: 'czesciowa / one wagon @0:20', buys: [[20, 1]] },
  { name: 'wlasciwa / three wagons @0:20', buys: [[20, 3]] },
];
/** Other plausible plays, printed for balance (not part of the ladder). */
export const M13_EXTRA: readonly M13Strategy[] = [
  { name: 'one wagon late @1:30', buys: [[90, 1]] },
  { name: 'two wagons @0:20', buys: [[20, 2]] },
  { name: 'four wagons @0:20', buys: [[20, 4]] },
  { name: 'five wagons @0:20', buys: [[20, 5]] },
  { name: 'three wagons @1:00', buys: [[60, 3]] },
  { name: 'three wagons @2:00', buys: [[120, 3]] },
  { name: 'one @0:20, one @1:30, one @3:00', buys: [[20, 1], [90, 1], [180, 1]] },
];

export function runM13(strategy: M13Strategy): M13Result {
  if (!MISSIONS.m13) throw new Error('mission m13 must be registered');
  const w = createWorld('m13');
  const st = w.state;
  const commandErrors: string[] = [];
  const invariantErrors: string[] = [];
  let allBusySamples = 0, firstAllBusy = -1, starvedWithStock = 0;
  const granary = st.buildings.find((b) => b.type === 'warehouse')!;
  while (st.mission.result === 'running') {
    for (const [sec, n] of strategy.buys) {
      if (st.tick === sec * TICK_HZ) {
        for (let i = 0; i < n; i++) {
          const cmd: Command = { t: 'buyWagon', stable: stableId(w) };
          const r = applyCommand(w, cmd);
          if (!r.ok) commandErrors.push(JSON.stringify({ cmd, error: r.err }));
        }
      }
    }
    step(w);
    if (st.tick % TICK_HZ === 0) {
      if (st.buildings.some((b) => b.status.k === 'NO_WAGON' && b.status.cause === 'ALL_BUSY')) {
        allBusySamples++;
        if (firstAllBusy < 0) firstAllBusy = st.tick / TICK_HZ;
      }
      const saw = st.buildings.find((b) => b.type === 'sawmill')!, mill = st.buildings.find((b) => b.type === 'mill')!;
      if ((saw.status.k === 'WAITING_DELIVERY' && granary.stock.wood > 0) || (mill.status.k === 'WAITING_DELIVERY' && granary.stock.grain > 0)) starvedWithStock++;
    }
    if (st.tick % (10 * TICK_HZ) === 0) {
      const problems = [...checkInvariants(w), ...unexplainedStalls(w)];
      if (problems.length) { invariantErrors.push('tick ' + st.tick + ': ' + problems.join('; ')); break; }
    }
    if (st.tick > 15 * 60 * TICK_HZ) { invariantErrors.push('exceeded 15-minute safety limit'); break; }
  }
  const castle = st.buildings.find((b) => b.type === 'castle')!;
  const c = st.mission.contract!;
  const delivered = Object.entries(c.need).filter(([, n]) => n > 0)
    .map(([g, n]) => g + '=' + castle.stock[g as keyof typeof c.need] + '/' + n).join(',');
  return {
    strategy: strategy.name, result: st.mission.result, minutes: st.mission.endTick / (60 * TICK_HZ), seals: stars(w),
    wagons: st.wagons.length, commandErrors, invariantErrors, allBusySamples, firstAllBusy, starvedWithStock, delivered,
    hash: stateHash(w),
  };
}

function print(r: M13Result): void {
  console.log(`m13 | ${r.strategy} | ${r.result} ${r.minutes.toFixed(2)} min | seals ${r.seals} | wagons ${r.wagons} | ${r.delivered}` +
    ` | allBusy ${r.allBusySamples} s (first ${r.firstAllBusy} s) | starved with stock ${r.starvedWithStock} s` +
    ` | ${r.hash}${[...r.commandErrors, ...r.invariantErrors].length ? ' | errors ' + [...r.commandErrors, ...r.invariantErrors].join('; ') : ''}`);
}

if (process.argv[1] && /bot-m13\.ts$/.test(process.argv[1])) {
  const ladder = M13_STRATEGIES.map(runM13);
  ladder.forEach(print);
  console.log('--- other plays');
  M13_EXTRA.map(runM13).forEach(print);
  const ok = ladder.every((r) => !r.commandErrors.length && !r.invariantErrors.length) &&
    ['0/2/3', '1/2/3'].includes(ladder.map((r) => r.seals).join('/'));
  if (!ok) process.exitCode = 1;
}
