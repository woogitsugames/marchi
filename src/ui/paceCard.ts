// The pace card (day 8c): a slow contract is not a stall, so no building carries a StallReason for it,
// and the worst-stall card stayed empty or calm while the order ran late (mission VII: one fisher, the
// lesson only in the letter). When no real stall needs the card, it names what the forecast says holds the
// order back and leads to the cure. Calm, never red. Pure read of the sim and of the UI's pace log.
import {
  BUILDINGS, GOODS, MARKET, MISSIONS, cycleTicks, MAX_WAGONS, capacityOf, castleForecast, contractsOf, PACE_WINDOW_TICKS, WAGON_PRICE, inputGoods, isHeld, RAIN_COBBLE, SPEED_COBBLE, TICK_HZ, buildingById, canPlace, canSurface, cellSpeed, contractForecast,
  edgeLength, findPath, suggestLinkToStable, isRaining, missionBuildable, outputGoods, roadCellCost, sandboxStatus, thawing, trancheForecast, validateRoad,
  type Building, type BuildingType, type CastleForecast, type ContractForecast, type Good, type PaceLog, type RoadSuggestion, type World,
} from '../sim/index';
import { iceBeforeWagon } from './stalls';
import { postWouldTake } from './stallKinds';
import { GROW_FEEDS, goodSaturated } from './saturation';
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
  // two castles (D-290): the whole order (both castles; each castle's own deadline is read by castleForecastFor)
  const whole = !!st.mission.extraContracts;
  // an order with tranches is read tranche by tranche (BACKLOG P3, D-78): the forecast covers what the castle
  // must hold once the tranche now due is complete
  const cur = c.tranches.findIndex((x) => x.doneTick < 0);
  if (!whole && c.tranches.length > 0 && cur < 0) return null;
  let sum = 0;
  for (const k of whole ? contractsOf(st.mission) : [c]) {
    const q = buildingById(world, k.castle);
    if (q) for (const g of GOODS) if (k.need[g] > 0) sum = sum * 31 + q.stock[g] * 1000 + q.incoming[g];
  }
  const key = `${st.mapId}|${log.ticks[log.ticks.length - 1] ?? -1}|${st.netVersion}|${sum}|${st.buildings.length}|${cur}|${cur >= 0 && st.tick - (cur > 0 ? c.tranches[cur - 1]!.doneTick : 0) < PACE_WINDOW_TICKS}`;
  if (cache?.key !== key || cache.world !== world || cache.log !== log) cache = { world, log, key, f: cur >= 0 && !whole ? trancheForecast(world, log) : contractForecast(world, log) };
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
 * stands; bakery once a mill stands; fisher; quarry; D-250: charcoal burner; malthouse; brewery once a malthouse
 * stands). `producer` is the castle (the card's subject, its sheet holds the cure: the build tool with `type` picked,
 * the ghost by the castle; D-266: in a valley built up around the castle, the building the ghost opens by instead).
 * `sold`/`goods`: distinct goods sold / needed.
 */
export interface PaceRank {
  k: 'rank'; producer: number; type: BuildingType; good: Good; rank: number; sold: number; goods: number;
  /** D-380: the consumer that goes up right after `type` (one tap, two buildings), when silver covers both. */
  then?: BuildingType;
}

/**
 * 'grow' (D-192, research valley-ranks-2-3 F1) — the free valley from rank 1: the next rank lacks renown or flow (D-264;
 * the goods are sold) and silver lies unspent. The card names one more producer of a chain that already
 * stands, keeping the chain's ratios, while the chain's end good still fetches a fair price (D-265: when every chain is
 * saturated, a producer of a good never sold). `producer` is the castle (the card's subject; its sheet holds the cure:
 * the build tool with `type` picked, the ghost by the castle; D-266: or the building the ghost opens by). `good`:
 * the chain's end good; `n`: how many of `type` stand now; `renown`/`need`: renown now / for `rank`.
 */
