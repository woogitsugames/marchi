// Which building statuses are stalls and which are critical: pure, no i18n or DOM (so headless tests
// can rank stalls). Re-exported by format.ts.
import { BUILDINGS, GOODS, MARKET, TICK_HZ, buildingById, rankGated, capacityOf, inputGoods, isMarket, marketOpen, postOpen, reachable, tradePostOf, outputSurplus, pricePct, type BuildingStatus, type Good, type ReasonLink, type WagonStatus } from '../sim/index';
import type { MessageKey } from '../i18n/index';
import type { World } from '../sim/index';
import { memoryWorld } from './readWorld';

/** A building status counts as a stall worth a bubble. */
export function isStall(s: BuildingStatus): boolean {
  switch (s.k) {
    case 'NO_ROAD':
    case 'NO_INPUT':
    case 'NO_WAGON':
    case 'OUTPUT_FULL':
    case 'WAITING_PICKUP':
    case 'STORAGE_FULL':
      return true;
    default:
      return false;
  }
}

/**
 * Critical stalls get the wax-clay marker: nothing is on the way to fix them. `calm`: the stall
 * resolves by itself — a full output whose customer still takes the good (outputCustomer), or an
 * input a season slows (seasonalSupplier) — so it is never critical, however long it lasts.
 */
export function isCritical(s: BuildingStatus, stalledTicks: number, calm = false): boolean {
  if (calm) return false;
  if (s.k === 'NO_ROAD') return true;
  if (s.k === 'NO_INPUT' && s.cause === 'UNREACHABLE') return true;
  if (s.k === 'NO_WAGON' && s.cause === 'NONE_CAN_REACH') return true;
  if (s.k === 'OUTPUT_FULL' && s.cause === 'NO_DESTINATION') return true;
  return stalledTicks > 45 * TICK_HZ && s.k !== 'WAITING_PICKUP';
}

/** A wagon status that is a wait worth explaining (bubble, red status line, cause chain). */
export function isWagonWait(s: WagonStatus): boolean {
  return s.k === 'BRIDGE_JAM' || s.k === 'NO_ROUTE' || s.k === 'BRIDGE_CLOSED';
}

/** A link of a cause chain that is itself a stall (a building stall or NO_INPUT, a wagon wait). */
export function isStallLink(l: ReasonLink): boolean {
  return l.kind === 'building' ? isStall(l.status) || l.status.k === 'NO_INPUT' : isWagonWait(l.status);
}

/**
 * The link whose status the "Co to znaczy?" fold explains (audit 2026-11-03, fix 4): the last link of the
 * chain that is a stall — not a producer that is WORKING or a wagon on its way, which answer nothing about
 * "why does it stand?" — or the subject itself when no link is (a short or calm chain).
 */
export function codexLink(chain: readonly ReasonLink[], self: ReasonLink): ReasonLink {
  for (let i = chain.length - 1; i >= 0; i--) if (isStallLink(chain[i]!)) return chain[i]!;
  return self;
}

/**
 * What to do next time about the loss's #1 cause (first-10-minutes-c N3, D-130): one action line under the ledger
 * of a lost contract, from the cause's kind — never advice about something that already stands.
 */
export function lossActionKey(status: string): MessageKey {
  const [k, cause] = status.split('.');
  if (k === 'WAITING_PICKUP' || (k === 'NO_WAGON' && cause === 'ALL_BUSY') || (k === 'OUTPUT_FULL' && cause === 'NO_WAGON')) return 'end.act.wagon';
  if (k === 'NO_ROAD' || k === 'NO_ROUTE' || (k === 'NO_INPUT' && cause === 'UNREACHABLE') || (k === 'NO_WAGON' && cause === 'NONE_CAN_REACH')) return 'end.act.road';
  if (k === 'BRIDGE_JAM' || k === 'BRIDGE_CLOSED') return 'end.act.bridge';
  if (k === 'STORAGE_FULL' || (k === 'OUTPUT_FULL' && cause === 'NO_DESTINATION')) return 'end.act.granary';
  return 'end.act.other';
}

/**
 * The status title key: 'status.<k>' or 'status.<k>.<cause>'. With the building's `id`, a full yard nobody needs
 * right now reads as the calm surplus — the sheet below it says a new wagon would not help, so the title must not
 * say "no wagon to collect" (first-10-minutes-e N7, D-160).
 */
