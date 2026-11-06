// Mission XIV ("Węgiel z lasu", D-210) strategy runner in the real simulation, and the shared runner of the
// "build it at the right end of the road" missions XIV-XV (bot-m15.ts uses runSiteBot).
// Use: npx tsx tools/bot-m14.ts — prints every strategy; exit != 0 when the seal ladder breaks.
import {
  MISSIONS, TICK_HZ, applyCommand, checkInvariants, createWorld, lineCells, stars, stateHash, step, unexplainedStalls,
  type Command, type World,
} from '../src/sim/index';
import { M14_BURNER_SITE, M14_WRONG_SITE } from '../src/sim/proposals/missions-14-15';

export interface SiteStrategy {
  name: string;
  /** [second, commands] pairs, simulation clock; a refused command is an error. */
  steps: [number, (w: World) => Command[]][];
}
export interface SiteResult {
  strategy: string;
  result: string;
  minutes: number;
  seals: number;
  /** Letters (tranches) delivered late. */
  late: number;
  wagons: number;
  coins: number;
  commandErrors: string[];
  invariantErrors: string[];
  delivered: string;
  hash: string;
}

const stableId = (w: World): number => w.state.buildings.find((b) => b.type === 'stable')!.id;
/** One road column x from y1 to y2 (dirt). */
export const column = (w: World, x: number, y1: number, y2: number): Command =>
  ({ t: 'road', surface: 1, cells: lineCells(w.terrain.w, y1 * w.terrain.w + x, y2 * w.terrain.w + x) });
export const wagons = (n: number) => (w: World): Command[] => Array.from({ length: n }, () => ({ t: 'buyWagon', stable: stableId(w) }));

export function runSiteBot(id: string, strategy: SiteStrategy): SiteResult {
  if (!MISSIONS[id]) throw new Error(`mission ${id} must be registered`);
  const w = createWorld(id);
  const st = w.state;
  const commandErrors: string[] = [];
  const invariantErrors: string[] = [];
  while (st.mission.result === 'running') {
    for (const [sec, cmds] of strategy.steps) {
      if (st.tick !== sec * TICK_HZ) continue;
      for (const cmd of cmds(w)) {
        const r = applyCommand(w, cmd);
        if (!r.ok) commandErrors.push(JSON.stringify({ t: cmd.t, error: r.err }));
      }
    }
    step(w);
    if (st.tick % (10 * TICK_HZ) === 0) {
      const problems = [...checkInvariants(w), ...unexplainedStalls(w)];
      if (problems.length) { invariantErrors.push('tick ' + st.tick + ': ' + problems.join('; ')); break; }
    }
    if (st.tick > 20 * 60 * TICK_HZ) { invariantErrors.push('exceeded 20-minute safety limit'); break; }
  }
  const castle = st.buildings.find((b) => b.type === 'castle')!;
  const c = st.mission.contract!;
  const delivered = Object.entries(c.need).filter(([, n]) => n > 0)
    .map(([g, n]) => g + '=' + castle.stock[g as keyof typeof c.need] + '/' + n).join(',');
  return {
    strategy: strategy.name, result: st.mission.result, minutes: st.mission.endTick / (60 * TICK_HZ), seals: stars(w),
    late: c.tranches.filter((t) => t.missed).length, wagons: st.wagons.length, coins: st.coins,
    commandErrors, invariantErrors, delivered, hash: stateHash(w),
  };
}

export function printSite(id: string, r: SiteResult): void {
  const errs = [...r.commandErrors, ...r.invariantErrors];
  console.log(`${id} | ${r.strategy} | ${r.result} ${r.minutes.toFixed(2)} min | seals ${r.seals}${r.late ? ` | late ${r.late}` : ''}` +
    ` | wagons ${r.wagons} coins ${r.coins} | ${r.delivered} | ${r.hash}${errs.length ? ' | errors ' + errs.join('; ') : ''}`);
}

/** The second burner by the woodcutters (the lesson) or by the castle (the tempting wrong site), with its road link. */
export const burnerByForest = (w: World): Command[] =>
  [{ t: 'place', type: 'charcoalBurner', ...M14_BURNER_SITE }, column(w, M14_BURNER_SITE.x + 1, 40, 41)];
export const burnerByCastle = (w: World): Command[] =>
  [{ t: 'place', type: 'charcoalBurner', ...M14_WRONG_SITE }, column(w, M14_WRONG_SITE.x + 1, 39, 40)];

/** The seal ladder (tests): nothing, the wrong site with a wagon, the lesson as soon as the pace card shows. */
export const M14_STRATEGIES: readonly SiteStrategy[] = [
  { name: 'nic / one burner for the order', steps: [] },
  { name: 'zla / second burner by the castle + 1 wagon @0:00', steps: [[0, wagons(1)], [0, burnerByCastle]] },
  { name: 'wlasciwa / second burner by the forest @1:00', steps: [[60, burnerByForest]] },
];
/** Other plausible plays, printed for balance (not part of the ladder). */
export const M14_EXTRA: readonly SiteStrategy[] = [
  { name: 'three wagons @0:00', steps: [[0, wagons(3)]] },
  { name: 'burner by the castle @0:00', steps: [[0, burnerByCastle]] },
  { name: 'burner by the forest @0:00', steps: [[0, burnerByForest]] },
  { name: 'burner by the forest @0:00 + 1 wagon', steps: [[0, wagons(1)], [0, burnerByForest]] },
  { name: 'burner by the forest @2:00', steps: [[120, burnerByForest]] },
];

if (process.argv[1] && /bot-m14\.ts$/.test(process.argv[1])) {
  const ladder = M14_STRATEGIES.map((s) => runSiteBot('m14', s));
  ladder.forEach((r) => printSite('m14', r));
  console.log('--- other plays');
  M14_EXTRA.map((s) => runSiteBot('m14', s)).forEach((r) => printSite('m14', r));
  const ok = ladder.every((r) => !r.commandErrors.length && !r.invariantErrors.length) && ladder.map((r) => r.seals).join('/') === '1/2/3';
  if (!ok) process.exitCode = 1;
}
