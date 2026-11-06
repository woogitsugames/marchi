// The pace card (day 8c): a slow contract is not a stall, so no building carries a StallReason for it,
// and the worst-stall card stayed empty or calm while the order ran late (mission VII: one fisher, the
// lesson only in the letter). When no real stall needs the card, it names what the forecast says holds the
// order back and leads to the cure. Calm, never red. Pure read of the sim and of the UI's pace log.
import {
  BUILDINGS, GOODS, MARKET, MAX_WAGONS, capacityOf, PACE_WINDOW_TICKS, WAGON_PRICE, inputGoods, isHeld, RAIN_COBBLE, SPEED_COBBLE, TICK_HZ, buildingById, canPlace, canSurface, cellSpeed, contractForecast,
  edgeLength, findPath, suggestLinkToStable, isRaining, missionBuildable, outputGoods, roadCellCost, sandboxStatus, thawing, trancheForecast, validateRoad,
  type Building, type BuildingType, type ContractForecast, type Good, type PaceLog, type RoadSuggestion, type World,
} from '../sim/index';
import { iceBeforeWagon } from './stalls';
import { granaryLoads, postWouldTake } from './stallKinds';
import { bottleneckCard } from './bottleneck';
import { siteExists } from './site';

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

/**
 * 'fleet' (day 9a, D-127) — a producer of the order's chain stands with a full yard for `waitTicks`: the wagon the
 * dispatcher gave it is still on another trip, no wagon idles at a stable, and the forecast misses three seals.
 * The fleet is the constraint, but the producer's own status (WAITING_PICKUP) is a calm one, so the stall card
 * never said so. `producer` is that building (the card's subject); the cure is one more wagon.
 */
export interface PaceFleet {
  k: 'fleet'; good: Good; producer: number; type: BuildingType; wagons: number; waitTicks: number; seals: number;
  /** The wagon on its way to the yard (the sheet says when it arrives). */
  wagon: number;
}

/**
 * 'rank' (D-152) — the free valley, no contract: the next rank still lacks distinct goods sold, and nothing louder
 * needs the slot. The card names the next unbuilt producer of an unsold good the rank allows (farm; mill once a farm
 * stands; bakery once a mill stands; fisher; quarry). `producer` is the castle (the card's subject, its sheet holds the
 * cure: the build tool with `type` picked, the ghost by the castle). `sold`/`goods`: distinct goods sold / needed.
 */
export interface PaceRank {
  k: 'rank'; producer: number; type: BuildingType; good: Good; rank: number; sold: number; goods: number;
}

/**
 * 'grow' (D-192, research valley-ranks-2-3 F1) — the free valley from rank 1: the next rank lacks only renown (the goods
 * are sold, the flow is reached) and silver lies unspent. The card names one more producer of a chain that already
 * stands, keeping the chain's ratios, while the chain's end good still fetches a fair price. `producer` is the castle
 * (the card's subject; its sheet holds the cure: the build tool with `type` picked, the ghost by the castle). `good`:
 * the chain's end good; `n`: how many of `type` stand now; `renown`/`need`: renown now / for `rank`.
 */
export interface PaceGrow {
  k: 'grow'; producer: number; type: BuildingType; good: Good; n: number; rank: number; renown: number; need: number;
}

/**
 * 'post' (D-245, BACKLOG P2 from D-233) — the free valley from rank 4: full granaries read "rynek nasycony" (the castle
 * takes no more of their loads) while the trading post across the river, open and paying 125 %, would take them but no
 * road reaches it (NO_ROAD). The card names the post (the card's subject: its sheet holds the gap finder's road with
 * the bridge, one tap to build). `good`: a good the post would take; `granaries`: how many full granaries wait on it;
 * `bridge`/`cost`: the gap finder's link.
 */
export interface PacePost {
  k: 'post'; producer: number; good: Good; granaries: number; bridge: boolean; cost: number;
}