export interface PaceGrow {
  k: 'grow'; producer: number; type: BuildingType; good: Good; n: number; rank: number; renown: number; need: number;
  /** D-380: the consumer that goes up right after `type` (one tap, two buildings), when silver covers both. */
  then?: BuildingType;
  /**
   * D-264: what the next rank still lacks — 'renown', or 'flow' (silver per minute; `flow`/`flowNeed`: best flow so
   * far / for `rank`). Flow is named whenever it is short (the rarer gate; renown may be short too).
   */
  short: 'renown' | 'flow'; flow: number; flowNeed: number;
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

/**
 * 'castle' (two castles, mission XVI, D-290) — a castle's order is forecast past its own deadline while another castle
 * takes the shared goods: they are split evenly (`share` 'even', no castle first) or the other castle is first
 * ('after'). `producer` is the late castle (the card's subject; its sheet holds the "this castle first" switch),
 * `rival` the castle that takes the goods, `lateTicks` how late, `firstTick` when it would be done if it went first.
 */
export interface PaceCastle {
  k: 'castle'; producer: number; rival: number; good: Good; share: 'even' | 'after'; lateTicks: number; firstTick: number; dueTick: number;
}

/**
 * 'haul' (two castles, mission XVI, D-307) — the fleet cannot keep the shared producer of the castles' good at work:
 * every wagon has been on the road for the last minute, none idles, the producer makes `rate` a minute of the `cap`
 * it could (its inputs could feed that much), and the whole order is forecast at `finishTick`, past the next seal's
 * `byTick` with time left for a new wagon to pay off. On a long castle leg the yard's pickup wait (the fleet card's
 * evidence) only shows minutes later, in bursts, when a wagon no longer pays off. `producer` is that producer (the
 * card's subject; its sheet offers "Kup wóz"), `seals` what the forecast earns, `aim` the seals in reach (= `seals` when
 * the forecast reaches them by less than HAUL_MARGIN_TICKS, D-313).
 */
export interface PaceHaul {
  k: 'haul'; good: Good; producer: number; type: BuildingType; wagons: number; rate: number; cap: number;
  finishTick: number; byTick: number; seals: number; aim: number;
}

export type PaceCard = PaceProducer | PaceMud | PaceFleet | PaceRank | PaceGrow | PacePost | PaceCastle | PaceHaul;

let castleCache: { world: World; log: PaceLog; key: string; f: Map<number, CastleForecast | null> } | null = null;

/**
 * Two castles (D-290): the forecast of one castle's order (castleForecast), recomputed only when a pace sample lands,
 * the network, a castle's stock or promised goods, or the "first" switch change. Null outside a two-castle mission.
 */
export function castleForecastFor(world: World, log: PaceLog, castle: number): CastleForecast | null {
  const st = world.state;
  if (!st.mission.extraContracts || st.mission.result !== 'running') return null;
  let sum = 0;
  for (const c of contractsOf(st.mission)) {
    const b = buildingById(world, c.castle);
    if (b) for (const g of GOODS) if (c.need[g] > 0) sum = sum * 31 + b.stock[g] * 1000 + b.incoming[g];
  }
  const key = `${st.mapId}|${log.ticks[log.ticks.length - 1] ?? -1}|${st.netVersion}|${sum}|${st.buildings.length}|${st.mission.firstCastle ?? -1}`;
  if (castleCache?.key !== key || castleCache.world !== world || castleCache.log !== log) castleCache = { world, log, key, f: new Map() };
  const f = castleCache.f;
  if (!f.has(castle)) f.set(castle, castleForecast(world, log, castle));
  return f.get(castle)!;
}

/** The 'castle' pace card (D-290): the castle whose own deadline falls first among those forecast late and not first. */
export function castleCard(world: World, log: PaceLog): PaceCastle | null {
  const m = world.state.mission;
  if (!m.extraContracts || m.result !== 'running') return null;
  const orders = [...contractsOf(m)].sort((a, b) => (a.tranches[0]?.deadlineTick ?? a.deadlineTick) - (b.tranches[0]?.deadlineTick ?? b.deadlineTick) || a.castle - b.castle);
  const chained = !!MISSIONS[m.id]?.chainPriority;
  for (const c of orders) {
    const fc = castleForecastFor(world, log, c.castle);
    // D-612: in a chain mission (XVII) only the whole chain first exempts a castle — its castle leg alone does not
    // move the shared input (the forecast's finish already says the even split), so the late castle keeps its card
    const first = chained ? !!m.chainFirst && m.firstCastle === c.castle : fc?.share === 'first';
    if (!fc || fc.done || first || fc.finishTick < 0 || fc.finishTick <= fc.dueTick) continue;
    const castle = buildingById(world, c.castle)!;
    const good = GOODS.find((g) => c.need[g] > castle.stock[g]) ?? GOODS.find((g) => c.need[g] > 0)!;
    // D-612: the other castle's chain goes first — "pierwszy jest …" even when it wants another good (the forecast's
    // share reads 'after' only when both castles want the same good), never "dzielony po równo"
    const share: 'after' | 'even' = chained ? (m.chainFirst && m.firstCastle !== undefined ? 'after' : 'even') : fc.share === 'after' ? 'after' : 'even';
    // mission XVII (D-358): the other castle wants another good made from the same input — its chain is the rival
    const rival = share === 'after' ? m.firstCastle! : orders.find((o) => o !== c && o.need[good] > 0)?.castle
      ?? (chained ? orders.find((o) => o !== c)?.castle ?? -1 : -1);
    if (rival < 0) continue;
    return { k: 'castle', producer: c.castle, rival, good, share, lateTicks: fc.finishTick - fc.dueTick, firstTick: fc.firstTick, dueTick: fc.dueTick };
  }
  return null;
}

/** A stretch shorter than this, or a gain below this, is not worth a card. */
const MUD_MIN_CELLS = 6;
const MUD_MIN_PCT = 15;

/**
 * The pace card for this forecast, or null. Generic: no mission names, only the forecast, the mission's
 * buildable list and the rank gate. `log`: the pace log (the two-castle card reads its own forecast from it).
 */
export function paceCard(world: World, f: ContractForecast | null, log: PaceLog | null = null): PaceCard | null {
  // two castles (D-290): a castle late on its own deadline because the other one takes the goods comes first — the
  // switch costs nothing and decides the lesson, and it is worth most in the first minutes
  const castle = log ? castleCard(world, log) : null;
  if (castle) return castle;
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
  const card = fleetCard(world, f) ?? haulCard(world, f) ?? mud ?? rank;
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
  // D-250: ranks 3-4 (the goods of rank 5). The charcoal burner first: the cheapest, and it burns the wood the
  // woodcutters pile up anyway; then the malthouse on the farms' grain; the brewery once a malthouse stands.
  ['charcoalBurner', 'woodcutter'], ['malthouse', 'farm'], ['brewery', 'malthouse'],
];

/** The free valley's rank card (D-152), or null. Shown also when silver is short (the sheet says how much). */
export function rankCard(world: World): PaceRank | null {
  const st = world.state;
  if (st.mission.contract || st.mission.result !== 'running') return null;
  const sb = sandboxStatus(world);
  if (!sb.market || !sb.next || sb.goodsSold >= sb.next.goods) return null;
  const castle = st.buildings.find((b) => b.type === 'castle');
  if (!castle) return null;
  const next = newProducer(world, castle.id, sb.unlocked);
  if (!next) return null;
  // D-380: the producer's own consumer, when the rank allows it and silver covers both (malthouse + brewery)
  const after = RANK_ORDER.find(([t, needs]) => needs === next.type && sb.unlocked.includes(t) && !st.buildings.some((b) => b.type === t))?.[0];
  const then = after && st.coins >= BUILDINGS[next.type].price + BUILDINGS[after].price ? after : undefined;
  return { k: 'rank', ...next, rank: sb.next.rank, sold: sb.goodsSold, goods: sb.next.goods, ...(then ? { then } : {}) };
}

/**
 * Where the ghost of `type` opens (D-266): by the castle while a site is left there (D-175); in a valley built up
 * around the castle, by a standing building of the same type, then by its input's maker, then by the stable. The id
 * of that building (the card's subject: its sheet holds the cure), or -1 when none has a site within the ghost's reach.
 */
function anchorFor(world: World, type: BuildingType, castle: number, maker: BuildingType | null): number {
  if (siteExists(world, type, castle)) return castle;
  const st = world.state;
  for (const t of [type, maker, 'stable' as BuildingType]) {
    if (!t) continue;
    for (const b of st.buildings) if (b.type === t && siteExists(world, type, b.id)) return b.id;
  }
  return -1;
}

/**
 * The next RANK_ORDER producer of a good never sold, whose type does not stand yet, whose input's maker stands and
 * which the rank allows, with a site a road reaches (anchorFor; D-175: else the next one); null when there is none.
 */
function newProducer(world: World, castle: number, unlocked: readonly BuildingType[]): { type: BuildingType; good: Good; producer: number } | null {
  const st = world.state;
  const has = (t: BuildingType): boolean => st.buildings.some((b) => b.type === t);
  for (const [type, needs] of RANK_ORDER) {
    const good = outputGoods(type)[0];
    if (!good || st.ledger.sold[good] > 0 || has(type) || (needs && !has(needs)) || !unlocked.includes(type)) continue;
    const producer = anchorFor(world, type, castle, needs);
    if (producer < 0) continue;
    return { type, good, producer };
  }
  return null;
}

/**
 * The grow card's chains (D-192): producers upstream first, and the rule that keeps each chain balanced — a raw
 * producer no sooner than its consumer (farm <= mill, woodcutter <= sawmill), a processor only behind a spare supplier
 * (mill < farm, bakery < mill, sawmill < woodcutter). The fisher is a chain of its own. D-251: the rank-5 chains too —
 * the charcoal burner on its own, malthouse <= brewery, brewery < malthouse.
 */
const GROW_CHAINS: readonly (readonly BuildingType[])[] = [
  ['farm', 'mill', 'bakery'], ['fisher'], ['woodcutter', 'sawmill'], ['charcoalBurner'], ['malthouse', 'brewery'],
];
const GROW_FED_BY: Partial<Record<BuildingType, BuildingType>> = { mill: 'farm', bakery: 'mill', sawmill: 'woodcutter', brewery: 'malthouse' };

/**
 * The free valley's grow card (D-192), or null. Shown only when the building is affordable with the fleet's silver
 * reserve left over (FLEET_FREE_KEEP): it spends silver that lies unused, never the last of it.
 */
export function growCard(world: World): PaceGrow | null {
  const st = world.state;
  if (st.mission.contract || st.mission.result !== 'running') return null;
  const sb = sandboxStatus(world);
  if (!sb.market || sb.rank < 1 || !sb.next) return null;
  // the goods are sold (the rank card covers missing goods) and renown or flow is still short: both grow only with
  // more producers (D-264: a valley held at rank 3 on flow alone showed nothing for 60+ min)
  if (sb.goodsSold < sb.next.goods || (sb.renown >= sb.next.renown && sb.bestFlow >= sb.next.flow)) return null;
  const castle = st.buildings.find((b) => b.type === 'castle');
  if (!castle) return null;
  const cnt = new Map<BuildingType, number>();
  for (const b of st.buildings) cnt.set(b.type, (cnt.get(b.type) ?? 0) + 1);
  const n = (t: BuildingType): number => cnt.get(t) ?? 0;
  let best: { type: BuildingType; good: Good; producer: number } | null = null;
  for (const chain of GROW_CHAINS) {
    // an existing chain only; its end good is what its most downstream standing building makes
    let last: BuildingType | null = null;
    for (const t of chain) if (n(t) > 0) last = t;
    if (!last) continue;
    const good = outputGoods(last)[0];
    if (!good || goodSaturated(world, good)) continue;
    for (const t of chain) {
      if (!sb.unlocked.includes(t)) continue;
      // D-267: a consumer the rank does not allow yet (the brewery before rank 4) leaves its supplier's good as the
      // chain's end: the malthouse grows on its own malt until the brewery may stand
      const feeds = GROW_FEEDS[t] && sb.unlocked.includes(GROW_FEEDS[t]!) ? GROW_FEEDS[t] : undefined, fedBy = GROW_FED_BY[t];
      if (feeds && n(feeds) > 0 && n(t) > n(feeds)) continue;
      if (feeds && n(feeds) === 0 && n(t) > 0) continue;
      if (fedBy && n(t) >= n(fedBy)) continue;
      if (best && n(t) >= n(best.type)) continue;
      // D-175: no site for the ghost (D-266: by the castle, else by its own kind, its supplier or the stable)
      const producer = anchorFor(world, t, castle.id, fedBy ?? null);
      if (producer < 0) continue;
      best = { type: t, good, producer };
    }
  }
  // D-265: every standing chain sells into a saturated market — a good the valley has never made fetches the full
  // price (the rank card's next producer, though the goods count is met: charcoal, malt, beer)
  if (!best) best = newProducer(world, castle.id, sb.unlocked);
  if (!best || st.coins < BUILDINGS[best.type].price + FLEET_FREE_KEEP) return null;
  const then = growThen(best.type, n, sb.unlocked, st.coins);
  return {
    ...(then ? { then } : {}),
    k: 'grow', producer: best.producer, type: best.type, good: best.good, n: n(best.type), rank: sb.next.rank, renown: sb.renown, need: sb.next.renown,
    short: sb.bestFlow < sb.next.flow ? 'flow' : 'renown', flow: sb.bestFlow, flowNeed: sb.next.flow,
  };
}

/**
 * D-380 (BACKLOG P2 from D-267): the grow card's second building — the chain's consumer of `type` (the brewery after
 * a malthouse, the mill after a farm), when one more `type` lets it grow by the same ratio rules and silver covers
 * both with the fleet's reserve left. A player who acts once a minute then grows a chain step in one tap.
 */
export function growThen(type: BuildingType, n: (t: BuildingType) => number, unlocked: readonly BuildingType[], coins: number): BuildingType | undefined {
  const next = GROW_FEEDS[type];
  if (!next || !unlocked.includes(next) || GROW_FED_BY[next] !== type) return undefined;
  // the consumer stays below its supplier after the supplier's +1 (brewery < malthouse)
  if (n(next) >= n(type) + 1) return undefined;
  // and the consumer's own consumer keeps up with it (mill <= bakery once a bakery stands)
  const after = GROW_FEEDS[next];
  if (after && unlocked.includes(after) && (n(after) > 0 ? n(next) > n(after) : n(next) > 0)) return undefined;
  if (coins < BUILDINGS[type].price + BUILDINGS[next].price + FLEET_FREE_KEEP) return undefined;
  return next;
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

/**
 * The fleet-wide part of the fleet card's rule; the goods of the bottleneck chain when it holds, else null. `aim`: the
 * seal the wagon aims at (default: the forecast's next better seal).
 */
function fleetGate(world: World, f: ContractForecast | null, aim: { byTick: number } | null = f?.aim ?? null): Set<Good> | null {
  const st = world.state;
  if (st.mission.result !== 'running') return null;
  if (!st.mission.contract) return freeFleetGate(world);
  if (!f || !f.ready || f.bottleneck < 0) return null;
  // a better seal is still in reach, with time for a new wagon to pay off before it
  if (!aim || aim.byTick - st.tick < FLEET_ROOM_TICKS) return null;
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

/**
 * Two castles (D-313): the whole-order forecast holds to within this much of the run's finish from 1:10 on
 * (tools/m16-forecast-error.ts), so a seal it reaches by less is not yet safe.
 */
export const HAUL_MARGIN_TICKS = 30 * TICK_HZ;

/**
 * The seal the haul card aims at (D-313): the forecast's next better seal, else the seal it earns when its finish
 * lies within HAUL_MARGIN_TICKS of that seal's time (the forecast may be that early). Null otherwise.
 */
function haulAim(world: World, f: ContractForecast | null): { seals: number; byTick: number } | null {
  if (!f || !f.ready) return null;
  if (f.aim) return f.aim;
  const c = world.state.mission.contract!;
  const byTick = f.seals === 3 ? c.star3Tick : f.seals === 2 ? c.star2Tick : -1;
  return byTick >= 0 && f.finishTick + HAUL_MARGIN_TICKS > byTick ? { seals: f.seals, byTick } : null;
}

/** The shared producer counts as held back by the fleet below this share of what its chain could make (D-307). */
export const HAUL_RATE_SHARE = 0.9;

/**
 * The two-castle haul card (D-307), or null: a two-castle mission only (the castle switch card comes first), with the
 * fleet card's gate (a better seal in reach with FLEET_ROOM_TICKS to spare, a wagon buyable, none idle, the fleet on
 * the road the whole last minute), and the bottleneck good's producers making less than HAUL_RATE_SHARE of their
 * capacity while their inputs could feed that capacity.
 */
export function haulCard(world: World, f: ContractForecast | null): PaceHaul | null {
  const st = world.state;
  if (!st.mission.extraContracts || !st.mission.contract) return null;
  const aim = haulAim(world, f);
  const chain = fleetGate(world, f, aim);
  if (!chain || !f || !aim) return null;
  const b = f.goods[f.bottleneck]!;
  if (b.toMake <= 0 || b.producer < 0 || !b.producerType || b.perMin < 0 || b.perMin >= HAUL_RATE_SHARE * b.capPerMin) return null;
  // the inputs could feed the producers flat out (else more makers, not wagons, would help)
  const r = BUILDINGS[b.producerType].recipe!;
  for (const g of GOODS) {
    const per = (r.inputs[g] ?? 0) / (r.outputs[b.good] ?? 1);
    if (per <= 0) continue;
    let cap = 0;
    for (const p of st.buildings) {
      const pr = BUILDINGS[p.type].recipe;
      if (pr && outputGoods(p.type).includes(g)) cap += (pr.outputs[g] ?? 0) * 60 * TICK_HZ / cycleTicks(world, p.type, pr.ticks);
    }
    if (cap < per * b.capPerMin) return null;
  }
  return {
    k: 'haul', good: b.good, producer: b.producer, type: b.producerType, wagons: st.wagons.length, rate: b.perMin, cap: b.capPerMin,
    finishTick: f.finishTick, byTick: aim.byTick, seals: f.seals, aim: aim.seals,
  };
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
