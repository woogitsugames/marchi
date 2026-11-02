// Deterministic acceptance/balance runner for proposed missions VII-IX.
// The proposal is installed only for the duration of each run; missions.ts stays untouched.
import {
  MISSIONS, TICK_HZ, applyCommand, checkInvariants, createWorld, lineCells,
  stars, step, stoneAvailable, unexplainedStalls,
  type Command, type World,
} from '../src/sim/index';
import { PROPOSED_MISSIONS_7_9, M7_FISHER_SITE, M9_WOODCUTTER_SITE, type Mission789Id } from '../src/sim/proposals/missions-7-9';

export type Strategy = {
  name: string;
  /** Do not attempt an action before this mission second. */
  after: number;
  /** For the stone road lesson, wait for this much delivered, unreserved stone. */
  whenStone?: number;
  cmds: (w: World) => Command[];
};
export type RunResult = {
  id: Mission789Id; strategy: string; result: string; minutes: number; seals: number;
  coins: number; actionSecond: number | null; commandErrors: string[]; invariantErrors: string[];
  stoneUsed: number; peakStoneStored: number; maxStoneWagon: number;
  fishCrossings: number; contestedSamples: number; produced: {fish: number; stone: number; malt: number; beer: number};
};

const row = (w: World, y: number, x1: number, x2: number): number[] =>
  lineCells(w.terrain.w, y * w.terrain.w + x1, y * w.terrain.w + x2);
const stableId = (w: World): number => w.state.buildings.find((b) => b.type === 'stable')!.id;
const wagon = (w: World): Command => ({ t: 'buyWagon', stable: stableId(w) });

export const STRATEGIES: Record<Mission789Id, Strategy[]> = {
  m7: [
    { name: 'nic / no action', after: 0, cmds: () => [] },
    { name: 'czesciowa / extra wagon @0:30', after: 30, cmds: (w) => [wagon(w)] },
    { name: 'wlasciwa / bank-side fisher @0:20 + wagon', after: 20,
      cmds: (w) => [{ t: 'place', type: 'fisher', ...M7_FISHER_SITE }, wagon(w)] },
  ],
  m8: [
    { name: 'nic / no action', after: 0, cmds: () => [] },
    { name: 'czesciowa / extra wagon @0:30', after: 30, cmds: (w) => [wagon(w)] },
    { name: 'wlasciwa / cobble x45-60 after stone arrives', after: 45, whenStone: 16,
      cmds: (w) => [{ t: 'road', surface: 2, cells: row(w, 44, 45, 60) }] },
  ],
  m9: [
    { name: 'nic / no action', after: 0, cmds: () => [] },
    { name: 'czesciowa / extra 2 wagons @0:30', after: 30, cmds: (w) => [wagon(w), wagon(w)] },
    { name: 'wlasciwa / second woodcutter @0:30 + wagons', after: 30,
      cmds: (w) => [{ t: 'place', type: 'woodcutter', ...M9_WOODCUTTER_SITE }, wagon(w), wagon(w)] },
  ],
};

export function withProposal<T>(id: Mission789Id, run: () => T): T {
  const old = MISSIONS[id];
  MISSIONS[id] = PROPOSED_MISSIONS_7_9[id];
  try { return run(); }
  finally { if (old) MISSIONS[id] = old; else delete MISSIONS[id]; }
}

export function runProposed(id: Mission789Id, strategy: Strategy): RunResult {
  return withProposal(id, () => {
    const w = createWorld(id);
    const st = w.state;
    if (w.terrain.w !== 96 || w.terrain.h !== 72) throw new Error(id + ': map must be 96x72');
    const commandErrors: string[] = [];
    const invariantErrors: string[] = [];
    let actionSecond: number | null = null;
    let executed = false, stoneUsed = 0, peakStoneStored = 0, maxStoneWagon = 0;
    let fishCrossings = 0, contestedSamples = 0;
    const fishCells = new Set<number>();
    // Observation is orthogonal to the outcome: fish is transported through water-road cells.
    while (st.mission.result === 'running') {
      if (!executed && st.tick >= strategy.after * TICK_HZ &&
          (strategy.whenStone === undefined || stoneAvailable(w) >= strategy.whenStone)) {
        for (const cmd of strategy.cmds(w)) {
          const r = applyCommand(w, cmd);
          if (!r.ok) commandErrors.push(JSON.stringify({ command: cmd, error: r.err }));
          else stoneUsed += r.stone ?? 0;
        }
        executed = true;
        actionSecond = st.tick / TICK_HZ;
      }
      step(w);
      peakStoneStored = Math.max(peakStoneStored, stoneAvailable(w));
      for (const q of st.wagons) {
        if (q.cargoGood === 'stone') maxStoneWagon = Math.max(maxStoneWagon, q.cargoQty);
        if (q.cargoGood === 'fish' && w.terrain.water[q.at] === 1 && !fishCells.has(q.at)) {
          fishCells.add(q.at);
          fishCrossings++;
        }
      }
      if (st.buildings.some((b) => b.status.k === 'NO_INPUT' && b.status.cause === 'CONTESTED')) contestedSamples++;
      if (st.tick % 50 === 0) {
        const bad = [...checkInvariants(w), ...unexplainedStalls(w)];
        if (bad.length) {
          invariantErrors.push('tick ' + st.tick + ': ' + bad.join('; '));
          break;
        }
      }
      if (st.tick > 25 * 60 * TICK_HZ) {
        invariantErrors.push('mission did not reach its declared deadline');
        break;
      }
    }
    const l = st.ledger.produced;
    return {
      id, strategy: strategy.name, result: st.mission.result,
      minutes: st.mission.endTick / (60 * TICK_HZ), seals: stars(w), coins: st.coins,
      actionSecond, commandErrors, invariantErrors, stoneUsed, peakStoneStored, maxStoneWagon,
      fishCrossings, contestedSamples, produced: { fish: l.fish, stone: l.stone, malt: l.malt, beer: l.beer },
    };
  });
}

export function printResults(id: Mission789Id): RunResult[] {
  const results = STRATEGIES[id].map((s) => runProposed(id, s));
  for (const r of results) {
    console.log(id + ' | ' + r.strategy.padEnd(44) + ' | ' + r.result +
      ' | ' + r.minutes.toFixed(2) + ' min | seals ' + r.seals +
      ' | action ' + (r.actionSecond ?? '-').toString() + 's' +
      ' | storedStone ' + r.peakStoneStored + ' usedStone ' + r.stoneUsed +
      ' maxStoneLoad ' + r.maxStoneWagon +
      ' fishBridge ' + r.fishCrossings + ' contested ' + r.contestedSamples +
      ' | errs ' + [...r.commandErrors, ...r.invariantErrors].join('; '));
  }
  return results;
}