export function statusKey(s: BuildingStatus, world?: World, id = -1): MessageKey {
  // a granary full of loads no market takes now (D-174) is calm: "Spichlerz pełny — rynek nasycony" (D-180)
  if (s.k === 'STORAGE_FULL' && world && id >= 0 && granaryLoads(world, id) === 'saturated') return 'status.STORAGE_FULL.saturated';
  // a granary full of goods nobody wants now (D-212): calm "Spichlerz pełny — tego towaru nikt teraz nie potrzebuje"
  if (s.k === 'STORAGE_FULL' && world && id >= 0 && granaryUnwanted(world, id)) return 'status.STORAGE_FULL.unwanted';
  // D-454: a free-valley granary "full" of loads still on the way (D-393): the card says "zapełnia się", so the
  // sheet's title must not say "Spichlerz pełny" over "W spichlerzu: 11/60"
  if (s.k === 'STORAGE_FULL' && world && id >= 0 && granaryFilling(world, id)) return 'status.STORAGE_FULL.filling';
  if (s.k === 'OUTPUT_FULL' && s.cause === 'NO_WAGON' && world && id >= 0 && outputSurplus(world, id) === 'SPARE') return 'status.OUTPUT_FULL.surplus';
  const cause = 'cause' in s ? s.cause : null;
  return (cause ? `status.${s.k}.${cause}` : `status.${s.k}`) as MessageKey;
}

/**
 * D-174 (research valley-ranks-2-3, F3): will a market take one more wagon load of `good` now? Some market (the castle,
 * the trading post when open) keeps room for a load under its in-flight limit (MARKET.inflightPerGood, as the
 * dispatcher checks) and, at the castle, the price is above the floor. Otherwise another wagon would only wait.
 * `from` (a road cell, e.g. a granary's gate): only markets reachable by road from it count (D-233: an unlinked
 * trading post has room for every good, and the card kept offering "Kup wóz" for a granary nothing could empty).
 */
export function marketTakesLoad(world: World, good: Good, from = -1): boolean {
  const cap = capacityOf(good), st = world.state;
  for (const m of st.buildings) {
    if (!isMarket(world, m) || MARKET.inflightPerGood - m.incoming[good] < cap) continue;
    if (from >= 0 && !reachable(world, from, m.gate)) continue;
    if (m.type === 'castle' && pricePct(st.market.saturation[good]) <= MARKET.floorPct) continue;
    return true;
  }
  return false;
}

/**
 * What the free valley's loads in a granary say: 'wagon' — a full wagon load of a good some market takes now (another
 * wagon empties it), 'saturated' — loads only of goods the markets will not take more of (D-174: no "Kup wóz", a calm
 * "rynek nasycony"), 'pending' — only loads the next dispatch is about to book (D-630), null — no market load at all
 * (not the free valley, or nothing sellable). Reads (and keeps per world) when each load was first seen unbooked.
 */
export function granaryLoads(world: World, granaryId: number): 'wagon' | 'saturated' | 'pending' | null {
  if (!marketOpen(world)) return null;
  const g = world.state.buildings.find((q) => q.id === granaryId);
  if (!g || g.type !== 'warehouse') return null;
  const tick = world.state.tick;
  let seen = loadSeen.get(memoryWorld(world));
  if (!seen) loadSeen.set(memoryWorld(world), (seen = new Map()));
  let loads = false, pending = false;
  let ready: boolean | null = null;
  for (let i = 0; i < GOODS.length; i++) {
    const good = GOODS[i]!;
    if (good === 'stone' || MARKET.base[good] <= 0) continue; // granary stone is building material
    const key = granaryId * GOODS.length + i;
    if (g.stock[good] - g.reservedOut[good] < capacityOf(good)) { seen.delete(key); continue; }
    if (marketTakesLoad(world, good, g.gate)) {
      // D-630: a load just unloaded that the market takes, while a wagon without a job waits and the market's share
      // of the fleet is not used up, is booked by the next dispatch (every DISPATCH_INTERVAL ticks): spoken for, like
      // a reserved load — not a wagon short. Without this the granary, and the producer it refuses, flashed red for a
      // second ("Kup wóz" with a wagon standing idle) between two calm "rynek nasycony" reads. Only for
      // PENDING_LOAD_TICKS from when the load was first seen: a load the dispatcher still leaves (another source of
      // the good is nearer the market, dearer goods take the slots) needs a wagon after all.
      let first = seen.get(key);
      if (first === undefined || first > tick) seen.set(key, (first = tick));
      if (tick - first < PENDING_LOAD_TICKS && (ready ??= marketWagonReady(world, g.gate))) { pending = true; continue; }
      return 'wagon';
    }
    seen.delete(key);
    loads = true;
  }
  return loads ? 'saturated' : pending ? 'pending' : null;
}

/** D-630: how long an unbooked market load may wait for the dispatcher before it reads as a wagon short (2 s). */
const PENDING_LOAD_TICKS = 2 * TICK_HZ;
/** D-630: per world, granary id × good -> the tick its unbooked market load was first read. */
const loadSeen = new WeakMap<World, Map<number, number>>();

/**
 * D-630: the next dispatch can send a wagon from `gate` to a market — one without a job stands on the same road
 * network, and the market's share of the fleet (MARKET.wagonSharePct, counted as `dispatch` counts it) is not used
 * up. Pure read.
 */
export function marketWagonReady(world: World, gate: number): boolean {
  const st = world.state;
  if (!st.wagons.some((w) => !w.job && reachable(world, w.at, gate))) return false;
  let slots = Math.max(1, Math.floor((st.wagons.length * MARKET.wagonSharePct) / 100));
  for (const w of st.wagons) {
    if (!w.job) continue;
    const to = buildingById(world, w.job.to);
    if (to && isMarket(world, to)) slots--;
  }
  return slots > 0;
}

