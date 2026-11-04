// The pace card (day 8c): a slow contract is not a stall, so no building carries a StallReason for it,
// and the worst-stall card stayed empty or calm while the order ran late (mission VII: one fisher, the
// lesson only in the letter). When no real stall needs the card, it names what the forecast says holds the
// order back and leads to the cure. Calm, never red. Pure read of the sim and of the UI's pace log.
import {
  GOODS, PACE_WINDOW_TICKS, TICK_HZ, buildingById, canPlace, contractForecast, missionBuildable, trancheForecast,
  type BuildingType, type ContractForecast, type Good, type PaceLog, type World,
} from '../sim/index';

let cache: { world: World; log: PaceLog; key: string; f: ContractForecast | null } | null = null;

/**
 * The forecast is a few path searches; recompute only when a new pace sample lands, the network
 * changes or a delivery is made or promised (the waybill and the card ask every frame).
 */
export function forecastFor(world: World, log: PaceLog): ContractForecast | null {
  const st = world.state;
  const c = st.mission.contract;
  if (!c || st.mission.result !== 'running') return null;
  // an order with tranches is read tranche by tranche (BACKLOG P3, D-78): the forecast covers what the castle
  // must hold once the tranche now due is complete
  const cur = c.tranches.findIndex((x) => x.doneTick < 0);
  if (c.tranches.length > 0 && cur < 0) return null;
  const castle = buildingById(world, c.castle);
  let sum = 0;
  if (castle) for (const g of GOODS) if (c.need[g] > 0) sum += castle.stock[g] * 1000 + castle.incoming[g];
  const key = `${st.mapId}|${log.ticks[log.ticks.length - 1] ?? -1}|${st.netVersion}|${sum}|${st.buildings.length}|${cur}|${cur >= 0 && st.tick - (cur > 0 ? c.tranches[cur - 1]!.doneTick : 0) < PACE_WINDOW_TICKS}`;
  if (cache?.key !== key || cache.world !== world || cache.log !== log) cache = { world, log, key, f: cur >= 0 ? trancheForecast(world, log) : contractForecast(world, log) };
  return cache.f;
}

/**
 * 'producer' — the bottleneck good's producers, even working without a break, cannot make what the next seal
 * needs, and the mission lets the player build another one: the cure is one more producer (the build ghost
 * starts on the mission's authored site, D-107). `rate` made per minute now, `cap` at most, `need` for `seals`.
 */
export interface PaceProducer {
  k: 'producer'; good: Good; producer: number; type: BuildingType; n: number;
  rate: number; cap: number; need: number; seals: number;
}

export type PaceCard = PaceProducer;


/**
 * The pace card for this forecast, or null. Generic: no mission names, only the forecast, the mission's
 * buildable list and the rank gate.
 */
export function paceCard(world: World, f: ContractForecast | null): PaceCard | null {
  return producerCard(world, f);
}

function producerCard(world: World, f: ContractForecast | null): PaceProducer | null {
  if (!f || !f.ready || !f.aim || f.bottleneck < 0) return null;
  const b = f.goods[f.bottleneck]!;
  if (b.toMake <= 0 || !b.producerType || b.producer < 0 || !buildingById(world, b.producer)) return null;
  // flat out is not enough: a wagon or a road cannot lift the pace above what the producers can make
  if (f.aim.perMin <= b.capPerMin) return null;
  const can = missionBuildable(world.state.mission.id);
  if (can === 'ranked' || !can.includes(b.producerType) || !canPlace(world, b.producerType).ok) return null;
  // the best seal one more producer can still reach (the aim's lag: the drive to the castle after the last unit)
  const c = world.state.mission.contract!, tick = world.state.tick;
  const lag = f.aim.byTick - tick - b.toMake * 60 * TICK_HZ / f.aim.perMin;
  const more = b.capPerMin * (b.producers + 1) / Math.max(1, b.producers);
  for (const [seals, byTick] of [[3, c.star3Tick], [2, c.star2Tick]] as const) {
    if (seals <= f.seals) break;
    const room = byTick - tick - lag;
    if (room <= 0) continue;
    const need = b.toMake * 60 * TICK_HZ / room;
    if (need > b.capPerMin && need <= more) {
      return { k: 'producer', good: b.good, producer: b.producer, type: b.producerType, n: b.producers, rate: Math.max(0, b.perMin), cap: b.capPerMin, need, seals };
    }
  }
  return null;
}

