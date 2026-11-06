// Which building statuses are stalls and which are critical: pure, no i18n or DOM (so headless tests
// can rank stalls). Re-exported by format.ts.
import { GOODS, MARKET, TICK_HZ, buildingById, capacityOf, inputGoods, isMarket, marketOpen, reachable, outputSurplus, pricePct, type BuildingStatus, type Good, type ReasonLink, type WagonStatus } from '../sim/index';
import type { MessageKey } from '../i18n/index';
import type { World } from '../sim/index';

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
 * "rynek nasycony"), null — no market load at all (not the free valley, or nothing sellable). Pure read.
 */
export function granaryLoads(world: World, granaryId: number): 'wagon' | 'saturated' | null {
  if (!marketOpen(world)) return null;
  const g = world.state.buildings.find((q) => q.id === granaryId);
  if (!g || g.type !== 'warehouse') return null;
  let loads = false;
  for (const good of GOODS) {
    if (good === 'stone' || MARKET.base[good] <= 0) continue; // granary stone is building material
    if (g.stock[good] - g.reservedOut[good] < capacityOf(good)) continue;
    if (marketTakesLoad(world, good, g.gate)) return 'wagon';
    loads = true;
  }
  return loads ? 'saturated' : null;
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
