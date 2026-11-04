// The pace card (day 8c): a slow contract is not a stall, so no building carries a StallReason for it,
// and the worst-stall card stayed empty or calm while the order ran late (mission VII: one fisher, the
// lesson only in the letter). When no real stall needs the card, it names what the forecast says holds the
// order back and leads to the cure. Calm, never red. Pure read of the sim and of the UI's pace log.
import {
  GOODS, PACE_WINDOW_TICKS, RAIN_COBBLE, SPEED_COBBLE, TICK_HZ, buildingById, canPlace, canSurface, cellSpeed, contractForecast,
  edgeLength, findPath, isRaining, missionBuildable, outputGoods, roadCellCost, thawing, trancheForecast,
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

/**
 * 'mud' — rain (or a thaw) turns the dirt road of a contract good's delivery to mud: not a stall, the wagons only
 * drive slower. `cells` is the longest stretch of muddy dirt on the slowest such delivery (producer -> castle, in
 * drive order), `pct` how much quicker that trip would be on cobbles under the same weather, `cost` the cobble
 * price. `risk`: the forecast misses three seals, so the card's sheet offers the cobble cure.
 */
export interface PaceMud {
  k: 'mud'; good: Good; producer: number; type: BuildingType; cells: number[]; pct: number; cost: number;
  risk: boolean; seals: number;
}

export type PaceCard = PaceProducer | PaceMud;

/** A stretch shorter than this, or a gain below this, is not worth a card. */
const MUD_MIN_CELLS = 6;
const MUD_MIN_PCT = 15;

/**
 * The pace card for this forecast, or null. Generic: no mission names, only the forecast, the mission's
 * buildable list and the rank gate.
 */
export function paceCard(world: World, f: ContractForecast | null): PaceCard | null {
  return producerCard(world, f) ?? mudCard(world, f);
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

let mudCache: { world: World; key: string; m: Omit<PaceMud, 'risk' | 'seals'> | null } | null = null;

function mudCard(world: World, f: ContractForecast | null): PaceMud | null {
  const st = world.state;
  const c = st.mission.contract;
  if (!c || st.mission.result !== 'running') return null;
  const rain = isRaining(st), thaw = thawing(world);
  if ((!rain && !thaw) || !canSurface(world, 2).ok) return null;
  const castle = buildingById(world, c.castle);
  if (!castle) return null;
  // goods the castle still lacks (the whole order, or the tranche now due)
  const lacks = GOODS.filter((g) => c.need[g] > 0 && castle.stock[g] < c.need[g]);
  const key = `${st.netVersion}|${st.buildings.length}|${rain}|${thaw}|${lacks.join(',')}`;
  if (mudCache?.key !== key || mudCache.world !== world) mudCache = { world, key, m: muddiest(world, castle.gate, lacks, rain, thaw) };
  const m = mudCache.m;
  if (!m) return null;
  // at risk: the forecast misses three seals (or a tranche's own deadline); unknown before the first minute
  const risk = !!f && f.ready && (f.seals < 3 || (c.tranches.length > 0 && f.finishTick > dueTick(world)));
  // only when a seal is at risk (owner 2026-11-04, M3): a calm mud line on an order that makes it anyway was noise
  if (!risk) return null;
  return { ...m, risk, seals: f!.seals };
}

function dueTick(world: World): number {
  const c = world.state.mission.contract!;
  const x = c.tranches.find((t) => t.doneTick < 0);
  return x && !x.missed ? x.deadlineTick : c.deadlineTick;
}

/** The delivery (producer of a lacking good -> castle) that loses the most time to mud, and its longest muddy stretch. */
function muddiest(world: World, castleGate: number, lacks: Good[], rain: boolean, thaw: boolean): Omit<PaceMud, 'risk' | 'seals'> | null {
  const st = world.state, t = world.terrain;
  const paved = SPEED_COBBLE * (rain ? RAIN_COBBLE : 1);
  let best: Omit<PaceMud, 'risk' | 'seals'> | null = null, bestLoss = 0;
  for (const p of st.buildings) {
    const good = lacks.find((g) => outputGoods(p.type).includes(g));
    if (!good) continue;
    const path = findPath(world, p.gate, castleGate, true);
    if (!path || path.length === 0) continue;
    // drive time now and with every muddy cell of the longest stretch on cobbles (slope left out: a ratio)
    const mud = (c: number): boolean => st.roads[c] === 1 && t.water[c] !== 1;
    let run: number[] = [], longest: number[] = [];
    for (const c of path) {
      if (mud(c)) { run.push(c); if (run.length > longest.length) longest = run; } else run = [];
    }
    if (longest.length < MUD_MIN_CELLS) continue;
    const inRun = new Set(longest);
    let now = 0, after = 0, a = p.gate;
    for (const b of path) {
      const len = edgeLength(t, a, b);
      const va = cellSpeed(world, a, rain, thaw), vb = cellSpeed(world, b, rain, thaw);
      now += len * 0.5 / va + len * 0.5 / vb;
      after += len * 0.5 / (inRun.has(a) ? paved : va) + len * 0.5 / (inRun.has(b) ? paved : vb);
      a = b;
    }
    const loss = now - after;
    const pct = Math.round(loss / now * 100);
    if (pct < MUD_MIN_PCT || loss <= bestLoss) continue;
    let cost = 0;
    for (const c of longest) cost += roadCellCost(world, c, 2);
    bestLoss = loss;
    best = { k: 'mud', good, producer: p.id, type: p.type, cells: longest, pct, cost };
  }
  return best;
}
