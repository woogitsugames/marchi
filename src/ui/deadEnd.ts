// Early "no road to victory" (D-48): a contract the player can no longer win because the castle is cut off and
// even selling the spare wagons would not pay for the cheapest connection. Pure read of the sim (no writes).
import {
  BUILDINGS, GOODS, WAGON_PRICE, contractsOf, inputGoods, missionBuildable, outputGoods, suggestConnection,
  type BuildingType, type Good, type World,
} from '../sim/index';

/** Silver one sold wagon returns (commands.ts sellWagon: half the price). */
export const WAGON_REFUND = Math.floor(WAGON_PRICE * 0.5);

export type DeadEnd = DeadEndRoute | DeadEndSource;

export interface DeadEndRoute {
  k: 'NO_ROUTE_TO_CASTLE';
  castle: number;
  /** Cheapest connection stable -> castle in silver; -1 when no road can be built at all. */
  cost: number;
  coins: number;
  /** Silver the player could still raise by selling every wagon but one. */
  raise: number;
}

/**
 * D-613: a castle's good nobody can make any more — its last producer (or the producer of its input) was taken down
 * in a mission whose build list cannot replace it, and what is left in yards, granaries and wagons (and the inputs
 * still there for the workshops that remain) does not cover the order.
 */
export interface DeadEndSource {
  k: 'NO_SOURCE';
  castle: number;
  good: Good;
  /** Units the castles still lack, and the most the map can still bring (stock, cargo, inputs left to work). */
  need: number;
  left: number;
}

/**
 * null while the contract can still be won (or is over). Otherwise why it cannot: no road from the wagons'
 * stable to the castle, and silver + spare-wagon refunds < the cheapest connection (or none is buildable).
 */
export function deadEnd(world: World): DeadEnd | null {
  const st = world.state, c = st.mission.contract;
  if (!c || st.mission.result !== 'running') return null;
  const src = noSource(world);
  if (src) return src;
  const castle = st.buildings.find((b) => b.id === c.castle);
  const stable = st.buildings.find((b) => b.type === 'stable');
  if (!castle || !stable) return null;
  const link = suggestConnection(world, stable.gate, castle.gate);
  if (link && link.newCells.length === 0) return null; // connected: still winnable as far as roads go
  const cost = link ? link.cost : -1;
  const raise = Math.max(0, st.wagons.length - 1) * WAGON_REFUND;
  if (cost >= 0 && st.coins + raise >= cost) return null;
  return { k: 'NO_ROUTE_TO_CASTLE', castle: castle.id, cost, coins: st.coins, raise };
}

/** Units of g on the map: every yard and granary (not the castles) and every wagon's cargo. */
function onMap(world: World, g: Good): number {
  let n = 0;
  for (const b of world.state.buildings) if (b.type !== 'castle') n += b.stock[g];
  for (const w of world.state.wagons) if (w.cargoGood === g) n += w.cargoQty;
  return n;
}

/**
 * The most units of g the map can still bring (Infinity while a producer works or can be built with an endless
 * supply of its inputs). Generous on purpose (a finite input counts in full for every workshop that uses it): a
 * dead end is only ever reported when even this bound falls short. Recursion depth is the chain's (≤ 3 here).
 */
function supply(world: World, g: Good, can: readonly BuildingType[] | 'ranked', seen: readonly Good[]): number {
  if (seen.includes(g)) return onMap(world, g);
  let n = onMap(world, g);
  const types = new Set<BuildingType>();
  for (const b of world.state.buildings) if (b.type !== 'castle' && b.type !== 'warehouse' && outputGoods(b.type).includes(g)) types.add(b.type);
  if (can === 'ranked') return Infinity;
  for (const t of can) if (outputGoods(t).includes(g)) types.add(t);
  for (const t of types) {
    const r = BUILDINGS[t].recipe!;
    const ins = inputGoods(t);
    if (ins.length === 0) return Infinity;
    let cycles = Infinity;
    for (const ig of ins) cycles = Math.min(cycles, Math.floor(supply(world, ig, can, [...seen, g]) / (r.inputs[ig] ?? 1)));
    if (cycles === Infinity) return Infinity;
    n += cycles * (r.outputs[g] ?? 0);
  }
  return n;
}

/** D-613: the first castle good whose order the map can no longer fill, or null. Pure read. */
function noSource(world: World): DeadEndSource | null {
  const st = world.state;
  const can = missionBuildable(st.mission.id);
  if (can === 'ranked') return null;
  for (const k of contractsOf(st.mission)) {
    const castle = st.buildings.find((b) => b.id === k.castle);
    if (!castle) continue;
    for (const g of GOODS) {
      if (k.need[g] <= 0) continue;
      // every castle of this good together (two castles may share one good, XVI)
      let need = 0;
      for (const o of contractsOf(st.mission)) {
        const ob = st.buildings.find((b) => b.id === o.castle);
        if (ob) need += Math.max(0, o.need[g] - ob.stock[g]);
      }
      if (need <= 0) continue;
      const left = supply(world, g, can, []);
      if (left < need) return { k: 'NO_SOURCE', castle: castle.id, good: g, need, left };
    }
  }
  return null;
}
