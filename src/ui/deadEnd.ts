// Early "no road to victory" (D-48): a contract the player can no longer win because the castle is cut off and
// even selling the spare wagons would not pay for the cheapest connection. Pure read of the sim (no writes).
import {
  BUILDINGS, DEMOLISH_REFUND, GOODS, WAGON_PRICE, contractsOf, demolishQuote, inputGoods, marketOpen, missionBuildable, outputGoods,
  roadCellCost, seasonal, suggestConnection, type BuildingType, type Good, type World,
} from '../sim/index';

/** Silver one sold wagon returns (commands.ts sellWagon: half the price). */
export const WAGON_REFUND = Math.floor(WAGON_PRICE * 0.5);

export type DeadEnd = DeadEndRoute | DeadEndSource | DeadEndLate;

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
  /**
   * D-638: a workshop on the build list would make it, but its price is more than all the silver the player can still
   * raise (coins, every spare wagon sold, every building and road taken back): the cheapest such price. Absent when
   * the build list itself has no such workshop.
   */
  price?: number;
}

/**
 * D-639: the order can still be filled, but not before the deadline — even if every workshop that makes the good
 * (and its inputs) worked without a pause from now on and no wagon needed a second to bring it, and no new workshop
 * can be built (not on the build list, or no silver for it).
 */
export interface DeadEndLate {
  k: 'TOO_LATE';
  castle: number;
  good: Good;
  /** Units the castles still lack, and the most that can be made by the deadline. */
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
  if (src?.k === 'NO_SOURCE') return src;
  const stable = st.buildings.find((b) => b.type === 'stable');
  if (!stable) return src;
  // D-635: every castle with an order (XVI / XVII: the second castle too), the main one first
  for (const k of contractsOf(st.mission)) {
    const castle = st.buildings.find((b) => b.id === k.castle);
    if (!castle || !GOODS.some((g) => k.need[g] > castle.stock[g])) continue; // gone, or its order is in
    const link = suggestConnection(world, stable.gate, castle.gate);
    if (link && link.newCells.length === 0) continue; // connected: still winnable as far as roads go
    const cost = link ? link.cost : -1;
    const raise = Math.max(0, st.wagons.length - 1) * WAGON_REFUND;
    if (cost >= 0 && st.coins + raise >= cost) continue;
    return { k: 'NO_ROUTE_TO_CASTLE', castle: castle.id, cost, coins: st.coins, raise };
  }
  return src; // D-639: too late, or null
}

/**
 * Units of g on the map: every yard and granary (not the castles), every wagon's cargo, and (D-636) the output of a
 * cycle already running — its inputs left the yard when it started, so without it the bound fell short by one cycle
 * (fuzz m17 seed 104: the letter at 4:40 cleared at 5:01 when the sawmill's last cycle came out).
 */
function onMap(world: World, g: Good, ticksLeft = Infinity): number {
  let n = 0;
  for (const b of world.state.buildings) {
    if (b.type === 'castle') continue;
    n += b.stock[g];
    const r = BUILDINGS[b.type].recipe;
    // D-639: by a deadline, only a cycle that is done by then (+1 tick of slack for the order of a step)
    if (b.progress >= 0 && r && r.ticks - b.progress <= ticksLeft + 1) n += r.outputs[g] ?? 0;
  }
  for (const w of world.state.wagons) if (w.cargoGood === g) n += w.cargoQty;
  return n;
}

/** What `supply` may assume: the build list, the silver bound for new workshops, the ticks left (Infinity: no limit). */
interface Bound { can: readonly BuildingType[]; silver: number; ticks: number }

/**
 * The most units of g the map can still bring (Infinity while a producer works or can be built with an endless
 * supply of its inputs). Generous on purpose (a finite input counts in full for every workshop that uses it, a new
 * workshop needs only its own price, no wagon time): a dead end is only ever reported when even this bound falls
 * short. With `ticks` finite (D-639) every existing workshop counts its cycles that fit by then. Recursion depth is the
 * chain's (≤ 3 here).
 */