/**
 * D-245 (BACKLOG P2 from D-233): the trading post that would empty this saturated granary if a road reached it. The
 * granary reads "rynek nasycony" (no reachable market takes any of its full loads), the post is open (rank 4) but its
 * gate is not reachable from the granary's gate, and it keeps room under its in-flight limit for a good the granary
 * holds a full load of. Returns the post's id, or -1. Pure read.
 */
export function postWouldTake(world: World, granaryId: number): number {
  if (!postOpen(world)) return -1;
  const post = tradePostOf(world);
  const g = buildingById(world, granaryId);
  if (!post || !g || g.type !== 'warehouse' || reachable(world, g.gate, post.gate)) return -1;
  if (granaryLoads(world, granaryId) !== 'saturated') return -1;
  for (const good of GOODS) {
    if (good === 'stone' || MARKET.base[good] <= 0) continue;
    const cap = capacityOf(good);
    if (g.stock[good] - g.reservedOut[good] < cap) continue;
    if (MARKET.inflightPerGood - post.incoming[good] >= cap) return post.id;
  }
  return -1;
}

/**
 * D-393: a free-valley granary that reads STORAGE_FULL only because wagons already carry goods to it: what lies
 * there is under its cap, the rest is spoken for by loads on the way (a granary built a moment ago is "full" with 0
 * in stock). It is filling, not full — the room it brought is being used; another granary is no cure until it holds
 * its cap. Missions keep the plain reading.
 */
export function granaryFilling(world: World, granaryId: number): boolean {
  const g = buildingById(world, granaryId);
  if (!g || g.type !== 'warehouse' || g.status.k !== 'STORAGE_FULL' || !rankGated(world)) return false;
  const cap = g.capOverride >= 0 ? g.capOverride : BUILDINGS.warehouse.storeCap;
  let stock = 0, incoming = 0;
  for (const good of GOODS) { stock += g.stock[good]; incoming += g.incoming[good]; }
  // a load a market takes already lies there: that one still asks for a wagon (valley-3h proposal 2)
  return incoming > 0 && stock < cap && granaryLoads(world, granaryId) !== 'wagon';
}

/**
 * D-393: the free valley's granary a producer's full yard waits on (OUTPUT_FULL.NO_DESTINATION) while a fresh granary
 * still takes its first loads: one that is filling (granaryFilling) with under half its cap in stock. The room the
 * last granary brought is being taken right now; the card waits for it before naming another one (card-10 placed a
 * granary every 10 s, each one "full" of reservations the moment it stood). Its id, or -1.
 */
export function freshGranary(world: World, b: { status: BuildingStatus }): number {
  const s = b.status;
  if (s.k !== 'OUTPUT_FULL' || s.cause !== 'NO_DESTINATION' || !rankGated(world)) return -1;
  // a refusing granary full of loads a market takes needs a wagon (cureFor), not patience
  if (s.blockedBy >= 0 && granaryLoads(world, s.blockedBy) === 'wagon') return -1;
  const half = BUILDINGS.warehouse.storeCap / 2;
  for (const g of world.state.buildings) {
    if (g.type !== 'warehouse' || !granaryFilling(world, g.id)) continue;
    let stock = 0;
    for (const good of GOODS) stock += g.stock[good];
    if (stock < half) return g.id;
  }
  return -1;
}

/**
 * D-212 (owner 2026-11-06): a full granary (STORAGE_FULL) holding only goods that nothing wants now — the contract has
 * no unfilled need of them (any letter, not only the open one: the next letter's goods are still wanted), no building
 * on the map takes them as an input, no open market takes a load of them, and no granary keeps them as road stone.
 * Mission XV's small store full of fish is the case: the stall is real but nothing done to it helps the order, so it
 * reads calm (no repair, no wagon) — consistent with D-160/D-174/D-180/D-193. A producer of a wanted good refused by
 * such a granary still gets its own cure (another granary). Pure read.
 */
export function granaryUnwanted(world: World, granaryId: number): boolean {
  const g = buildingById(world, granaryId);
  if (!g || g.type !== 'warehouse' || g.status.k !== 'STORAGE_FULL') return false;
  const st = world.state, k = st.mission.contract;
  const castle = k ? buildingById(world, k.castle) : undefined;
  let any = false;
  for (const good of GOODS) {
    if (g.stock[good] <= 0) continue;
    any = true;
    if (k && k.need[good] > (castle?.stock[good] ?? 0)) return false;
    if (good === 'stone' && (st.mission.roadStone || marketOpen(world))) return false;
    if (MARKET.base[good] > 0 && marketTakesLoad(world, good, g.gate)) return false;
    for (const c of st.buildings) if (c.type !== 'warehouse' && inputGoods(c.type).includes(good)) return false;
  }
  return any;
}
