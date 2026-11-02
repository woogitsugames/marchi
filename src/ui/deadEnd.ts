// Early "no road to victory" (D-48): a contract the player can no longer win because the castle is cut off and
// even selling the spare wagons would not pay for the cheapest connection. Pure read of the sim (no writes).
import { WAGON_PRICE, suggestConnection, type World } from '../sim/index';

/** Silver one sold wagon returns (commands.ts sellWagon: half the price). */
export const WAGON_REFUND = Math.floor(WAGON_PRICE * 0.5);

export interface DeadEnd {
  k: 'NO_ROUTE_TO_CASTLE';
  castle: number;
  /** Cheapest connection stable -> castle in silver; -1 when no road can be built at all. */
  cost: number;
  coins: number;
  /** Silver the player could still raise by selling every wagon but one. */
  raise: number;
}

/**
 * null while the contract can still be won (or is over). Otherwise why it cannot: no road from the wagons'
 * stable to the castle, and silver + spare-wagon refunds < the cheapest connection (or none is buildable).
 */
export function deadEnd(world: World): DeadEnd | null {
  const st = world.state, c = st.mission.contract;
  if (!c || st.mission.result !== 'running') return null;
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