function supply(world: World, g: Good, o: Bound, seen: readonly Good[]): number {
  if (seen.includes(g)) return onMap(world, g, o.ticks);
  let n = onMap(world, g, o.ticks);
  // per type, the cycles its standing workshops can still finish by then: a running cycle's output is on the map
  // already (onMap), the next one starts when it is done (D-639, +1 tick of slack for the order of a step)
  const count = new Map<BuildingType, number>();
  for (const b of world.state.buildings) {
    if (b.type === 'castle' || b.type === 'warehouse' || !outputGoods(b.type).includes(g)) continue;
    const ticks = BUILDINGS[b.type].recipe!.ticks;
    const free = o.ticks - (b.progress >= 0 ? ticks - b.progress : 0) + 1;
    count.set(b.type, (count.get(b.type) ?? 0) + (o.ticks === Infinity ? 1 : Math.max(0, Math.floor(free / ticks))));
  }
  // D-638: a type on the build list counts only when its price is within the silver the player can still raise
  const fresh = new Set<BuildingType>();
  for (const t of o.can) if (outputGoods(t).includes(g) && BUILDINGS[t].price <= o.silver) fresh.add(t);
  for (const t of new Set([...count.keys(), ...fresh])) {
    const r = BUILDINGS[t].recipe!;
    // as many as the player likes of a type that can be built; otherwise the ones standing, each a cycle at a time
    const byTime = fresh.has(t) || o.ticks === Infinity ? Infinity : count.get(t) ?? 0;
    let cycles = byTime;
    for (const ig of inputGoods(t)) cycles = Math.min(cycles, Math.floor(supply(world, ig, o, [...seen, g]) / (r.inputs[ig] ?? 1)));
    if (cycles === Infinity) return Infinity;
    n += cycles * (r.outputs[g] ?? 0);
  }
  return n;
}

/**
 * D-638: the most silver the player can still raise in a contract mission, where nothing pays but a refund: the coins,
 * every wagon but one sold, every building (not castle, stable or trading post) and every road cell taken back.
 * Infinity where a market pays for goods. Pure read.
 */
function silverBound(world: World): number {
  if (marketOpen(world)) return Infinity;
  const st = world.state;
  let n = st.coins + Math.max(0, st.wagons.length - 1) * WAGON_REFUND;
  for (const b of st.buildings) if (b.type !== 'castle' && b.type !== 'stable' && b.type !== 'tradePost') n += demolishQuote(world, b).refund;
  for (let c = 0; c < st.roads.length; c++) {
    const s = st.roads[c]!;
    if (s) n += Math.floor(roadCellCost(world, c, s as 1 | 2) * DEMOLISH_REFUND);
  }
  return n;
}

/**
 * D-613: the first castle good whose order the map can no longer fill, or null. D-638: a workshop the player cannot
 * pay for counts as none. D-639: else the first good that cannot be made by the deadline (TOO_LATE). Pure read.
 */
function noSource(world: World): DeadEndSource | DeadEndLate | null {
  const st = world.state;
  const can = missionBuildable(st.mission.id);
  if (can === 'ranked') return null;
  const silver = silverBound(world);
  const now: Bound = { can, silver, ticks: Infinity };
  // seasons stretch and shorten cycles (the free valley only today): no deadline bound there
  const ticksLeft = st.mission.contract && !seasonal(world) ? st.mission.contract.deadlineTick - st.tick : Infinity;
  let late: DeadEndLate | null = null;
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
      const left = supply(world, g, now, []);
      if (left < need) {
        // D-638: would a workshop on the list make it, if silver were no object? Then name the cheapest price
        const rich = supply(world, g, { ...now, silver: Infinity }, []) >= need;
        const d: DeadEndSource = { k: 'NO_SOURCE', castle: castle.id, good: g, need, left };
        if (rich) d.price = cheapestMissing(world, g, can, silver);
        return d;
      }
      if (!late && ticksLeft !== Infinity) {
        const by = supply(world, g, { ...now, ticks: Math.max(0, ticksLeft) }, []);
        if (by < need) late = { k: 'TOO_LATE', castle: castle.id, good: g, need, left: by };
      }
    }
  }
  return late;
}

/** D-638: the cheapest workshop on the build list, in g's chain, that the silver bound cannot pay for. */
function cheapestMissing(world: World, g: Good, can: readonly BuildingType[], silver: number, seen: readonly Good[] = []): number {
  if (seen.includes(g)) return Infinity;
  let best = Infinity;
  for (const t of can) {
    if (!outputGoods(t).includes(g)) continue;
    if (BUILDINGS[t].price > silver) best = Math.min(best, BUILDINGS[t].price);
    for (const ig of inputGoods(t)) best = Math.min(best, cheapestMissing(world, ig, can, silver, [...seen, g]));
  }
  return best;
}