export type PaceCard = PaceProducer | PaceMud | PaceFleet | PaceRank | PaceGrow | PacePost;

/** A stretch shorter than this, or a gain below this, is not worth a card. */
const MUD_MIN_CELLS = 6;
const MUD_MIN_PCT = 15;

/**
 * The pace card for this forecast, or null. Generic: no mission names, only the forecast, the mission's
 * buildable list and the rank gate.
 */
export function paceCard(world: World, f: ContractForecast | null): PaceCard | null {
  const prod = producerCard(world, f);
  if (prod) return prod;
  const mud = mudCard(world, f);
  // a cobble stretch the player cannot pay for now yields to the wagon he can (D-127, mission I at 60 s)
  if (mud && mudPayable(world, mud)) return mud;
  // the free valley (D-163): the rank card's producer comes before one more wagon once the fleet serves its yards
  const rank = rankCard(world);
  if (rank && fleetEnough(world)) return rank;
  // D-245: the road to the trading post comes before one more wagon — with the markets in reach saturated, a wagon
  // only carries loads into full granaries; the post opens a new market once, and the card is gone for good after
  const post = postCard(world);
  if (post) return post;
  const card = fleetCard(world, f) ?? mud ?? rank;
  if (card) return card;
  // D-192: the grow card comes last — after the fleet cue (a yard losing silver now) and after the bottleneck card
  // (D-171: a measured shortage names the right producer; the grow card only keeps ratios)
  return bottleneckCard(world) ? null : growCard(world);
}

/** Wagons per producing building from which the free valley's fleet counts as enough (D-163). */
export const FLEET_ENOUGH_PER_PRODUCER = 2;

/**
 * The free valley's fleet serves its producers well enough that the rank card's building goes first (D-163,
 * first-10-minutes-e V2): two wagons or more per producing building. Below that the fleet card keeps the slot.
 */
export function fleetEnough(world: World): boolean {
  const st = world.state;
  let producers = 0;
  for (const b of st.buildings) if (BUILDINGS[b.type].recipe && outputGoods(b.type).length > 0) producers++;
  return producers > 0 && st.wagons.length >= FLEET_ENOUGH_PER_PRODUCER * producers;
}

/**
 * The rank card's build order (research sandbox-first-30, prototype `sbRank`): a producer, and the building that must
 * already stand before it is worth building (its input's maker).
 */
const RANK_ORDER: readonly (readonly [BuildingType, BuildingType | null])[] = [
  ['farm', null], ['mill', 'farm'], ['bakery', 'mill'], ['fisher', null], ['quarry', null],
];

/** The free valley's rank card (D-152), or null. Shown also when silver is short (the sheet says how much). */
export function rankCard(world: World): PaceRank | null {
  const st = world.state;
  if (st.mission.contract || st.mission.result !== 'running') return null;
  const sb = sandboxStatus(world);
  if (!sb.market || !sb.next || sb.goodsSold >= sb.next.goods) return null;
  const castle = st.buildings.find((b) => b.type === 'castle');
  if (!castle) return null;
  const has = (t: BuildingType): boolean => st.buildings.some((b) => b.type === t);
  for (const [type, needs] of RANK_ORDER) {
    const good = outputGoods(type)[0];
    if (!good || st.ledger.sold[good] > 0 || has(type) || (needs && !has(needs)) || !sb.unlocked.includes(type)) continue;
    // D-175: no site by the castle (the ghost would open red): name the next building instead
    if (!siteExists(world, type, castle.id)) continue;
    return { k: 'rank', producer: castle.id, type, good, rank: sb.next.rank, sold: sb.goodsSold, goods: sb.next.goods };
  }
  return null;
}

/**
 * The grow card's chains (D-192): producers upstream first, and the rule that keeps each chain balanced — a raw
 * producer no sooner than its consumer (farm <= mill, woodcutter <= sawmill), a processor only behind a spare supplier
 * (mill < farm, bakery < mill, sawmill < woodcutter). The fisher is a chain of its own.
 */
