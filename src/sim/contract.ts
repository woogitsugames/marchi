// Contract tranches (mission V), per-building storage capacity (mission VI) and ice windows
// (mission IV): small pure helpers shared by dispatch, wagons, routing and checkMission.
import { BUILDINGS, GOODS } from './defs';
import type { Building, Contract, Good, MissionState, SimState } from './types';

/** Warehouse capacity of this building (all goods together). */
export function storeCapOf(b: Building): number {
  return b.capOverride >= 0 ? b.capOverride : BUILDINGS[b.type].storeCap;
}

/**
 * Every castle order of the mission: the main contract, then the further castles of mission XVI
 * (D-288). One-castle missions return [contract] (or []), so callers behave exactly as before.
 */
export function contractsOf(m: MissionState): Contract[] {
  if (!m.contract) return [];
  return m.extraContracts ? [m.contract, ...m.extraContracts] : [m.contract];
}

/** The order this castle holds while the mission runs, or null (not a contract castle / mission over). */
export function runningContractOf(m: MissionState, castleId: number): Contract | null {
  if (!m.contract || m.result !== 'running') return null;
  if (m.contract.castle === castleId) return m.contract;
  if (m.extraContracts) for (const c of m.extraContracts) if (c.castle === castleId) return c;
  return null;
}

/** Index of the first tranche not yet complete, or -1 (no tranches / all done). */
export function activeTranche(c: Contract): number {
  for (let i = 0; i < c.tranches.length; i++) if (c.tranches[i]!.doneTick < 0) return i;
  return -1;
}

/** Cumulative need of tranches 0..i (inclusive). */
export function cumulativeNeed(c: Contract, i: number, g: Good): number {
  let n = 0;
  for (let k = 0; k <= i && k < c.tranches.length; k++) n += c.tranches[k]!.need[g];
  return n;
}

/**
 * How many units of g the castle should hold right now: the whole order, or with tranches only
 * up to the tranche currently due (the castle does not order the next letter's goods early).
 */
export function contractTarget(c: Contract, g: Good): number {
  if (c.tranches.length === 0) return c.need[g];
  const a = activeTranche(c);
  return a < 0 ? c.need[g] : cumulativeNeed(c, a, g);
}

/** Does the castle stock cover tranches 0..i? */
export function trancheCovered(c: Contract, i: number, stock: Record<Good, number>): boolean {
  for (const g of GOODS) if (stock[g] < cumulativeNeed(c, i, g)) return false;
  return true;
}

/** End tick of the ice window covering the current tick, or -1 when the bridges are open. */
export function iceUntil(st: Pick<SimState, 'ice' | 'tick'>): number {
  for (const w of st.ice) if (st.tick >= w.start && st.tick < w.end) return w.end;
  return -1;
}
