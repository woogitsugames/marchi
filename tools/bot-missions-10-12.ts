// Deterministic strategy runner for missions X-XII, in the real simulation.
// Use: npx tsx tools/bot-m10.ts (or bot-m11.ts / bot-m12.ts).
import { goldenHash } from './golden-hash';
import {
  MISSIONS, TICK_HZ, applyCommand, checkInvariants, createWorld, explainBuilding,
  lineCells, stars, step, unexplainedStalls, type Command, type World,
} from '../src/sim/index';
import { M10_SECOND_WOODCUTTER, M12_GRANARY_LINK, type Mission101112Id } from '../src/sim/proposals/missions-10-12';

export interface Strategy {
  name: string;
  after: number; // seconds, simulation clock
  cmds: (w: World) => Command[];
}
export interface RunResult {
  id: Mission101112Id;
  strategy: string;
  result: string;
  minutes: number;
  seals: number;
  actionSecond: number | null;
  commandErrors: string[];
  invariantErrors: string[];
  contestedSamples: number;
  waitingDeliverySamples: number;
  allBusySamples: number;
  storageFullSamples: number;
  blockedMaltSamples: number;
  peakWarehouseMalt: number;
  lateTranches: number;
  delivered: string;
  produced: { planks: number; charcoal: number; grain: number; malt: number; beer: number; bread: number };
  /** Final state hash (golden comparisons across sim changes, D-44). */
  hash: string;
}

const stableId = (w: World): number => w.state.buildings.find((b) => b.type === 'stable')!.id;
const wagon = (w: World): Command => ({ t: 'buyWagon', stable: stableId(w) });
const granaryLink = (w: World): Command => ({
  t: 'road', surface: 1,
  cells: lineCells(w.terrain.w, M12_GRANARY_LINK.y1 * w.terrain.w + M12_GRANARY_LINK.x,
    M12_GRANARY_LINK.y2 * w.terrain.w + M12_GRANARY_LINK.x),
});

/** Plausible wrong fixes: they must not reach the right fix's seals (tests). */
export const WRONG_FIXES: Record<Mission101112Id, readonly Strategy[]> = {
  m10: [{ name: 'zla / two wagons @0:20', after: 20, cmds: (w) => [wagon(w), wagon(w)] }],
  m11: [],
  m12: [{ name: 'zla / two wagons @0:20', after: 20, cmds: (w) => [wagon(w), wagon(w)] }],
};

export const STRATEGIES: Record<Mission101112Id, readonly Strategy[]> = {
  m10: [
    { name: 'nic / competing workshops', after: 0, cmds: () => [] },
    { name: 'czesciowa / woodcutter late @2:30', after: 150, cmds: () => [{ t: 'place', type: 'woodcutter', ...M10_SECOND_WOODCUTTER }] },
    { name: 'wlasciwa / woodcutter @0:20', after: 20, cmds: () => [{ t: 'place', type: 'woodcutter', ...M10_SECOND_WOODCUTTER }] },
  ],
  m11: [
    { name: 'nic / three wagons for a long route', after: 0, cmds: () => [] },
    { name: 'czesciowa / one wagon @1:00', after: 60, cmds: (w) => [wagon(w)] },
    { name: 'wlasciwa / five wagons @0:20', after: 20, cmds: (w) => [wagon(w), wagon(w), wagon(w), wagon(w), wagon(w)] },
  ],
  m12: [
    { name: 'nic / granary remains full', after: 0, cmds: () => [] },
    { name: 'czesciowa / connect granary late @2:00', after: 120, cmds: (w) => [granaryLink(w)] },
    { name: 'wlasciwa / connect granary @0:20', after: 20, cmds: (w) => [granaryLink(w)] },
  ],
};

export function runProposed(id: Mission101112Id, strategy: Strategy): RunResult {
  if (MISSIONS[id] === undefined) throw new Error('mission ' + id + ' must be registered');
  const w = createWorld(id);
  const st = w.state;
  const commandErrors: string[] = [];
  const invariantErrors: string[] = [];
  let actionSecond: number | null = null;
  let executed = false;
  let contestedSamples = 0, waitingDeliverySamples = 0, allBusySamples = 0;
  let storageFullSamples = 0, blockedMaltSamples = 0, peakWarehouseMalt = 0;
  while (st.mission.result === 'running') {
    if (!executed && st.tick >= strategy.after * TICK_HZ) {
      for (const cmd of strategy.cmds(w)) {
        const result = applyCommand(w, cmd);
        if (!result.ok) commandErrors.push(JSON.stringify({ cmd, error: result.err }));
      }
      actionSecond = st.tick / TICK_HZ;
      executed = true;
    }
    step(w);
    // Sample once per simulated second: status is updated by the dispatcher every half-second.
    if (st.tick % TICK_HZ === 0) {
      if (st.buildings.some((b) => b.status.k === 'NO_INPUT' && b.status.cause === 'CONTESTED')) contestedSamples++;
      if (st.buildings.some((b) => b.status.k === 'WAITING_DELIVERY')) waitingDeliverySamples++;
      if (st.buildings.some((b) => b.status.k === 'NO_WAGON' && b.status.cause === 'ALL_BUSY')) allBusySamples++;
      const warehouses = st.buildings.filter((b) => b.type === 'warehouse');
      if (warehouses.some((b) => b.status.k === 'STORAGE_FULL')) storageFullSamples++;
      const malt = st.buildings.find((b) => b.type === 'malthouse');
      if (malt && malt.status.k === 'OUTPUT_FULL' && malt.status.cause === 'NO_DESTINATION' &&
        explainBuilding(w, malt.id).some((l) => l.kind === 'building' && l.status.k === 'STORAGE_FULL')) {
        blockedMaltSamples++;
      }
      peakWarehouseMalt = Math.max(peakWarehouseMalt, ...warehouses.map((b) => b.stock.malt), 0);
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
  const l = st.ledger.produced;
  return {
    id, strategy: strategy.name, result: st.mission.result,
    minutes: st.mission.endTick / (60 * TICK_HZ), seals: stars(w), actionSecond,
    commandErrors, invariantErrors, contestedSamples, waitingDeliverySamples, allBusySamples,
    storageFullSamples, blockedMaltSamples, peakWarehouseMalt,
    lateTranches: c.tranches.filter((t) => t.missed).length, delivered,
    produced: { planks: l.planks, charcoal: l.charcoal, grain: l.grain,
      malt: l.malt, beer: l.beer, bread: l.bread },
    hash: goldenHash(w),
  };
}

export function printResults(id: Mission101112Id): RunResult[] {
  const results = [...STRATEGIES[id], ...WRONG_FIXES[id]].map((strategy) => runProposed(id, strategy));
  for (const result of results) {
    console.log(id + ' | ' + result.strategy + ' | ' + result.result + ' ' + result.minutes.toFixed(2) +
      ' min | seals ' + result.seals + ' | ' + result.delivered + ' | observations ' +
      JSON.stringify({ contested: result.contestedSamples, delivery: result.waitingDeliverySamples,
        allBusy: result.allBusySamples, storageFull: result.storageFullSamples,
        blockedMalt: result.blockedMaltSamples, warehouseMalt: result.peakWarehouseMalt,
        late: result.lateTranches }) + ' | produced ' + JSON.stringify(result.produced) +
      ' | errors ' + [...result.commandErrors, ...result.invariantErrors].join('; '));
  }
  return results;
}