const GROW_CHAINS: readonly (readonly BuildingType[])[] = [['farm', 'mill', 'bakery'], ['fisher'], ['woodcutter', 'sawmill']];
const GROW_FEEDS: Partial<Record<BuildingType, BuildingType>> = { farm: 'mill', mill: 'bakery', woodcutter: 'sawmill' };
const GROW_FED_BY: Partial<Record<BuildingType, BuildingType>> = { mill: 'farm', bakery: 'mill', sawmill: 'woodcutter' };
/**
 * The chain's end good does not fetch a fair price any more (D-174): its saturation reached half the cap, or a full
 * granary holds a load of it that no market takes. More of the same would only fill the granaries.
 */
function growSaturated(world: World, good: Good): boolean {
  const st = world.state;
  if (st.market.saturation[good] >= MARKET.cap / 2) return true;
  return st.buildings.some((b) => b.type === 'warehouse' && b.status.k === 'STORAGE_FULL' &&
    b.stock[good] >= capacityOf(good) && granaryLoads(world, b.id) === 'saturated');
}

/**
 * The free valley's grow card (D-192), or null. Shown only when the building is affordable with the fleet's silver
 * reserve left over (FLEET_FREE_KEEP): it spends silver that lies unused, never the last of it.
 */
export function growCard(world: World): PaceGrow | null {
  const st = world.state;
  if (st.mission.contract || st.mission.result !== 'running') return null;
  const sb = sandboxStatus(world);
  if (!sb.market || sb.rank < 1 || !sb.next) return null;
  // only renown missing: the goods are sold and the flow reached (the rank card covers missing goods)
  if (sb.goodsSold < sb.next.goods || sb.bestFlow < sb.next.flow || sb.renown >= sb.next.renown) return null;
  const castle = st.buildings.find((b) => b.type === 'castle');
  if (!castle) return null;
  const cnt = new Map<BuildingType, number>();
  for (const b of st.buildings) cnt.set(b.type, (cnt.get(b.type) ?? 0) + 1);
  const n = (t: BuildingType): number => cnt.get(t) ?? 0;
  let best: { type: BuildingType; good: Good } | null = null;
  for (const chain of GROW_CHAINS) {
    // an existing chain only; its end good is what its most downstream standing building makes
    let last: BuildingType | null = null;
    for (const t of chain) if (n(t) > 0) last = t;
    if (!last) continue;
    const good = outputGoods(last)[0];
    if (!good || growSaturated(world, good)) continue;
    for (const t of chain) {
      if (!sb.unlocked.includes(t)) continue;
      const feeds = GROW_FEEDS[t], fedBy = GROW_FED_BY[t];
      if (feeds && n(feeds) > 0 && n(t) > n(feeds)) continue;
      if (feeds && n(feeds) === 0 && n(t) > 0) continue;
      if (fedBy && n(t) >= n(fedBy)) continue;
      if (best && n(t) >= n(best.type)) continue;
      // D-175: no site by the castle (the ghost would open red)
      if (!siteExists(world, t, castle.id)) continue;
      best = { type: t, good };
    }
  }
  if (!best || st.coins < BUILDINGS[best.type].price + FLEET_FREE_KEEP) return null;
  return { k: 'grow', producer: castle.id, type: best.type, good: best.good, n: n(best.type), rank: sb.next.rank, renown: sb.renown, need: sb.next.renown };
}

let postLink: { world: World; key: string; s: RoadSuggestion | null } | null = null;

/**
 * The free valley's trading-post card (D-245), or null: some full granary (STORAGE_FULL) reads "rynek nasycony" and
 * the open post, unreachable by road, would take one of its loads (postWouldTake), and the gap finder has a link.
 * Shown also when silver is short (the post's sheet says how much, as the rank card's). Pure read; the link search is
 * cached per network version.
 */
export function postCard(world: World): PacePost | null {
  const st = world.state;
  if (st.mission.contract || st.mission.result !== 'running') return null;
  let post = -1, n = 0, good: Good | null = null;
  for (const b of st.buildings) {
    if (b.type !== 'warehouse' || b.status.k !== 'STORAGE_FULL') continue;
    const p = postWouldTake(world, b.id);
    if (p < 0) continue;
    post = p; n++;
    if (!good) good = GOODS.find((g) => g !== 'stone' && MARKET.base[g] > 0 && b.stock[g] - b.reservedOut[g] >= capacityOf(g)) ?? null;
  }
  if (post < 0 || !good) return null;
  const key = `${post}|${st.netVersion}|${st.buildings.length}`;
  if (postLink?.world !== world || postLink.key !== key) postLink = { world, key, s: suggestLinkToStable(world, post) };
  const s = postLink.s;
  if (!s) return null;
  return { k: 'post', producer: post, good, granaries: n, bridge: s.bridgeCells > 0, cost: s.cost };
}

/** The mud card's cobbles cost no more silver than the player has (stone or rank may still refuse them). */
function mudPayable(world: World, m: PaceMud): boolean {
  const r = validateRoad(world, m.cells, 2);
  return r.ok || r.err.k !== 'NO_COINS';
}

/** A yard full this long, with the forecast short of a seal, is lost production worth a wagon. */
export const FLEET_WAIT_TICKS = 20 * TICK_HZ;
/** The fleet counts as short when no wagon stood idle or held for this share of the last minute. */
export const FLEET_BUSY_SHARE = 0.9;
/**
 * A wagon bought later than this before the seal it aims at rarely pays off (measured on missions I-XIII,
 * D-127: bought with less room it made X miss 3 seals and never lifted a seal anywhere).
 */
export const FLEET_ROOM_TICKS = 210 * TICK_HZ;
/**
 * Without a contract (the free valley) there is no seal to aim at: the cue keeps this much silver for the next
 * building (owner 2026-11-05; research sandbox-first-30: rank 1 at ~11 min instead of 14–17, no failed purchase).
 */
export const FLEET_FREE_KEEP = 40;

/**
 * How busy the fleet was over the last minute (UI-owned, never in the state): one bit per game second, set when
 * no wagon stood idle at a stable and none was held at a bridge or cut off (more wagons would wait there too).
 * Call once per sim tick (the app's onTick; headless tools right after step()). A world never sampled (a freshly
 * loaded save) shows the fleet card a minute later — harmless.
 */
const FLEET_WINDOW = 60;
interface FleetLog { tick: number; bits: number[] }
const fleetLogs = new WeakMap<World, FleetLog>();
export function sampleFleet(world: World): void {
  const st = world.state;
  if (st.tick % TICK_HZ !== 0 || st.mission.result !== 'running') return;
  let log = fleetLogs.get(world);
  if (!log || st.tick <= log.tick) { log = { tick: st.tick, bits: [] }; fleetLogs.set(world, log); }
  log.tick = st.tick;
  log.bits.push(st.wagons.some((w) => (w.status.k === 'IDLE' && !w.job) || isHeld(w.status)) ? 0 : 1);
  if (log.bits.length > FLEET_WINDOW) log.bits.shift();
}

/** Share of the last minute the whole fleet was on the road (0 until a full minute was sampled). */
export function fleetBusyShare(world: World): number {
  const log = fleetLogs.get(world);
  if (!log || log.bits.length < FLEET_WINDOW || world.state.tick - log.tick > TICK_HZ) return 0;
  let n = 0;
  for (const b of log.bits) n += b;
  return n / log.bits.length;
}

/** The forecast's bottleneck good and, upstream, the inputs of its producers (grain -> malt -> beer). */
function bottleneckChain(world: World, f: ContractForecast): Set<Good> {
  const out = new Set<Good>([f.goods[f.bottleneck]!.good]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const b of world.state.buildings) {
      if (!BUILDINGS[b.type].recipe || !outputGoods(b.type).some((g) => out.has(g))) continue;
      for (const g of inputGoods(b.type)) if (!out.has(g)) { out.add(g); grew = true; }
    }
  }
  return out;
}

/** The fleet-wide part of the fleet card's rule; the goods of the bottleneck chain when it holds, else null. */
function fleetGate(world: World, f: ContractForecast | null): Set<Good> | null {
  const st = world.state;
  if (st.mission.result !== 'running') return null;
  if (!st.mission.contract) return freeFleetGate(world);
  if (!f || !f.ready || f.bottleneck < 0) return null;
  // a better seal is still in reach, with time for a new wagon to pay off before it
  if (!f.aim || f.aim.byTick - st.tick < FLEET_ROOM_TICKS) return null;
  // a wagon must be buyable now, and must not cost the stone bridge before the ice (D-117)
  if (st.coins < WAGON_PRICE || st.wagons.length >= MAX_WAGONS || !st.buildings.some((b) => b.type === 'stable')) return null;
  if (iceBeforeWagon(world)) return null;
  // a wagon idles at a stable right now, or the fleet was not on the road the whole last minute
  if (st.wagons.some((w) => w.status.k === 'IDLE' && !w.job) || fleetBusyShare(world) < FLEET_BUSY_SHARE) return null;
  return bottleneckChain(world, f);
}

/**
 * No contract (the free valley, D-140): no forecast and no seal, so every good counts; the rest of the gate is the
 * contract one (a wagon buyable, none idle, the fleet on the road the whole last minute) plus a silver reserve.
 */
function freeFleetGate(world: World): Set<Good> | null {
  const st = world.state;
  if (st.coins < WAGON_PRICE + FLEET_FREE_KEEP || st.wagons.length >= MAX_WAGONS || !st.buildings.some((b) => b.type === 'stable')) return null;
  if (st.wagons.some((w) => w.status.k === 'IDLE' && !w.job) || fleetBusyShare(world) < FLEET_BUSY_SHARE) return null;
  return new Set<Good>(GOODS);
}

/** This building's yard qualifies: a long pickup wait on the chain, its wagon not held. */
function fleetWait(world: World, b: Building, goods: Set<Good>, seals: number): PaceFleet | null {
  const s = b.status, st = world.state;
  if (s.k !== 'WAITING_PICKUP' || b.stalledTicks < FLEET_WAIT_TICKS || !goods.has(s.good)) return null;
  // the wagon on its way is held at a bridge or cut off: another wagon would wait there too
  const w = st.wagons.find((q) => q.id === s.wagon);
  if (!w || isHeld(w.status)) return null;
  return { k: 'fleet', good: s.good, producer: b.id, type: b.type, wagons: st.wagons.length, waitTicks: b.stalledTicks, seals, wagon: w.id };
}

function fleetCard(world: World, f: ContractForecast | null): PaceFleet | null {
  const goods = fleetGate(world, f);
  if (!goods) return null;
  let best: PaceFleet | null = null;
  for (const b of world.state.buildings) {
    const c = fleetWait(world, b, goods, f?.seals ?? -1);
    if (c && (!best || c.waitTicks > best.waitTicks || (c.waitTicks === best.waitTicks && c.producer < best.producer))) best = c;
  }
  return best;
}

/**
 * The fleet cure on this building's own sheet (D-128, first-10-minutes-c N2): the same rule as the card, for any
 * yard that qualifies — not only the one the card names. Null otherwise (the wait stays calm, no cure).
 */
export function fleetCueFor(world: World, f: ContractForecast | null, b: Building): PaceFleet | null {
  const goods = fleetGate(world, f);
  return goods ? fleetWait(world, b, goods, f?.seals ?? -1) : null;
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
